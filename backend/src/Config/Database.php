<?php
namespace Config;

use PDO;
use PDOException;

class Database {
    private $host = 'db';
    private $db_name = 'auth_system';
    private $username = 'root';
    private $password = 'root';
    public $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $dsn = "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4";
            $this->conn = new PDO($dsn, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->exec("set names utf8mb4");
            // 与 PHP 的 Asia/Shanghai 保持一致，避免 NOW() 与剩余天数计算错位
            $this->conn->exec("SET time_zone = '+08:00'");
            $this->migrate();
        } catch(PDOException $exception) {
            echo "Connection error: " . $exception->getMessage();
        }
        return $this->conn;
    }

    /**
     * 轻量自动迁移：为旧版本库补齐到期提醒相关字段
     * - expiration_date 允许 NULL（NULL 即长期有效）
     * - 新增 is_permanent 标记
     */
    private function migrate() {
        $this->conn->exec("ALTER TABLE licenses MODIFY expiration_date DATETIME NULL COMMENT '到期时间，NULL 表示长期有效'");

        $col = $this->conn->query("SHOW COLUMNS FROM licenses LIKE 'is_permanent'");
        if ($col->rowCount() === 0) {
            $this->conn->exec("ALTER TABLE licenses ADD COLUMN is_permanent BOOLEAN DEFAULT FALSE COMMENT '是否长期有效' AFTER expiration_date");
        }
    }
}
