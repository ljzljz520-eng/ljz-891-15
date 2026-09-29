<?php
namespace Controllers;

use Config\Database;
use PDO;

class LicenseController {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    /**
     * 计算授权到期状态
     * status: permanent(长期有效) / normal(正常) / expiring(7天内到期) / expired(已过期)
     * days_remaining: 剩余天数（向下取整；过期为负数，长期有效为 null）
     */
    private function buildStatus($row) {
        $isPermanent = !empty($row['is_permanent']) || empty($row['expiration_date']);
        if ($isPermanent) {
            return [
                'is_permanent' => true,
                'status' => 'permanent',
                'days_remaining' => null,
                'is_expired' => false,
            ];
        }

        $now = new \DateTime('now', new \DateTimeZone('+08:00'));
        $exp = new \DateTime($row['expiration_date'], new \DateTimeZone('+08:00'));
        $diffSeconds = $exp->getTimestamp() - $now->getTimestamp();
        // 向下取整到天（不足1天按0天处理）
        $days = (int) floor($diffSeconds / 86400);
        $isExpired = $diffSeconds <= 0;

        $status = 'normal';
        if ($isExpired) {
            $status = 'expired';
        } elseif ($diffSeconds <= 7 * 86400) {
            $status = 'expiring';
        }

        return [
            'is_permanent' => false,
            'status' => $status,
            'days_remaining' => $days,
            'is_expired' => $isExpired,
        ];
    }

