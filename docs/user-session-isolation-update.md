# 사용자별 격리 시스템 업데이트 가이드

## 개요
ENT 파일 처리에서 사용자별 격리 시스템을 구현하여 동시 사용자 충돌을 방지하고 보안을 강화합니다.

## 변경된 구조

### 이전 구조
```
/var/www/html/temp/ent_files/
├── current/                    # 모든 사용자 공유
├── parse_xxx/                  # 임시 디렉토리 (누적 문제)
```

### 새로운 구조  
```
/var/www/html/temp/ent_files/
├── users/                      # 사용자별 격리
│   ├── user1_sessionId1/
│   ├── user1_sessionId2/
│   ├── user2_sessionId1/
│   └── ...
├── current -> users/latest/    # 심볼릭 링크 (하위 호환성)
└── parse_xxx/                  # 즉시 정리됨
```

## Apache 설정 업데이트 필요

현재 설정:
```apache
# ENT 이미지 고정 경로 서빙
Alias /entry/temp /var/www/html/temp/ent_files/current
```

업데이트 필요한 설정:
```apache
# 사용자별 세션 지원 (동적 경로)
Alias /entry/temp /var/www/html/temp/ent_files/current
# current는 심볼릭 링크로 최신 사용자 세션을 가리킴

# 또는 8070번 서버에서 정적 파일 서빙으로 변경 고려
```

## 8070번 서버 업데이트

### 정적 파일 서빙 추가
8070번 서버(entry/server.js)에서 직접 사용자별 파일을 서빙하도록 수정:

```javascript
// 사용자별 세션 파일 서빙
app.use('/temp', express.static('/var/www/html/temp/ent_files/users', {
    setHeaders: (res, path) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=3600');
    }
}));
```

### URL 파라미터 처리 업데이트
```javascript
// sessionID 파라미터 추가 처리
const params = new URLSearchParams(window.location.search);
const sessionID = params.get('sessionID');
const userID = params.get('userID');

// 프로젝트 데이터 로드 시 세션 정보 활용
```

## 기능 특징

### 1. 자동 세션 관리
- 사용자당 최대 3개 세션까지 유지
- 오래된 세션 자동 정리
- 1시간 후 세션 만료

### 2. 하위 호환성
- current 심볼릭 링크로 기존 시스템과 호환
- 기존 이미지 경로(/entry/temp/) 유지

### 3. 보안 강화
- 사용자별 완전 격리
- 세션 기반 접근 제어
- 자동 정리로 정보 유출 방지

## 배포 순서

1. **lib/entFileManager.js** 업데이트 (완료)
2. **routes/entryRouter.js** 업데이트 (완료)  
3. **서버 재시작** 후 테스트
4. **8070번 서버 업데이트** (선택사항)
5. **Apache 설정 최적화** (필요시)

## 모니터링 포인트

### 로그 확인
```bash
# 사용자 세션 생성 확인
grep "사용자별 세션 디렉토리 생성" /var/www/html/logs/*.log

# 세션 정리 확인  
grep "오래된 사용자 세션 삭제\|예약된 세션 정리" /var/www/html/logs/*.log
```

### 디렉토리 상태 확인
```bash
# 사용자별 세션 개수
ls -la /var/www/html/temp/ent_files/users/ | wc -l

# current 심볼릭 링크 상태
ls -la /var/www/html/temp/ent_files/current
```

## 문제 해결

### 세션 디렉토리 수동 정리
```bash
# 24시간 이상 된 사용자 세션 정리
find /var/www/html/temp/ent_files/users/ -type d -mtime +1 -exec rm -rf {} \;
```

### 심볼릭 링크 복구
```bash  
cd /var/www/html/temp/ent_files/