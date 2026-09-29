<?php
namespace Controllers;

use Config\Database;
use PDO;

class LicenseController {
    private $db;

    // 距到期不足该天数即触发提醒
    const EXPIRING_SOON_DAYS = 7;

    public function __construct($db) {
        $this->db = $db;
    }

    /**
     * 计算授权到期状态
     * @return array status: normal|expiring_soon|expired|permanent, days_left, is_expired, is_permanent
     */
    private function getExpiryStatus($row) {
        $isPermanent = !empty($row['is_permanent']) || empty($row['expiration_date']);

        if ($isPermanent) {
            return [
                'status'        => 'permanent',
                'is_permanent'  => true,
                'is_expired'    => false,
                'expiring_soon' => false,
                'days_left'     => null,
            ];
        }

        $expireTs   = strtotime($row['expiration_date']);
        $nowTs      = time();
        // 剩余整天数（向上取整，到期当天显示剩余 0 天）
        $diffSec    = $expireTs - $nowTs;
        $daysLeft   = (int) floor($diffSec / 86400);
        $isExpired  = $diffSec <= 0;

        return [
            'status'        => $isExpired ? 'expired' : ($daysLeft <= self::EXPIRING_SOON_DAYS ? 'expiring_soon' : 'normal'),
            'is_permanent'  => false,
            'is_expired'    => $isExpired,
            'expiring_soon' => !$isExpired && $daysLeft <= self::EXPIRING_SOON_DAYS,
            'days_left'     => $isExpired ? abs((int) ceil($diffSec / 86400)) : $daysLeft,
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

        $query = "SELECT * FROM licenses WHERE qq = :qq AND owner_name = :owner LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(":qq", $qq);
        $stmt->bindParam(":owner", $owner);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $expiry = $this->getExpiryStatus($row);

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
                    // —— 到期提醒信息 ——
                    "license_status" => $expiry['status'],         // normal / expiring_soon / expired / permanent
                    "is_permanent"    => $expiry['is_permanent'],
                    "is_expired"      => $expiry['is_expired'],
                    "expiring_soon"   => $expiry['expiring_soon'],
                    "days_left"       => $expiry['days_left'],    // 剩余天数；长期有效为 null
                    "remind_within_days" => self::EXPIRING_SOON_DAYS
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

    // Admin: List All（支持 ?filter=all|expiring|expired|permanent）
    public function listAll() {
        $filter = isset($_GET['filter']) ? $_GET['filter'] : 'all';

        $query = "SELECT * FROM licenses";
        $conditions = [];

        // 筛选尽量下推到 SQL，同时前端也会基于状态字段二次过滤
        switch ($filter) {
            case 'expiring':
                // 七天内到期：非长期、未过期、到期时间在 7 天以内
                $conditions[] = "(is_permanent = 0 AND expiration_date IS NOT NULL
                                  AND expiration_date > NOW()
                                  AND expiration_date <= DATE_ADD(NOW(), INTERVAL " . (int)self::EXPIRING_SOON_DAYS . " DAY))";
                break;
            case 'expired':
                $conditions[] = "(is_permanent = 0 AND expiration_date IS NOT NULL AND expiration_date <= NOW())";
                break;
            case 'permanent':
                $conditions[] = "(is_permanent = 1 OR expiration_date IS NULL)";
                break;
            default:
                break;
        }

        if (!empty($conditions)) {
            $query .= " WHERE " . implode(' AND ', $conditions);
        }
        $query .= " ORDER BY is_permanent ASC, expiration_date ASC, created_at DESC";

        $stmt = $this->db->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 附加计算字段，便于后台直接渲染徽标与剩余天数
        foreach ($rows as &$r) {
            $expiry = $this->getExpiryStatus($r);
            $r['license_status'] = $expiry['status'];
            $r['is_permanent_computed'] = $expiry['is_permanent'];
            $r['is_expired_computed']   = $expiry['is_expired'];
            $r['expiring_soon']         = $expiry['expiring_soon'];
            $r['days_left']             = $expiry['days_left'];
        }
        unset($r);

        echo json_encode($rows);
    }

    // Admin: Create
    public function create() {
        $data = json_decode(file_get_contents("php://input"));
        $isPermanent = !empty($data->is_permanent);

        // datetime-local 提交格式为 "2026-12-31T23:59"，转换为 MySQL 格式；长期有效则为 NULL
        $expiration = null;
        if (!$isPermanent) {
            if (!isset($data->expiration_date) || trim($data->expiration_date) === '') {
                http_response_code(400);
                echo json_encode(["message" => "请选择过期时间，或勾选长期有效"]);
                return;
            }
            $expiration = str_replace('T', ' ', $data->expiration_date);
            if (strlen($expiration) === 16) {
                $expiration .= ':00';
            }
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
