<?php
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';
require_auth();

$input  = get_input();
$action = $input['action'] ?? '';

// 🔥 Shared Board: Everyone interacts with the same Board ID 🔥
$userId = GLOBAL_BOARD_USER_ID;

// ── Helper: save file from base64 data URL ────────────────
function save_attachment($userId, $base64DataUrl, $name) {
    $parts   = explode(',', $base64DataUrl, 2);
    $decoded = base64_decode($parts[1] ?? '');
    $ext     = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $ext     = preg_replace('/[^a-z0-9]/', '', $ext);
    if (!$ext) $ext = 'bin';
    $filename = uniqid('att_', true) . '.' . $ext;
    $dir = dirname(__DIR__) . '/uploads/' . $userId . '/';
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    file_put_contents($dir . $filename, $decoded);
    return $filename; // relative filename inside uploads/{userId}/
}

function att_url($userId, $filename) {
    return get_base_url() . 'uploads/' . $userId . '/' . $filename;
}

// ── Helper: build full board structure ───────────────────
function fetch_board($pdo, $userId) {
    // Lists
    $lists = $pdo->prepare("SELECT id, title, position FROM lists WHERE user_id = ? ORDER BY position ASC");
    $lists->execute([$userId]);
    $lists = $lists->fetchAll();

    if (empty($lists)) return [];

    $listIds    = array_column($lists, 'id');
    $inList     = implode(',', array_fill(0, count($listIds), '?'));

    // Cards
    $cards = $pdo->prepare("SELECT id, list_id, text, description, position FROM cards WHERE list_id IN ($inList) ORDER BY list_id, position ASC");
    $cards->execute($listIds);
    $cards = $cards->fetchAll();

    $cardIds = array_column($cards, 'id');

    $labelsByCard    = [];
    $commentCounts   = [];
    $attachmentCounts = [];

    if (!empty($cardIds)) {
        $inCard = implode(',', array_fill(0, count($cardIds), '?'));

        // Labels
        $lStmt = $pdo->prepare("SELECT id, card_id, name, color FROM labels WHERE card_id IN ($inCard)");
        $lStmt->execute($cardIds);
        foreach ($lStmt->fetchAll() as $l) {
            $labelsByCard[$l['card_id']][] = ['id' => $l['id'], 'name' => $l['name'], 'color' => $l['color']];
        }

        // Comment Counts
        $cCountStmt = $pdo->prepare("SELECT card_id, COUNT(*) as cnt FROM comments WHERE card_id IN ($inCard) GROUP BY card_id");
        $cCountStmt->execute($cardIds);
        foreach ($cCountStmt->fetchAll() as $row) {
            $commentCounts[$row['card_id']] = (int)$row['cnt'];
        }

        // Attachment Counts (via Comments)
        $aCountStmt = $pdo->prepare("SELECT c.card_id, COUNT(a.id) as cnt FROM attachments a JOIN comments c ON a.comment_id = c.id WHERE c.card_id IN ($inCard) GROUP BY c.card_id");
        $aCountStmt->execute($cardIds);
        foreach ($aCountStmt->fetchAll() as $row) {
            $attachmentCounts[$row['card_id']] = (int)$row['cnt'];
        }
    }

    // Build nested structure
    $cardsByList = [];
    foreach ($cards as $c) {
        $cardsByList[$c['list_id']][] = [
            'id'               => $c['id'],
            'text'             => $c['text'],
            'description'      => $c['description'] ?? '',
            'labels'           => $labelsByCard[$c['id']] ?? [],
            'comment_count'    => $commentCounts[$c['id']] ?? 0,
            'attachment_count' => $attachmentCounts[$c['id']] ?? 0,
        ];
    }

    $result = [];
    foreach ($lists as $l) {
        $result[] = [
            'id'    => $l['id'],
            'title' => $l['title'],
            'cards' => $cardsByList[$l['id']] ?? [],
        ];
    }
    return $result;
}

