<?php
// Run this file ONCE to create the database and all tables.
// Visit: http://localhost/projek1/api/setup_db.php

$host   = $_ENV['DB_HOST']   ?? (getenv('DB_HOST')   ?: ($_SERVER['DB_HOST']   ?? 'localhost'));
$dbuser = $_ENV['DB_USER']   ?? (getenv('DB_USER')   ?: ($_SERVER['DB_USER']   ?? 'root'));
$dbpass = $_ENV['DB_PASS']   ?? (getenv('DB_PASS')   ?: ($_SERVER['DB_PASS']   ?? ''));
$dbname = $_ENV['DB_NAME']   ?? (getenv('DB_NAME')   ?: ($_SERVER['DB_NAME']   ?? 'tralala_db'));

try {
    // TiDB Cloud requires SSL connection.
    $options = [
        1002 => 'SET NAMES utf8mb4', // MYSQL_ATTR_INIT_COMMAND
        1010 => '',                  // MYSQL_ATTR_SSL_CA (Forces SSL)
        1014 => false,               // MYSQL_ATTR_SSL_VERIFY_SERVER_CERT
    ];

    // Connect without specifying a database first
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $dbuser, $dbpass, $options);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create database
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$dbname`");

    // Users table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `users` (
        `id`          INT AUTO_INCREMENT PRIMARY KEY,
        `username`    VARCHAR(100) NOT NULL,
        `email`       VARCHAR(255) NOT NULL UNIQUE,
        `password`    VARCHAR(255) NOT NULL,
        `photo`       LONGTEXT DEFAULT NULL,
        `photo_pos_x` FLOAT NOT NULL DEFAULT 50,
        `photo_pos_y` FLOAT NOT NULL DEFAULT 50,
        `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Lists table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `lists` (
        `id`         VARCHAR(20) PRIMARY KEY,
        `user_id`    INT NOT NULL,
        `title`      VARCHAR(255) NOT NULL,
        `position`   INT NOT NULL DEFAULT 0,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Cards table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `cards` (
        `id`          VARCHAR(20) PRIMARY KEY,
        `list_id`     VARCHAR(20) NOT NULL,
        `text`        VARCHAR(500) NOT NULL DEFAULT 'New task...',
        `description` TEXT DEFAULT NULL,
        `position`    INT NOT NULL DEFAULT 0,
        `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Labels table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `labels` (
        `id`      VARCHAR(30) PRIMARY KEY,
        `card_id` VARCHAR(20) NOT NULL,
        `name`    VARCHAR(100) DEFAULT '',
        `color`   VARCHAR(20) NOT NULL DEFAULT '#4A90E2',
        FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Comments table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `comments` (
        `id`          VARCHAR(30) PRIMARY KEY,
        `card_id`     VARCHAR(20) NOT NULL,
        `author_name` VARCHAR(100) NOT NULL DEFAULT 'User',
        `body`        LONGTEXT DEFAULT NULL,
        `timestamp`   BIGINT NOT NULL,
        FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Attachments table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `attachments` (
        `id`         INT AUTO_INCREMENT PRIMARY KEY,
        `comment_id` VARCHAR(30) NOT NULL,
        `name`       VARCHAR(255) NOT NULL,
        `file_path`  VARCHAR(500) NOT NULL,
        `is_image`   TINYINT(1) NOT NULL DEFAULT 0,
        FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    echo '<h2 style="font-family:sans-serif;color:green;">✅ Database setup berhasil!</h2>';
    echo '<p style="font-family:sans-serif">Database <strong>tralala_db</strong> dan semua tabel sudah dibuat.</p>';
    echo '<p style="font-family:sans-serif">Tabel yang dibuat: <code>users, lists, cards, labels, comments, attachments</code></p>';
    echo '<p style="font-family:sans-serif"><a href="../index.html">→ Kembali ke app</a></p>';

} catch (PDOException $e) {
    echo '<h2 style="font-family:sans-serif;color:red;">❌ Setup gagal</h2>';
    echo '<pre style="font-family:sans-serif">' . htmlspecialchars($e->getMessage()) . '</pre>';
}
