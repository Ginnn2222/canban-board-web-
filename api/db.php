<?php
// Shared Board Configuration
define('GLOBAL_BOARD_USER_ID', 1);

$host   = $_ENV['DB_HOST']   ?? (getenv('DB_HOST')   ?: ($_SERVER['DB_HOST']   ?? 'localhost'));
$dbname = $_ENV['DB_NAME']   ?? (getenv('DB_NAME')   ?: ($_SERVER['DB_NAME']   ?? 'tralala_db'));
$dbuser = $_ENV['DB_USER']   ?? (getenv('DB_USER')   ?: ($_SERVER['DB_USER']   ?? 'root'));
$dbpass = $_ENV['DB_PASS']   ?? (getenv('DB_PASS')   ?: ($_SERVER['DB_PASS']   ?? 'root'));

// DEBUGGING CRITICAL CHECK
if ($host === 'localhost' || empty($host)) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => '🛑 ERROR: Vercel Environment Variables (DB_HOST) are missing or localhost!']);
    exit;
}

// Custom Database Session Handler for Vercel
class TiDBSessionHandler implements SessionHandlerInterface {
    private $pdo;
    public function __construct($pdo) { $this->pdo = $pdo; }
    public function open($savePath, $sessionName): bool { return true; }
    public function close(): bool { return true; }
    public function read($id): string {
        try {
            $stmt = $this->pdo->prepare("SELECT data FROM sessions WHERE id = ?");
            $stmt->execute([$id]);
            $rows = $stmt->fetchAll();
            return (isset($rows[0]['data']) && !empty($rows[0]['data'])) ? $rows[0]['data'] : '';
        } catch (Exception $e) {
            return '';
        }
    }
    public function write($id, $data): bool {
        $stmt = $this->pdo->prepare("REPLACE INTO sessions (id, data, last_updated) VALUES (?, ?, ?)");
        return (bool)$stmt->execute([$id, $data, time()]);
    }
    public function destroy($id): bool {
        $stmt = $this->pdo->prepare("DELETE FROM sessions WHERE id = ?");
        return (bool)$stmt->execute([$id]);
    }
    public function gc($maxlifetime): int {
        try {
            $stmt = $this->pdo->prepare("DELETE FROM sessions WHERE last_updated < ?");
            $stmt->execute([time() - $maxlifetime]);
        } catch (Exception $e) {}
        return 1; // Success
    }
}

try {
    require_once __DIR__ . '/TiDB_PDO.php';

    $ca_path = '';
    $ca_paths = [
        __DIR__ . '/ca-bundle.crt',
        '/etc/pki/tls/certs/ca-bundle.crt',
        '/etc/ssl/certs/ca-certificates.crt',
        '/etc/ssl/ca-bundle.pem'
    ];
    foreach($ca_paths as $path) {
        if (file_exists($path)) {
            $ca_path = $path;
            break;
        }
    }

    $options = [
        1002 => 'SET NAMES utf8mb4', // MYSQL_ATTR_INIT_COMMAND
        1014 => false,               // MYSQL_ATTR_SSL_VERIFY_SERVER_CERT (Disable verification)
    ];
    if ($ca_path) {
        $options[1009] = $ca_path;   // MYSQL_ATTR_SSL_CA
    }
    // Extract port if provided, otherwise default to 4000 for TiDB Cloud Serverless
    $port = 4000;
    if (strpos($host, ':') !== false) {
        $parts = explode(':', $host);
        $host = $parts[0];
        $port = $parts[1];
    }
    
    // 🔥 Magic happens here: Instantiate our Polyfill instead of native PDO 🔥
    $pdo = new TiDB_PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $dbuser, $dbpass, $options);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
    // 🔥 Activate Database Sessions (Centralized here) 🔥
    if (session_status() === PHP_SESSION_NONE) {
        session_set_save_handler(new TiDBSessionHandler($pdo), true);
        
        // Optimize for Vercel/Serverless
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
        
        session_start();
    }
    
    // Auto-migrate: Add last_seen column if not already present
    // Use a lightweight check to avoid ALTER TABLE errors on every request
    try {
        $checkCol = $pdo->prepare("SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = ? AND table_name = 'users' AND column_name = 'last_seen'");
        $checkCol->execute([$dbname]);
        $colExists = $checkCol->fetch();
        if (!$colExists || (int)$colExists['cnt'] === 0) {
            $pdo->exec("ALTER TABLE `users` ADD COLUMN `last_seen` TIMESTAMP NULL DEFAULT NULL");
        }
    } catch (Exception $e) {
        // Silently ignore - column may already exist or permissions issue
    }
} catch (Exception $e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'DB connection failed: ' . $e->getMessage()]);
    exit;
}

function json_ok($data = null) {
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'data' => $data]);
    exit;
}

function json_err($msg, $code = 400) {
    header('Content-Type: application/json');
    http_response_code($code);
    echo json_encode(['ok' => false, 'message' => $msg]);
    exit;
}

function get_input() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function get_base_url() {
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    // Go up one directory from /projek1/api to /projek1
    $projectDir = dirname(dirname($_SERVER['SCRIPT_NAME']));
    return $protocol . '://' . $host . $projectDir . '/';
}

function check_session_timeout() {
    $timeout_duration = 12 * 3600; // 12 hours in seconds
    if (isset($_SESSION['login_time']) && (time() - $_SESSION['login_time']) > $timeout_duration) {
        session_unset();
        session_destroy();
        return false;
    }
    return true;
}

function require_auth() {
    if (empty($_SESSION['user_id']) || !check_session_timeout()) {
        json_err('Sesi Anda telah berakhir, silakan login kembali.', 401);
    }
}
