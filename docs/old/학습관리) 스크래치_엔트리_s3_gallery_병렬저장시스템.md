# 🔄 병렬 저장 모델(Parallel Storage Model) 구현 명세서

**작성일**: 2025년 12월 27일  
**프로젝트**: educodingnplay  
**버전**: 1.0  
**상태**: 프론트엔드 수정 대기

---

## 📋 프로젝트 개요

### 목적
Entry와 Scratch 프로젝트 저장 시 **UserFiles**(스토리지 용량 관리)와 **ProjectSubmissions**(학습 진도 추적) 두 테이블에 **병렬 저장**하여 데이터 일관성 확보

### 문제 배경
- **기존 상황**: Entry는 `ProjectSubmissions`만, Scratch는 `UserFiles`만 사용
- **문제점**: 테이블 간 데이터 불일치, 삭제 시 참조 무결성 문제
- **해결책**: 병렬 모델(Parallel Model) - 파일 저장 시 두 테이블 동시 기록

---

## 🏗️ 아키텍처

### 데이터 흐름
```
[프론트엔드] → [백엔드 API] → [S3 업로드]
                    ↓
              [parallelSave.js]
                    ↓
        ┌──────────┴──────────┐
        ▼                      ▼
   [UserFiles]          [ProjectSubmissions]
   (스토리지 관리)          (학습 추적)
```

### 저장 정책
| 저장 유형 | UserFiles | ProjectSubmissions |
|-----------|-----------|---------------------|
| 자동저장 (draft) | ❌ | ✅ (덮어쓰기) |
| 수동저장/제출 (final) | ✅ | ✅ |
| 삭제 | ✅ (논리삭제) | ✅ (논리삭제) |

---

## 📁 수정된 파일 목록

### ✅ 백엔드 (완료)

| 파일 경로 | 상태 | 설명 |
|-----------|------|------|
| `lib_storage/parallelSave.js` | ✅ 신규 | 병렬 저장 핵심 모듈 |
| `routes/entryRouter.js` | ✅ 수정 | Entry 저장/삭제 API |
| `routes/scratchRouter.js` | ✅ 수정 | Scratch 저장/삭제 API |

### 🔲 프론트엔드 (대기)

| 파일 경로 | 상태 | 설명 |
|-----------|------|------|
| `scratch-gui/src/lib/save-project-to-server.js` | 🔲 대기 | Scratch 저장 로직 |
| `scratch-gui/src/lib/project-saver-hoc.jsx` | 🔲 대기 | Scratch 저장 HOC |
| `entry/src/...` (파일 확인 필요) | 🔲 대기 | Entry 저장 로직 |

### ✅ 데이터베이스 (검증 완료)

| 테이블 | 상태 | 필요 컬럼 |
|--------|------|-----------|
| UserFiles | ✅ 존재 | is_deleted, deleted_at |
| ProjectSubmissions | ✅ 존재 | is_deleted, deleted_at, idx_not_deleted |

---

## 🔧 핵심 모듈: parallelSave.js

### 파일 위치
```
C:\Users\User\Documents\pioneer\educodingnplay\lib_storage\parallelSave.js
```

### 주요 함수

```javascript
// 병렬 저장 (신규 생성)
async function saveProjectParallel(params) {
  // params: userId, centerID, platform, projectName, s3Path, fileSize, fileType, s3Url, submissionType
  // returns: { projectSubmissionId, userFileId }
}

// 병렬 업데이트 (기존 수정)
async function updateProjectParallel(params) {
  // params: projectId, userId, userFileId, projectName, s3Path, fileSize, s3Url, submissionType
}

// 병렬 삭제 (논리삭제)
async function deleteProjectParallel(params) {
  // params: projectId, userFileId, userId
}

// 프로젝트 분석 (블록 수 등)
function analyzeProject(projectData, platform) {
  // returns: { blocksCount, spritesCount, variablesCount, functionsCount }
}
```

---

## 🎨 프론트엔드 수정 가이드

### 1. Scratch GUI 수정

#### 파일 위치 (로컬)
```
C:\Users\User\Documents\pioneer\scratch-gui\src\lib\
```

#### 수정 포인트 A: 저장 응답 처리
```javascript
// save-project-to-server.js 또는 project-saver-hoc.jsx
const response = await fetch('/scratch/api/save-project', {
    method: 'POST',
    body: formData
});
const result = await response.json();

if (result.success) {
    // ✅ 추가: userFileId 저장
    this.projectData.projectId = result.projectId;
    this.projectData.userFileId = result.userFileId;  // 새로 추가
    
    // 로컬 스토리지에도 백업
    localStorage.setItem('scratch_userFileId_' + result.projectId, result.userFileId);
}
```

