# 시스템 마이그레이션 및 포트 충돌 해결 보고서
**작성일:** 2025-12-19

## 1. 개요
본 문서는 PM2 기반의 메인 웹 서버와 Docker 기반의 실행 환경(Jupyter, Judge0) 간의 포트 충돌(3000번) 문제를 해결하고, 안정적인 서비스 분리 구조를 확립한 내용을 기술합니다.

## 2. 문제 상황 (As-Is)
- **증상:** 배포 후 메인 웹 서버 로그인 불가 및 503 에러 발생.
- **원인:**
    1. **포트 충돌:** `docker-compose`로 실행된 `educoding-app` 컨테이너가 3000번 포트를 점유하여, 로컬 PM2 서버가 실행되지 못함.
    2. **DB 분리(Split-Brain):** Docker 컨테이너 내부의 격리된(빈) DB를 바라보고 있어 사용자 정보가 조회되지 않음.
    3. **IPv6 이슈:** Node.js 17+ 환경에서 `localhost`가 IPv6(`::1`)로 우선 해석되어, IPv4(`127.0.0.1`)에 바인딩된 Docker 서비스와 연결 실패 (503 에러).

## 3. 변경 사항 (To-Be)

### 3.1 아키텍처 구조 변경
서비스를 호스트 실행(Native)과 격리 실행(Docker)으로 명확히 분리하였습니다.

| 서비스명 | 실행 주체 | 포트 | 역할 | 비고 |
|---|---|---|---|---|
| **Main Server** | **PM2 (Host)** | **3000** | 웹 서비스, 로그인, DB 연결, API | 기존 시스템 유지 |
| **Jupyter** | Docker | **8888** | Python 노트북 실행 환경 | 독립 컨테이너 운영 |
| **Judge0** | Docker | **2358** | 코드 채점 엔진 | 독립 컨테이너 운영 |

### 3.2 주요 파일 수정 내역

#### 1) `docker-compose.yml`
- **변경:** 메인 웹 서버(`app`) 서비스 정의 제거.
- **이유:** PM2로 구동되는 메인 서버와 충돌 방지.
- **변경:** `jupyter` 서비스에 `build: .` 컨텍스트 추가하여 독립적으로 이미지 빌드 가능하도록 수정.

#### 2) `ecosystem.config.js`
- **변경:** `server` 앱의 환경 변수 추가
    - `JUPYTER_HOST`: `'127.0.0.1'` (IPv6 이슈 해결을 위해 IP 명시)
    - `JUPYTER_PORT`: `8888`
    - `JUDGE0_API_URL`: `'http://localhost:2358'`
- **변경:** 레거시 `jupyter-server` (PM2 관리 프로세스) 삭제.

#### 3) `public/js/components/ide/IDEComponent.js`
- **버그 수정:** 존재하지 않는 부모 메서드(`super.setupDownloadButton()`) 호출로 인한 초기화 크래시 수정.

## 4. 검증 결과
- **웹 서버:** 3000번 포트 정상 구동, 로그인 및 기존 DB 데이터 접근 성공.
- **채점 서버:** `curl http://localhost:2358/about` -> 정상 응답 확인.
- **노트북 서버:** `curl -I http://localhost:8888` -> TornadoServer 헤더 확인 (연결 성공).
- **IDE:** 화면 로딩 정상화 및 코드 다운로드/실행 기능 복구 확인.

## 5. 배포 가이드
서버에 변경 사항 적용 시 아래 절차를 따릅니다.

```bash
# 1. 파일 업데이트
git pull origin main

# 2. Docker 재구동 (Jupyter/Judge0만 실행됨)
docker-compose down
docker-compose up -d --build

# 3. PM2 설정 재로드 (환경변수 적용 필수)
pm2 delete server
pm2 start ecosystem.config.js
```
