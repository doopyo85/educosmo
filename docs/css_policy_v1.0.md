# CSS 정책 및 현황 보고서 (v1.0)

**문서 생성일**: 2025-12-17  
**적용 대상**: EducodingNPlay 전체 프로젝트  
**정책 담당**: Antigravity (Agent)

---

## 1. CSS 아키텍처 표준 (6-Layer System)

모든 스타일 시트는 아래의 6가지 역할군으로 분류하여 관리합니다.

| Layer | 역할 (Role) | 파일 경로 및 패턴 | 관리 규칙 |
| :--- | :--- | :--- | :--- |
| **1. Global** | 전역 설정, 리셋, 공통 레이아웃 | `public/css/styles.css`<br>`public/css/common-layout.css` | 모든 페이지에 로드됨. 특정 페이지용 스타일 정의 금지. |
| **2. Component** | **디자인 시스템 코어** | **`public/css/apple-theme.css`** | 색상 변수(:root), 버튼(.apple-btn), 카드(.apple-card) 등 재사용 가능한 UI 모음. |
| **3. Project** | 프로젝트 카드 리스트 전용 | `public/css/card_project.css` | 스크래치/엔트리 등 프로젝트 선택 페이지의 그리드 및 카드 스타일. |
| **4. Dashboard** | 교사/관리자 대시보드 | `public/css/teacher/*.css`<br>`public/css/dashboard.css` | 데이터 테이블, 차트 등 관리자 전용 UI. 일반 사용자와 스타일 분리. |
| **5. Header** | 상단 네비게이션바 | `public/css/header.css` | 헤더, 메뉴 드롭다운, 프로필 모달. z-index 충돌 주의. |
| **6. Board** | 게시판 시스템 | `public/css/board.css`<br>`public/css/board-layout.css` | 게시글 목록, 읽기, 쓰기 폼 스타일. |

---

## 2. 페이지별 CSS 사용 현황 (Usage Report)

2025-12-17 기준, 주요 페이지의 CSS 의존성 분석 결과입니다.

| 페이지 역할 | 파일명 (Views) | 사용 중인 주요 CSS 파일 | 비고 |
| :--- | :--- | :--- | :--- |
| **공통 (Layout)** | `partials/header.ejs` | `styles.css`<br>`header.css`<br>`board-notification.css` | 모든 페이지의 기본 스타일셋 |
| **메인 (Landing)** | `index.ejs` | `styles.css` | 추가적인 인라인 스타일이 일부 존재했으나 `styles.css`로 이관 권장 |
| **프로젝트 (List)** | `*_project.ejs`<br>(scratch, entry, appinventor) | `styles.css`<br>`card_project.css` | 프로젝트 카드 CSS가 독립적으로 분리되어 있음 |
| **게시판 (Board)** | `board/list.ejs` 등 | `styles.css`<br>`board-layout.css` | 인라인 스타일(`<style>`)이 다수 포함되어 있어 `board.css`로 리팩토링 필요 |
| **교사 (Teacher)** | `teacher/student-management.ejs` | `teacher/student-management.css` | 헤더(`header.ejs`)를 통한 `styles.css` 상속 여부 확인 필요 |
| **관리자 (Admin)** | `admin/dashboard.ejs` | `styles.css`<br>`dashboard.css` | Bootstrap 기반 위에 커스텀 스타일 적용 중 |

---

## 3. 향후 개선 로드맵

1.  **Apple Theme 통합**: 현재 `styles.css`와 `card_project.css`에 분산된 Apple 스타일 UI를 `apple-theme.css`로 중앙화.
2.  **게시판 스타일 분리**: `board/list.ejs` 등의 인라인 스타일을 `board.css`로 추출.
3.  **대시보드 표준화**: 교사 및 관리자 대시보드의 버튼/테이블 스타일을 `apple-theme.css` 기반으로 통일.

---
*이 문서는 프로젝트의 CSS 구조가 변경될 때마다 갱신되어야 합니다.*
