# Entry 저장소 통합 작업 설계서

> **문서 버전**: 1.0  
> **작성일**: 2025-12-18  
> **목표**: 기존 Entry API에 UI 통합, 용량 체크, 센터별 관리 기능 추가

---

## 📋 현재 상태

### 기존 Entry 저장 시스템

| 항목 | 현재 값 |
|------|---------|
| **저장 API** | `/entry/api/save-project` |
| **목록 API** | `/entry/api/user-projects` |
| **DB 테이블** | `ProjectSubmissions` |
| **S3 경로** | 비표준 (개선 필요) |
| **용량 체크** | ❌ 없음 |
| **센터별 관리** | △ center_id 있으나 미활용 |

### 목표 상태

| 항목 | 목표 값 |
|------|---------|
| **S3 경로** | `users/{userID}/entry/{saveType}/` |
| **용량 체크** | ✅ quotaChecker 연동 |
| **센터별 관리** | ✅ 센터별 사용량 집계 |
| **통합 UI** | ✅ 공통 컴포넌트 사용 |

---

## 🛠️ 작업 목록

### PHASE 1: 기존 API에 용량 체크 추가

#### 1.1 entryRouter.js 수정

**파일**: `/routes/entryRouter.js`

**수정 내용**: `/api/save-project` 엔드포인트에 quotaChecker 연동

```javascript
// 🔥 추가할 import
const { canUpload, increaseUsage, decreaseUsage } = require('../lib_storage/quotaChecker');

// 🔥 /api/save-project 수정
router.post('/api/save-project', authenticateUser, async (req, res) => {
    try {
        const { projectData, projectName, userID, centerID, saveType } = req.body;
        
        // 1. 사용자 DB ID 조회
        const db = require('../lib_login/db');
        const [user] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?', 
            [userID || req.session.userID]
        );
        
        if (!user) {
            return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
        }
        
        const userId = user.id;
        const centerId = centerID || req.session.centerID;
        
        // 2. 파일 크기 계산 (JSON 문자열 길이 기준)
        const projectJson = JSON.stringify(projectData);
        const fileSize = Buffer.byteLength(projectJson, 'utf8');
        
        // 3. 🔥 용량 체크
        const canSave = await canUpload(userId, centerId, fileSize);
        if (!canSave.allowed) {
            return res.status(413).json({
                success: false,
                error: 'QUOTA_EXCEEDED',
                message: canSave.message,
                details: {
                    currentUsage: canSave.currentUsage,
                    limit: canSave.limit,
                    required: fileSize
                }
            });
        }
        
        // 4. S3 저장 (기존 로직)
        // ... S3 업로드 코드 ...
        
        // 5. 🔥 사용량 업데이트
        await increaseUsage(userId, centerId, fileSize, 'entry');
        
        // 6. DB 저장 (기존 로직)
        // ... ProjectSubmissions INSERT ...
        
        res.json({ success: true, ... });
        
    } catch (error) {
        console.error('저장 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
```

#### 1.2 S3 경로 표준화

**변경 전**: 
```
ent/projects/{userID}/{fileName}.ent
```

**변경 후** (정책 준수):
```
users/{userID}/entry/projects/{fileName}.ent
users/{userID}/entry/autosave/{fileName}.ent
users/{userID}/entry/submissions/{fileName}.ent
```

**수정 위치**: `lib_entry/entFileManager.js` 또는 S3 업로드 로직

```javascript
// S3 키 생성 함수
function generateS3Key(userID, saveType, fileName) {
    // saveType: 'projects' | 'autosave' | 'submissions'
    return `users/${userID}/entry/${saveType}/${fileName}`;
}
```

---

### PHASE 2: ProjectSubmissions 테이블 확장

#### 2.1 컬럼 추가 (선택사항)

```sql
-- 용량 관리를 위한 컬럼 추가 (이미 file_size_kb 있음)
ALTER TABLE ProjectSubmissions 
ADD COLUMN s3_key VARCHAR(500) AFTER s3_url,
ADD COLUMN thumbnail_url VARCHAR(500) AFTER s3_key,
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN deleted_at TIMESTAMP NULL;

-- 인덱스 추가
CREATE INDEX idx_user_platform ON ProjectSubmissions(user_id, platform);
CREATE INDEX idx_center_id ON ProjectSubmissions(center_id);
```

#### 2.2 center_id 활용

현재 `ProjectSubmissions`에 `center_id`가 없다면 추가:

```sql
-- center_id 컬럼 추가
ALTER TABLE ProjectSubmissions 
ADD COLUMN center_id INT AFTER user_id,
ADD FOREIGN KEY (center_id) REFERENCES Centers(id);

-- 기존 데이터 마이그레이션 (Users 테이블에서 가져오기)
UPDATE ProjectSubmissions ps
JOIN Users u ON ps.user_id = u.id
SET ps.center_id = u.centerID;
```

