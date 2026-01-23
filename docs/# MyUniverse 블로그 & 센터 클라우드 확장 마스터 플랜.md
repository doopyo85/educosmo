# 5. 🌌 MyUniverse 블로그 & 센터 클라우드 확장 마스터 플랜
**문서 버전:** 2.1 (Teacher Blog Added)  
**작성일:** 2026-01-23  
**변경 내역:**
- 문서 제목 변경 (기존: 통합 마스터 플랜)
- **교사 블로그 (EduPlan)** 개념 및 기능 명세 추가

---

## 📖 1. 개요 (Overview)
본 문서는 **Educosmo/Pong2 플랫폼의 차세대 통합 시스템**인 "MyUniverse"의 전체 기술 및 비즈니스 설계를 담고 있습니다.  
기존 MyUniverse에 **블로그(StarDiary)**, **교사 수업 자료실(EduPlan)**, **센터 클라우드(CloudBoard)** 기능을 통합하여 B2B SaaS 모델을 완성하는 것이 목표입니다.

### 1.1 핵심 에코시스템 (Three Pillars)
1.  **Student Blog (개인):** 자신의 학습 포트폴리오(엔트리/스크래치/Python)를 축적하고 공유하는 공간.
2.  **Teacher Blog (교사):** 교안 및 문제(`.py`, `.md`)를 작성하고 플랫폼(문제은행)에 바로 업로드하는 전문가 공간. *(신규 추가)*
3.  **Center Blog (센터):** 소속 학생들의 포트폴리오를 큐레이션하고 센터 전체를 브랜딩하는 홈페이지.

---

## 🏗️ 2. 시스템 아키텍처 (System Architecture)

### 2.1 인프라 구조 (NCP 기반)
*   **Server:** NCP Server (IP: 101.79.11.188) - Express.js Node.js 서버
*   **Storage:** NCP Object Storage (`educodingnplaycontents` 버킷)
*   **Database:** MySQL 8.0 (Docker)

### 2.2 도메인 전략 (SSR 기반)
*   **메인 플랫폼:** `pong2.app`
*   **유저/교사 블로그:** `*.pong2.app` (SSR)
    *   학생: `doopyo.pong2.app`
    *   교사: `teacher-kim.pong2.app`
*   **센터 클라우드:** `gangnam.pong2.app`

---

## 📝 3. 블로그 유형별 상세 명세

### 3.1 StarDiary (학생 개인 블로그)
*   **목적:** 포트폴리오 축적 및 자기표현
*   **주요 기능:**
    *   학습 타임라인 자동 기록 (프로젝트 제출 내역)
    *   노션 스타일의 자유로운 글 작성
    *   외부 공유 가능한 퍼스널 브랜딩 페이지

### 3.2 EduPlan Blog (교사 블로그) **(✨ New)**
*   **목적:** 수업 자료 아카이빙 및 플랫폼 콘텐츠 기여(Admin 역할 겸용)
*   **URL:** `teacher-{name}.pong2.app` (또는 커스텀)
*   **핵심 기능:**
    1.  **교안 업로드 시스템:**
        *   Markdown(`.md`) 파일 업로드 → 블로그 게시글로 자동 변환 및 렌더링.
        *   Python(`.py`) 파일 업로드 → 구문 강조된 코드 블록으로 변환 및 실행 가능한 예제로 삽입.
    2.  **플랫폼 퍼블리싱 (Publish to Platform):**
        *   블로그에 작성한 내용을 클릭 한 번으로 **"문제은행"** 또는 **"공식 강의자료"**로 등록.
        *   **문제은행 연동:** `.py` 파일 업로드 시 [문제 설명/입력예시/출력예시/정답코드] 메타데이터를 파싱하여 `ProblemBank` 테이블에 Draft 상태로 등록.
    3.  **리소스 뱅크:**
        *   수업에 필요한 이미지, PDF 등을 체계적으로 관리하는 파일 보관함.
    4.  **권한 관리:**
        *   일부 게시글은 "내 센터 학생 공개" 또는 "동료 교사 공개"로 설정 가능.

### 3.3 Center CloudBoard (센터 홈페이지)
*   **목적:** 센터 브랜딩 및 학생 관리
*   **주요 기능:**
    *   패들렛 스타일의 자료 공유 (공지, 과제)
    *   소속 학생 블로그 모아보기 (Showcase)
    *   센터 전체 스토리지 용량 관리

---

## 💾 4. 멀티미디어 업로드 시스템
**공통 기능:** 드래그 앤 드롭 업로드, 임시 파일 관리, 자동 TTL 삭제 (전체 블로그 공통 적용)

---

## 💰 5. B2B SaaS 요금제 및 등급

### 5.1 계정 등급 설계 (교사 등급 추가)

| 구분 | 🆓 **Pong2 계정** (학생) | 🎓 **EduPlan 계정** (교사) | 💼 **Center 계정** (센터) |
| :--- | :--- | :--- | :--- |
| **타겟** | 일반 학생 | 개인 교사, 강사 | 학원/학교 운영자 |
| **블로그 Type** | **StarDiary** (포트폴리오) | **EduPlan Blog** (교안/문제) | **CloudBoard** (자료실) |
| **특화 기능** | 프로젝트 자동 수집 | **플랫폼 업로드(문제출제)** | 학생/강사 관리, 결제 |
| **스토리지** | 500 MB | **5 GB** | **30 GB** (공용) |
| **월 요금** | 무료 | 무료 (초대) / 유료 (프리랜서) | ₩110,000 |

---

## 🚀 6. 구현 로드맵 (업데이트)

### Phase 1: NCP 인프라 & DNS (완료)
### Phase 2: DB 스키마 & 백엔드 (완료)
*   [✅] 블로그 3유형(`user`, `teacher`, `center`) 지원을 위한 ENUM 확장 필요
    *   `blog_type` ENUM('user', 'center') -> ENUM('user', 'teacher', 'center')로 변경

### Phase 3: 블로그 & 센터 클라우드 (진행 중)
*   [✅] SSR 서버 구축
*   [🟡] 학생 블로그 UI 구현
*   [⬜] **교사 블로그 특화 기능 구현** (상세 기술 명세)
    *   **DB Schema (`teacher_posts`)**:
        ```sql
        CREATE TABLE teacher_posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id INT NOT NULL,
            title VARCHAR(200) NOT NULL,
            content_md TEXT,                    -- 마크다운 원본
            content_html TEXT,                  -- 렌더링된 HTML
            is_published BOOLEAN DEFAULT FALSE, -- 내부 발행 여부
            tags JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teacher_id) REFERENCES Users(id)
        );
        ```
    *   **Routes**:
        *   `GET /teacher/blog`: 교사 블로그 대시보드
        *   `GET /teacher/blog/write`: 글쓰기 에디터 (ToastUI/Editor.js + MD)
        *   `POST /api/teacher/posts`: 교안 저장/발행

### Phase 4: B2B SaaS 기능 (80% 완료)

---

## ✅ 7. 결론
교사 블로그의 추가로 MyUniverse는 단순 학습 기록장을 넘어, **양질의 교육 콘텐츠가 생산되고 유통되는 플랫폼**으로 확장됩니다. 교사들은 자신의 노하우를 블로그에 쌓는 동시에 플랫폼의 콘텐츠 생태계에 기여하게 됩니다.
