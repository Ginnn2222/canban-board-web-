<?php
echo "<h3>Debug Database Connection Info:</h3>";
echo "HOST (via _ENV): " . ($_ENV['DB_HOST'] ?? '<span style="color:red">KOSONG</span>') . "<br>";
echo "HOST (via getenv): " . (getenv('DB_HOST') ?: '<span style="color:red">KOSONG</span>') . "<br>";
echo "HOST (via _SERVER): " . ($_SERVER['DB_HOST'] ?? '<span style="color:red">KOSONG</span>') . "<br>";
echo "<hr>";
echo "<h3>SSL Certificate Check:</h3>";
$paths = [
    __DIR__ . '/ca-bundle.crt',
    '/etc/pki/tls/certs/ca-bundle.crt',
    '/etc/ssl/certs/ca-certificates.crt',
    '/etc/ssl/ca-bundle.pem',
    '/etc/ssl/cert.pem'
];
foreach ($paths as $path) {
    if (file_exists($path)) {
        echo "<span style='color:green'>ADA</span> - $path<br>";
    } else {
        echo "<span style='color:red'>TIDAK ADA</span> - $path<br>";
    }
}
echo "<hr>";
echo "DATABASE: " . ($_ENV['DB_NAME'] ?? (getenv('DB_NAME') ?: '<span style="color:red">KOSONG</span>')) . "<br>";
echo "USER: " . ($_ENV['DB_USER'] ?? (getenv('DB_USER') ?: '<span style="color:red">KOSONG</span>')) . "<br>";
echo "PASS: " . (($_ENV['DB_PASS'] ?? getenv('DB_PASS')) ? '<span style="color:green">TERISI</span>' : '<span style="color:red">KOSONG</span>') . "<br>";
echo "<hr>";
echo "PHP Version: " . PHP_VERSION . "<br>";
?>
