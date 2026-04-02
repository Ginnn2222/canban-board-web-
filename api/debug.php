<?php
echo "<h3>Debug Database Connection Info:</h3>";
echo "HOST (via _ENV): " . ($_ENV['DB_HOST'] ?? '<span style="color:red">KOSONG</span>') . "<br>";
echo "HOST (via getenv): " . (getenv('DB_HOST') ?: '<span style="color:red">KOSONG</span>') . "<br>";
echo "HOST (via _SERVER): " . ($_SERVER['DB_HOST'] ?? '<span style="color:red">KOSONG</span>') . "<br>";
echo "<hr>";
echo "DATABASE: " . ($_ENV['DB_NAME'] ?? (getenv('DB_NAME') ?: '<span style="color:red">KOSONG</span>')) . "<br>";
echo "USER: " . ($_ENV['DB_USER'] ?? (getenv('DB_USER') ?: '<span style="color:red">KOSONG</span>')) . "<br>";
echo "PASS: " . (($_ENV['DB_PASS'] ?? getenv('DB_PASS')) ? '<span style="color:green">TERISI</span>' : '<span style="color:red">KOSONG</span>') . "<br>";
echo "<hr>";
echo "PHP Version: " . PHP_VERSION . "<br>";
?>
