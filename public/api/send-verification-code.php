<?php
/**
 * Send SMS Verification Code (public endpoint)
 * POST /api/send-verification-code.php
 * Body: { phone, patientName, language }
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$data = getJsonInput();
$phone = $data['phone'] ?? '';
$patientName = $data['patientName'] ?? '';
$language = $data['language'] ?? 'el';

if (!$phone) jsonResponse(['error' => 'Phone number is required'], 400);

// Validate phone format
if (!preg_match('/^[0-9+\-\s()]{7,20}$/', $phone)) {
    jsonResponse(['error' => 'Invalid phone number format'], 400);
}

// Format phone (Greek +30 prefix)
$formattedPhone = preg_replace('/\D/', '', $phone);
if (!str_starts_with($formattedPhone, '30')) {
    $formattedPhone = '30' . $formattedPhone;
}

$pdo = getDB();

// Rate limiting: max 20 per hour
$windowStart = date('Y-m-d H:i:s', time() - 3600);
$stmt = $pdo->prepare("SELECT COUNT(*) FROM rate_limit_log WHERE identifier = ? AND action_type = 'send_verification' AND created_at >= ?");
$stmt->execute([$formattedPhone, $windowStart]);
$count = $stmt->fetchColumn();

if ($count >= 20) {
    jsonResponse(['error' => 'Too many verification attempts. Please try again later.'], 429);
}

// Log attempt
$pdo->prepare('INSERT INTO rate_limit_log (id, identifier, action_type, created_at) VALUES (?, ?, ?, NOW())')
    ->execute([generateUUID(), $formattedPhone, 'send_verification']);

// Generate 4-digit code
$code = str_pad(random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
$expiresAt = date('Y-m-d H:i:s', time() + 600); // 10 minutes

$pdo->prepare('INSERT INTO email_verifications (id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())')
    ->execute([generateUUID(), $formattedPhone, $code, $expiresAt]);

// Build SMS text
if ($language === 'el') {
    $smsText = "Γειά σας $patientName, ο κωδικός επαλήθευσης του ραντεβού σας είναι: $code. Αυτός ο κωδικός λήγει σε 10 λεπτά.";
} else {
    $smsText = "Hello $patientName, your appointment verification code is: $code. This code expires in 10 minutes.";
}

// Send SMS via Infobip
$smsPayload = json_encode([
    'messages' => [[
        'destinations' => [['to' => $formattedPhone]],
        'from' => 'Appointment',
        'text' => $smsText,
    ]],
]);

$ch = curl_init(INFOBIP_BASE_URL . '/sms/2/text/advanced');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $smsPayload,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: App ' . INFOBIP_API_KEY,
    ],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode >= 400) {
    jsonResponse(['error' => 'Failed to send SMS. Please try again.'], 500);
}

jsonResponse([
    'success' => true,
    'message' => 'Verification code sent via SMS',
    'rateLimitRemaining' => max(0, 19 - $count),
]);
