# 🌌 MyUniverse - 통합 학습 포털 정책 명세서 v1.0

> **"나만의 우주를 탐험하고, 별자리를 만들고, 이야기를 기록하는 곳"**

---

## 📋 문서 정보

| 항목 | 내용 |
|------|------|
| 문서명 | MyUniverse 통합 학습 포털 정책 명세서 |
| 버전 | 1.0 |
| 작성일 | 2025-12-27 |
| 상태 | 초안 (Draft) |

---

## 1. 개요

### 1.1 프로젝트 명칭 제안

| 후보 | 의미 | 장점 | 단점 |
|------|------|------|------|
| **MyUniverse** ⭐ | 나만의 우주 | CT Galaxy와 연계, 확장성 좋음 | 영어 |
| **내별자리** | 한글 친근함 | 초등학생 접근성 | 고학년에겐 유치 |
| **Orbit** | 궤도 | 깔끔, 국제적 | CT 연결 약함 |
| **Logbook** | 항해일지 | 기록 강조 | 영어 |
| **MySpace** | 나의 공간 | 직관적 | 옛 SNS 연상 |

**선정: `MyUniverse (마이유니버스)`**
- 라우트: `/my-universe` 또는 `/mu`
- 한글 표기: "마이유니버스" 또는 "내 우주"

### 1.2 핵심 컨셉

```
┌─────────────────────────────────────────────────────────────┐
│                      🌌 MyUniverse                          │
│         "모든 학습 여정이 하나의 우주로 연결된다"              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │Timeline │ │Portfolio│ │ Galaxy  │ │Dashboard│ │  Blog  │ │
│  │ 타임라인 │ │갤러리   │ │Observatory│ │대시보드 │ │ 블로그 │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘ │
│       │          │          │          │          │       │
│       └──────────┴──────────┴──────────┴──────────┘       │
│                         │                                  │
│                    [통합 데이터]                            │
│              학습로그, 제출물, CT점수, 블로그               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 기능 구조 (Feature Architecture)

### 2.1 탭 기반 네비게이션

```
┌──────────────────────────────────────────────────────────────────┐
│ 🌌 MyUniverse                            [설정] [공개프로필]     │
├──────────────────────────────────────────────────────────────────┤
│ [타임라인] [갤러리] [Observatory] [대시보드] [블로그]            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                     << 탭별 콘텐츠 영역 >>                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 기능별 상세 정의

| 탭 | 기능명 | 핵심 목적 | 데이터 소스 |
|----|--------|----------|-------------|
| 📅 | **타임라인** | 학습 이력 시각화 | LearningLogs, ProjectSubmissions |
| 🎨 | **갤러리** | 프로젝트 임베드 공유 | S3 final/, pong2_boards |
| 🌌 | **Observatory** | CT 이해도 시각화 | User_Connectome, CT_Nodes |
| 📊 | **대시보드** | 학습 현황 통계 | 집계 쿼리 |
| 📝 | **블로그** | 개인 기록 공간 | user_blog_posts (신규) |

---

## 3. 각 탭 상세 설계

### 3.1 📅 타임라인 (Timeline)

#### 목적
- 학습 여정을 **시간 순서**로 시각화
- 제출 과제, 문제 풀이, 프로젝트 저장 등 모든 활동 기록