    // Public Query
    public function query() {
        if (!isset($_GET['qq']) || !isset($_GET['owner'])) {
            http_response_code(400);
            echo json_encode(["message" => "Missing parameters"]);
            return;
        }

        $qq = $_GET['qq'];
        $owner = $_GET['owner'];

        $query = "SELECT * FROM licenses WHERE qq = :qq AND owner_name = :owner AND is_active = TRUE LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(":qq", $qq);
        $stmt->bindParam(":owner", $owner);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $statusInfo = $this->buildStatus($row);

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "data" => [
                    "qq" => $row['qq'],
                    "owner" => $row['owner_name'],
                    "product" => $row['product_name'],
                    "upline" => $row['upline'],
                    "expiration" => $row['expiration_date'],
                    "created_at" => $row['created_at'],
                    "is_permanent" => $statusInfo['is_permanent'],
                    "license_status" => $statusInfo['status'],
                    "days_remaining" => $statusInfo['days_remaining'],
                    "is_expired" => $statusInfo['is_expired'],
                ]
            ]);
        } else {
            // Failure with specific message
            http_response_code(404);
            echo json_encode([
                "status" => "error",
                "message" => "暂未查询到您的授权信息 请查证后再次查询！",
                "reasons" => [
                    "1.授权开通不足60分钟内",
                    "2.未购买正版授权，可能是盗版程序授权",
                    "3.恭喜你，被圈钱了！"
                ]
            ]);
        }
    }

    // Admin: List All (支持到期状态筛选: expiring_7d / expired / permanent)
    public function listAll() {
        $where = '';
        $params = [];

        if (isset($_GET['filter']) && $_GET['filter'] !== '' && $_GET['filter'] !== 'all') {
            switch ($_GET['filter']) {
                case 'expiring_7d':
                    // 7天内到期（含今天到期），排除长期有效与已过期
                    $where = "WHERE (is_permanent = FALSE OR is_permanent IS NULL)
                              AND expiration_date IS NOT NULL
                              AND expiration_date > NOW()
                              AND expiration_date <= DATE_ADD(NOW(), INTERVAL 7 DAY)";
                    break;
                case 'expired':
                    $where = "WHERE (is_permanent = FALSE OR is_permanent IS NULL)
                              AND expiration_date IS NOT NULL
                              AND expiration_date <= NOW()";
                    break;
                case 'permanent':
                    $where = "WHERE is_permanent = TRUE OR expiration_date IS NULL";
                    break;
            }
        }

        $query = "SELECT * FROM licenses $where ORDER BY created_at DESC";
        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 附加计算后的状态字段，供前端直接渲染徽章
        foreach ($rows as &$row) {
            $statusInfo = $this->buildStatus($row);
            $row['is_permanent'] = $statusInfo['is_permanent'] ? 1 : 0;
            $row['license_status'] = $statusInfo['status'];
            $row['days_remaining'] = $statusInfo['days_remaining'];
            $row['is_expired'] = $statusInfo['is_expired'] ? 1 : 0;
        }
        unset($row);

        echo json_encode($rows);
    }

    // Admin: Create
    public function create() {
        $data = json_decode(file_get_contents("php://input"));

        $isPermanent = !empty($data->is_permanent);
        // 长期有效时到期时间写 NULL；否则必须提供过期时间
        $expiration = $isPermanent ? null : ($data->expiration_date ?? null);

        if (!$isPermanent && empty($expiration)) {
            http_response_code(400);
            echo json_encode(["message" => "请选择过期时间或勾选长期有效"]);
            return;
        }

        $query = "INSERT INTO licenses (qq, owner_name, product_name, upline, expiration_date, is_permanent)
                  VALUES (:qq, :owner, :product, :upline, :exp, :permanent)";
        $stmt = $this->db->prepare($query);

        $params = [
            ":qq" => $data->qq,
            ":owner" => $data->owner_name,
            ":product" => $data->product_name,
            ":upline" => $data->upline,
            ":exp" => $expiration,
            ":permanent" => $isPermanent ? 1 : 0,
        ];

        if($stmt->execute($params)) {
             echo json_encode(["message" => "Created successfully"]);
        } else {
             http_response_code(500);
             echo json_encode(["message" => "Create failed"]);
        }
    }
    
    // Admin: Delete
    public function delete() {
         $data = json_decode(file_get_contents("php://input"));
         if(!isset($data->id)) { return; }
         $query = "DELETE FROM licenses WHERE id = :id";
         $stmt = $this->db->prepare($query);
         $stmt->bindParam(":id", $data->id);
         $stmt->execute();
         echo json_encode(["message" => "Deleted"]);
    }

    // Update Flow: Step 1 - Send Code
    public function sendVerificationCode() {
        $data = json_decode(file_get_contents("php://input"));
        $qq = $data->qq;
        $email = $qq . "@qq.com";
        
        $code = rand(100000, 999999);
        
        // Save code
        $stmt = $this->db->prepare("INSERT INTO verification_codes (type, identifier, code, expires_at) VALUES ('update_license', :email, :code, DATE_ADD(NOW(), INTERVAL 10 MINUTE))");
        $stmt->execute([':email' => $email, ':code' => $code]);
        
        // Real Email Sending via PHPMailer
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        try {
            //Server settings
            $mail->SMTPDebug = 2; // Enable verbose debug output
            $mail->Debugoutput = 'error_log'; // Output to stderr
            $mail->isSMTP();
            $mail->Host       = 'smtp.163.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'yuwangifeng@163.com';
            $mail->Password   = 'LRZMA358wePVGa8F'; 
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port       = 465;
            $mail->CharSet    = 'UTF-8';

            // Allow self-signed certs (matches Node.js permissive behavior)
            $mail->SMTPOptions = array(
                'ssl' => array(
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'allow_self_signed' => true
                )
            );

            //Recipients - Name removed to match Node example exactly
            $mail->setFrom('yuwangifeng@163.com');
            $mail->addAddress($email);
            
            // Set HELO to localhost to avoid Docker container ID rejection
            $mail->Hostname = 'localhost';

            //Content
            $mail->isHTML(true);
            $mail->Subject = '【授权系统】验证码';
            $mail->Body    = "您的验证码是 <b>$code</b>，请在10分钟内完成验证。<br>如非本人操作请忽略。";

            $mail->send();
            echo json_encode(["message" => "验证码已发送至QQ邮箱"]);
        } catch (\Exception $e) {
            // Fallback for demo/dev if SMTP fails
            error_log("SMTP Error: {$mail->ErrorInfo}");
            echo json_encode([
                 "message" => "邮件发送失败 (转为模拟模式)", 
                 "mock_code" => $code,
                 "debug_error" => $mail->ErrorInfo
            ]);
        }
    }

    // Update Flow: Step 2 - Verify & Update
    public function update() {
        $data = json_decode(file_get_contents("php://input"));
        // Expect: qq, code, new_owner, new_product...
        
        $email = $data->qq . "@qq.com";
        $code = $data->code;
        
        // Verify Code
        $stmt = $this->db->prepare("SELECT * FROM verification_codes WHERE identifier=:email AND code=:code AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
        $stmt->execute([':email' => $email, ':code' => $code]);
        
        if ($stmt->rowCount() == 0) {
            http_response_code(400);
            echo json_encode(["message" => "Invalid or expired code"]);
            return;
        }
        
        // Update License
        // For demo, assume we update the owner name for this QQ
        $updateQ = "UPDATE licenses SET owner_name = :new_owner WHERE qq = :qq";
        $ustmt = $this->db->prepare($updateQ);
        $ustmt->execute([':new_owner' => $data->owner_name, ':qq' => $data->qq]); // assuming we update owner
        
        echo json_encode(["message" => "Update successful"]);
    }
}
