/**
 * Extension API Router
 *
 * 코딩앤플레이 확장프로그램 전용 API
 * - Presigned URL 기반 S3 업로드
 * - 제출 정보 저장
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../lib_login/authMiddleware');
const db = require('../../lib_login/db');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { fromEnv } = require('@aws-sdk/credential-provider-env');
const config = require('../../config');

// S3 Client 설정
const s3Client = new S3Client({
  region: config.S3.REGION,
  credentials: fromEnv()
});

// ============================================
// GET /api/extension/mission/:missionId
// 과제 정보 조회
// ============================================
router.get('/mission/:missionId', authenticateUser, async (req, res) => {
  try {
    const { missionId } = req.params;

    // 과제 정보 조회 (실제 DB 스키마에 맞게 수정 필요)
    // 여기서는 예시로 간단한 쿼리를 작성합니다
    const [mission] = await db.queryDatabase(`
      SELECT
        id as missionId,
        title,
        description,
        platform,
        template_url as templateUrl,
        due_date as dueDate
      FROM Missions
      WHERE id = ?
    `, [missionId]);

    if (!mission) {
      return res.status(404).json({
        success: false,
        error: 'Mission not found'
      });
    }

    res.json({
      success: true,
      data: mission
    });

  } catch (error) {
    console.error('[Extension] Mission info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mission info'
    });
  }
});

// ============================================
// POST /api/extension/upload-url
// S3 Presigned URL 발급
// ============================================
router.post('/upload-url', authenticateUser, async (req, res) => {
  try {
    const { platform, missionId, userId, fileName, fileType } = req.body;
    const sessionUserId = req.session.userID;

    // Validation
    if (!platform || !missionId || !userId || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // 권한 확인 (자신의 과제만 제출 가능)
    if (sessionUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // S3 Key 생성
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
    const s3Key = `${platform}/${userId}/${missionId}/${sanitizedFileName.replace(/\.[^.]+$/, '')}_${timestamp}${fileName.match(/\.[^.]+$/)?.[0] || ''}`;

    // Presigned URL 생성 (1시간 유효)
    const command = new PutObjectCommand({
      Bucket: config.S3.BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType || 'application/octet-stream'
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600 // 1시간
    });

    res.json({
      success: true,
      data: {
        uploadUrl,
        s3Key,
        expiresIn: 3600
      }
    });

  } catch (error) {
    console.error('[Extension] Upload URL generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate upload URL'
    });
  }
});

// ============================================
// POST /api/extension/submit
// 제출 정보 저장
// ============================================
router.post('/submit', authenticateUser, async (req, res) => {
  try {
    const {
      platform,
      missionId,
      userId,
      projectUrl,
      projectId,
      s3Key,
      fileName,
      submittedAt
    } = req.body;

    const sessionUserId = req.session.userID;
    const centerId = req.session.centerID;

    // Validation
    if (!platform || !missionId || !userId || !s3Key || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // 권한 확인
    if (sessionUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // 사용자 DB ID 조회
    const [user] = await db.queryDatabase(`
      SELECT id FROM Users WHERE userID = ?
    `, [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userDbId = user.id;

    // S3 URL 생성
    const s3Url = `https://${config.S3.BUCKET_NAME}.s3.${config.S3.REGION}.amazonaws.com/${s3Key}`;

    // 메타데이터 생성
    const metadata = {
      platform,
      missionId,
      projectUrl,
      projectId,
      fileName,
      submittedAt: submittedAt || new Date().toISOString(),
      submissionSource: 'extension'
    };

    // DB에 제출 정보 저장
    const result = await db.queryDatabase(`
      INSERT INTO ProjectSubmissions (
        user_id,
        center_id,
        platform,
        project_name,
        s3_url,
        metadata,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [
      userDbId,
      centerId,
      platform,
      fileName.replace(/\.[^.]+$/, ''), // 확장자 제거
      s3Url,
      JSON.stringify(metadata)
    ]);

    const submissionId = result.insertId;

    res.json({
      success: true,
      data: {
        submissionId,
        s3Url,
        message: '제출이 완료되었습니다.'
      }
    });

  } catch (error) {
    console.error('[Extension] Submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save submission'
    });
  }
});

// ============================================
// GET /api/extension/submissions
// 제출 내역 조회
// ============================================
router.get('/submissions', authenticateUser, async (req, res) => {
  try {
    const userId = req.session.userID;
    const { platform, missionId } = req.query;

    // 사용자 DB ID 조회
    const [user] = await db.queryDatabase(`
      SELECT id FROM Users WHERE userID = ?
    `, [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // 쿼리 조건 구성
    let whereConditions = ['user_id = ?'];
    let params = [user.id];

    if (platform) {
      whereConditions.push('platform = ?');
      params.push(platform);
    }

    if (missionId) {
      whereConditions.push('JSON_EXTRACT(metadata, "$.missionId") = ?');
      params.push(missionId);
    }

    // 제출 내역 조회
    const submissions = await db.queryDatabase(`
      SELECT
        id as submissionId,
        platform,
        project_name as projectName,
        s3_url as s3Url,
        metadata,
        created_at as createdAt
      FROM ProjectSubmissions
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY created_at DESC
    `, params);

    res.json({
      success: true,
      data: submissions.map(sub => ({
        ...sub,
        metadata: typeof sub.metadata === 'string' ? JSON.parse(sub.metadata) : sub.metadata
      }))
    });

  } catch (error) {
    console.error('[Extension] Submissions query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch submissions'
    });
  }
});

module.exports = router;