---

### PHASE 3: 센터별 사용량 집계

#### 3.1 API 엔드포인트 추가

**파일**: `/routes/entryRouter.js`

```javascript
// 🔥 센터별 Entry 사용량 조회 (교사/관리자용)
router.get('/api/center-usage', authenticateUser, async (req, res) => {
    try {
        const { role, centerID } = req.session;
        
        // 권한 체크
        if (!['admin', 'manager', 'teacher'].includes(role)) {
            return res.status(403).json({ success: false, error: '권한이 없습니다.' });
        }
        
        const db = require('../lib_login/db');
        
        // admin은 모든 센터, 나머지는 자기 센터만
        const centerFilter = role === 'admin' ? '' : 'WHERE ps.center_id = ?';
        const params = role === 'admin' ? [] : [centerID];
        
        const query = `
            SELECT 
                ps.center_id,
                COUNT(*) as project_count,
                SUM(ps.file_size_kb) as total_size_kb,
                COUNT(DISTINCT ps.user_id) as user_count
            FROM ProjectSubmissions ps
            ${centerFilter}
            GROUP BY ps.center_id
        `;
        
        const results = await db.queryDatabase(query, params);
        
        res.json({
            success: true,
            centerUsage: results.map(r => ({
                centerId: r.center_id,
                projectCount: r.project_count,
                totalSizeKb: r.total_size_kb,
                totalSizeFormatted: formatSize(r.total_size_kb * 1024),
                userCount: r.user_count
            }))
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

### PHASE 4: 통합 UI 컴포넌트

#### 4.1 공통 모달 컴포넌트 생성

**파일**: `/public/js/components/storage/ProjectListModal.js`

```javascript
/**
 * 프로젝트 목록 불러오기 모달 (공통)
 * 모든 플랫폼에서 동일한 UI 사용
 */
class ProjectListModal {
    constructor(options = {}) {
        this.platform = options.platform || 'entry';
        this.apiBase = options.apiBase || '/entry/api';
        this.onSelect = options.onSelect || (() => {});
        this.onClose = options.onClose || (() => {});
    }
    
    async show() {
        const projects = await this.fetchProjects();
        this.render(projects);
    }
    
    async fetchProjects() {
        const response = await fetch(`${this.apiBase}/user-projects`, {
            credentials: 'include'
        });
        const result = await response.json();
        return result.success ? result.projects : [];
    }
    
    render(projects) {
        // 모달 HTML 생성 (통일된 디자인)
        const modal = document.createElement('div');
        modal.className = 'project-list-modal';
        modal.innerHTML = this.getModalHTML(projects);
        document.body.appendChild(modal);
        
        this.bindEvents(modal);
    }
    
    getModalHTML(projects) {
        return `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>📂 내 프로젝트</h3>
                        <span class="project-count">${projects.length}개</span>
                        <button class="modal-close">✕</button>
                    </div>
                    <div class="modal-body">
                        ${this.getProjectGridHTML(projects)}
                    </div>
                </div>
            </div>
        `;
    }
    
    getProjectGridHTML(projects) {
        if (projects.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>저장된 프로젝트가 없습니다.</p>
                </div>
            `;
        }
        
        return `
            <div class="project-grid">
                ${projects.map(p => this.getProjectCardHTML(p)).join('')}
            </div>
        `;
    }
    
    getProjectCardHTML(project) {
        return `
            <div class="project-card" data-id="${project.id}" data-url="${project.s3Url || ''}">
                <div class="project-thumbnail">
                    ${project.thumbnailUrl 
                        ? `<img src="${project.thumbnailUrl}" alt="${project.projectName}">`
                        : `<div class="default-thumb">📦</div>`
                    }
                </div>
                <div class="project-info">
                    <div class="project-name">${project.projectName}</div>
                    <div class="project-meta">
                        ${this.formatDate(project.createdAt)}
                        ${project.fileSizeKb ? ` · ${this.formatSize(project.fileSizeKb * 1024)}` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('ko-KR');
    }
    
    formatSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    bindEvents(modal) {
        // 닫기 버튼
        modal.querySelector('.modal-close').onclick = () => {
            modal.remove();
            this.onClose();
        };
        
        // 오버레이 클릭
        modal.querySelector('.modal-overlay').onclick = (e) => {
            if (e.target === e.currentTarget) {
                modal.remove();
                this.onClose();
            }
        };
        
        // 프로젝트 카드 클릭
        modal.querySelectorAll('.project-card').forEach(card => {
            card.onclick = () => {
                const projectId = card.dataset.id;
                const s3Url = card.dataset.url;
                const projectName = card.querySelector('.project-name').textContent;
                
                modal.remove();
                this.onSelect({ id: projectId, s3Url, projectName });
            };
        });
    }
}

// 전역 등록
window.ProjectListModal = ProjectListModal;
```

#### 4.2 공통 CSS

**파일**: `/public/css/components/project-modal.css`

```css
/* 프로젝트 목록 모달 공통 스타일 */
.project-list-modal .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
}

.project-list-modal .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 700px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.project-list-modal .modal-header {
    display: flex;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #eee;
}

.project-list-modal .modal-header h3 {
    margin: 0;
    flex: 1;
    font-size: 18px;
    color: #333;
}

.project-list-modal .project-count {
    color: #666;
    font-size: 14px;
    margin-right: 16px;
}

.project-list-modal .modal-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #999;
    padding: 4px 8px;
}