// ─────────────────────────────────────────────────────────
switch ($action) {

    // ── Get full board ────────────────────────────────────
    case 'get_board':
        json_ok(fetch_board($pdo, $userId));
        break;

    // ── Get card details (Lazy Loading) ───────────────────
    case 'get_card_details':
        $cardId = $input['card_id'];
        
        $cStmt = $pdo->prepare("SELECT id, card_id, user_id, author_name, body, timestamp FROM comments WHERE card_id = ? ORDER BY timestamp DESC");
        $cStmt->execute([$cardId]);
        $comments = $cStmt->fetchAll();
        
        $commentIds = array_column($comments, 'id');
        $attsByComment = [];
        if (!empty($commentIds)) {
            $inCmt = implode(',', array_fill(0, count($commentIds), '?'));
            $aStmt = $pdo->prepare("SELECT id, comment_id, name, file_path, is_image FROM attachments WHERE comment_id IN ($inCmt)");
            $aStmt->execute($commentIds);
            foreach ($aStmt->fetchAll() as $a) {
                $attsByComment[$a['comment_id']][] = $a;
            }
        }
        
        $userPhoto = $_SESSION['photo'] ?? null;
        $formattedComments = [];
        foreach ($comments as $c) {
            $atts = [];
            foreach ($attsByComment[$c['id']] ?? [] as $a) {
                $atts[] = [
                    'id'      => (int)$a['id'],
                    'name'    => $a['name'],
                    'data'    => att_url($_SESSION['user_id'] ?? 1, $a['file_path']),
                    'isImage' => (bool)$a['is_image'],
                ];
            }
            $formattedComments[] = [
                'id'          => $c['id'],
                'user_id'     => (int)$c['user_id'],
                'authorName'  => $c['author_name'],
                'authorPhoto' => $userPhoto,
                'text'        => $c['body'],
                'attachments' => $atts,
                'timestamp'   => (int)$c['timestamp'],
            ];
        }
        json_ok(['comments' => $formattedComments]);
        break;

    // ── Add list ──────────────────────────────────────────
    case 'add_list':
        $id       = $input['id'];
        $title    = trim($input['title'] ?? 'New List');
        $position = (int)($input['position'] ?? 0);
        $pdo->prepare("INSERT INTO lists (id, user_id, title, position) VALUES (?, ?, ?, ?)")
            ->execute([$id, $userId, $title, $position]);
        json_ok(['id' => $id]);
        break;

    // ── Update list title ────────────────────────────────
    case 'update_list':
        $pdo->prepare("UPDATE lists SET title = ? WHERE id = ? AND user_id = ?")
            ->execute([trim($input['title'] ?? ''), $input['id'], $userId]);
        json_ok(null);
        break;

    // ── Delete list ───────────────────────────────────────
    case 'delete_list':
        // Delete attached uploads first
        $stmt = $pdo->prepare("
            SELECT a.file_path FROM attachments a
            INNER JOIN comments cm ON a.comment_id = cm.id
            INNER JOIN cards c ON cm.card_id = c.id
            WHERE c.list_id = ?
        ");
        $stmt->execute([$input['id']]);
        $dir = dirname(__DIR__) . '/uploads/' . $userId . '/';
        foreach ($stmt->fetchAll() as $a) {
            $f = $dir . $a['file_path'];
            if (file_exists($f)) unlink($f);
        }
        $pdo->prepare("DELETE FROM lists WHERE id = ? AND user_id = ?")
            ->execute([$input['id'], $userId]);
        json_ok(null);
        break;

    // ── Add card ──────────────────────────────────────────
    case 'add_card':
        $id       = $input['id'];
        $listId   = $input['list_id'];
        $text     = trim($input['text'] ?? 'New task...');
        $desc     = $input['description'] ?? '';
        $position = (int)($input['position'] ?? 0);
        $pdo->prepare("INSERT INTO cards (id, list_id, text, description, position) VALUES (?, ?, ?, ?, ?)")
            ->execute([$id, $listId, $text, $desc, $position]);
        json_ok(['id' => $id]);
        break;

    // ── Update card ───────────────────────────────────────
    case 'update_card':
        $id     = $input['id'];
        $fields = [];
        $params = [];
        if (isset($input['text']))        { $fields[] = 'text = ?';        $params[] = trim($input['text']); }
        if (isset($input['description'])) { $fields[] = 'description = ?'; $params[] = $input['description']; }
        if ($fields) {
            $params[] = $id;
            $pdo->prepare("UPDATE cards SET " . implode(', ', $fields) . " WHERE id = ?")
                ->execute($params);
        }
        json_ok(null);
        break;

    // ── Delete card ───────────────────────────────────────
    case 'delete_card':
        $id  = $input['id'];
        $dir = dirname(__DIR__) . '/uploads/' . $userId . '/';
        $stmt = $pdo->prepare("SELECT a.file_path FROM attachments a INNER JOIN comments cm ON a.comment_id = cm.id WHERE cm.card_id = ?");
        $stmt->execute([$id]);
        foreach ($stmt->fetchAll() as $a) {
            $f = $dir . $a['file_path'];
            if (file_exists($f)) unlink($f);
        }
        $pdo->prepare("DELETE FROM cards WHERE id = ?")->execute([$id]);
        json_ok(null);
        break;

    // ── Sync positions (drag-drop / move card) ────────────
    case 'sync_positions':
        $lists = $input['lists'] ?? [];
        foreach ($lists as $li => $list) {
            $pdo->prepare("UPDATE lists SET position = ? WHERE id = ? AND user_id = ?")
                ->execute([$list['position'], $list['id'], $userId]);
            foreach ($list['cards'] as $ci => $card) {
                $pdo->prepare("UPDATE cards SET position = ?, list_id = ? WHERE id = ?")
                    ->execute([$card['position'], $list['id'], $card['id']]);
            }
        }
        json_ok(null);
        break;

    // ── Add label ─────────────────────────────────────────
    case 'add_label':
        $pdo->prepare("INSERT INTO labels (id, card_id, name, color) VALUES (?, ?, ?, ?)")
            ->execute([$input['id'], $input['card_id'], $input['name'] ?? '', $input['color']]);
        json_ok(null);
        break;

    // ── Update label ──────────────────────────────────────
    case 'update_label':
        $pdo->prepare("UPDATE labels SET name = ?, color = ? WHERE id = ?")
            ->execute([$input['name'] ?? '', $input['color'], $input['id']]);
        json_ok(null);
        break;

    // ── Delete label ──────────────────────────────────────
    case 'delete_label':
        $pdo->prepare("DELETE FROM labels WHERE id = ?")->execute([$input['id']]);
        json_ok(null);
        break;

    // ── Add comment ───────────────────────────────────────
    case 'add_comment':
        $cardId      = $input['card_id'];
        $authorName  = $input['author_name'] ?? 'User';
        $body        = $input['text'] ?? '';
        $timestamp   = (int)($input['timestamp'] ?? (time() * 1000));
        $rawAtts     = $input['attachments'] ?? [];
        $commentId   = $input['id'] ?? ('cmt-' . time() . rand(100,999));

        $pdo->prepare("INSERT INTO comments (id, card_id, user_id, author_name, body, timestamp) VALUES (?, ?, ?, ?, ?, ?)")
            ->execute([$commentId, $cardId, $userId, $authorName, $body, $timestamp]);

        $savedAtts = [];
        foreach ($rawAtts as $att) {
            $filename = save_attachment($userId, $att['data'], $att['name']);
            $isImage  = $att['isImage'] ? 1 : 0;
            $pdo->prepare("INSERT INTO attachments (comment_id, name, file_path, is_image) VALUES (?, ?, ?, ?)")
                ->execute([$commentId, $att['name'], $filename, $isImage]);
            $attId = (int)$pdo->lastInsertId();
            $savedAtts[] = [
                'id'      => $attId,
                'name'    => $att['name'],
                'data'    => att_url($userId, $filename),
                'isImage' => (bool)$isImage,
            ];
        }

        json_ok([
            'id'          => $commentId,
            'user_id'     => $userId,
            'authorName'  => $authorName,
            'authorPhoto' => $_SESSION['photo'] ?? null,
            'text'        => $body,
            'attachments' => $savedAtts,
            'timestamp'   => $timestamp,
        ]);
        break;

    // ── Edit comment ──────────────────────────────────────
    case 'edit_comment':
        $id   = $input['id'];
        $text = $input['text'] ?? '';

        $stmt = $pdo->prepare("SELECT user_id FROM comments WHERE id = ?");
        $stmt->execute([$id]);
        $cmt = $stmt->fetch();

        if (!$cmt || $cmt['user_id'] != $userId) {
            json_err('Unauthorized to edit this comment', 403);
        }

        $pdo->prepare("UPDATE comments SET body = ? WHERE id = ?")->execute([$text, $id]);
        json_ok(null);
        break;

    // ── Delete comment ────────────────────────────────────
    case 'delete_comment':
        $id  = $input['id'];
        $dir = dirname(__DIR__) . '/uploads/' . $userId . '/';
        $stmt = $pdo->prepare("SELECT file_path FROM attachments WHERE comment_id = ?");
        $stmt->execute([$id]);
        foreach ($stmt->fetchAll() as $a) {
            $f = $dir . $a['file_path'];
            if (file_exists($f)) unlink($f);
        }
        $pdo->prepare("DELETE FROM comments WHERE id = ?")->execute([$id]);
        json_ok(null);
        break;

    // ── Delete attachment ─────────────────────────────────
    case 'delete_attachment':
        $id  = (int)$input['id'];
        $dir = dirname(__DIR__) . '/uploads/' . $userId . '/';
        $stmt = $pdo->prepare("SELECT file_path FROM attachments WHERE id = ?");
        $stmt->execute([$id]);
        $att = $stmt->fetch();
        if ($att) {
            $f = $dir . $att['file_path'];
            if (file_exists($f)) unlink($f);
            $pdo->prepare("DELETE FROM attachments WHERE id = ?")->execute([$id]);
        }
        json_ok(null);
        break;

    default:
        json_err('Unknown action', 404);
}
