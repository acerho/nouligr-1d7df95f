<?php
/**
 * Notification Logs API (staff only)
 * GET  /api/notifications.php                    - List all notification logs
 * GET  /api/notifications.php?patient_id=UUID    - Get notifications for patient
 * POST /api/notifications.php                    - Create notification log
 */
require_once __DIR__ . '/config.php';

requireStaff();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $patientId = $_GET['patient_id'] ?? null;
        listNotifications($patientId);
        break;
    case 'POST':
        createNotification();
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function listNotifications(?string $patientId): void {
    $pdo = getDB();

    if ($patientId) {
        $stmt = $pdo->prepare('SELECT n.*, p.first_name, p.last_name FROM notification_logs n LEFT JOIN patients p ON n.patient_id = p.id WHERE n.patient_id = ? ORDER BY n.sent_at DESC LIMIT 500');
        $stmt->execute([$patientId]);
    } else {
        $stmt = $pdo->query('SELECT n.*, p.first_name, p.last_name FROM notification_logs n LEFT JOIN patients p ON n.patient_id = p.id ORDER BY n.sent_at DESC LIMIT 500');
    }

    jsonResponse($stmt->fetchAll());
}

function createNotification(): void {
    $data = getJsonInput();
    if (empty($data['message'])) jsonResponse(['error' => 'message is required'], 400);

    $pdo = getDB();
    $id = generateUUID();

    $pdo->prepare('INSERT INTO notification_logs (id, patient_id, appointment_id, message, notification_type, sent_at) VALUES (?, ?, ?, ?, ?, NOW())')
        ->execute([
            $id,
            $data['patient_id'] ?? null,
            $data['appointment_id'] ?? null,
            $data['message'],
            $data['notification_type'] ?? 'status_change',
        ]);

    jsonResponse(['success' => true, 'id' => $id], 201);
}
