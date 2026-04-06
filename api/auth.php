<?php
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

$input  = get_input();
$action = $input['action'] ?? '';

switch ($action) {

    // ── Register ──────────────────────────────────────────
    case 'register':
        $username = trim($input['username'] ?? '');
        $email    = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if (!$username || !$email || !$password) {
            json_err('Semua field harus diisi.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_err('Format email tidak valid.');
        }
        if (strlen($password) < 6) {
            json_err('Password minimal 6 karakter.');
        }

        // Check duplicate email
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            json_err('Email sudah terdaftar.');
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
        $stmt->execute([$username, $email, $hash]);
        $userId = (int)$pdo->lastInsertId();

        $user = [
            'id'       => $userId,
            'username' => $username,
            'email'    => $email,
            'photo'    => null,
            'photoPos' => ['x' => 50, 'y' => 50],
        ];

        $_SESSION['user_id']    = $userId;
        $_SESSION['login_time'] = time();
        $_SESSION['username']   = $username;
        $_SESSION['email']      = $email;
        $_SESSION['photo']      = null;
        $_SESSION['photo_pos_x'] = 50;
        $_SESSION['photo_pos_y'] = 50;

        json_ok($user);
        break;

    // ── Login ─────────────────────────────────────────────
    case 'login':
        $email    = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if (!$email || !$password) {
            json_err('Email dan password harus diisi.');
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            json_err('Email atau password salah.');
        }

        $_SESSION['user_id']     = (int)$user['id'];
        $_SESSION['login_time']  = time();
        $_SESSION['username']    = $user['username'];
        $_SESSION['email']       = $user['email'];
        $_SESSION['photo']       = $user['photo'];
        $_SESSION['photo_pos_x'] = (float)$user['photo_pos_x'];
        $_SESSION['photo_pos_y'] = (float)$user['photo_pos_y'];

        json_ok([
            'id'       => (int)$user['id'],
            'username' => $user['username'],
            'email'    => $user['email'],
            'photo'    => $user['photo'],
            'photoPos' => ['x' => (float)$user['photo_pos_x'], 'y' => (float)$user['photo_pos_y']],
        ]);
        break;

    // ── Session Check ────────────────────────────────────
    case 'session_check':
        if (empty($_SESSION['user_id']) || !check_session_timeout()) {
            json_ok(null);
        }
        json_ok([
            'id'       => (int)$_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'email'    => $_SESSION['email'],
            'photo'    => $_SESSION['photo'],
            'photoPos' => [
                'x' => (float)($_SESSION['photo_pos_x'] ?? 50),
                'y' => (float)($_SESSION['photo_pos_y'] ?? 50),
            ],
        ]);
        break;

    // ── Logout ───────────────────────────────────────────
    case 'logout':
        session_destroy();
        json_ok(null);
        break;

    // ── Update Profile ───────────────────────────────────
    case 'update_profile':
        require_auth();
        $userId      = $_SESSION['user_id'];
        $newUsername = trim($input['username'] ?? '');
        $oldPw       = $input['old_password'] ?? '';
        $newPw       = $input['new_password'] ?? '';

        if (!$newUsername) {
            json_err('Username tidak boleh kosong.');
        }

        // Fetch current user
        $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        $updates = ['username = ?'];
        $params  = [$newUsername];

        // Change password (optional)
        if ($oldPw || $newPw) {
            if (!$oldPw || !$newPw) {
                json_err('Isi semua field password untuk menggantinya.');
            }
            if (!password_verify($oldPw, $row['password'])) {
                json_err('Password lama salah.');
            }
            if (strlen($newPw) < 6) {
                json_err('Password baru minimal 6 karakter.');
            }
            $updates[] = 'password = ?';
            $params[]  = password_hash($newPw, PASSWORD_BCRYPT);
        }

        $params[] = $userId;
        $pdo->prepare("UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?")
            ->execute($params);

        $_SESSION['username'] = $newUsername;

        json_ok([
            'id'       => (int)$userId,
            'username' => $newUsername,
            'email'    => $_SESSION['email'],
            'photo'    => $_SESSION['photo'],
            'photoPos' => [
                'x' => (float)($_SESSION['photo_pos_x'] ?? 50),
                'y' => (float)($_SESSION['photo_pos_y'] ?? 50),
            ],
        ]);
        break;

    // ── Get All Users (For Navbar Avatar Stack) ──
    case 'get_all_users':
        $stmt = $pdo->query("SELECT id, username, photo, photo_pos_x, photo_pos_y FROM users ORDER BY id ASC");
        $users = [];
        while ($row = $stmt->fetch()) {
            $users[] = [
                'id'       => (int)$row['id'],
                'username' => $row['username'],
                'photo'    => $row['photo'],
                'photoPos' => [
                    'x' => (float)($row['photo_pos_x'] ?? 50),
                    'y' => (float)($row['photo_pos_y'] ?? 50),
                ]
            ];
        }
        json_ok($users);
        break;

    // ── Update Photo ─────────────────────────────────────
    case 'update_photo':
        require_auth();
        $userId = $_SESSION['user_id'];
        $photo  = $input['photo']; // base64 string or null

        $pdo->prepare("UPDATE users SET photo = ?, photo_pos_x = 50, photo_pos_y = 50 WHERE id = ?")
            ->execute([$photo, $userId]);

        $_SESSION['photo']      = $photo;
        $_SESSION['photo_pos_x'] = 50;
        $_SESSION['photo_pos_y'] = 50;

        json_ok(['photo' => $photo, 'photoPos' => ['x' => 50, 'y' => 50]]);
        break;

    default:
        json_err('Unknown action.', 404);
}
