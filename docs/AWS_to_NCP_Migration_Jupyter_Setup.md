# AWS → NCP 마이그레이션: Jupyter 설정 가이드

## 📋 현재 상황 (2026-01-13)

### ✅ 완료된 작업
1. **NCP Object Storage 설정**
   - 자격 증명 설정 완료 (`.env` 파일)
   - S3Manager를 통한 NCP 연결 성공
   - S3 Explorer 정상 작동

2. **Jupyter 서버**
   - Docker 컨테이너 정상 실행
   - 로컬 파일시스템으로 작동 중
   - 포트 8889 (컨테이너 내부 8888) 매핑 완료

3. **코드 수정**
   - `docker-compose.yml`: NCP 환경 변수 추가
   - `start-jupyter.sh`: 에러 핸들링 개선, 디버그 정보 추가
   - `jupyterRouter.js`: 인증 우회 (DB 복원 전 임시)
   - `JupyterComponent.js`: testuser 폴백 로직 추가

### ⚠️ 임시 조치 (DB 복원 후 되돌려야 함)

#### 1. `routes/api/jupyterRouter.js` (Line 157-158, 188-190)
```javascript
// 🔥 임시: DB 복원 전까지 인증 우회
router.post('/create-blank-notebook', async (req, res) => {
    const userID = req.session?.userID || req.body.userID || 'testuser';
    // ...
});

router.get('/user-notebooks', async (req, res) => {
    const userID = req.session?.userID || req.query.userID || 'testuser';
    // ...
});
```

**DB 복원 후 되돌릴 내용:**
```javascript
// 원래 버전
router.post('/create-blank-notebook', requireAuth, async (req, res) => {
    const userID = req.session?.userID || req.body.userID || 'guest';
    // ...
});

router.get('/user-notebooks', requireAuth, async (req, res) => {
    const userID = req.session?.userID || req.query.userID || 'guest';
    // ...
});
```

#### 2. `public/js/components/jupyter/JupyterComponent.js` (Line 63-65)
```javascript
// 🔥 4. DB 복원 전 임시: testuser 사용
console.log('⚠️  No user session found, using testuser (DB migration in progress)');
return 'testuser';
```

**DB 복원 후 되돌릴 내용:**
```javascript
// 4. 기본값: 게스트 + 랜덤 ID
const randomId = Math.random().toString(36).substr(2, 8);
return `guest_${randomId}`;
```

---

## 🔴 미해결 이슈

### 1. S3 마운트 실패
**증상:**
```
🚀 Mounting S3 Bucket: educodingnplaycontents to /app/jupyter_notebooks
❌ S3 Mount Failed!
```

**원인 분석:**
- 환경 변수는 컨테이너로 정상 전달됨 확인
- `start-jupyter.sh`의 디버그 메시지가 출력되지 않음
- 스크립트가 19-22번 줄 사이에서 중단되는 것으로 추정

**해결 시도:**
1. `set -e` → `set +e`로 변경 (에러 시에도 계속 진행)
2. 상세 디버그 정보 추가
3. 에러 핸들링 강화

**다음 단계:**
- 서버에서 `docker-compose restart jupyter` 실행
- 새로운 로그 확인:
  ```bash
  docker logs educodingnplay-jupyter 2>&1 | grep -E "(DEBUG|Configuration|s3fs)"
  ```

### 2. 마크다운 파일 404 에러
**증상:**
```
onag54aw13447.edge.naverncp.com/DataAnalysis/chapter01_1_p01.md
Failed to load resource: 404
```

**원인:**
- NCP Object Storage에 해당 파일이 없음
- AWS에서 NCP로 마이그레이션 시 파일이 복사되지 않았을 가능성

**해결 방법:**
1. S3 Explorer로 실제 파일 경로 확인
2. AWS S3에서 NCP Object Storage로 파일 복사 필요
3. 또는 경로가 변경되었을 경우 코드 수정

---

## 🎯 DB 복원 후 해야 할 작업

### 1. 인증 복원
```bash
# 1. jupyterRouter.js 수정
# Line 157-158: requireAuth 미들웨어 다시 추가
# Line 188-190: requireAuth 미들웨어 다시 추가

# 2. JupyterComponent.js 수정
# Line 63-65: 랜덤 guest ID 로직으로 변경

# 3. 서버 재시작
pm2 restart server
```

### 2. 테스트
```bash
# 1. 로그인 테스트
# 2. Jupyter 노트북 생성 테스트
# 3. 사용자별 격리 확인
```

