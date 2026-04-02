<?php
if (session_status() === PHP_SESSION_NONE) session_start();

$host   = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'tralala_db';
$dbuser = getenv('DB_USER') ?: 'root';
$dbpass = getenv('DB_PASS') ?: 'root';

try {
    // TiDB Cloud requires SSL connection.
    $options = [
        PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4',
        PDO::MYSQL_ATTR_SSL_MIN_PROTOCOL_VERSION => 3,
        // On Vercel, we can usually omit SSL_CA if the server has system CAs, 
        // but we'll enable SSL to ensure it works.
        PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false, 
    ];
    
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbuser, $dbpass, $options);
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