#### 수정 포인트 B: 업데이트 요청 시 userFileId 포함
```javascript
const formData = new FormData();
formData.append('projectData', projectBlob);
formData.append('projectName', projectName);
formData.append('isNew', 'false');
formData.append('projectId', this.projectData.projectId);
formData.append('userFileId', this.projectData.userFileId);  // ✅ 추가
```

#### 수정 포인트 C: 삭제 요청 시 userFileId 전달
```javascript
const projectId = this.projectData.projectId;
const userFileId = this.projectData.userFileId || 
                   localStorage.getItem('scratch_userFileId_' + projectId);

const url = `/scratch/api/project/${projectId}?userFileId=${userFileId}`;

const response = await fetch(url, {
    method: 'DELETE'
});
```

---

### 2. Entry 수정

#### 파일 위치 (로컬)
```
C:\Users\User\Documents\pioneer\educodingnplay\entry\
```

#### 수정 포인트 A: 저장 응답 처리
```javascript
const response = await fetch('/entry/api/projects', {
    method: 'POST',
    body: formData
});
const result = await response.json();

if (result.success) {
    // ✅ 추가: userFileId 저장
    Entry.projectId = result.projectId;
    Entry.userFileId = result.userFileId;
    
    if (Entry.projectData) {
        Entry.projectData.userFileId = result.userFileId;
    }
}
```

#### 수정 포인트 B: 업데이트 요청 시
```javascript
const requestBody = {
    projectName: projectName,
    projectData: projectData,
    thumbnail: thumbnailData,
    userFileId: Entry.userFileId  // ✅ 추가
};
```

#### 수정 포인트 C: 삭제 요청 시
```javascript
const projectId = Entry.projectId;
const userFileId = Entry.userFileId;

const url = `/entry/api/projects/${projectId}?userFileId=${userFileId}`;

const response = await fetch(url, {
    method: 'DELETE'
});
```

---

## 📊 백엔드 API 응답 형식

### 저장 API 응답 (이미 구현됨)
```json
{
    "success": true,
    "projectId": 123,
    "userFileId": 456,
    "s3Url": "https://...",
    "message": "프로젝트가 저장되었습니다."
}
```

### 삭제 API 요청
```
DELETE /scratch/api/project/{projectId}?userFileId={userFileId}
DELETE /entry/api/projects/{projectId}?userFileId={userFileId}
```

---

## 🚀 배포 절차

### 1단계: 백엔드 배포 (완료)
```bash
# 로컬에서
cd C:\Users\User\Documents\pioneer\educodingnplay
git add .
git commit -m "feat: 병렬 저장 모델 백엔드 구현"
git push origin main

# 서버에서
cd /var/www/html/educodingnplay
sudo git pull origin main
pm2 restart all
```

### 2단계: Scratch GUI 배포 (대기)
```bash
# 로컬에서
cd C:\Users\User\Documents\pioneer\scratch-gui
# 프론트엔드 수정 후
npm run build
git add .
git commit -m "feat: userFileId 저장/업데이트/삭제 연동"
git push origin main

# 서버에서
cd /var/www/html/scratch-gui
sudo git pull origin main
npm run build  # 또는 pm2 restart scratch-gui
```

### 3단계: Entry 배포 (대기)
```bash
# 로컬에서
cd C:\Users\User\Documents\pioneer\educodingnplay\entry
# 프론트엔드 수정 후
git add .
git commit -m "feat: userFileId 저장/업데이트/삭제 연동"
git push origin main

# 서버에서
cd /var/www/html/educodingnplay/entry
sudo git pull origin main
pm2 restart entry-server  # 필요시
```

---

## ✅ 체크리스트

### 백엔드
- [x] parallelSave.js 모듈 생성
- [x] entryRouter.js 병렬 모델 적용
- [x] scratchRouter.js 병렬 모델 적용
- [x] DB 테이블 구조 확인 (is_deleted, deleted_at)
- [ ] 인덱스 추가 (권장): `idx_userfiles_not_deleted`

