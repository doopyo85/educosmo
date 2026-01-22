# Docker 도입 및 인프라 정책 (Docker Adoption Policy)

**작성일**: 2025-12-18
**버전**: 1.0
**상태**: **채택됨 (Approved)**

---

## 1. 배경 및 문제 의식 (Background)

`educodingnplay` 플랫폼은 다양한 코딩 교육 도구(Entry, Python, Jupyter)를 통합 제공하는 과정에서 다음과 같은 구조적 한계와 보안 위협에 직면했습니다.

### 1.1 주요 이슈 (Issues)
1.  **보안 취약점 (Security Vulnerability)**
    *   Python 코드가 `child_process`를 통해 호스트 OS(NCP Server)에서 직접 실행됩니다.
    *   악의적인 코드(`rm -rf`, `fork bomb` 등) 공격 시 서버 전체가 마비될 위험이 있습니다.
2.  **환경 파편화 (Environment Fragmentation)**
    *   개발 환경(Windows)과 운영 환경(Ubuntu)의 차이로 인해 `npm` 의존성 및 Python 라이브러리 버전 불일치 문제가 발생합니다.
3.  **Jupyter 격리 부재**
    *   단일 Jupyter 서버를 공유하므로 사용자 간 변수/파일 간섭 및 시스템 명령 실행 제어가 어렵습니다.

---

## 2. 현재 기술 스택 (Current Stack)

*   **Runtime**: Node.js 16+, Python 3.x
*   **Backend Framework**: Express.js (Monolithic)
*   **Database**: MySQL (User Data, NCP Cloud DB), Redis (Session/Cache)
*   **Execution Model**:
    *   **Python**: `spawn` 프로세스 실행 (Host 직접 실행)
    *   **Jupyter**: 단일 `jupyter notebook` 서버 실행 + 사용자별 폴더 분기

---

## 3. 도입 솔루션 및 분석 (Solutions)

보안성과 운영 효율성을 동시에 확보하기 위해 **"Microservices 지향형 컨테이너 아키텍처"**로 전환합니다.

### 3.1 채점/실행 엔진: Judge0 (오픈소스)
*   **역할**: Python/C/Java 등 코드 실행 및 정답 비교 전담.
*   **장점 (Pros)**:
    *   Docker Sandbox 기반의 강력한 보안 격리.
    *   표준화된 REST API 제공으로 백엔드 로직 단순화.
    *   다양한 언어 즉시 지원 가능.
*   **단점 (Cons)**:
    *   별도의 컨테이너(API, Worker, DB) 리소스 소모.

### 3.2 Jupyter 환경: Single Container Dockerization
*   **전략**: "사용자별 컨테이너 생성(Per-User)" 대신 **"기존 단일 서버를 컨테이너로 감싸는 방식(Single Container)"** 채택.
*   **이유**: 사용자별 컨테이너 동적 생성은 구현 난이도(포트 관리, 수명주기 관리)가 매우 높음.
*   **장점 (Pros)**:
    *   **Host Protection**: 사용자가 시스템을 파괴해도 컨테이너만 재시작하면 호스트(Server)는 안전함.
    *   **구현 용이성**: 기존 파일 기반 분기 로직 재사용 가능.
*   **단점 (Cons)**:
    *   여전히 사용자 간 완벽한 리소스 격리는 안 됨 (Phase 2에서 해결).

---

## 4. 구현 및 전환 방향성 (Roadmap)

### [Phase 1] 호스트 보안 및 환경 표준화 (즉시 실행)
가장 시급한 **"서버가 죽지 않게 하는 것"**에 집중합니다. `Nginx` 없이 NCP Load Balancer가 트래픽을 처리합니다.

1.  **Docker Compose 구성**:
    *   `app` (Node.js Main Server)
    *   `judge0` (Code Execution Engine)
2.  **App 컨테이너화**:
    *   Node.js 앱을 Docker Image로 빌드.
    *   Jupyter도 이 컨테이너 내부(또는 별도 컨테이너)에서 실행하여 호스트와 격리.
3.  **코드 실행 위임**:
    *   기존 `PythonRunner` -> `Judge0 API` 호출로 변경.

### [Phase 2] 고도화 (추후 과제)
1.  **JupyterHub 도입**: 사용자 간 완전 격리가 필요할 시점(동접자 증가 등)에 공식 JupyterHub 이미지를 도입.
2.  **CI/CD**: GitHub Actions와 연동하여 자동 배포 파이프라인 구축.

---

## 5. 결론 (Conclusion)

본 정책은 **"이상적인 아키텍처(Per-User Container)"보다는 "현실적인 보안/안정성(Host Isolation)"을 우선**합니다.
Docker 도입을 통해 `educodingnplay`는 더 안전하고 이식성 높은 플랫폼으로 진화할 것입니다.