---

## 📂 파일 구조

### Jupyter 사용자별 디렉토리 구조
```
jupyter_notebooks/
├── users/
│   ├── testuser/          # 임시 테스트 계정
│   │   └── jupyter/
│   │       └── testuser.ipynb
│   ├── {userID}/          # 실제 사용자
│   │   └── jupyter/
│   │       └── {userID}.ipynb
│   └── ...
└── .gitkeep
```

### 관련 파일 목록
```
educosmo/
├── docker-compose.yml                          # NCP 환경 변수 설정
├── Dockerfile                                  # Jupyter 이미지 빌드
├── start-jupyter.sh                            # S3 마운트 스크립트
├── routes/api/jupyterRouter.js                # Jupyter API 엔드포인트
├── public/js/components/jupyter/
│   └── JupyterComponent.js                    # 프론트엔드 컴포넌트
├── lib_storage/
│   └── s3Manager.js                           # NCP Object Storage 클라이언트
└── .env                                        # 환경 변수 (자격 증명)
```

---

## 🔧 환경 변수

### `.env` 파일 설정
```bash
# NCP Object Storage 설정
AWS_REGION=kr
BUCKET_NAME=educodingnplaycontents
S3_ENDPOINT_URL=https://kr.object.ncloudstorage.com
S3_ASSET_URL=https://onag54aw13447.edge.naverncp.com
AWS_ACCESS_KEY_ID=ncp_iam_BPxxx...
AWS_SECRET_ACCESS_KEY=ncp_iam_BPxxx...
```

### Docker 환경 변수 전달
```yaml
# docker-compose.yml
environment:
  - JUPYTER_PORT=8888
  - AWS_REGION=${AWS_REGION:-kr}
  - S3_BUCKET_NAME=${S3_BUCKET_NAME:-educodingnplaycontents}
  - S3_ENDPOINT_URL=https://kr.object.ncloudstorage.com
  - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
  - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
```

---

## 🚀 배포/재시작 절차

```bash
# 1. 코드 수정 후
cd /var/www/html

# 2. Node.js 서버 재시작
pm2 restart server

# 3. Jupyter 컨테이너 재시작
docker-compose restart jupyter

# 4. 로그 확인
docker logs -f educodingnplay-jupyter

# 5. Node.js 로그 확인
pm2 logs server
```

---

## 📝 참고 사항

1. **S3 마운트 vs 로컬 파일시스템**
   - 현재: 로컬 파일시스템 사용 (S3 마운트 실패)
   - 향후: S3 마운트 성공 시 NCP Object Storage 직접 사용
   - 장점: 여러 서버 간 파일 공유, 백업 자동화

2. **보안**
   - Jupyter는 인증 없음 (`--NotebookApp.token=''`)
   - 외부 접근은 Apache 프록시로 제한
   - 사용자별 디렉토리 격리

3. **성능**
   - 로컬 파일시스템: 빠름
   - S3 마운트 (s3fs): 네트워크 레이턴시 있음
   - 대용량 파일은 로컬 캐시 권장

---

## 🔍 트러블슈팅

### Jupyter 503 에러
```bash
# 1. Jupyter 서버 상태 확인
docker ps | grep jupyter

# 2. 컨테이너 로그 확인
docker logs educodingnplay-jupyter --tail 100

# 3. 파일 존재 여부 확인
docker exec educodingnplay-jupyter ls -la /app/jupyter_notebooks/users/
```

### 인증 401 에러
```bash
# 1. 세션 확인
# 브라우저 개발자 도구 → Application → Cookies

# 2. 임시 우회 확인
# routes/api/jupyterRouter.js에서 requireAuth 제거 여부 확인

# 3. 서버 로그 확인
pm2 logs server | grep jupyter
```

---

## ✅ 체크리스트

### 마이그레이션 완료 전
- [x] NCP Object Storage 설정
- [x] 환경 변수 설정
- [x] Jupyter 서버 실행
- [x] 인증 우회 (임시)
- [ ] S3 마운트 성공
- [ ] DB 복원
- [ ] 마크다운 파일 복사

### DB 복원 후
- [ ] 인증 미들웨어 복원
- [ ] 게스트 ID 로직 복원
- [ ] 로그인/로그아웃 테스트
- [ ] 사용자별 노트북 생성 테스트
- [ ] 권한 체크 테스트

---

**작성일:** 2026-01-13
**작성자:** Claude Code Assistant
**상태:** 진행 중 (DB 복원 대기)
