<?php
/**
 * Verify SMS Code (public endpoint)
 * POST /api/verify-code.php
 * Body: { phone, code }
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$data = getJsonInput();
$phone = $data['phone'] ?? '';
$code = $data['code'] ?? '';

if (!$phone || !$code) jsonResponse(['error' => 'Phone number and code are required'], 400);

// Validate code format (4 digits)
if (!preg_match('/^\d{4}$/', $code)) {
    jsonResponse(['error' => 'Invalid code format'], 400);
}

$formattedPhone = preg_replace('/\D/', '', $phone);
if (!str_starts_with($formattedPhone, '30')) {
    $formattedPhone = '30' . $formattedPhone;
}

$pdo = getDB();

// Rate limiting: max 5 attempts per 15 min
$windowStart = date('Y-m-d H:i:s', time() - 900);
$stmt = $pdo->prepare("SELECT COUNT(*) FROM rate_limit_log WHERE identifier = ? AND action_type = 'verify_code' AND created_at >= ?");
$stmt->execute([$formattedPhone, $windowStart]);
$count = $stmt->fetchColumn();

if ($count >= 5) {
    jsonResponse(['error' => 'Too many verification attempts. Please request a new code.'], 429);
}

// Log attempt
$pdo->prepare('INSERT INTO rate_limit_log (id, identifier, action_type, created_at) VALUES (?, ?, ?, NOW())')
    ->execute([generateUUID(), $formattedPhone, 'verify_code']);

// Find valid verification
$now = date('Y-m-d H:i:s');
$stmt = $pdo->prepare("SELECT * FROM email_verifications WHERE email = ? AND code = ? AND verified_at IS NULL AND expires_at >= ? ORDER BY created_at DESC LIMIT 1");
$stmt->execute([$formattedPhone, $code, $now]);
$verification = $stmt->fetch();

if (!$verification) {
    jsonResponse(['error' => 'Invalid or expired verification code'], 400);
}

// Mark as verified
$pdo->prepare('UPDATE email_verifications SET verified_at = NOW() WHERE id = ?')
    ->execute([$verification['id']]);

jsonResponse(['success' => true, 'verified' => true]);
