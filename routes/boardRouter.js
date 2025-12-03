const express = require('express');
const router = express.Router();
const db = require('../lib_login/db');
const { authenticateUser } = require('../lib_login/authMiddleware');

console.log('BoardRouter 로드됨');

// 날짜 포맷 함수
function formatDate(date) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// 권한 체크 함수
function checkWritePermission(userRole, category) {
    const permissions = {
        'notice': ['admin', 'manager'],
        'education': ['admin', 'manager', 'teacher'],
        'free': ['admin', 'manager', 'teacher', 'student']
    };
    
    return permissions[category]?.includes(userRole) || false;
}

// 🔥 첨부파일 헬퍼 함수들
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileTypeClass(mimeType, filename) {
    const extension = filename.split('.').pop().toLowerCase();
    
    if (mimeType && mimeType.startsWith('image/')) {
        return 'image';
    }
    
    if (mimeType === 'application/pdf' || extension === 'pdf') {
        return 'pdf';
    }
    
    if (mimeType && (mimeType.includes('word') || mimeType.includes('wordprocessingml')) || 
        ['doc', 'docx'].includes(extension)) {
        return 'word';
    }
    
    if (mimeType && (mimeType.includes('excel') || mimeType.includes('spreadsheetml')) || 
        ['xls', 'xlsx'].includes(extension)) {
        return 'excel';
    }
    
    if (mimeType && (mimeType.includes('powerpoint') || mimeType.includes('presentationml')) || 
        ['ppt', 'pptx'].includes(extension)) {
        return 'powerpoint';
    }
    
    if (mimeType && (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) || 
        ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
        return 'archive';
    }
    
    if (mimeType && mimeType.includes('text') || 
        ['txt', 'rtf', 'md'].includes(extension)) {
        return 'document';
    }
    
    return 'other';
}

function getFileIcon(mimeType, filename) {
    const fileType = getFileTypeClass(mimeType, filename);
    
    switch (fileType) {
        case 'image': return 'bi-image';
        case 'pdf': return 'bi-file-earmark-pdf';
        case 'word': return 'bi-file-earmark-word';
        case 'excel': return 'bi-file-earmark-excel';
        case 'powerpoint': return 'bi-file-earmark-ppt';
        case 'archive': return 'bi-file-earmark-zip';
        case 'document': return 'bi-file-earmark-text';
        default: return 'bi-file-earmark';
    }
}

// 게시판 메인 페이지
router.get('/', async (req, res) => {
    try {
        console.log('게시판 메인 페이지 요청');
        res.render('board/board_index', {
            categoryData: {
                notice: [],
                education: [],
                free: []
            },
            userID: req.session.userID,
            role: req.session.role,
            is_logined: req.session.is_logined
        });
    } catch (error) {
        console.error('게시판 메인 페이지 오류:', error);
        res.status(500).send('서버 오류가 발생했습니다.');
    }
});

// 🔥 통합 글쓰기 페이지 (공용 컴포넌트) - 카테고리 라우터보다 먼저 위치
router.get('/write', async (req, res) => {
    try {
        const defaultCategory = req.query.category;
        let categoryInfo = null;
        
        if (defaultCategory) {
            const categoryData = await db.queryDatabase(
                'SELECT * FROM board_categories WHERE slug = ?',
                [defaultCategory]
            );
            
            if (categoryData.length > 0) {
                categoryInfo = categoryData[0];
            }
        }
        
        res.render('board/write', {
            category: categoryInfo,
            mode: 'write',
            userID: req.session.userID,
            role: req.session.role,
            is_logined: req.session.is_logined,
            canSetNotice: ['admin', 'manager'].includes(req.session.role)
        });
        
    } catch (error) {
        console.error('통합 글쓰기 페이지 오류:', error);
        res.status(500).send('서버 오류가 발생했습니다.');
    }
});

// 카테고리별 게시글 목록
router.get('/:category', async (req, res) => {
    try {
        console.log('=== 카테고리별 목록 요청 ===');
        console.log('카테고리:', req.params.category);
        
        const { category } = req.params;
        
        // 카테고리 정보 가져오기
        const categoryInfo = await db.queryDatabase(
            'SELECT * FROM board_categories WHERE slug = ?', 
            [category]
        );
        
        if (categoryInfo.length === 0) {
            return res.status(404).send('존재하지 않는 게시판입니다.');
        }
        
        console.log('카테고리 정보:', categoryInfo[0]);
        
        const categoryId = categoryInfo[0].id;
        console.log('카테고리 ID:', categoryId);
        
        const posts = await db.queryDatabase(`
            SELECT 
                id, title, author, views, is_pinned, is_notice, created_at
            FROM board_posts 
            WHERE category_id = ?
            ORDER BY is_pinned DESC, is_notice DESC, created_at DESC
            LIMIT 20
        `, [categoryId]);
        
        console.log('조회된 게시글 수:', posts.length);
        
        const formattedPosts = posts.map(post => ({
            ...post,
            created_at: formatDate(post.created_at),
            category_name: categoryInfo[0].name,
            attachment_count: 0,
            has_attachment: false
        }));
        
        const totalPosts = posts.length;
        
        res.render('board/list', {
            category: categoryInfo[0],
            posts: formattedPosts,
            currentPage: 1,
            totalPages: 1,
            totalPosts,
            search: '',
            searchType: 'title',
            userID: req.session.userID,
            role: req.session.role,
            is_logined: req.session.is_logined,
            canWrite: checkWritePermission(req.session.role, category)
        });
        
        console.log('렌더링 완료!');
        
    } catch (error) {
        console.error('=== 게시글 목록 조회 오류 ===');
        console.error('오류 메시지:', error.message);
        console.error('오류 스택:', error.stack);
        res.status(500).send(`서버 오류: ${error.message}`);
    }
});