.project-list-modal .modal-close:hover {
    color: #333;
}

.project-list-modal .modal-body {
    padding: 24px;
    overflow-y: auto;
    max-height: calc(80vh - 80px);
}

.project-list-modal .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
}

.project-list-modal .project-card {
    border: 2px solid #e8e8e8;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s ease;
}

.project-list-modal .project-card:hover {
    border-color: #00B894;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 184, 148, 0.2);
}

.project-list-modal .project-thumbnail {
    height: 100px;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    display: flex;
    align-items: center;
    justify-content: center;
}

.project-list-modal .project-thumbnail img {
    max-width: 100%;
    max-height: 100%;
    object-fit: cover;
}

.project-list-modal .default-thumb {
    font-size: 36px;
}

.project-list-modal .project-info {
    padding: 12px;
}

.project-list-modal .project-name {
    font-weight: 600;
    font-size: 14px;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
}

.project-list-modal .project-meta {
    font-size: 12px;
    color: #888;
}

.project-list-modal .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #999;
}

.project-list-modal .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
}
```

---

### PHASE 5: 용량 표시 UI

#### 5.1 저장 모달에 용량 표시 추가

```javascript
// projectSaver.js의 createPromptModal 수정
async createPromptModal(defaultName, resolve) {
    // 용량 정보 먼저 조회
    let usageInfo = null;
    try {
        const response = await fetch('/api/storage/usage', { credentials: 'include' });
        const result = await response.json();
        if (result.success) {
            usageInfo = result.data;
        }
    } catch (e) {
        console.warn('용량 정보 조회 실패:', e);
    }
    
    const modal = document.createElement('div');
    // ... 모달 HTML ...
    
    // 용량 바 추가
    if (usageInfo) {
        const usageHTML = `
            <div class="storage-usage" style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
                    <span>사용 중: ${usageInfo.total.usageFormatted}</span>
                    <span>전체: ${usageInfo.total.limitFormatted}</span>
                </div>
                <div style="height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${usageInfo.total.percent}%; background: ${usageInfo.total.percent > 90 ? '#f44336' : '#00B894'};"></div>
                </div>
            </div>
        `;
        // 모달에 삽입
    }
}
```

---

## 📋 작업 체크리스트

### PHASE 1: 용량 체크 연동
- [ ] entryRouter.js에 quotaChecker import
- [ ] /api/save-project에 canUpload 체크 추가
- [ ] 저장 성공 시 increaseUsage 호출
- [ ] 삭제 시 decreaseUsage 호출
- [ ] 테스트: 용량 초과 시 에러 확인

### PHASE 2: S3 경로 표준화
- [ ] S3 키 생성 함수 수정
- [ ] 기존 파일 마이그레이션 스크립트 (선택)
- [ ] 테스트: 새 경로에 저장 확인

### PHASE 3: DB 스키마 확장
- [ ] center_id 컬럼 확인/추가
- [ ] s3_key 컬럼 추가
- [ ] is_deleted 컬럼 추가
- [ ] 인덱스 생성

### PHASE 4: 센터별 관리 API
- [ ] /api/center-usage 엔드포인트 추가
- [ ] 권한 체크 로직 구현
- [ ] 테스트: 교사 대시보드 연동

### PHASE 5: UI 통합
- [ ] ProjectListModal.js 생성
- [ ] project-modal.css 생성
- [ ] projectSaver.js에서 공통 모달 사용
- [ ] 용량 표시 바 추가
- [ ] 테스트: 모든 플랫폼 동일 UI 확인

---

## 🚀 배포 순서

1. **DB 스키마 변경** (서버 다운타임 없음)
2. **백엔드 API 수정** (entryRouter.js)
3. **프론트엔드 컴포넌트 추가**
4. **projectSaver.js 업데이트**
5. **테스트 후 배포**

---

## 📝 관련 문서

- [플랫폼_통합저장소_정책명세서.md](./플랫폼_통합저장소_정책명세서.md)
- [S3_스토리지_API_명세서.txt](../S3_스토리지_API_명세서.txt)