#### UI 구조
```
┌────────────────────────────────────────────────────────────┐
│ 📅 타임라인                           [필터 ▼] [기간 선택] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  2025.01.05 ─────────────────────────────────────────────  │
│  │                                                         │
│  ├─ 🎮 [제출] 엔트리 "미로게임" 최종 제출                   │
│  │     └─ CT: 반복문(+5), 조건문(+3)                       │
│  │                                                         │
│  ├─ ✅ [문제풀이] 파이썬 cospro_1-7 p03 정답               │
│  │     └─ 이해도: 85% | 소요시간: 12분                     │
│  │                                                         │
│  2025.01.04 ─────────────────────────────────────────────  │
│  │                                                         │
│  ├─ 💾 [저장] 스크래치 "애니메이션" 임시저장                │
│  │                                                         │
│  ├─ 📖 [학습] 컴퓨터기초활용 1-3 완료                      │
│  │     └─ 진도율: 30% → 45%                                │
│  │                                                         │
│  └─ ...                                                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 이벤트 타입 분류

| 타입 | 아이콘 | 설명 | 데이터 소스 |
|------|--------|------|-------------|
| `submit` | 🎮 | 프로젝트 최종 제출 | ProjectSubmissions (final) |
| `save` | 💾 | 프로젝트 임시 저장 | ProjectSubmissions (draft) |
| `solve` | ✅/❌ | 문제 풀이 | QuizResults |
| `learn` | 📖 | 콘텐츠 학습 | LearningLogs |
| `badge` | 🏆 | 뱃지/업적 획득 | User_Badges (신규) |
| `blog` | 📝 | 블로그 작성 | user_blog_posts |

#### 필터 옵션
- **플랫폼**: 전체, 엔트리, 스크래치, 파이썬, 앱인벤터
- **활동 유형**: 제출, 저장, 문제풀이, 학습
- **기간**: 오늘, 이번 주, 이번 달, 전체

---

### 3.2 🎨 갤러리 (Gallery)

#### 목적
- 완성된 프로젝트를 **임베드 형태**로 공유
- 다른 학생들이 직접 **플레이/실행** 가능

#### UI 구조
```
┌────────────────────────────────────────────────────────────┐
│ 🎨 갤러리                    [+ 새 작품 등록] [정렬 ▼]     │
├────────────────────────────────────────────────────────────┤
│ [전체] [엔트리] [스크래치] [앱인벤터] [파이썬]              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ 🎮 미로게임   │  │ 🐱 점프게임   │  │ 📱 계산기앱  │     │
│  │ [썸네일]     │  │ [썸네일]     │  │ [썸네일]     │     │
│  │              │  │              │  │              │     │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤     │
│  │ Entry        │  │ Scratch      │  │ AppInventor  │     │
│  │ 👁 123 ❤ 45  │  │ 👁 89 ❤ 23   │  │ 👁 56 ❤ 12   │     │
│  │ [▶ 실행]     │  │ [▶ 실행]     │  │ [📲 QR]      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 플랫폼별 임베드 방식

| 플랫폼 | 임베드 방식 | 기술 |
|--------|------------|------|
| **엔트리** | iframe + Entry.js | `/entry_editor/?s3Url=...&mode=play` |
| **스크래치** | iframe + Scratch GUI | `/scratch/?project_file=...&mode=play` |
| **앱인벤터** | QR코드 + APK 다운로드 | S3 APK 링크 |
| **파이썬** | 코드 뷰어 + 실행 결과 | Monaco Editor + 출력 표시 |
| **주피터** | nbviewer 스타일 | ipynb → HTML 변환 |

#### 공개 설정

| 공개 범위 | 설명 |
|----------|------|
| `private` | 본인만 보기 |
| `class` | 같은 센터 학생들 |
| `public` | 전체 공개 (Pong2 연동) |

#### Pong2 연동
```
[공유하기] 버튼 클릭
    ↓
공개 범위 선택: [비공개] [우리반] [전체공개]
    ↓
"전체공개" 선택 시
    ↓
Pong2 갤러리에 자동 등록
    ↓
https://pong2.app/portfolio/{projectId}
```

---

### 3.3 🌌 Observatory (관측소)

#### 목적
- **CT Connectome** 3D 시각화
- **CT 요소별 이해도** 그래프

