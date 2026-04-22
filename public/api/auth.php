<?php
/**
 * Authentication API
 * POST /api/auth.php?action=login     - Login
 * POST /api/auth.php?action=register  - Register new staff
 * POST /api/auth.php?action=logout    - Logout (client-side token removal)
 * GET  /api/auth.php?action=me        - Get current user
 */
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'login':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleLogin();
        break;

    case 'register':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleRegister();
        break;

    case 'me':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        handleMe();
        break;

    case 'change-password':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleChangePassword();
        break;

    case 'change-email':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleChangeEmail();
        break;

    case 'forgot-password':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleForgotPassword();
        break;

    case 'verify-reset-token':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        handleVerifyResetToken();
        break;

    case 'reset-password':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleResetPassword();
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}

function handleLogin(): void {
    $data = getJsonInput();
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (!$email || !$password) {
        jsonResponse(['error' => 'Email and password are required'], 400);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT u.*, ur.role FROM auth_users u LEFT JOIN user_roles ur ON u.id = ur.user_id WHERE u.email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['error' => 'Invalid email or password'], 401);
    }

    $token = createJWT($user['id'], $user['role'] ?? 'staff');

    // Update last sign in
    $pdo->prepare('UPDATE auth_users SET last_sign_in_at = NOW() WHERE id = ?')->execute([$user['id']]);

    jsonResponse([
        'access_token' => $token,
        'user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'] ?? 'staff',
        ],
    ]);
}

function handleRegister(): void {
    $data = getJsonInput();
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (!$email || !$password) {
        jsonResponse(['error' => 'Email and password are required'], 400);
    }

    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'Invalid email format'], 400);
    }

    // Strong password policy: min 12 chars, uppercase, lowercase, number, special char
    if (strlen($password) < 12 ||
        !preg_match('/[A-Z]/', $password) ||
        !preg_match('/[a-z]/', $password) ||
        !preg_match('/[0-9]/', $password) ||
        !preg_match('/[^A-Za-z0-9]/', $password)) {
        jsonResponse(['error' => 'Password must be at least 12 characters with uppercase, lowercase, number, and special character'], 400);
    }

    $pdo = getDB();

    // Check if email exists
    $stmt = $pdo->prepare('SELECT id FROM auth_users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'Email already registered'], 409);
    }

    $userId = generateUUID();
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $pdo->beginTransaction();
    try {
        // Create user
        $pdo->prepare('INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, NOW())')
            ->execute([$userId, $email, $passwordHash]);

        // Assign role: first user = admin, others = staff
        $stmt = $pdo->query('SELECT COUNT(*) FROM user_roles');
        $userCount = $stmt->fetchColumn();
        $role = ($userCount == 0) ? 'admin' : 'staff';

        $pdo->prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, NOW())')
            ->execute([generateUUID(), $userId, $role]);

        $pdo->commit();

        $token = createJWT($userId, $role);
        jsonResponse([
            'access_token' => $token,
            'user' => ['id' => $userId, 'email' => $email, 'role' => $role],
        ], 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Registration failed'], 500);
    }
}

function handleMe(): void {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('SELECT u.id, u.email, ur.role FROM auth_users u LEFT JOIN user_roles ur ON u.id = ur.user_id WHERE u.id = ?');
    $stmt->execute([$user['sub']]);
    $userData = $stmt->fetch();

    if (!$userData) {
        jsonResponse(['error' => 'User not found'], 404);
    }

    jsonResponse(['user' => $userData]);
}

function handleChangePassword(): void {
    $user = requireAuth();
    $data = getJsonInput();
    $current = $data['current_password'] ?? '';
    $new = $data['new_password'] ?? '';

    if (!$current || !$new) jsonResponse(['error' => 'Both passwords required'], 400);
    if (strlen($new) < 12 ||
        !preg_match('/[A-Z]/', $new) ||
        !preg_match('/[a-z]/', $new) ||
        !preg_match('/[0-9]/', $new) ||
        !preg_match('/[^A-Za-z0-9]/', $new)) {
        jsonResponse(['error' => 'Password too weak'], 400);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT password_hash FROM auth_users WHERE id = ?');
    $stmt->execute([$user['sub']]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($current, $row['password_hash'])) {
        jsonResponse(['error' => 'Current password is incorrect'], 401);
    }

    $newHash = password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]);
    $pdo->prepare('UPDATE auth_users SET password_hash = ? WHERE id = ?')->execute([$newHash, $user['sub']]);
    jsonResponse(['success' => true]);
}

