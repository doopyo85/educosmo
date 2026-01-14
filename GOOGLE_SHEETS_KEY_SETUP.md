# Google Service Account JSON 키 생성 가이드

## 현재 상태
- ✅ Service Account 생성 완료: `sheets-editor@educodingnplay.iam.gserviceaccount.com`
- ✅ 구글 시트에 편집자 권한 부여 완료
- ❌ JSON 키 파일 생성 필요

---

## JSON 키 생성 단계

### 1. Google Cloud Console 접속
1. https://console.cloud.google.com 접속
2. 프로젝트: `educodingnplay` 선택

### 2. Service Account 키 생성
1. 좌측 메뉴 > **IAM 및 관리자** > **서비스 계정**
2. `sheets-editor@educodingnplay.iam.gserviceaccount.com` 클릭
3. 상단 **키(Keys)** 탭 클릭
4. **키 추가** > **새 키 만들기** 클릭
5. 키 유형: **JSON** 선택
6. **만들기** 클릭
7. JSON 파일이 자동으로 다운로드됩니다 (예: `educodingnplay-xxxxx.json`)

⚠️ **중요**: 다운로드된 JSON 파일을 안전한 곳에 보관하세요!

---

## JSON 키를 환경변수로 설정

### Windows PowerShell에서 실행

```powershell
# 1. 다운로드 폴더로 이동 (JSON 파일이 있는 곳)
cd C:\Users\User\Downloads

# 2. JSON 파일을 한 줄로 변환
Get-Content educodingnplay-xxxxx.json | ConvertFrom-Json | ConvertTo-Json -Compress
```

**출력 예시** (매우 긴 한 줄):
```
{"type":"service_account","project_id":"educodingnplay","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIE...","client_email":"sheets-editor@educodingnplay.iam.gserviceaccount.com",...}
```

### educosmo/.env 파일 수정

1. `C:\Users\User\Documents\pioneer\educosmo\.env` 파일 열기
2. 마지막 줄의 `'여기에_JSON_키를_붙여넣으세요'`를 위에서 복사한 JSON으로 교체

**최종 형태**:
```bash
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"educodingnplay",...}'
```

**주의사항**:
- JSON 전체를 **작은따옴표 `'`로 감싸기**
- 줄바꿈 없이 한 줄로
- Private key의 `\n`은 그대로 유지

### 서버 재시작

```bash
cd C:\Users\User\Documents\pioneer\educosmo
pm2 restart server
pm2 logs server
```

**성공 로그 확인**:
```
✅ Google Sheets Service Account 인증 성공
Google Sheets API 초기화 성공
```

---

## 트러블슈팅

### Q: JSON 파일이 다운로드되지 않아요
**A**: 브라우저의 다운로드 폴더 확인 또는 팝업 차단 해제

### Q: JSON 변환 명령어가 안돼요
**A**: PowerShell을 관리자 권한으로 실행하거나, 파일 경로를 전체 경로로 입력
```powershell
Get-Content "C:\Users\User\Downloads\educodingnplay-xxxxx.json" | ConvertFrom-Json | ConvertTo-Json -Compress
```

### Q: pm2 명령어가 안돼요
**A**: educosmo 폴더에서 실행하는지 확인
```bash
cd educosmo
pm2 restart server
```

---

**작성일**: 2026-01-15