#### UI 구조
```
┌────────────────────────────────────────────────────────────┐
│ 🌌 Observatory                        [2D/3D 전환] [확대]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────┐  ┌────────────────┐ │
│  │                                  │  │ CT 이해도 요약  │ │
│  │      🌟 반복문 (85%)             │  │                │ │
│  │        ╱   ╲                     │  │ 🔵 반복문: 85% │ │
│  │    ⭐     ⭐                     │  │ 🟢 조건문: 72% │ │
│  │  조건문   변수                    │  │ 🟡 변수: 60%   │ │
│  │  (72%)   (60%)                   │  │ 🔴 함수: 45%   │ │
│  │      ╲   ╱                       │  │ ⚫ 재귀: 20%   │ │
│  │       ⚫ 함수 (45%)              │  │                │ │
│  │        │                         │  │ 전체 레벨: 58  │ │
│  │       ⚫ 재귀 (20%)              │  │                │ │
│  │                                  │  │ [상세보기]     │ │
│  │    [마우스로 회전/줌]            │  └────────────────┘ │
│  └──────────────────────────────────┘                     │
│                                                            │
│  💡 추천: "반복문을 더 강화하려면 python p05를 풀어보세요" │
└────────────────────────────────────────────────────────────┘
```

#### 시각화 요소

| 요소 | 표현 | 의미 |
|------|------|------|
| **노드 크기** | 원의 크기 | CT 중요도 |
| **노드 색상** | 그라데이션 | 이해도 (빨강→파랑) |
| **연결선** | 선 굵기 | CT 간 연관성 |
| **발광 효과** | Bloom | 최근 활성화된 영역 |

#### 기술 스택
- **3D 렌더링**: Three.js + react-force-graph-3d
- **2D 대안**: D3.js Force Layout
- **데이터**: User_Connectome 테이블

---

### 3.4 📊 대시보드 (Dashboard)

#### 목적
- 학습 현황 **한눈에 파악**
- 교사/학부모 공유용 리포트

#### UI 구조
```
┌────────────────────────────────────────────────────────────┐
│ 📊 대시보드                              [기간: 이번 달 ▼] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 🕐 총 학습   │  │ ✅ 문제풀이  │  │ 🎮 프로젝트  │        │
│  │    12시간   │  │    45문제   │  │    3개 제출  │        │
│  │  (▲ 20%)   │  │  정답률 78% │  │  (▲ 1개)    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 📈 주간 학습 시간                                   │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │     ▓▓                                        │ │   │
│  │  │     ▓▓  ▓▓                    ▓▓              │ │   │
│  │  │ ▓▓  ▓▓  ▓▓  ▓▓      ▓▓  ▓▓  ▓▓              │ │   │
│  │  │ 월  화  수  목  금  토  일                     │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │ 🏆 획득 뱃지         │  │ 📋 최근 활동              │   │
│  │                      │  │                          │   │
│  │ 🥇 첫 제출           │  │ • 엔트리 미로게임 제출    │   │
│  │ 🔥 3일 연속 학습     │  │ • 파이썬 p03 정답        │   │
│  │ 💪 반복문 마스터     │  │ • 스크래치 저장          │   │
│  └──────────────────────┘  └──────────────────────────┘   │
│                                                            │
│  [PDF 다운로드] [선생님께 공유]                            │
└────────────────────────────────────────────────────────────┘
```

#### 통계 항목

| 카테고리 | 지표 | 계산 방식 |
|----------|------|----------|
| **시간** | 총 학습 시간 | SUM(LearningLogs.duration) |
| **문제** | 풀이 수, 정답률 | COUNT/AVG(QuizResults) |
| **프로젝트** | 제출 수 | COUNT(ProjectSubmissions.final) |
| **연속성** | 연속 학습일 | 날짜 연속 체크 |
| **CT** | 전체 레벨 | AVG(User_Connectome.activation) |

---

### 3.5 📝 블로그 (Blog)

#### 목적
- **노션 스타일** 개인 기록 공간
- 멀티미디어 콘텐츠 자유롭게 작성