function handleChangeEmail(): void {
    $user = requireAuth();
    $data = getJsonInput();
    $newEmail = trim($data['new_email'] ?? '');

    if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'Invalid email'], 400);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT id FROM auth_users WHERE email = ? AND id <> ?');
    $stmt->execute([$newEmail, $user['sub']]);
    if ($stmt->fetch()) jsonResponse(['error' => 'Email already in use'], 409);

    $pdo->prepare('UPDATE auth_users SET email = ? WHERE id = ?')->execute([$newEmail, $user['sub']]);

    // Re-issue token with same role
    $stmt = $pdo->prepare('SELECT role FROM user_roles WHERE user_id = ?');
    $stmt->execute([$user['sub']]);
    $role = $stmt->fetchColumn() ?: 'staff';
    $token = createJWT($user['sub'], $role);

    jsonResponse([
        'access_token' => $token,
        'user' => ['id' => $user['sub'], 'email' => $newEmail, 'role' => $role],
    ]);
}

function handleForgotPassword(): void {
    $data = getJsonInput();
    $email = trim($data['email'] ?? '');
    if (!$email) jsonResponse(['error' => 'Email required'], 400);

    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT id FROM auth_users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Always respond success to avoid email enumeration
    if ($user) {
        $token = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', time() + 3600);
        $pdo->prepare('INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())')
            ->execute([generateUUID(), $user['id'], $token, $expires]);

        // Build reset link & send via Infobip Email
        $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $resetUrl = "$proto://$host/reset-password?token=$token";

        $sStmt = $pdo->query('SELECT practice_name, infobip_sender_email FROM practice_settings LIMIT 1');
        $settings = $sStmt->fetch() ?: [];
        $practiceName = $settings['practice_name'] ?? 'Medical Practice';
        $senderEmail = $settings['infobip_sender_email'] ?? INFOBIP_SENDER_EMAIL;

        $html = "<p>You requested a password reset for your account at $practiceName.</p>"
              . "<p><a href=\"$resetUrl\">Click here to reset your password</a></p>"
              . "<p>This link expires in 1 hour. If you did not request this, ignore this email.</p>";

        $boundary = uniqid('boundary');
        $body = "--$boundary\r\nContent-Disposition: form-data; name=\"from\"\r\n\r\n$practiceName <$senderEmail>\r\n"
              . "--$boundary\r\nContent-Disposition: form-data; name=\"to\"\r\n\r\n$email\r\n"
              . "--$boundary\r\nContent-Disposition: form-data; name=\"subject\"\r\n\r\nPassword Reset\r\n"
              . "--$boundary\r\nContent-Disposition: form-data; name=\"html\"\r\n\r\n$html\r\n"
              . "--$boundary--\r\n";

        $ch = curl_init(INFOBIP_BASE_URL . '/email/3/send');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => [
                "Content-Type: multipart/form-data; boundary=$boundary",
                'Authorization: App ' . INFOBIP_API_KEY,
            ],
        ]);
        curl_exec($ch);
        curl_close($ch);
    }

    jsonResponse(['success' => true]);
}

function handleVerifyResetToken(): void {
    $token = $_GET['token'] ?? '';
    if (!$token) jsonResponse(['valid' => false]);
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT id FROM password_reset_tokens WHERE token = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1');
    $stmt->execute([$token]);
    jsonResponse(['valid' => (bool) $stmt->fetch()]);
}

function handleResetPassword(): void {
    $data = getJsonInput();
    $token = $data['token'] ?? '';
    $newPassword = $data['new_password'] ?? '';

    if (!$token || !$newPassword) jsonResponse(['error' => 'Missing fields'], 400);
    if (strlen($newPassword) < 12 ||
        !preg_match('/[A-Z]/', $newPassword) ||
        !preg_match('/[a-z]/', $newPassword) ||
        !preg_match('/[0-9]/', $newPassword) ||
        !preg_match('/[^A-Za-z0-9]/', $newPassword)) {
        jsonResponse(['error' => 'Password too weak'], 400);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT id, user_id FROM password_reset_tokens WHERE token = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) jsonResponse(['error' => 'Invalid or expired token'], 400);

    $hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
    $pdo->prepare('UPDATE auth_users SET password_hash = ? WHERE id = ?')->execute([$hash, $row['user_id']]);
    $pdo->prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?')->execute([$row['id']]);

    jsonResponse(['success' => true]);
}
