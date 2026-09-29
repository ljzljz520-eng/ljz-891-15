SET NAMES utf8mb4;
SET TIME_ZONE = '+08:00';

CREATE DATABASE IF NOT EXISTS auth_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auth_system;

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Licenses Table
CREATE TABLE IF NOT EXISTS licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    qq VARCHAR(20) NOT NULL,
    owner_name VARCHAR(50) NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    upline VARCHAR(50) NOT NULL COMMENT '上级代理',
    expiration_date DATETIME NULL COMMENT 'NULL 表示长期有效',
    is_permanent BOOLEAN DEFAULT FALSE COMMENT '是否长期有效',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_qq (qq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verification Codes (for updates)
CREATE TABLE IF NOT EXISTS verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'update_license'
    identifier VARCHAR(100) NOT NULL, -- QQ email
    code VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data (Test Accounts)
-- Password is '123456' hashed with BCRYPT (Cost 10)
INSERT INTO admins (username, password) VALUES 
('admin', '$2y$10$eLYd0HGc9JM0qxzPkpLtDuL1UZRAS6XAwgVNO7oL9R0M/f/6bkEcW'); 

-- Seed Data (Sample Licenses)
INSERT INTO licenses (qq, owner_name, product_name, upline, expiration_date, is_permanent) VALUES
('123456789', '张三', '超级授权系统VIP版', '总代理', '2026-12-31 23:59:59', FALSE),
('987654321', '李四', '企业级管理后台', '核心代理', '2025-06-30 23:59:59', FALSE),
('11111', '王五', '测试过期产品', '测试员', '2023-01-01 00:00:00', FALSE), -- Expired
('22222', '赵六', '即将到期产品', '核心代理', DATE_ADD(NOW(), INTERVAL 5 DAY), FALSE), -- Expiring within 7 days
('33333', '孙七', '永久旗舰授权', '总代理', NULL, TRUE); -- Permanent

-- Idempotent migration for existing databases (safe to run multiple times)
SET @ddl := (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'auth_system' AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'is_permanent') = 0,
    'ALTER TABLE licenses ADD COLUMN is_permanent BOOLEAN DEFAULT FALSE COMMENT ''是否长期有效'' AFTER expiration_date',
    'SELECT 1'
));
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'auth_system' AND TABLE_NAME = 'licenses' AND IS_NULLABLE = 'NO' AND COLUMN_NAME = 'expiration_date') > 0,
    'ALTER TABLE licenses MODIFY expiration_date DATETIME NULL COMMENT ''NULL 表示长期有效''',
    'SELECT 1'
));
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
