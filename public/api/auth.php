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
