<?php
/**
 * Practice Settings API
 * GET  /api/settings.php          - Get settings (public view for non-staff)
 * PUT  /api/settings.php          - Update settings (staff only)
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        getSettings();
        break;
    case 'PUT':
        requireStaff();
        updateSettings();
        break;
    case 'POST':
        if ($action === 'upload-logo') {
            requireStaff();
            uploadLogo();
        } else {
            jsonResponse(['error' => 'Invalid action'], 400);
        }
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function uploadLogo(): void {
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['error' => 'Upload failed'], 400);
    }
    $file = $_FILES['file'];
    if (!str_starts_with($file['type'] ?? '', 'image/')) {
        jsonResponse(['error' => 'Only images allowed'], 400);
    }
    $dir = __DIR__ . '/../uploads/practice-assets/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'png';
    $name = 'logo-' . time() . '.' . preg_replace('/[^a-z0-9]/i', '', $ext);
    if (!move_uploaded_file($file['tmp_name'], $dir . $name)) {
        jsonResponse(['error' => 'Save failed'], 500);
    }
    jsonResponse(['url' => '/uploads/practice-assets/' . $name]);
}

function getSettings(): void {
    $pdo = getDB();
    $user = getAuthUser();

    if ($user) {
        // Check if staff
        $stmt = $pdo->prepare('SELECT role FROM user_roles WHERE user_id = ?');
        $stmt->execute([$user['sub']]);
        if ($stmt->fetch()) {
            // Staff: return full settings
            $stmt = $pdo->query('SELECT * FROM practice_settings LIMIT 1');
            $settings = $stmt->fetch();
            if ($settings) {
                $settings['custom_patient_fields'] = json_decode($settings['custom_patient_fields'] ?? '[]', true);
                $settings['operating_hours'] = json_decode($settings['operating_hours'] ?? '{}', true);
            }
            jsonResponse($settings ?: new \stdClass());
            return;
        }
    }

    // Public: return limited settings (no API keys)
    $stmt = $pdo->query("SELECT id, practice_name, doctor_name, phone_number, address, specialty, logo_url, custom_patient_fields, operating_hours, is_closed, closure_reason, booking_enabled, visit_duration, created_at, updated_at FROM practice_settings LIMIT 1");
    $settings = $stmt->fetch();
    if ($settings) {
        $settings['custom_patient_fields'] = json_decode($settings['custom_patient_fields'] ?? '[]', true);
        $settings['operating_hours'] = json_decode($settings['operating_hours'] ?? '{}', true);
    }
    jsonResponse($settings ?: new \stdClass());
}

function updateSettings(): void {
    $data = getJsonInput();
    $pdo = getDB();

    // Get existing settings ID
    $stmt = $pdo->query('SELECT id FROM practice_settings LIMIT 1');
    $existing = $stmt->fetch();

    if (!$existing) {
        // Create initial settings
        $id = generateUUID();
        $pdo->prepare('INSERT INTO practice_settings (id, created_at, updated_at) VALUES (?, NOW(), NOW())')->execute([$id]);
        $settingsId = $id;
    } else {
        $settingsId = $existing['id'];
    }

    $fields = [];
    $params = [];
    $allowed = ['practice_name', 'doctor_name', 'phone_number', 'address', 'specialty', 'logo_url', 'is_closed', 'closure_reason', 'booking_enabled', 'visit_duration', 'infobip_api_key', 'infobip_base_url', 'infobip_sender_email'];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $data)) {
            $fields[] = "$field = ?";
            $params[] = $data[$field];
        }
    }

    if (array_key_exists('custom_patient_fields', $data)) {
        $fields[] = "custom_patient_fields = ?";
        $params[] = json_encode($data['custom_patient_fields']);
    }
    if (array_key_exists('operating_hours', $data)) {
        $fields[] = "operating_hours = ?";
        $params[] = json_encode($data['operating_hours']);
    }

    if (empty($fields)) jsonResponse(['error' => 'No fields to update'], 400);

    $fields[] = "updated_at = NOW()";
    $params[] = $settingsId;

    $sql = "UPDATE practice_settings SET " . implode(', ', $fields) . " WHERE id = ?";
    $pdo->prepare($sql)->execute($params);

    // Return updated settings
    $stmt = $pdo->prepare('SELECT * FROM practice_settings WHERE id = ?');
    $stmt->execute([$settingsId]);
    $settings = $stmt->fetch();
    $settings['custom_patient_fields'] = json_decode($settings['custom_patient_fields'] ?? '[]', true);
    $settings['operating_hours'] = json_decode($settings['operating_hours'] ?? '{}', true);
    jsonResponse($settings);
}
