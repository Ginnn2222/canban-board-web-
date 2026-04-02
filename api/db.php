<?php
if (session_status() === PHP_SESSION_NONE) session_start();

$host   = $_ENV['DB_HOST']   ?? (getenv('DB_HOST')   ?: ($_SERVER['DB_HOST']   ?? 'localhost'));
$dbname = $_ENV['DB_NAME']   ?? (getenv('DB_NAME')   ?: ($_SERVER['DB_NAME']   ?? 'tralala_db'));
$dbuser = $_ENV['DB_USER']   ?? (getenv('DB_USER')   ?: ($_SERVER['DB_USER']   ?? 'root'));
$dbpass = $_ENV['DB_PASS']   ?? (getenv('DB_PASS')   ?: ($_SERVER['DB_PASS']   ?? 'root'));

try {
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

    // TiDB Cloud requires SSL connection with SNI support.
    // In PHP PDO, SNI is only sent if MYSQL_ATTR_SSL_VERIFY_SERVER_CERT is set to true!
    $options = [
        1002 => 'SET NAMES utf8mb4', // MYSQL_ATTR_INIT_COMMAND
        1014 => true,                // MYSQL_ATTR_SSL_VERIFY_SERVER_CERT (Must be true for SNI)
    ];
    if ($ca_path) {
        $options[1009] = $ca_path;   // MYSQL_ATTR_SSL_CA (1009 = File, 1010 = Directory)
    }
    // Extract port if provided, otherwise default to 4000 for TiDB Cloud Serverless
    $port = 4000;
    if (strpos($host, ':') !== false) {
        $parts = explode(':', $host);
        $host = $parts[0];
        $port = $parts[1];
    }
    
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $dbuser, $dbpass, $options);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
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
