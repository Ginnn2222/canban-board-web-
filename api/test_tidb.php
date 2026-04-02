<?php
$host   = $_ENV['DB_HOST']   ?? (getenv('DB_HOST')   ?: ($_SERVER['DB_HOST']   ?? 'localhost'));
$dbuser = $_ENV['DB_USER']   ?? (getenv('DB_USER')   ?: ($_SERVER['DB_USER']   ?? 'root'));
$dbpass = $_ENV['DB_PASS']   ?? (getenv('DB_PASS')   ?: ($_SERVER['DB_PASS']   ?? ''));
$dbname = $_ENV['DB_NAME']   ?? (getenv('DB_NAME')   ?: ($_SERVER['DB_NAME']   ?? 'tralala_db'));

$port = 4000;
if (strpos($host, ':') !== false) {
    $parts = explode(':', $host);
    $host = $parts[0];
    $port = $parts[1];
}

echo "<h3>Testing TiDB Connection</h3>";
echo "Host: " . htmlspecialchars($host) . "<br>";
echo "Port: " . htmlspecialchars($port) . "<br>";

$ca_paths = [
    __DIR__ . '/ca-bundle.crt',
    '/etc/pki/tls/certs/ca-bundle.crt',
    '/etc/ssl/certs/ca-certificates.crt',
    '/etc/ssl/ca-bundle.pem'
];

echo "<h4>Checking CAs:</h4>";
$ca_path = '';
foreach ($ca_paths as $p) {
    echo $p . ": " . (file_exists($p) ? "<b>FOUND</b>" : "Not found") . "<br>";
    if (file_exists($p) && empty($ca_path)) {
        $ca_path = $p;
    }
}

echo "<h4>Using CA: " . ($ca_path ?: 'NONE') . "</h4>";

echo "<h4>Attempting PDO (with VERIFY=true):</h4>";
try {
    $options = [
        1002 => 'SET NAMES utf8mb4',
        1014 => true,
    ];
    if ($ca_path) $options[1009] = $ca_path;
    $pdo = new PDO("mysql:host=$host;port=$port;charset=utf8mb4", $dbuser, $dbpass, $options);
    echo "<span style='color:green'>PDO CONNECTED SUCCESSFULLY!</span><br>";
} catch (PDOException $e) {
    echo "<span style='color:red'>PDO FAILED: " . $e->getMessage() . "</span><br>";
}

echo "<h4>Attempting PDO (with VERIFY=false):</h4>";
try {
    $options = [
        1002 => 'SET NAMES utf8mb4',
        1014 => false,
    ];
    if ($ca_path) $options[1009] = $ca_path;
    $pdo = new PDO("mysql:host=$host;port=$port;charset=utf8mb4", $dbuser, $dbpass, $options);
    echo "<span style='color:green'>PDO CONNECTED SUCCESSFULLY!</span><br>";
} catch (PDOException $e) {
    echo "<span style='color:red'>PDO FAILED: " . $e->getMessage() . "</span><br>";
}

echo "<h4>Attempting MYSQLI:</h4>";
$mysqli = mysqli_init();
if ($ca_path) {
    mysqli_ssl_set($mysqli, NULL, NULL, $ca_path, NULL, NULL);
}
if (mysqli_real_connect($mysqli, $host, $dbuser, $dbpass, "", $port, NULL, MYSQLI_CLIENT_SSL)) {
    echo "<span style='color:green'>MYSQLI CONNECTED SUCCESSFULLY!</span><br>";
    mysqli_close($mysqli);
} else {
    echo "<span style='color:red'>MYSQLI FAILED: " . mysqli_connect_error() . "</span><br>";
}
