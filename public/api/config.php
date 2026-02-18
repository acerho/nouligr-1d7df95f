<?php
/**
 * Nouli Medical - Database Configuration & Helpers
 * Place your MySQL credentials here
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ==========================================
// DATABASE CONFIGURATION - EDIT THESE VALUES
// ==========================================
define('DB_HOST', 'localhost');
define('DB_NAME', 'nouli_medical');
define('DB_USER', 'nouli_user');
define('DB_PASS', 'YOUR_PASSWORD_HERE'); // ← Change this!
define('DB_PORT', 3306);

// Infobip SMS/Email config
define('INFOBIP_API_KEY', 'YOUR_INFOBIP_API_KEY'); // ← Change this!
define('INFOBIP_BASE_URL', 'https://YOUR_INFOBIP_BASE_URL'); // ← Change this!
define('INFOBIP_SENDER_EMAIL', 'noreply@nouli.gr'); // ← Change this!

// JWT Secret for authentication tokens
define('JWT_SECRET', 'YOUR_RANDOM_SECRET_KEY_MIN_32_CHARS'); // ← Change this!
define('JWT_EXPIRY', 7 * 24 * 3600); // 7 days

// ==========================================
// DATABASE CONNECTION
// ==========================================
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4",
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed']);
            exit();
        }
    }
    return $pdo;
}

// ==========================================
// AUTHENTICATION HELPERS
// ==========================================
function generateUUID(): string {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function createJWT(string $userId, string $role): string {
    $header = base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload = base64UrlEncode(json_encode([
        'sub' => $userId,
        'role' => $role,
        'iat' => time(),
        'exp' => time() + JWT_EXPIRY,
    ]));
    $signature = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$signature";
}

function verifyJWT(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $payload, $signature] = $parts;
    $expectedSig = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));

    if (!hash_equals($expectedSig, $signature)) return null;

    $data = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
    if (!$data || !isset($data['exp']) || $data['exp'] < time()) return null;

    return $data;
}

function getAuthUser(): ?array {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (!str_starts_with($authHeader, 'Bearer ')) return null;

    $token = substr($authHeader, 7);
    return verifyJWT($token);
}

function requireAuth(): array {
    $user = getAuthUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit();
    }
    return $user;
}

function requireStaff(): array {
    $user = requireAuth();
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT role FROM user_roles WHERE user_id = ?');
    $stmt->execute([$user['sub']]);
    $role = $stmt->fetchColumn();
    
    if (!$role) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden - Staff only']);
        exit();
    }
    return array_merge($user, ['db_role' => $role]);
}

function requireAdmin(): array {
    $user = requireStaff();
    if ($user['db_role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden - Admin only']);
        exit();
    }
    return $user;
}

// ==========================================
// INPUT HELPERS
// ==========================================
function getJsonInput(): array {
    $input = json_decode(file_get_contents('php://input'), true);
    return $input ?? [];
}

function jsonResponse(mixed $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}
