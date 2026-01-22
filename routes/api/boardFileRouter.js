const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client, BUCKET_NAME, generateMultimediaKey, moveFromTempToPermanent, deleteFromS3 } = require('../../lib_board/s3Utils');
const { authenticateUser } = require('../../lib_login/authMiddleware');
const { queryDatabase } = require('../../lib_login/db');
const { canUpload, increaseUsage, recordFile } = require('../../lib_storage/quotaChecker');
const { formatBytes } = require('../../lib_storage/storagePolicy');
const path = require('path');

// 🔧 Multer S3 Configuration for Multimedia Uploads (Temp)
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        acl: 'public-read',
        key: function (req, file, cb) {
            const ext = path.extname(file.originalname);
            // Default to 'blog' context if not specified (or 'center')
            // Frontend should ensure context passed, but we use 'blog' for now as default
            const context = req.body.context || 'blog';
            const key = generateMultimediaKey(context, ext, true); // true = isTemp
            cb(null, key);
        }
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        // Allow images, videos, audio, documents
        // Expand as needed
        cb(null, true);
    }
});

/**
 * POST /api/board/files/upload
 * Upload file to generic temp storage (board_temp_files)
 */
router.post('/upload', authenticateUser, async (req, res) => {
    // Wrap multer to handle errors
    const uploadSingle = upload.single('file');

    uploadSingle(req, res, async (err) => {
        if (err) {
            console.error('Upload Error:', err);
            return res.status(500).json({ error: 'File upload failed: ' + err.message });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file provided' });
            }

            const userId = req.session.userID;
            const context = req.body.context || 'blog'; // 'blog' or 'center'
            const fileCategory = req.body.category || 'file'; // image, video, file...

            // 1. Quota Check
            const [user] = await queryDatabase('SELECT id, centerID FROM Users WHERE userID = ?', [userId]);
            const quotaCheck = await canUpload(user.id, user.centerID, req.file.size);

            if (!quotaCheck.allowed) {
                // Delete the uploaded file from S3 immediately
                await deleteFromS3(req.file.key);
                return res.status(413).json({ error: quotaCheck.message });
            }

            // 2. Insert into board_temp_files
            const fileType = req.file.mimetype;
            const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8'); // Fix encoding if needed

            // Map mimetype to category if not provided
            let category = 'file';
            if (fileType.startsWith('image/')) category = 'image';
            else if (fileType.startsWith('video/')) category = 'video';
            else if (fileType.startsWith('audio/')) category = 'audio';

            const result = await queryDatabase(`
                INSERT INTO board_temp_files 
                (user_id, temp_key, original_name, file_size, file_type, file_category, s3_url, is_permanent)
                VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)
            `, [
                user.id,
                req.file.key,
                originalName,
                req.file.size,
                fileType,
                category,
                req.file.location
            ]);

            // 3. Update Storage Usage (Temp usage counts too?) 
            // Usually we count usage. If it expires, we decrease it.
            await increaseUsage(user.id, user.centerID, req.file.size, 'blog');

            res.json({
                success: true,
                file: {
                    id: result.insertId,
                    url: req.file.location,
                    key: req.file.key,
                    originalName: originalName,
                    size: req.file.size,
                    category: category
                }
            });

        } catch (error) {
            console.error('File Processing Error:', error);
            // Verify if file was uploaded and try to delete it?
            if (req.file && req.file.key) {
                await deleteFromS3(req.file.key).catch(e => console.error('Cleanup error:', e));
            }
            res.status(500).json({ error: 'Server error during file processing' });
        }
    });
});

/**
 * POST /api/board/files/finalize
 * Confirm files used in a post (Move S3 temp -> perm, Update DB)
 */
router.post('/finalize', authenticateUser, async (req, res) => {
    try {
        const { fileIds, postId, blogType } = req.body; // fileIds: [] of board_temp_files IDs
        const userId = req.session.userID;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.json({ success: true, message: 'No files to finalize' });
        }

        const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);

        const processedFiles = [];
        const failedFiles = [];

        for (const tempFileId of fileIds) {
            try {
                // 1. Get temp file info
                const [tempFile] = await queryDatabase('SELECT * FROM board_temp_files WHERE id = ? AND user_id = ?', [tempFileId, user.id]);

                if (!tempFile || tempFile.is_permanent) {
                    continue; // Already processed or not own file
                }

                // 2. Move S3 Object
                // Detect type from key path or use passed context. 
                // tempFile.temp_key is like 'blog/temp/uuid.ext'

                const permanentKey = await moveFromTempToPermanent(tempFile.temp_key);
                const permanentUrl = req.protocol + '://' + req.get('host').replace('api.', 's3.') + '/' + permanentKey; // Simplify or use config S3 URL
                // Better use tempFile.s3_url logic but replaced key

                // 3. Insert into blog_post_files (Permanent Record)
                // Assuming we are finalizing for a blog post.
                // If it's for something else, we might need a different table.
                // For now, based on Phase 3, it's likely blog_post_files.

                if (postId) {
                    await queryDatabase(`
                        INSERT INTO blog_post_files 
                        (post_id, user_id, s3_key, s3_url, original_name, file_size, file_type, file_category, is_temp)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)
                    `, [
                        postId,
                        user.id,
                        permanentKey,
                        tempFile.s3_url.replace(tempFile.temp_key, permanentKey), // Simple URL replacement
                        tempFile.original_name,
                        tempFile.file_size,
                        tempFile.file_type,
                        tempFile.file_category
                    ]);
                }

                // 4. Update board_temp_files (Mark as permanent or Delete?)
                // Strategy: Mark as permanent so it's not cleaned up by cron, 
                // OR delete from board_temp_files since it's now in blog_post_files.
                // Given `is_permanent` column, marking it seems safer for now, or just delete row.
                // Let's delete it to keep temp table clean?
                // Actually the `board_temp_files` schema has `is_permanent`. 
                // Let's update it.
                await queryDatabase('UPDATE board_temp_files SET is_permanent = TRUE, post_id = ? WHERE id = ?', [postId || null, tempFileId]);

                processedFiles.push({ id: tempFileId, key: permanentKey });

            } catch (e) {
                console.error(`Failed to finalize file ${tempFileId}:`, e);
                failedFiles.push(tempFileId);
            }
        }

        res.json({
            success: true,
            processed: processedFiles.length,
            failed: failedFiles
        });

    } catch (error) {
        console.error('Finalize Error:', error);
        res.status(500).json({ error: 'Finalize failed' });
    }
});

module.exports = router;