### 프론트엔드
- [ ] Scratch GUI: 저장 응답에서 userFileId 저장
- [ ] Scratch GUI: 업데이트 시 userFileId 전송
- [ ] Scratch GUI: 삭제 시 userFileId 전송
- [ ] Entry: 저장 응답에서 userFileId 저장
- [ ] Entry: 업데이트 시 userFileId 전송
- [ ] Entry: 삭제 시 userFileId 전송

### 배포
- [ ] 백엔드 Git 커밋 및 푸시
- [ ] 서버에서 백엔드 pull 및 재시작
- [ ] Scratch GUI 빌드 및 배포
- [ ] Entry 배포
- [ ] 통합 테스트

---

## 🔍 다음 작업 시작점

### 즉시 필요한 작업
1. **Scratch GUI 소스 파일 확인**
   - `C:\Users\User\Documents\pioneer\scratch-gui\src\lib\save-project-to-server.js` 분석
   - `project-saver-hoc.jsx` 분석
   
2. **Entry 소스 파일 확인**
   - `C:\Users\User\Documents\pioneer\educodingnplay\entry\` 내 저장 관련 파일 분석

3. **프론트엔드 수정 적용**
   - userFileId 저장/업데이트/삭제 로직 추가

### 권장 인덱스 (선택)
```sql
CREATE INDEX idx_userfiles_not_deleted 
ON UserFiles(user_id, file_category, is_deleted);
```

---

## 📚 참조 문서

- `/mnt/project/S3_스토리지_API_명세서.txt`
- `/mnt/project/DB_테이블명세서.txt`
- `/mnt/project/__educodingnplay_프로젝트전체구조명세서.txt`

---

## 🗂️ 관련 트랜스크립트

| 파일명 | 내용 |
|--------|------|
| `2025-12-26-17-08-50-parallel-model-code-implementation.txt` | 코드 구현 상세 |
| `2025-12-26-17-20-22-parallel-storage-deployment-complete.txt` | Entry 백엔드 완료 |
| `2025-12-26-17-25-38-scratch-parallel-model-deployment.txt` | Scratch 백엔드 완료 |
| `2025-12-26-17-52-40-parallel-model-db-migration-frontend-guide.txt` | DB 확인 및 프론트엔드 가이드 |
| `2025-12-26-18-01-53-scratch-gui-directory-structure.txt` | Scratch GUI 구조 탐색 |

---
---

# 추가 명세: 저장소(S3) 및 갤러리 구현

## 1. 개요
본 섹션은 **Scratch** 및 **Entry** 프로젝트의 S3 저장 구조, 데이터베이스 스키마, 그리고 갤러리 공유 시스템의 구현 상태를 정리합니다.

---

## 2. AWS S3 저장 구조 (Folder Structure)

모든 콘텐츠는 `educodingnplaycontents` 버킷 (`ap-northeast-2`)에 저장됩니다.

### 2.1. 폴더 경로 규칙

| 플랫폼 | 저장 유형 (Type) | S3 키 (Path) 패턴 | 파일 형식 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **Scratch** | 자동저장 (Autosave) | `users/{userID}/scratch/autosave/{projectName}_{timestamp}.sb3` | `.sb3` | 자동저장은 용량 산정 제외 (일부 로직) |
| **Scratch** | 프로젝트 (Projects) | `users/{userID}/scratch/projects/{projectName}_{timestamp}.sb3` | `.sb3` | 일반 저장 |
| **Scratch** | 썸네일 (Thumbnails) | `users/{userID}/scratch/{type}/thumbnails/{projectName}_{timestamp}.png` | `.png` | `{type}`은 `autosave` 또는 `projects` |
| **Entry** | 자동저장/프로젝트 | `users/{userID}/entry/{type}/{projectName}_{timestamp}.ent` | `.ent` | `saveType` 파라미터에 따라 결정 (기본: `projects`) |
| **Entry** | 썸네일 | `users/{userID}/entry/{type}/thumbnails/{projectName}_{timestamp}.png` | `.png` | |
| **공통** | 사용자 파일 (삭제됨) | `users/{userID}/{platform}/draft/...` | - | 구 버전 로직의 흔적 (`s3Manager.js` 주석 참조) |

> **참고**: `users/{userID}` 경로는 로그인이 완료된 사용자의 고유 ID를 기반으로 생성됩니다.

---

## 3. 데이터베이스 스키마 (Database)

프로젝트 저장과 갤러리 공유를 위해 주요 테이블들이 유기적으로 연결되어 있습니다.

### 3.1. 프로젝트 저장 테이블 (`ProjectSubmissions`)
사용자가 저장한 프로젝트의 원본 메타데이터를 관리합니다.

| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | INT | Primary Key |
| `user_id` | INT | `Users` 테이블 FK |
| `platform` | VARCHAR | `scratch`, `entry` 등 |
| `project_name` | VARCHAR | 프로젝트 제목 |
| `s3_url` | VARCHAR | S3 전체 URL |
| `s3_key` | VARCHAR | S3 파일 키 (삭제 시 사용) |
| `save_type` | VARCHAR | `projects` (일반), `autosave` (자동) |
| `file_size_kb` | FLOAT | 파일 크기 (KB) |
| `thumbnail_url` | VARCHAR | 썸네일 이미지 URL |
| `is_deleted` | BOOLEAN | 삭제 여부 (Soft Delete) |

### 3.2. 갤러리 공유 테이블 (`gallery_projects`)
사용자가 `ProjectSubmissions`의 프로젝트를 갤러리에 공유할 때 생성되는 레코드입니다.

| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | INT | Primary Key |
| `user_id` | INT | 작성자 ID |
| `submission_id` | INT | `ProjectSubmissions` 원본 ID (연동용) |
| `title` | VARCHAR | 갤러리에 노출될 제목 |
| `description` | TEXT | 작품 설명 |
| `platform` | VARCHAR | `entry`, `scratch` 등 |
| `s3_url` | VARCHAR | 공유 시점의 S3 파일 URL |
| `embed_url` | VARCHAR | 플레이어 임베드용 URL |
| `visibility` | ENUM | `public` (전체공개), `class` (센터공개), `private` (나만보기) |
| `view_count` | INT | 조회수 |
| `like_count` | INT | 좋아요 수 |
| `is_active` | BOOLEAN | 활성화 여부 (삭제 시 0) |

### 3.3. 기타 관련 테이블
- **`UserFiles`**: 사용자 저장 용량(Quota) 관리를 위한 병렬 테이블.
- **`gallery_likes`**: 갤러리 작품 좋아요 이력 (`gallery_id`, `user_id`).
- **`gallery_views`**: 갤러리 작품 조회 이력 (중복 조회 방지).

---

## 4. 로직 및 메서드 구현 (Implementation Logic)

### 4.1. 저장 로직 (Save Process)
- **위치**: `routes/scratchRouter.js`, `routes/entryRouter.js`
- **프로세스**:
  1. 클라이언트에서 프로젝트 데이터(JSON)와 썸네일(Base64) 전송.
  2. **Quota Check**: `quotaChecker`를 통해 사용자 남은 용량 확인 (자동저장 제외).
  3. **S3 Upload**: `s3Manager.uploadProject` 호출하여 `.sb3` 또는 `.ent` 파일 업로드.
  4. **DB Save**: 
     - `ProjectSubmissions` 테이블에 메타데이터 저장.
     - `UserFiles` 테이블에 용량 정보 동기화 (병렬 모델).

### 4.2. 공유 로직 (Share Process)
- **위치**: `routes/api/galleryApiRouter.js` (`POST /share`)
- **프로세스**:
  1. 사용자가 내 프로젝트 목록(`ProjectSubmissions`)에서 공유할 항목 선택.
  2. 제목, 설명, 공개 범위(`visibility`) 입력.
  3. **Embed URL 생성**:
     - Entry: `/entry_editor/?s3Url={url}&mode=play&embed=1`
     - Scratch: `/scratch/?project_file={url}&mode=player&embed=1`
  4. `gallery_projects` 테이블에 INSERT.

### 4.3. 파일 로드 (Load Process)
- **Entry**: `/entry_editor` 라우트에서 `s3Url` 파라미터를 받아 `EntFileManager`가 S3에서 파일을 다운로드 후 에디터에 주입.
- **Scratch**: `/scratch` 라우트 또는 API가 `s3Url`을 받아 `.sb3` 파일을 로드.

---

## 5. 요약 Matrix

| 구분 | Scratch | Entry |
| :--- | :--- | :--- |
| **Router** | `scratchRouter.js` | `entryRouter.js` |
| **S3 Path** | `.../scratch/{type}/...` | `.../entry/{type}/...` |
| **File Ext** | `.sb3` | `.ent` |
| **Embed URL** | `/scratch/?project_file=...` | `/entry_editor/?s3Url=...` |
| **DB Table** | `ProjectSubmissions` (`platform='scratch'`) | `ProjectSubmissions` (`platform='entry'`) |