#### UI 구조
```
┌────────────────────────────────────────────────────────────┐
│ 📝 내 블로그                               [+ 새 글 작성]  │
├────────────────────────────────────────────────────────────┤
│ [전체] [TIL] [프로젝트 일지] [회고]                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 📌 미로게임 개발 일지 #3                            │   │
│  │ 2025.01.05 | TIL | 공개                            │   │
│  │                                                    │   │
│  │ 오늘은 벽 충돌 로직을 완성했다!                      │   │
│  │                                                    │   │
│  │ ```python                                          │   │
│  │ if player.touching("wall"):                        │   │
│  │     player.bounce()                                │   │
│  │ ```                                                │   │
│  │                                                    │   │
│  │ [이미지: 게임 스크린샷]                              │   │
│  │                                                    │   │
│  │ 👁 23 | 💬 5 | ❤ 12                               │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 📌 파이썬 반복문 공부 정리                          │   │
│  │ 2025.01.04 | TIL | 비공개                          │   │
│  │ ...                                                │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 에디터 기능 (블록 기반)

| 블록 타입 | 설명 | 구현 |
|----------|------|------|
| `/text` | 일반 텍스트 | 마크다운 지원 |
| `/heading` | 제목 (H1~H3) | # ## ### |
| `/code` | 코드 블록 | Monaco Editor |
| `/image` | 이미지 | S3 업로드 |
| `/video` | 영상 | YouTube/Vimeo 임베드 |
| `/embed` | 외부 콘텐츠 | iframe |
| `/project` | 내 프로젝트 | 갤러리에서 선택 |
| `/callout` | 강조 박스 | 아이콘 + 배경색 |
| `/divider` | 구분선 | --- |
| `/toggle` | 토글 리스트 | 접기/펼치기 |

#### 공개 설정

| 설정 | 설명 |
|------|------|
| `private` | 본인만 |
| `link` | 링크 있는 사람만 |
| `public` | 전체 공개 |

---

## 4. 데이터베이스 설계

### 4.1 신규 테이블

#### user_blog_posts (블로그 글)
```sql
CREATE TABLE user_blog_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    
    title VARCHAR(255) NOT NULL,
    content JSON NOT NULL,              -- 블록 기반 에디터 데이터
    excerpt TEXT,                       -- 미리보기 텍스트
    
    category VARCHAR(50),               -- 'til', 'project', 'review'
    tags JSON,                          -- ["파이썬", "반복문"]
    
    visibility ENUM('private', 'link', 'public') DEFAULT 'private',
    
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    
    is_pinned BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    INDEX idx_user_category (user_id, category),
    INDEX idx_visibility (visibility),
    FULLTEXT idx_search (title, excerpt)
);
```

#### user_blog_comments (블로그 댓글)
```sql
CREATE TABLE user_blog_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    
    content TEXT NOT NULL,
    
    parent_id INT NULL,                 -- 대댓글용
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (post_id) REFERENCES user_blog_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);
```

#### user_badges (업적/뱃지)
```sql
CREATE TABLE user_badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    badge_code VARCHAR(50) NOT NULL,    -- 'first_submit', 'streak_7', 'loop_master'
    
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_badge (user_id, badge_code)
);

