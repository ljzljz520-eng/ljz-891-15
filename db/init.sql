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
    expiration_date DATETIME NULL COMMENT '到期时间，NULL 表示长期有效',
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
-- 覆盖全部状态：正常 / 七天内到期 / 已过期 / 长期有效
INSERT INTO licenses (qq, owner_name, product_name, upline, expiration_date, is_permanent) VALUES
('123456789', '张三', '超级授权系统VIP版', '总代理', '2026-12-31 23:59:59', FALSE),
('987654321', '李四', '企业级管理后台', '核心代理', DATE_ADD(NOW(), INTERVAL 3 DAY), FALSE), -- 3天后到期（七天内提醒）
('11111', '王五', '测试过期产品', '测试员', '2023-01-01 00:00:00', FALSE), -- 已过期
('22222', '赵六', '旧版授权（已失效）', '测试员', '2025-06-30 23:59:59', FALSE), -- 已过期
('666666666', '星罗永久客户', '授权系统永久版', '总代理', NULL, TRUE); -- 长期有效
