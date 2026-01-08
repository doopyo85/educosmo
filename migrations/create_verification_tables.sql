-- 인증 코드 저장 테이블 (이메일 및 SMS 인증)
CREATE TABLE IF NOT EXISTS VerificationCodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact VARCHAR(255) NOT NULL,           -- 이메일 또는 전화번호
    contact_type ENUM('email', 'phone') NOT NULL,  -- 연락처 타입
    code VARCHAR(10) NOT NULL,                -- 인증 코드 (6자리)
    purpose ENUM('register', 'reset_password', 'phone_verify') NOT NULL,  -- 용도
    verified BOOLEAN DEFAULT FALSE,           -- 인증 완료 여부
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,            -- 만료 시간 (10분)
    verified_at TIMESTAMP NULL,               -- 인증 완료 시간

    INDEX idx_contact (contact),
    INDEX idx_code (code),
    INDEX idx_expires (expires_at),
    INDEX idx_purpose (purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 센터 정보 테이블 (Google Sheets 대신 DB 사용 준비)
CREATE TABLE IF NOT EXISTS Centers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    center_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100),                -- 담당자 이름
    contact_phone VARCHAR(20),                -- 담당자 전화번호
    contact_email VARCHAR(255),               -- 담당자 이메일
    address TEXT,                             -- 센터 주소
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
    plan_type VARCHAR(50) DEFAULT 'free',     -- 요금제 타입
    storage_limit_bytes BIGINT DEFAULT 10737418240,  -- 10GB
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_center_name (center_name),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 센터 초대 코드 테이블 (향후 확장용)
CREATE TABLE IF NOT EXISTS CenterInviteCodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    center_id INT NOT NULL,
    invite_code VARCHAR(20) NOT NULL UNIQUE,  -- 초대 코드
    max_uses INT DEFAULT NULL,                -- 최대 사용 횟수 (NULL = 무제한)
    used_count INT DEFAULT 0,                 -- 사용된 횟수
    expires_at TIMESTAMP NULL,                -- 만료 시간 (NULL = 무제한)
    created_by INT,                           -- 생성한 사용자 ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (center_id) REFERENCES Centers(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE SET NULL,

    INDEX idx_invite_code (invite_code),
    INDEX idx_center_id (center_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 임시 센터 가입 신청 테이블 (휴대폰 인증 완료 후 저장)
CREATE TABLE IF NOT EXISTS TempCenterRegistrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userID VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role VARCHAR(20) NOT NULL,
    center_name VARCHAR(255) NOT NULL,       -- 새로 생성할 센터명
    phone_verified BOOLEAN DEFAULT FALSE,     -- 휴대폰 인증 완료 여부
    email_verified BOOLEAN DEFAULT FALSE,     -- 이메일 인증 완료 여부 (선택)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,            -- 1시간 후 만료

    INDEX idx_userID (userID),
    INDEX idx_phone (phone),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