-- 뱃지 정의 테이블
CREATE TABLE badge_definitions (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),                   -- 이모지 또는 아이콘 클래스
    category VARCHAR(50),               -- 'achievement', 'streak', 'ct'
    condition JSON                      -- 획득 조건 정의
);
```

#### gallery_projects (갤러리 작품)
```sql
CREATE TABLE gallery_projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    submission_id INT,                  -- ProjectSubmissions 참조
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(500),
    
    platform ENUM('entry', 'scratch', 'appinventor', 'python', 'jupyter'),
    embed_url VARCHAR(500),             -- 임베드용 URL
    
    visibility ENUM('private', 'class', 'public') DEFAULT 'private',
    
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    
    is_featured BOOLEAN DEFAULT FALSE,  -- 추천 작품
    pong2_synced BOOLEAN DEFAULT FALSE, -- Pong2 동기화 여부
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (submission_id) REFERENCES ProjectSubmissions(id) ON DELETE SET NULL,
    INDEX idx_platform (platform),
    INDEX idx_visibility (visibility)
);
```

### 4.2 기존 테이블 활용

| 테이블 | 용도 |
|--------|------|
| `LearningLogs` | 타임라인 학습 이벤트 |
| `ProjectSubmissions` | 타임라인 제출 이벤트, 갤러리 소스 |
| `QuizResults` | 타임라인 문제풀이, 대시보드 통계 |
| `User_Connectome` | Observatory CT 이해도 |
| `CT_Nodes`, `CT_Edges` | Observatory 그래프 구조 |
| `UserActivityLogs` | 어드민 전용 접속 이력 |

---

## 5. API 설계

### 5.1 엔드포인트 구조

```
/api/my-universe/
├── timeline/
│   ├── GET /events          # 타임라인 이벤트 목록
│   └── GET /events/:id      # 이벤트 상세
├── gallery/
│   ├── GET /projects        # 갤러리 작품 목록
│   ├── POST /projects       # 작품 등록
│   ├── PUT /projects/:id    # 작품 수정
│   ├── DELETE /projects/:id # 작품 삭제
│   └── POST /projects/:id/share  # Pong2 공유
├── observatory/
│   ├── GET /connectome      # CT 그래프 데이터
│   ├── GET /ct-levels       # CT별 이해도
│   └── GET /recommendations # 추천 콘텐츠
├── dashboard/
│   ├── GET /summary         # 요약 통계
│   ├── GET /weekly          # 주간 데이터
│   └── GET /badges          # 획득 뱃지
└── blog/
    ├── GET /posts           # 글 목록
    ├── POST /posts          # 글 작성
    ├── PUT /posts/:id       # 글 수정
    ├── DELETE /posts/:id    # 글 삭제
    ├── POST /posts/:id/like # 좋아요
    └── /posts/:id/comments  # 댓글 CRUD
```

### 5.2 주요 API 상세

#### GET /api/my-universe/timeline/events
```javascript
// Request
GET /api/my-universe/timeline/events?
    platform=all&
    type=all&
    from=2025-01-01&
    to=2025-01-31&
    page=1&
    limit=20

// Response
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "sub_123",
        "type": "submit",
        "platform": "entry",
        "title": "미로게임",
        "description": "최종 제출",
        "timestamp": "2025-01-05T14:30:00Z",
        "metadata": {
          "ct_gained": { "loop": 5, "condition": 3 },
          "thumbnail": "https://..."
        }
      },
      {
        "id": "quiz_456",
        "type": "solve",
        "platform": "python",
        "title": "cospro_1-7 p03",
        "description": "정답",
        "timestamp": "2025-01-05T10:15:00Z",
        "metadata": {
          "is_correct": true,
          "understanding": 85,
          "time_spent": 720
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156
    }
  }
}
```

#### GET /api/my-universe/observatory/connectome
```javascript
// Response
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "ct_loop",
        "name": "반복문",
        "category": "Flow Control",
        "activation": 0.85,
        "importance": 1.2,
        "position": { "x": 0, "y": 0, "z": 0 }
      },
      {
        "id": "ct_condition",
        "name": "조건문",
        "category": "Flow Control",
        "activation": 0.72,
        "importance": 1.1,
        "position": { "x": 10, "y": 5, "z": -3 }
      }
    ],
    "edges": [
      {
        "source": "ct_loop",
        "target": "ct_condition",
        "weight": 0.8
      }
    ],
    "summary": {
      "overall_level": 58,
      "strongest": "ct_loop",
      "weakest": "ct_recursion"
    }
  }
}
```

---

## 6. 권한 및 공개 범위

### 6.1 역할별 접근 권한

| 기능 | student | teacher | manager | admin |
|------|---------|---------|---------|-------|
| 본인 MyUniverse | ✅ | ✅ | ✅ | ✅ |
| 학생 MyUniverse 조회 | ❌ | ✅ (같은 센터) | ✅ (같은 센터) | ✅ (전체) |
| 갤러리 공개 작품 | ✅ | ✅ | ✅ | ✅ |
| 블로그 공개 글 | ✅ | ✅ | ✅ | ✅ |
| 통계 집계 | 본인 | 센터 | 센터 | 전체 |

### 6.2 공개 프로필

```
/profile/{userID}
    ↓
