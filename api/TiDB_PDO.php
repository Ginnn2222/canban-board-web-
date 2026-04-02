<?php

// A drop-in polyfill for PDO using MySQLi to bypass the vercel-php OpenSSL 3.0 PDO bug
// with TiDB Serverless Envoy proxies.
class TiDB_Statement {
    private $mysqli_stmt;
    private $result;

    public function __construct($mysqli_stmt) {
        $this->mysqli_stmt = $mysqli_stmt;
    }

    public function execute($params = null): bool {
        // Clear previous results
        $this->result = null;
        
        if ($params !== null && !empty($params)) {
            $values = array_values($params);
            // mysqli_stmt::execute([$v1, $v2]) is PHP 8.1+
            if (method_exists($this->mysqli_stmt, 'execute') && PHP_VERSION_ID >= 80100) {
                if (!$this->mysqli_stmt->execute($values)) {
                    throw new Exception("TiDB Execute failed: " . $this->mysqli_stmt->error);
                }
            } else {
                // Fallback for PHP < 8.1 (Older environments)
                $types = str_repeat('s', count($values)); // Bind all as strings for safety
                $this->mysqli_stmt->bind_param($types, ...$values);
                if (!$this->mysqli_stmt->execute()) {
                    throw new Exception("TiDB Execute legacy failed: " . $this->mysqli_stmt->error);
                }
            }
        } else {
            if (!$this->mysqli_stmt->execute()) {
                throw new Exception("TiDB Execute failed: " . $this->mysqli_stmt->error);
            }
        }
        
        $this->result = $this->mysqli_stmt->get_result();
        return true;
    }

    public function fetchAll() {
        if (!$this->result) return [];
        return $this->result->fetch_all(MYSQLI_ASSOC) ?: [];
    }

    public function fetch() {
        if (!$this->result) return false;
        return $this->result->fetch_assoc() ?: false;
    }
}

class TiDB_PDO {
    private $mysqli;

    public function __construct($dsn, $user, $password, $options = []) {
        preg_match('/host=([^;]+)/', $dsn, $host_match);
        preg_match('/dbname=([^;]+)/', $dsn, $db_match);
        preg_match('/port=([^;]+)/', $dsn, $port_match);
        
        $host = $host_match[1] ?? 'localhost';
        $dbname = $db_match[1] ?? '';
        $port = $port_match[1] ?? 3306;

        $this->mysqli = mysqli_init();
        
        // Maps PDO::MYSQL_ATTR_SSL_CA (1009) -> mysqli ssl set
        $ca_path = $options[1009] ?? NULL;
        if ($ca_path) {
            mysqli_ssl_set($this->mysqli, NULL, NULL, $ca_path, NULL, NULL);
        }
        
        if (!mysqli_real_connect($this->mysqli, $host, $user, $password, $dbname, $port, NULL, MYSQLI_CLIENT_SSL)) {
            throw new Exception("TiDB_PDO Connection failed: " . mysqli_connect_error());
        }
        $this->mysqli->set_charset("utf8mb4");
    }

    public function prepare($sql) {
        $stmt = $this->mysqli->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->mysqli->error);
        }
        return new TiDB_Statement($stmt);
    }

    public function exec($sql) {
        if (!$this->mysqli->query($sql)) {
            throw new Exception("Exec failed: " . $this->mysqli->error);
        }
        return $this->mysqli->affected_rows;
    }

    public function lastInsertId() {
        return $this->mysqli->insert_id;
    }

    public function setAttribute($attr, $val) {
        // Stub for PDO::ATTR_ERRMODE etc., since our polyfill throws exceptions by default.
        return true; 
    }
}
