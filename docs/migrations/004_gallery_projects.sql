-- ============================================================
-- 갤러리 프로젝트 테이블 생성
-- 작성일: 2025-12-27
-- 목적: 스크래치/엔트리 프로젝트 공유 갤러리 시스템
-- ============================================================

-- 1. 갤러리 프로젝트 테이블
CREATE TABLE IF NOT EXISTS gallery_projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,                           -- Users.id 참조
    submission_id INT NULL,                         -- ProjectSubmissions.id 참조 (선택)
    
    -- 프로젝트 기본 정보
    title VARCHAR(255) NOT NULL,                    -- 작품 제목
    description TEXT,                               -- 작품 설명
    platform ENUM('entry', 'scratch', 'appinventor', 'python', 'jupyter') NOT NULL,
    
    -- 파일 정보
    s3_url VARCHAR(500) NOT NULL,                   -- S3 프로젝트 파일 URL
    s3_key VARCHAR(500),                            -- S3 키
    thumbnail_url VARCHAR(500),                     -- 썸네일 이미지 URL
    
    -- 임베드 설정
    embed_url VARCHAR(500),                         -- 임베드용 URL (자동 생성)
    
    -- 공개 설정
    visibility ENUM('private', 'class', 'public') DEFAULT 'class',
    -- private: 본인만
    -- class: 같은 센터 학생들
    -- public: 전체 공개
    
    -- 통계
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    play_count INT DEFAULT 0,                       -- 실행 횟수
    
    -- 상태
    is_featured BOOLEAN DEFAULT FALSE,              -- 추천 작품
    is_active BOOLEAN DEFAULT TRUE,                 -- 활성화 여부
    
    -- 메타데이터
    tags JSON,                                      -- ["게임", "애니메이션"]
    metadata JSON,                                  -- 플랫폼별 추가 정보
    
    -- 타임스탬프
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 외래키
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (submission_id) REFERENCES ProjectSubmissions(id) ON DELETE SET NULL,
    
    -- 인덱스
    INDEX idx_user_platform (user_id, platform),
    INDEX idx_visibility (visibility),
    INDEX idx_platform (platform),
    INDEX idx_featured (is_featured),
    INDEX idx_created (created_at DESC)
);

-- 2. 갤러리 좋아요 테이블
CREATE TABLE IF NOT EXISTS gallery_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gallery_id INT NOT NULL,                        -- gallery_projects.id
    user_id INT NOT NULL,                           -- 좋아요 누른 사용자
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (gallery_id) REFERENCES gallery_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    
    -- 한 사용자당 한 번만 좋아요
    UNIQUE KEY unique_like (gallery_id, user_id)
);

-- 3. 갤러리 댓글 테이블 (선택적)
CREATE TABLE IF NOT EXISTS gallery_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gallery_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    parent_id INT NULL,                             -- 대댓글용
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (gallery_id) REFERENCES gallery_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES gallery_comments(id) ON DELETE SET NULL,
    
    INDEX idx_gallery (gallery_id),
    INDEX idx_parent (parent_id)
);

-- 4. 조회 기록 테이블 (중복 조회 방지용)
CREATE TABLE IF NOT EXISTS gallery_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gallery_id INT NOT NULL,
    user_id INT NULL,                               -- 비로그인 시 NULL
    ip_address VARCHAR(45),                         -- IP 기반 중복 체크
    session_id VARCHAR(255),                        -- 세션 기반 중복 체크
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (gallery_id) REFERENCES gallery_projects(id) ON DELETE CASCADE,
    
    -- 같은 세션/IP에서 중복 조회 방지 (24시간 기준)
    INDEX idx_gallery_session (gallery_id, session_id),
    INDEX idx_created (created_at)
);

-- ============================================================
-- 실행 방법:
-- mysql -u root -p educodingnplay < 004_gallery_projects.sql
-- ============================================================
