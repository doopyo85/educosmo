/**
 * 🔥 S3 브라우저 API 라우터
 * 권한 기반 파일 탐색 API
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const S3Manager = require('../../lib_storage/s3Manager');  // 🔥 클래스 import
const s3Manager = new S3Manager();  // 🔥 인스턴스 생성
const db = require('../../lib_login/db');
const { authenticateUser } = require('../../lib_login/authMiddleware');

/**
 * 🔥 한글 파일명 디코딩 함수
 * multer가 Latin-1로 인코딩한 파일명을 UTF-8로 복원
 */
function decodeFileName(filename) {
  try {
    // Latin-1 → Buffer → UTF-8 변환
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch (error) {
    console.error('파일명 디코딩 실패:', error);
    return filename; // 실패 시 원본 반환
  }
}

// 🔥 Multer 설정 (메모리 저장)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10 // 최대 10개 파일
  },
  fileFilter: (req, file, cb) => {
    // 🔥 한글 파일명 디코딩
    file.originalname = decodeFileName(file.originalname);

    // 허용 확장자
    const allowedExts = ['.ent', '.sb3', '.sb2', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.zip', '.html', '.js', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`허용되지 않는 파일 형식입니다: ${ext}`));
    }
  }
});

/**
 * GET /api/s3/browse
 * S3 폴더/파일 목록 조회 (권한별 자동 필터링)
 */
