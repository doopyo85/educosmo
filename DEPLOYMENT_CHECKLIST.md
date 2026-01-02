# ✅ 배포 전 최종 체크리스트

## 🎯 즉시 해야 할 작업

### 1. 아이콘 생성 (필수)
**현재 상태**: ⚠️ 미완료

**방법 A: 자동 생성 도구 사용**
```bash
# 브라우저에서 열기
educodingnplay/extension/icons/generate_icons.html

# 각 다운로드 버튼 클릭:
1. icon16.png 다운로드
2. icon48.png 다운로드
3. icon128.png 다운로드

# 다운로드한 파일을 다음 위치로 이동:
educodingnplay/extension/icons/
```

**방법 B: 디자인 툴 사용**
- Figma/Canva에서 제작
- 크기: 16x16, 48x48, 128x128 픽셀
- 형식: PNG, 투명 배경
- 브랜드 색상: #667eea, #764ba2

✅ 완료 확인:
```bash
ls -la educodingnplay/extension/icons/
# icon16.png, icon48.png, icon128.png 파일 존재 확인
```

### 2. 확장프로그램 재패키징
**현재 상태**: ✅ 스크립트 준비 완료

아이콘 생성 후 실행:
```bash
cd educodingnplay
npm run package-extension
```

예상 결과:
```
✅ ZIP 파일 생성 완료!
📦 파일: .../public/extension/codingnplay-extension.zip
```

### 3. 로컬 테스트
**현재 상태**: ⚠️ 테스트 필요

#### 3.1 확장프로그램 설치
```
Chrome/Edge 브라우저:
1. chrome://extensions (또는 edge://extensions) 접속
2. 개발자 모드 ON
3. "압축해제된 확장 프로그램 로드" 클릭
4. educodingnplay/extension 폴더 선택
```

#### 3.2 기능 테스트
- [ ] Entry 프로젝트 열기 → 제출
- [ ] Scratch 프로젝트 열기 → 제출
- [ ] App Inventor 프로젝트 열기 → 제출
- [ ] 확장프로그램 미설치 시 안내 모달
- [ ] 제출 내역 조회 API
- [ ] /extension-guide 페이지 접근

### 4. 서버 배포
**현재 상태**: ⚠️ 배포 대기

```bash
# Git 커밋
git add .
git commit -m "feat: Add Chrome Extension for project submission

- Add extension files (manifest, background, content scripts)
- Add server API (/api/extension/*)
- Add extension-bridge.js for web integration
- Add /extension-guide page
- Update CORS settings for Chrome Extension
- Add package-extension script"

# 원격 저장소에 푸시
git push origin main

# 서버에서 배포
ssh your-server
cd /path/to/educodingnplay
git pull
npm run package-extension
pm2 restart educodingnplay
```

## 📋 배포 후 확인사항

### 서버 확인
- [ ] 서버가 정상 실행 중인지 확인
  ```bash
  pm2 status educodingnplay
  pm2 logs educodingnplay --lines 50
  ```

- [ ] API 엔드포인트 접근 확인
  ```bash
  # 과제 정보 조회 (인증 필요)
  curl https://app.codingnplay.co.kr/api/extension/mission/test

  # 확장프로그램 가이드 페이지
  curl https://app.codingnplay.co.kr/extension-guide
  ```

- [ ] ZIP 파일 다운로드 확인
  ```bash
  curl -I https://app.codingnplay.co.kr/extension/codingnplay-extension.zip
  # 200 OK 응답 확인
  ```

### 데이터베이스 확인
- [ ] ProjectSubmissions 테이블 존재 확인
  ```sql
  DESCRIBE ProjectSubmissions;
  ```

- [ ] 인덱스 추가 (선택사항, 성능 향상)
  ```sql
  ALTER TABLE ProjectSubmissions
  ADD INDEX idx_user_platform (user_id, platform);

  ALTER TABLE ProjectSubmissions
  ADD INDEX idx_created_at (created_at);
  ```

### S3 확인
- [ ] 버킷 존재 확인: `codingnplay-learning-data`
- [ ] IAM 권한 확인:
  - s3:PutObject
  - s3:GetObject
  - s3:GeneratePresignedUrl

### 웹사이트 확인
- [ ] https://app.codingnplay.co.kr/entry_project 접속
  - extension-bridge.js 로드 확인
  - 콘솔에 오류 없음

- [ ] https://app.codingnplay.co.kr/scratch_project 접속
  - extension-bridge.js 로드 확인

- [ ] https://app.codingnplay.co.kr/extension-guide 접속
  - 페이지 정상 렌더링
  - 다운로드 링크 작동

