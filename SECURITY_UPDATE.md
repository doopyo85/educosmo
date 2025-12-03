# 🔐 AWS IAM Role 보안 업데이트 (2024-12-03)

## ✅ 변경 사항

### 1. S3Manager IAM Role 지원 추가
- **파일**: `lib_storage/s3Manager.js`
- **변경 내용**: 
  - EC2 IAM Role을 통한 자동 인증 지원
  - 프로덕션: IAM Role 사용 (액세스 키 불필요)
  - 개발: 환경 변수 사용 (선택적)

### 2. 환경 변수 보안 강화
- **파일**: `.env`
- **변경 내용**:
  - AWS 액세스 키 제거 (주석 처리)
  - IAM Role 사용 안내 추가
  - 노출된 키 표시 (사용 금지)

### 3. .gitignore 업데이트
- **파일**: `.gitignore`
- **변경 내용**:
  - `.env` 파일 추가
  - AWS 자격 증명 파일 차단
  - 민감 정보 파일 전체 차단

---

## 🚀 배포 방법

### 배포 전 확인사항
- ✅ AWS IAM Role `s3-access` 생성 완료
- ✅ EC2 인스턴스에 IAM Role 연결 완료
- ✅ 로컬 코드 수정 완료

### 배포 실행

```bash
# 배포 스크립트 실행
##deploy.bat
```

입력할 커밋 메시지:
```
🔐 AWS IAM Role 보안 업데이트

- S3Manager IAM Role 지원 추가
- 액세스 키 제거 (IAM Role 사용)
- .env 보안 강화
- .gitignore 업데이트
```

---

## 🔍 배포 후 확인사항

### 1. 서버 로그 확인

```bash
ssh -i "C:\Users\User\Documents\pioneer\1. aws\pioneer.pem" ubuntu@ec2-43-202-0-141.ap-northeast-2.compute.amazonaws.com

# 로그 확인
pm2 logs server

# 찾아야 할 메시지:
# ✅ "🔐 프로덕션 환경: IAM Role로 AWS 자격 증명 사용"
```

### 2. S3 기능 테스트

브라우저에서 다음 기능 테스트:
- [ ] 프로젝트 파일 업로드
- [ ] 프로젝트 파일 다운로드
- [ ] 파일 목록 보기
- [ ] 파일 삭제

### 3. 에러 발생 시

**증상: "Unable to locate credentials"**

```bash
# EC2 IAM Role 확인
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# 출력: s3-access (역할 이름이 나와야 함)
# 404 에러: IAM Role이 연결되지 않음
```

**해결 방법:**
1. AWS Console → EC2 → 인스턴스 선택
2. 작업 → 보안 → IAM 역할 수정
3. `s3-access` 역할 선택

---

## 📋 체크리스트

### 로컬 (완료)
- [x] s3Manager.js IAM Role 지원 추가
- [x] .env 파일에서 액세스 키 제거
- [x] .gitignore 업데이트

### AWS (완료 여부 확인 필요)
- [ ] IAM 정책 생성 (`educodingnplay-s3-access`)
- [ ] IAM 역할 생성 (`s3-access`)
- [ ] EC2에 역할 연결
- [ ] 노출된 액세스 키 삭제 (AWS IAM 콘솔)

### 배포 (진행 예정)
- [ ] Git 커밋 & 푸시
- [ ] 서버에 배포
- [ ] 로그 확인
- [ ] 기능 테스트

---

## 🎯 이점

### 보안
- ✅ 액세스 키가 코드에 없음
- ✅ Git에 민감 정보 없음
- ✅ 자동 자격 증명 갱신

### 관리
- ✅ 키 로테이션 불필요
- ✅ 키 관리 부담 없음
- ✅ AWS 권장 방식

---

## 📞 문제 발생 시

1. **pm2 로그 확인**: `pm2 logs server`
2. **IAM Role 확인**: EC2 메타데이터 조회
3. **백업 복구**: `cp lib_storage/s3Manager.js.backup lib_storage/s3Manager.js`

---

## 📚 관련 문서

- `docs/AWS_보안_강화_가이드.md` - 전체 보안 가이드
- `docs/README_보안사고대응.md` - 보안 사고 대응 요약
- `.gitignore` - Git 제외 파일 목록
