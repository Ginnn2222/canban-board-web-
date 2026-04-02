<?php

// A drop-in polyfill for PDO using MySQLi to bypass the vercel-php OpenSSL 3.0 PDO bug
// with TiDB Serverless Envoy proxies.
class TiDB_Statement {
    private $mysqli_stmt;
    private $result;

    public function __construct($mysqli_stmt) {
        $this->mysqli_stmt = $mysqli_stmt;
    }

    public function execute($params = null) {
        // PHP 8.1+ supports passing parameters array directly to execute()
        if ($params !== null && !empty($params)) {
            // PDO execute uses 0-indexed arrays usually, or associative.
            // mysqli_stmt::execute expects list of values.
            $values = array_values($params);
            if (!$this->mysqli_stmt->execute($values)) {
                throw new Exception($this->mysqli_stmt->error);
            }
        } else {
            if (!$this->mysqli_stmt->execute()) {
                throw new Exception($this->mysqli_stmt->error);
            }
        }
        
        // get_result only works for SELECT queries, for others it returns false cleanly
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