// 🔥 게시글 수정 페이지 라우트
router.get('/:category/:id(\\d+)/edit', async (req, res) => {
    try {
        const { category, id } = req.params;
        
        console.log('=== 게시글 수정 페이지 ===');
        console.log('카테고리:', category);
        console.log('게시글 ID:', id);
        
        // 게시글 정보 조회
        const posts = await db.queryDatabase(`
            SELECT bp.*, bc.name as category_name, bc.slug as category_slug
            FROM board_posts bp
            LEFT JOIN board_categories bc ON bp.category_id = bc.id
            WHERE bp.id = ?
        `, [id]);
        
        if (posts.length === 0) {
            return res.status(404).send('게시글을 찾을 수 없습니다.');
        }
        
        const post = posts[0];
        
        // 권한 확인 - 본인 글이거나 관리자/매니저만 수정 가능
        const canEdit = req.session.userID === post.author || ['admin', 'manager'].includes(req.session.role);
        
        if (!canEdit) {
            return res.status(403).send('게시글 수정 권한이 없습니다.');
        }
        
        // 카테고리 정보 가져오기
        const categoryInfo = await db.queryDatabase(
            'SELECT * FROM board_categories WHERE slug = ?',
            [category]
        );
        
        if (categoryInfo.length === 0) {
            return res.status(404).send('존재하지 않는 게시판입니다.');
        }
        
        res.render('board/write', {
            category: categoryInfo[0],
            post: post, // 기존 게시글 데이터 전달
            mode: 'edit', // 수정 모드
            userID: req.session.userID,
            role: req.session.role,
            is_logined: req.session.is_logined,
            canSetNotice: ['admin', 'manager'].includes(req.session.role)
        });
        
        console.log('수정 페이지 렌더링 완료!');
        
    } catch (error) {
        console.error('=== 게시글 수정 페이지 오류 ===');
        console.error('오류 메시지:', error.message);
        console.error('오류 스택:', error.stack);
        res.status(500).send(`서버 오류: ${error.message}`);
    }
});

// 게시글 상세보기
router.get('/:category/:id(\\d+)', async (req, res) => {
    try {
        const { category, id } = req.params;
        
        console.log('=== 게시글 상세보기 ===');
        console.log('카테고리:', category);
        console.log('게시글 ID:', id);
        
        // 조회수 증가
        await db.queryDatabase(
            'UPDATE board_posts SET views = views + 1 WHERE id = ?',
            [id]
        );
        
        // 게시글 정보 조회
        const posts = await db.queryDatabase(`
            SELECT bp.*, bc.name as category_name, bc.slug as category_slug
            FROM board_posts bp
            LEFT JOIN board_categories bc ON bp.category_id = bc.id
            WHERE bp.id = ?
        `, [id]);
        
        if (posts.length === 0) {
            return res.status(404).send('게시글을 찾을 수 없습니다.');
        }
        
        const postData = posts[0];
        console.log('조회된 게시글 데이터:', postData);
        
        // 첨부파일 조회
        const attachments = await db.queryDatabase(`
            SELECT * FROM board_attachments 
            WHERE post_id = ? 
            ORDER BY created_at ASC
        `, [id]);
        
        console.log('조회된 첨부파일 수:', attachments.length);
        
        const post = {
            ...postData,
            created_at: formatDate(postData.created_at),
            updated_at: formatDate(postData.updated_at),
            category_name: postData.category_name || category,
            category_slug: postData.category_slug || category,
            author_name: postData.author || '익명',
            views: postData.views || 0
        };
        
        // 권한 확인
        const canEdit = req.session.userID === postData.author || ['admin', 'manager'].includes(req.session.role);
        const canDelete = req.session.userID === postData.author || ['admin', 'manager'].includes(req.session.role);
        
        res.render('board/view', {
            post,
            attachments: attachments,
            canEdit,
            canDelete,
            userID: req.session.userID,
            role: req.session.role,
            is_logined: req.session.is_logined,
            // 🔥 헬퍼 함수들을 템플릿에서 사용할 수 있도록 전달
            formatFileSize: formatFileSize,
            getFileTypeClass: getFileTypeClass,
            getFileIcon: getFileIcon
        });
        
        console.log('렌더링 완료!');
        
    } catch (error) {
        console.error('=== 게시글 상세보기 오류 ===');
        console.error('오류 메시지:', error.message);
        console.error('오류 스택:', error.stack);
        res.status(500).send(`서버 오류: ${error.message}`);
    }
});

// 기존 카테고리별 글쓰기 페이지 (호환성 유지)
router.get('/:category/write', async (req, res) => {
    try {
        const { category } = req.params;
        
        // 권한 체크
        if (!checkWritePermission(req.session.role, category)) {
            return res.status(403).send('글쓰기 권한이 없습니다.');
        }
        
        // 카테고리 정보 가져오기
        const categoryInfo = await db.queryDatabase(
            'SELECT * FROM board_categories WHERE slug = ?',
            [category]
        );
        
        if (categoryInfo.length === 0) {
            return res.status(404).send('존재하지 않는 게시판입니다.');
        }
        
        res.render('board/write', {
            category: categoryInfo[0],
            mode: 'write',
            userID: req.session.userID,
            role: req.session.role,
            is_logined: req.session.is_logined,
            canSetNotice: ['admin', 'manager'].includes(req.session.role)
        });
        
    } catch (error) {
        console.error('글쓰기 페이지 오류:', error);
        res.status(500).send('서버 오류가 발생했습니다.');
    }
});

module.exports = router;