router.get('/browse', authenticateUser, async (req, res) => {
  try {
    let { prefix = '', platform } = req.query;
    const userRole = req.session.role;
    const userID = req.session.userID;
    const centerID = req.session.centerID;

    console.log(`📂 S3 Browse 요청 - Role: ${userRole}, Prefix: "${prefix}"`);

    // 🔥 Root 경로 접근 차단 및 리다이렉트
    if (!prefix || prefix === '' || prefix === '/' || prefix === 'Root') {
      if (userRole !== 'admin') {
        // manager/teacher는 users/로 리다이렉트 (학생 파일 목록을 보기 위해)
        if (userRole === 'manager' || userRole === 'teacher') {
          console.log(`🔄 ${userRole} Root 접근 시도 → users/ 리다이렉트`);
          return res.json({
            success: true,
            redirect: true,
            redirectPath: 'users/',
            message: '소속 학생 폴더로 이동합니다.',
            currentPath: 'users/',
            breadcrumbs: [
              { name: 'Root', path: '' },
              { name: 'users', path: 'users/' }
            ],
            folders: [],
            files: []
          });
        }
        // student도 users/로 리다이렉트 (본인 폴더와 선생님 폴더를 보기 위해)
        else if (userRole === 'student') {
          console.log(`🔄 Student Root 접근 시도 → users/ 리다이렉트`);
          return res.json({
            success: true,
            redirect: true,
            redirectPath: 'users/',
            message: '내 폴더로 이동합니다.',
            currentPath: 'users/',
            breadcrumbs: [
              { name: 'Root', path: '' },
              { name: 'users', path: 'users/' }
            ],
            folders: [],
            files: []
          });
        } else {
          return res.status(403).json({
            success: false,
            error: 'Root 경로 접근 권한이 없습니다.'
          });
        }
      }
    }

    // 🔥 manager/teacher의 users/ 외부 접근 차단
    if ((userRole === 'manager' || userRole === 'teacher') && prefix && !prefix.startsWith('users/')) {
      console.log(`❌ ${userRole} users/ 외부 접근 차단: ${prefix}`);
      return res.status(403).json({
        success: false,
        error: 'users/ 하위 경로만 접근 가능합니다.'
      });
    }

    // 🔥 student의 접근 제어 (본인 폴더 + 선생님 폴더 허용)
    if (userRole === 'student' && prefix && prefix !== 'users/') {
      // 본인 폴더 경로
      const myPath = `users/${userID}/`;

      // 허용 여부 체크를 위해 선생님 목록 조회
      // (일단 prefix가 users/로 시작하는지 확인)
      if (!prefix.startsWith('users/')) {
        return res.status(403).json({
          success: false,
          error: 'users/ 하위 경로만 접근 가능합니다.'
        });
      }

      // 접근하려는 사용자의 ID 추출 (users/{targetID}/...)
      const parts = prefix.split('/');
      const targetID = parts[1]; // users/ 다음에 오는 ID

      if (targetID && targetID !== userID) {
        // 본인이 아닌 경우, 해당 targetID가 같은 센터의 관리자(teacher/manager)인지 확인
        const [manager] = await db.queryDatabase(
          'SELECT id FROM Users WHERE userID = ? AND centerID = ? AND role IN ("teacher", "manager")',
          [targetID, centerID]
        );

        if (!manager) {
          console.log(`❌ Student 허용되지 않은 폴더 접근 차단: ${prefix}`);
          return res.status(403).json({
            success: false,
            error: '접근 권한이 없는 폴더입니다.'
          });
        }
      }
    }

    // 1. 역할별 scope 및 필터링 목록 결정
    let scope, allowedUserIDs;

    if (userRole === 'admin') {
      // Admin: 모든 파일 접근
      scope = 'all';
      allowedUserIDs = null; // 필터링 없음

    } else if (userRole === 'teacher' || userRole === 'manager') {
      // Teacher/Manager: 본인 + 소속 학생
      scope = 'center';

      // centerID로 학생 목록 조회
      const students = await db.queryDatabase(
        'SELECT userID FROM Users WHERE centerID = ? AND role = "student"',
        [centerID]
      );

      // 본인 포함
      allowedUserIDs = [userID, ...students.map(s => s.userID)];

    } else if (userRole === 'student') {
      // Student: 본인 + 소속 선생님/매니저
      scope = 'center'; // 개념상 center scope 내의 특정 유저들

      // 같은 센터의 관리자 조회
      const managers = await db.queryDatabase(
        'SELECT userID FROM Users WHERE centerID = ? AND role IN ("teacher", "manager")',
        [centerID]
      );

      // 본인 + 선생님들
      allowedUserIDs = [userID, ...managers.map(m => m.userID)];

    } else {
      return res.status(403).json({
        success: false,
        error: '권한이 없습니다.'
      });
    }

    // 2. 경로 검증 (보안)
    if (prefix.includes('..')) {
      return res.status(400).json({
        success: false,
        error: '잘못된 경로입니다.'
      });
    }

    // 3. S3 조회
    const result = await s3Manager.browse(prefix);

    // 🔥 4. 권한 기반 폴더 필터링 (users/ 목록 조회 시)
    if (scope !== 'all' && prefix === 'users/') {
      // S3 실제 폴더 목록
      const s3Folders = result.folders.map(f => f.name);

      // 권한 있는 사용자 ID만 필터링
      result.folders = result.folders.filter(f => allowedUserIDs.includes(f.name));

      // 권한 목록에는 있지만 S3에는 폴더가 없는 경우 (가상 폴더 추가)
      const missingUsers = allowedUserIDs.filter(uid => !s3Folders.includes(uid));

      missingUsers.forEach(uid => {
        result.folders.push({
          name: uid,
          fullPath: `users/${uid}/`,
          isEmpty: true  // 빈 폴더 표시
        });
      });

      // 폴더 이름 정렬
      result.folders.sort((a, b) => {
        // 사용자를 항상 맨 위로 (선택사항, 하지만 UX상 좋음)
        if (a.name === userID) return -1;
        if (b.name === userID) return 1;
        return a.name.localeCompare(b.name);
      });

      console.log(`📊 필터링 적용 - 허용된 유저: ${allowedUserIDs.length}명, 최종 표시: ${result.folders.length}개`);
    }

    res.json(result);

  } catch (error) {
    console.error('❌ S3 Browse 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/s3/download
 * 파일 다운로드
 */
router.get('/download', authenticateUser, async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({ error: '파일 키가 필요합니다.' });
    }

    console.log(`⬇️ 파일 다운로드: ${key}`);

    // 권한 확인: 본인 파일인지 또는 admin인지
    const userRole = req.session.role;
    const userID = req.session.userID;

    if (userRole !== 'admin' && !key.startsWith(`users/${userID}/`)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    // S3에서 파일 다운로드
    const fileBuffer = await s3Manager.downloadUserProject(key);

    // 파일명 추출
    const fileName = key.split('/').pop();

    // 응답 헤더 설정
    res.setHeader('Content-Type', s3Manager.getContentType(fileName));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(fileBuffer);

  } catch (error) {
    console.error('❌ 다운로드 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/s3/preview
 * 파일 미리보기 (Presigned URL 반환)
 */
router.get('/preview', authenticateUser, async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({ error: '파일 키가 필요합니다.' });
    }

    console.log(`👁️ 파일 미리보기: ${key}`);

    // 권한 확인
    const userRole = req.session.role;
    const userID = req.session.userID;

    if (userRole !== 'admin' && userRole !== 'teacher' && userRole !== 'manager') {
      if (!key.startsWith(`users/${userID}/`)) {
        return res.status(403).json({ error: '접근 권한이 없습니다.' });
      }
    }

    // S3 다운로드 후 Base64로 반환 (간단한 방식)
    const fileBuffer = await s3Manager.downloadUserProject(key);
    const base64 = fileBuffer.toString('base64');
    const fileName = key.split('/').pop();
    const contentType = s3Manager.getContentType(fileName);

    res.json({
      success: true,
      data: `data:${contentType};base64,${base64}`,
      contentType: contentType
    });

  } catch (error) {
    console.error('❌ 미리보기 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/s3/upload
 * 파일 업로드 (멀티파트 지원)
 */
router.post('/upload', authenticateUser, upload.array('files', 10), async (req, res) => {
  try {
    const { folder } = req.body;  // 🔥 platform 제거
    const userID = req.session.userID;
    const userRole = req.session.role;
    const files = req.files;

    console.log(`📤 업로드 요청 - User: ${userID}, Folder: ${folder}, Files: ${files?.length || 0}`);

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '업로드할 파일이 없습니다.'
      });
    }

    // 🔥 platform 검증 제거

    // 🔥 권한 검증
    const targetFolder = folder || '';
    console.log(`📌 대상 폴더: ${targetFolder}`);

    // Student는 본인 폴더만
    if (userRole === 'student') {
      const allowedPath = `users/${userID}/`;
      if (targetFolder && !targetFolder.startsWith(allowedPath)) {
        return res.status(403).json({
          success: false,
          error: '본인 폴더에만 업로드할 수 있습니다.'
        });
      }
    }

    // Teacher/Manager는 students/ 하위만
    if (userRole === 'teacher' || userRole === 'manager') {
      if (targetFolder && !targetFolder.startsWith('users/')) {
        return res.status(403).json({
          success: false,
          error: 'students/ 하위에만 업로드할 수 있습니다.'
        });
      }
    }

    // 업로드 실행
    const uploadResults = [];

    for (const file of files) {
      try {
        // 🔥 현재 경로에 직접 업로드 (platform 제거)
        const result = await s3Manager.uploadUserProject(
          userID,
          null,  // 🔥 platform null
          file.originalname,
          file.buffer,
          targetFolder  // 🔥 현재 경로 전달
        );

        console.log(`✅ 업로드 성공: ${result.s3Key}`);

        uploadResults.push({
          success: true,
          fileName: file.originalname,
          s3Key: result.s3Key,
          s3Url: result.s3Url,
          fileSize: result.fileSize
        });

      } catch (error) {
        console.error(`❌ 업로드 실패: ${file.originalname}`, error);
        uploadResults.push({
          success: false,
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    // 성공/실패 집계
    const successCount = uploadResults.filter(r => r.success).length;
    const failCount = uploadResults.filter(r => !r.success).length;

    console.log(`📊 업로드 결과 - 성공: ${successCount}, 실패: ${failCount}`);

    res.json({
      success: true,
      message: `${successCount}개 파일 업로드 완료${failCount > 0 ? `, ${failCount}개 실패` : ''}`,
      results: uploadResults,
      stats: {
        total: files.length,
        success: successCount,
        failed: failCount
      }
    });

  } catch (error) {
    console.error('❌ 업로드 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/s3/delete
 * 파일 삭제 (Admin, 본인만 가능)
 */
router.delete('/delete', authenticateUser, async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: '파일 키가 필요합니다.'
      });
    }

    console.log(`🗑️ 파일 삭제 요청: ${key}`);

    // 🔥 권한 확인: Admin 또는 본인 파일만
    const userRole = req.session.role;
    const userID = req.session.userID;

    if (userRole !== 'admin') {
      // Teacher/Manager는 users/ 하위만 삭제 가능
      if (userRole === 'teacher' || userRole === 'manager') {
        if (!key.startsWith('users/')) {
          return res.status(403).json({
            success: false,
            error: '삭제 권한이 없습니다.'
          });
        }
      }
      // Student는 본인 파일만 삭제 가능
      else if (userRole === 'student') {
        if (!key.startsWith(`users/${userID}/`)) {
          return res.status(403).json({
            success: false,
            error: '본인 파일만 삭제할 수 있습니다.'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          error: '삭제 권한이 없습니다.'
        });
      }
    }

    // 🔥 S3 삭제 실행
    const result = await s3Manager.deleteUserProject(key);

    console.log(`✅ 삭제 성공: ${key}`);

    res.json({
      success: true,
      message: result.message || '파일이 삭제되었습니다.',
      deletedKey: result.deletedKey
    });

  } catch (error) {
    console.error('❌ 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '삭제에 실패했습니다.'
    });
  }
});

/**
 * POST /api/s3/delete-multiple
 * 🔥 여러 파일 일괄 삭제
 */
router.post('/delete-multiple', authenticateUser, async (req, res) => {
  try {
    const { keys } = req.body;

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({
        success: false,
        error: '삭제할 파일 목록이 필요합니다.'
      });
    }

    console.log(`🗑️ 일괄 삭제 요청: ${keys.length}개 파일`);

    // 🔥 권한 확인
    const userRole = req.session.role;
    const userID = req.session.userID;

    // 권한 검증 (각 파일에 대해)
    for (const key of keys) {
      if (userRole !== 'admin') {
        if (userRole === 'teacher' || userRole === 'manager') {
          if (!key.startsWith('users/')) {
            return res.status(403).json({
              success: false,
              error: `삭제 권한이 없습니다: ${key}`
            });
          }
        } else if (userRole === 'student') {
          if (!key.startsWith(`users/${userID}/`)) {
            return res.status(403).json({
              success: false,
              error: `본인 파일만 삭제할 수 있습니다: ${key}`
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            error: '삭제 권한이 없습니다.'
          });
        }
      }
    }

    // 🔥 S3 일괄 삭제 실행
    const result = await s3Manager.deleteUserProjects(keys);

    console.log(`✅ 일괄 삭제 완료:`, result.stats);

    res.json(result);

  } catch (error) {
    console.error('❌ 일괄 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '일괄 삭제에 실패했습니다.'
    });
  }
});

module.exports = router;
