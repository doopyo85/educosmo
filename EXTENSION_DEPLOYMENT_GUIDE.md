# 📦 코딩앤플레이 확장프로그램 배포 가이드

## 📋 개요

이 문서는 코딩앤플레이 학습도우미 Chrome/Edge 확장프로그램의 배포 절차를 안내합니다.

## 🎯 배포 전 체크리스트

### 1. 확장프로그램 파일 준비

- [x] manifest.json
- [x] background.js
- [x] content.js
- [x] content-codingnplay.js
- [x] popup UI (HTML, CSS, JS)
- [x] styles/floating.css
- [x] lib/utils.js
- [x] README.md
- [ ] 아이콘 이미지 (icon16.png, icon48.png, icon128.png)

### 2. 서버 API 준비

- [x] `/api/extension/mission/:missionId` - 과제 정보 조회
- [x] `/api/extension/upload-url` - S3 Presigned URL 발급
- [x] `/api/extension/submit` - 제출 정보 저장
- [x] `/api/extension/submissions` - 제출 내역 조회
- [x] CORS 설정 (Chrome Extension Origin 허용)

### 3. 웹사이트 연동

- [x] extension-bridge.js 추가
- [x] entry_project.ejs 수정
- [x] scratch_project.ejs 수정
- [x] appinventor_project.ejs 수정
- [x] /extension-guide 페이지 생성

## 🚀 배포 절차

### Step 1: 아이콘 생성

확장프로그램에는 3가지 크기의 아이콘이 필요합니다.

**방법 1: 온라인 도구 사용**
```bash
# 브라우저에서 아래 파일을 열고 아이콘 생성
educodingnplay/extension/icons/generate_icons.html
```

**방법 2: 디자인 툴 사용**
- Figma, Canva 등에서 직접 제작
- 코딩앤플레이 브랜드 색상 사용 (#667eea, #764ba2)
- 투명 배경 PNG 형식

생성된 아이콘을 다음 위치에 저장:
```
educodingnplay/extension/icons/
├── icon16.png
├── icon48.png
└── icon128.png
```

### Step 2: 확장프로그램 패키징

```bash
cd educodingnplay
npm run package-extension
```

이 명령은 다음을 수행합니다:
1. `extension` 폴더의 모든 파일을 ZIP으로 압축
2. `public/extension/codingnplay-extension.zip` 생성
3. 웹사이트에서 다운로드 가능하도록 배포

### Step 3: 서버 배포

```bash
# Git에 변경사항 커밋
git add .
git commit -m "feat: Add Chrome Extension support for project submission"

# 서버에 배포
git push origin main

# 서버에서
cd /path/to/educodingnplay
git pull
pm2 restart educodingnplay
```

### Step 4: 데이터베이스 확인

필요한 테이블이 존재하는지 확인:

```sql
-- ProjectSubmissions 테이블 (이미 존재함)
SELECT * FROM ProjectSubmissions LIMIT 1;

-- 필요시 인덱스 추가
ALTER TABLE ProjectSubmissions
ADD INDEX idx_user_platform (user_id, platform);
```

### Step 5: 환경 변수 확인

`.env` 파일에 필요한 설정이 있는지 확인:

```env
# AWS S3 설정
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=codingnplay-learning-data

# 서버 설정
NODE_ENV=production
PORT=3000
```

## 📱 사용자 안내

### 확장프로그램 설치 안내

사용자는 다음 페이지에서 설치 가이드를 확인할 수 있습니다:
```
https://app.codingnplay.co.kr/extension-guide
```

### 주요 기능 안내

1. **프로젝트 열기**
   - 코딩앤플레이에서 과제 선택
   - "프로젝트 열기" 버튼 클릭
   - 공식 에디터가 새 탭으로 열림

2. **프로젝트 제출**
   - 에디터에서 작업 완료
   - 우측 상단 "제출하기" 버튼 클릭
   - 파일 업로드 또는 자동 추출 (Scratch 공유 프로젝트)

3. **제출 확인**
   - 제출 내역은 자동으로 저장
   - 교사는 학생 제출물을 확인 가능

## 🧪 테스트

### 로컬 테스트

1. **확장프로그램 설치**
   ```
   1. Chrome에서 chrome://extensions 열기
   2. 개발자 모드 켜기
   3. "압축해제된 확장 프로그램 로드" 클릭
   4. educodingnplay/extension 폴더 선택
   ```

2. **기능 테스트**
   - [ ] Entry 프로젝트 열기 및 제출
   - [ ] Scratch 프로젝트 열기 및 제출
   - [ ] App Inventor 프로젝트 열기 및 제출
   - [ ] 제출 내역 조회
   - [ ] 확장프로그램 미설치 시 안내 모달

3. **API 테스트**
   ```bash
   # 과제 정보 조회
   curl -X GET https://app.codingnplay.co.kr/api/extension/mission/test123 \
     -H "Cookie: your-session-cookie"

   # Upload URL 발급
   curl -X POST https://app.codingnplay.co.kr/api/extension/upload-url \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{
       "platform": "scratch",
       "missionId": "test123",
       "userId": "user123",
       "fileName": "project.sb3",
       "fileType": "application/octet-stream"
     }'
   ```

## 🔧 문제 해결

### 확장프로그램이 작동하지 않음

1. **CORS 오류**
   - server.js의 CORS 설정 확인
   - Chrome Extension Origin이 허용되었는지 확인

2. **API 호출 실패**
   - 네트워크 탭에서 요청 확인
   - 서버 로그 확인
   - 인증 쿠키 확인

3. **파일 업로드 실패**
   - S3 권한 확인
   - Presigned URL 만료 시간 확인
   - 파일 크기 제한 (50MB) 확인

### 제출 버튼이 표시되지 않음

1. 확장프로그램 설치 확인
2. content.js 로드 확인 (개발자 도구 콘솔)
3. 과제 정보가 chrome.storage에 저장되었는지 확인

## 📊 모니터링

### 주요 지표

- 확장프로그램 다운로드 수
- 제출 성공률
- API 응답 시간
- 오류 발생률

### 로그 확인

```bash
# 서버 로그
pm2 logs educodingnplay

# 특정 API 로그 검색
pm2 logs educodingnplay | grep "Extension"
```

## 🔄 업데이트 절차

1. **코드 수정**
   - extension 폴더의 파일 수정
   - manifest.json의 version 업데이트

2. **재패키징**
   ```bash
   npm run package-extension
   ```

3. **서버 배포**
   ```bash
   git add .
   git commit -m "chore: Update extension to v1.0.1"
   git push origin main
   ```

4. **사용자 안내**
   - 기존 사용자는 확장프로그램 재설치 필요
   - 공지사항으로 업데이트 안내

## 📝 체크리스트: 배포 완료 후

- [ ] 확장프로그램 ZIP 파일 생성 확인
- [ ] /extension-guide 페이지 접근 확인
- [ ] 모든 플랫폼(Entry, Scratch, App Inventor)에서 테스트
- [ ] 제출 데이터가 DB에 정상 저장되는지 확인
- [ ] S3에 파일이 정상 업로드되는지 확인
- [ ] 오류 로그 모니터링 설정
- [ ] 사용자 가이드 문서 배포
- [ ] 교사 대상 교육 자료 준비

## 📞 지원

문제 발생 시:
1. 서버 로그 확인
2. 브라우저 개발자 도구 콘솔 확인
3. GitHub Issues에 버그 리포트

---

**작성일**: 2025-01-02
**버전**: 1.0.0
**작성자**: educodingnplay team
