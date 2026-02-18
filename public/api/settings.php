<?php
/**
 * Practice Settings API
 * GET  /api/settings.php          - Get settings (public view for non-staff)
 * PUT  /api/settings.php          - Update settings (staff only)
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getSettings();
        break;
    case 'PUT':
        requireStaff();
        updateSettings();
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
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
    $stmt = $pdo->query("SELECT id, practice_name, doctor_name, phone_number, address, specialty, logo_url, custom_patient_fields, operating_hours, is_closed, closure_reason, created_at, updated_at FROM practice_settings LIMIT 1");
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
    $allowed = ['practice_name', 'doctor_name', 'phone_number', 'address', 'specialty', 'logo_url', 'is_closed', 'closure_reason', 'infobip_api_key', 'infobip_base_url', 'infobip_sender_email'];

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
