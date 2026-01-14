# Google Sheets API 설정 가이드

## 문제 상황
`POST /api/pong2/sheets/add-project` API 호출 시 "Login Required" 에러 발생.

**원인**: Google Sheets API에서 데이터를 **읽을 때**는 API Key로 충분하지만, **쓸 때**는 Service Account 인증이 필요합니다.

---

## 해결 방법

### 1. Google Cloud Console에서 Service Account 생성

#### 1.1 프로젝트 선택
1. https://console.cloud.google.com 접속
2. 기존 프로젝트 선택 또는 신규 생성

#### 1.2 Service Account 생성
1. 좌측 메뉴 > **IAM 및 관리자** > **서비스 계정**
2. **서비스 계정 만들기** 클릭
3. 이름 입력: `sheets-editor` (또는 원하는 이름)
4. 설명: `Google Sheets 데이터 쓰기용`
5. **만들기 및 계속하기** 클릭

#### 1.3 권한 부여 (선택사항, 스킵 가능)
- 이 단계는 스킵해도 됩니다 (구글 시트에서 직접 권한 부여)
- **완료** 클릭

#### 1.4 JSON 키 생성
1. 생성된 서비스 계정 클릭
2. **키** 탭 이동
3. **키 추가** > **새 키 만들기**
4. 키 유형: **JSON** 선택
5. **만들기** 클릭
6. JSON 파일 자동 다운로드 (안전한 곳에 보관!)

---

### 2. 구글 시트에 Service Account 권한 부여

#### 2.1 Service Account 이메일 복사
JSON 파일에서 `client_email` 값 복사:
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "sheets-editor@your-project.iam.gserviceaccount.com",  // 이 값 복사
  ...
}
```

#### 2.2 구글 시트 공유
1. 구글 시트 열기 (시트 ID: `1yEb5m_fjw3msbBYLFtO55ukUI0C0XkJfLurWWyfALok`)
2. 우측 상단 **공유** 버튼 클릭
3. 복사한 Service Account 이메일 입력
4. 권한: **편집자** 선택
5. **완료** 클릭

---

### 3. 서버 환경변수 설정

#### 3.1 JSON 키를 한 줄로 변환
```bash
# Linux/Mac
cat service-account-key.json | jq -c '.' | tr -d '\n'

# Windows PowerShell
Get-Content service-account-key.json | ConvertFrom-Json | ConvertTo-Json -Compress
```

#### 3.2 .env 파일에 추가
```bash
# educosmo/.env
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"sheets-editor@your-project.iam.gserviceaccount.com",...}'
```

**중요**:
- JSON 전체를 **작은따옴표(`'`)** 로 감싸기
- 줄바꿈 없이 한 줄로 입력
- Private key의 `\n`은 그대로 유지

#### 3.3 서버 재시작
```bash
cd educosmo
pm2 restart server
```

---

### 4. 테스트

#### 4.1 서버 로그 확인
```bash
pm2 logs server

# 성공 시:
✅ Google Sheets Service Account 인증 성공
Google Sheets API 초기화 성공
```

#### 4.2 API 테스트
pong2.app에서 프로젝트 추가 테스트:
1. 로그인
2. 아케이드/메타버스/HTML바이브코딩 카테고리 이동
3. +버튼 클릭
4. 프로젝트 정보 입력 후 등록

**성공 로그**:
```
📝 [Pong2] 프로젝트 추가 요청 - User: 홍길동, Category: 아케이드, Title: 테스트
🖼️ Thumbnail: https://...
✅ Google Sheets 데이터 추가 성공
✅ [Pong2] 프로젝트가 구글시트에 추가되었습니다.
```

---

## 트러블슈팅

### 에러: "Login Required"
**원인**: Service Account 인증이 안됨.

**확인**:
1. `GOOGLE_SERVICE_ACCOUNT_KEY` 환경변수가 설정되었는지 확인
2. JSON 형식이 올바른지 확인 (줄바꿈 없이 한 줄)
3. 서버를 재시작했는지 확인

### 에러: "The caller does not have permission"
**원인**: 구글 시트에 Service Account가 편집자로 추가되지 않음.

**해결**:
1. 구글 시트에서 **공유** 클릭
2. Service Account 이메일 추가 (JSON의 `client_email`)
3. 권한: **편집자** 선택

### 에러: "Invalid credentials"
**원인**: JSON 키가 잘못되었거나 만료됨.

**해결**:
1. Google Cloud Console에서 새 키 생성
2. `.env` 파일 업데이트
3. 서버 재시작

---

## 보안 주의사항

1. **JSON 키 파일 절대 Git에 커밋하지 말 것!**
   - `.gitignore`에 `*.json` 추가
   - 환경변수로만 관리

2. **Service Account 이메일은 공개 가능**
   - 이메일 자체는 비밀번호가 아님
   - Private key만 안전하게 보관

3. **권한 최소화**
   - Service Account에 꼭 필요한 시트만 공유
   - 불필요한 권한은 제거

---

## 대안: API Key만 사용 (읽기 전용)

만약 Service Account 설정이 어렵다면, 프론트엔드에서 직접 Google Sheets API를 호출하는 방법도 있습니다 (읽기 전용).

하지만 **쓰기 작업**은 반드시 Service Account 또는 OAuth가 필요합니다.

---

**작성일**: 2026-01-15
**버전**: v1.0