## 🧪 End-to-End 테스트

### 시나리오 1: Entry 제출
1. [ ] 코딩앤플레이 로그인
2. [ ] Entry 프로젝트 페이지 접속
3. [ ] 과제 카드에서 "프로젝트 열기" 클릭
4. [ ] playentry.org 에디터 열림 확인
5. [ ] 우측 상단에 "제출하기" 버튼 표시 확인
6. [ ] 과제 정보 배지 표시 확인
7. [ ] Entry에서 프로젝트 작성
8. [ ] "파일 → 내 컴퓨터에 저장" 실행
9. [ ] "제출하기" 버튼 클릭
10. [ ] 파일 선택 모달 표시
11. [ ] .ent 파일 선택
12. [ ] 진행 상태 모달 표시
13. [ ] "제출 완료" 모달 표시
14. [ ] DB에 데이터 저장 확인
15. [ ] S3에 파일 업로드 확인

### 시나리오 2: Scratch 제출 (공유 프로젝트)
1. [ ] Scratch 프로젝트 페이지 접속
2. [ ] "프로젝트 열기" 클릭
3. [ ] scratch.mit.edu 에디터 열림
4. [ ] 프로젝트 작성 및 "공유" 클릭
5. [ ] "제출하기" 버튼 클릭
6. [ ] 자동 추출 성공 확인
7. [ ] 제출 완료

### 시나리오 3: 확장프로그램 미설치
1. [ ] 확장프로그램 비활성화
2. [ ] "프로젝트 열기" 버튼 클릭
3. [ ] 설치 안내 모달 표시 확인
4. [ ] "설치 가이드 보기" 클릭
5. [ ] /extension-guide 페이지 열림

## 📊 모니터링 설정

### 로그 모니터링
```bash
# 실시간 로그 확인
pm2 logs educodingnplay

# Extension 관련 로그만 필터링
pm2 logs educodingnplay | grep -i extension

# 오류 로그만 확인
pm2 logs educodingnplay --err
```

### 주요 지표
- [ ] API 응답 시간 (< 1초)
- [ ] 파일 업로드 성공률 (> 95%)
- [ ] 오류 발생률 (< 5%)
- [ ] 동시 접속자 수

## 🎓 사용자 교육

### 교사 대상
- [ ] 확장프로그램 설치 가이드 전달
- [ ] 사용 방법 데모 진행
- [ ] 제출 내역 조회 방법 안내
- [ ] FAQ 문서 제공

### 학생 대상
- [ ] 확장프로그램 설치 안내 (단체 메일)
- [ ] 간단한 사용 가이드 (PDF/동영상)
- [ ] 문제 발생 시 연락처 안내

## 🚨 긴급 상황 대응

### 서버 다운
```bash
# PM2 재시작
pm2 restart educodingnplay

# 실패 시 강제 재시작
pm2 delete educodingnplay
pm2 start server.js --name educodingnplay
```

### 확장프로그램 오류
1. 사용자에게 재설치 안내
2. 브라우저 캐시 클리어 안내
3. 문제 지속 시 이전 버전으로 롤백

### 데이터베이스 문제
```bash
# 백업 확인
mysql -u root -p educodingnplay < backup.sql

# 테이블 복구
REPAIR TABLE ProjectSubmissions;
```

## ✅ 최종 체크리스트

배포 전:
- [ ] 아이콘 3개 생성 완료
- [ ] npm run package-extension 실행
- [ ] 로컬 테스트 완료
- [ ] Git 커밋 및 푸시
- [ ] 서버 배포

배포 후:
- [ ] 서버 정상 작동 확인
- [ ] API 엔드포인트 접근 확인
- [ ] ZIP 다운로드 확인
- [ ] 3개 플랫폼 E2E 테스트 완료
- [ ] 로그 모니터링 설정
- [ ] 사용자 교육 자료 배포

문서화:
- [x] EXTENSION_DEPLOYMENT_GUIDE.md
- [x] EXTENSION_IMPLEMENTATION_SUMMARY.md
- [x] DEPLOYMENT_CHECKLIST.md
- [x] extension/README.md

---

## 🎉 배포 완료 기준

모든 체크박스가 체크되면 배포 완료!

**예상 소요 시간**: 2-3시간
- 아이콘 생성: 30분
- 테스트: 1시간
- 배포 및 확인: 1시간

**담당자**: _____________
**완료 예정일**: _____________
**실제 완료일**: _____________

---

**마지막 업데이트**: 2025-01-02