공개 설정된 항목만 표시:
- 갤러리 (public 작품)
- 블로그 (public 글)
- 뱃지 (전체 공개)
- CT 레벨 요약 (선택적)
```

---

## 7. 라우팅 구조

### 7.1 페이지 라우트

```javascript
// server.js 또는 myUniverseRouter.js

// 메인 페이지 (기본: 타임라인)
GET /my-universe
GET /my-universe/timeline

// 각 탭
GET /my-universe/gallery
GET /my-universe/observatory
GET /my-universe/dashboard
GET /my-universe/blog

// 블로그 상세
GET /my-universe/blog/:postId

// 갤러리 상세 (임베드 플레이)
GET /my-universe/gallery/:projectId

// 공개 프로필
GET /profile/:userID

// 교사용: 학생 MyUniverse 조회
GET /my-universe/student/:studentId
```

### 7.2 파일 구조

```
educodingnplay/
├── routes/
│   └── myUniverseRouter.js           # 🔥 신규
├── routes/api/
│   └── myUniverseApiRouter.js        # 🔥 신규
├── views/
│   └── my-universe/
│       ├── index.ejs                 # 메인 레이아웃
│       ├── timeline.ejs              # 타임라인 탭
│       ├── gallery.ejs               # 갤러리 탭
│       ├── observatory.ejs           # 관측소 탭
│       ├── dashboard.ejs             # 대시보드 탭
│       ├── blog.ejs                  # 블로그 목록
│       ├── blog-post.ejs             # 블로그 글 상세
│       └── blog-editor.ejs           # 블로그 에디터
├── public/js/components/
│   └── my-universe/
│       ├── TimelineComponent.js
│       ├── GalleryComponent.js
│       ├── ObservatoryComponent.js   # Three.js 기반
│       ├── DashboardComponent.js
│       └── BlogEditorComponent.js    # 블록 에디터
└── public/css/
    └── my-universe.css
```

---

## 8. 구현 우선순위

### Phase 1: 기본 골격 (2주)
- [ ] 라우터 및 레이아웃 구조
- [ ] 타임라인 기본 구현 (기존 로그 데이터 활용)
- [ ] 대시보드 기본 통계

### Phase 2: 갤러리 (2주)
- [ ] 갤러리 CRUD
- [ ] 플랫폼별 임베드 구현
- [ ] Pong2 연동 API

### Phase 3: Observatory (2주)
- [ ] CT Connectome 데이터 시딩
- [ ] Three.js 3D 시각화
- [ ] 이해도 계산 로직

### Phase 4: 블로그 (2주)
- [ ] 블록 에디터 구현
- [ ] 멀티미디어 업로드
- [ ] 댓글 시스템

### Phase 5: 고도화 (지속)
- [ ] 뱃지 시스템
- [ ] 공개 프로필
- [ ] 모바일 최적화

---

## 9. 외부 연동

### 9.1 Pong2 연동

```
[educodingnplay]                    [pong2.app]
gallery_projects ──────────────────> pong2_boards
    ↓ POST /api/pong2/sync              ↓
    └── visibility: public ──────> portfolio 게시글
```

### 9.2 임베드 URL 생성

| 플랫폼 | 임베드 URL 패턴 |
|--------|----------------|
| Entry | `/entry_editor/?s3Url={url}&mode=play&embed=1` |
| Scratch | `/scratch/?project_file={url}&mode=play&embed=1` |
| Python | `/python-viewer/?file={url}&embed=1` |
| AppInventor | QR 코드 이미지 (APK 다운로드) |

---

## 10. 요약

**MyUniverse**는 학생의 모든 학습 여정을 **하나의 우주**로 통합합니다:

| 탭 | 한줄 설명 |
|----|----------|
| **타임라인** | 내 학습 역사를 시간순으로 |
| **갤러리** | 완성작을 자랑하고 공유 |
| **Observatory** | CT 이해도를 별자리로 |
| **대시보드** | 한눈에 보는 학습 현황 |
| **블로그** | 나만의 이야기 기록 |

---

**📅 작성일**: 2025-12-27  
**🔄 상태**: 초안 (구현 대기)  
**👤 작성자**: AI Assistant
