# 🌌 MyUniverse - 통합 학습 포털 정책 명세서 v1.1

> **"나만의 우주를 탐험하고, 별자리를 만들고, 이야기를 기록하는 곳"**

---

## 📋 문서 정보

| 항목 | 내용 |
|------|------|
| 문서명 | MyUniverse 통합 학습 포털 정책 명세서 |
| 버전 | 1.1 (Implemented) |
| 작성일 | 2025-12-30 |
| 상태 | **구현 완료 (Phase 1~3)** |

---

## 1. 개요

### 1.1 프로젝트 명칭
**MyUniverse (마이유니버스)**
- 라우트: `/my-universe`
- 한글 표기: "마이유니버스" 또는 "나의 우주"

### 1.2 핵심 컨셉
모든 학습 여정이 하나의 우주로 연결됩니다.
- **Timeline**: 학습, 과제, 문제 풀이 등 모든 활동의 통합 기록
- **Problem Solving**: Python 및 COS Pro 문제 해결 성과 리스트
- **Observatory**: 3D로 시각화된 나의 CT(Computational Thinking) Connectome

---

## 2. 구현된 기능 (Implemented Features)

### 2.1 📅 타임라인 (Timeline)
- **기능**: 학습 활동을 시간 순으로 통합 시각화
- **데이터 통합**:
  - `LearningLogs`: 콘텐츠 학습 이력
  - `ProjectSubmissions`: Entry, Scratch 프로젝트 제출 및 저장
  - `QuizResults`: Python 문제 풀이 결과
- **구현 특징**:
  - `UNION ALL` 쿼리를 통한 이종 데이터 통합
  - 활동 타입별 아이콘 및 상태 메시지 자동 생성
  - 클릭 시 해당 프로젝트 에디터 또는 문제 페이지로 바로 이동

### 2.2 ✅ 문제 풀이 (Problem Solving)
- **기능**: "Problem Solving" 탭에서 문제 해결 현황 확인
- **구현 특징**:
  - Python 문제 제출 시 백엔드(`PythonProblemManager.js`)에서 `QuizResults` 테이블에 자동 로깅
  - `QuizResults` 스키마 개선: `problem_number` 길이 확장(`VARCHAR(100)`), `timestamp` 컬럼 사용

### 2.3 🌌 Observatory (관측소)
- **기능**: CT 역량을 3D 별자리(Connectome)로 시각화
- **기술 스택**: Three.js 기반 `ObservatoryComponent.js`
- **구현 특징**:
  - `/api/connectome-data`: 노드(Node)와 간선(Edge) 데이터 제공
  - **Auto-Migration**: 서버 시작 시 `schemaInit.js`를 통해 `CT_Edges`, `User_Personality` 테이블 자동 생성 및 시딩
  - 3D 뷰어: 마우스 인터렉션(회전, 줌) 지원

---

## 3. 데이터베이스 구조 (Implemented Schema)

### 3.1 주요 테이블
| 테이블 | 역할 | 비고 |
|--------|------|------|
| `LearningLogs` | 학습 콘텐츠 이력 | 기존 유지 |
| `ProjectSubmissions` | 프로젝트 활동 이력 | Entry/Scratch 통합 |
| `QuizResults` | 문제 풀이 결과 | 로그 통합됨 (기존 `ProblemSubmissions` 대체) |
| `CT_Nodes` | CT 핵심 개념 정의 | 'loop', 'condition' 등 (시딩 완료) |
| `CT_Edges` | 개념 간 연결 관계 | **[New]** Auto-migrated |
| `User_Connectome` | 사용자별 CT 점수 | 문제 풀이 시 자동 업데이트 |
| `User_Personality` | 사용자 성향/페르소나 | **[New]** Auto-migrated |

### 3.2 스키마 변경 사항 (v1.1)
1. **`QuizResults`**:
   - `problem_number`: `VARCHAR(100)`으로 확장
   - `user_answer`: `TEXT` 타입 (코드 저장용)
2. **`CT_Edges`** (신규):
   - `source_node_id`, `target_node_id`, `relationship_type`, `strength`
3. **`User_Personality`** (신규):
   - `user_id`, `primary_archetype`, `traits` (JSON)

---

## 4. API 명세 (Implemented APIs)

### 4.1 View Routes
- `GET /my-universe/timeline`: 통합 타임라인 뷰
- `GET /my-universe/problems`: 문제 풀이 리스트 뷰
- `GET /my-universe/observatory`: 3D 관측소 뷰 (학생 본인)
- `GET /my-universe/student/:id/observatory`: 교사용 학생 관측소 조회

### 4.2 Data APIs
- `GET /api/connectome-data`: CT 노드/엣지 및 사용자 활성도 반환
- `POST /api/submit-solution`: Python 문제 제출 (채점 + 로깅 + CT 점수 업데이트)

---

## 5. 향후 계획 (Future Roadmap)

### Phase 4: 갤러리 (Gallery) - 예정
- 완성된 프로젝트를 공유하고 전시하는 공간
- Pong2 커뮤니티와의 연동 (공개 범위 설정)

### Phase 5: 블로그 (Blog) - 예정
- 마크다운/블록 기반 학습 일지 작성
- 프로젝트/코드 임베딩 지원

---

**📅 최종 업데이트**: 2025-12-30
**👤 작성자**: AI Assistant
