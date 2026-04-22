<?php
/**
 * Patient Check-ins API
 * GET    /api/checkins.php              - List check-ins (staff only)
 * POST   /api/checkins.php              - Create check-in (public)
 * PUT    /api/checkins.php?id=UUID      - Process check-in (staff only)
 * DELETE /api/checkins.php?id=UUID      - Delete check-in (staff only)
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        if ($action === 'public-waitlist') {
            publicWaitlist();
            break;
        }
        requireStaff();
        listCheckins();
        break;
    case 'POST':
        if ($action === 'public-check-in') {
            publicCheckIn();
            break;
        }
        createCheckin();
        break;
    case 'PUT':
        requireStaff();
        if (!$id) jsonResponse(['error' => 'Check-in ID required'], 400);
        processCheckin($id);
        break;
    case 'DELETE':
        requireStaff();
        if (!$id) jsonResponse(['error' => 'Check-in ID required'], 400);
        deleteCheckin($id);
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function publicWaitlist(): void {
    // Today's appointments only, with masked surname (no contact info)
    $pdo = getDB();
    $stmt = $pdo->query(
        "SELECT a.id, p.first_name, p.last_name, a.scheduled_at, a.status, a.created_at
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE DATE(a.scheduled_at) = CURDATE()
           AND a.status IN ('scheduled', 'arrived')
         ORDER BY a.scheduled_at ASC"
    );
    $rows = $stmt->fetchAll();
    $out = array_map(function ($r) {
        $ln = $r['last_name'] ?? '';
        $masked = $ln === '' ? '' : (mb_substr($ln, 0, 1) . str_repeat('*', max(0, mb_strlen($ln) - 1)));
        return [
            'id' => $r['id'],
            'first_name' => $r['first_name'],
            'masked_last_name' => $masked,
            'scheduled_at' => $r['scheduled_at'],
            'status' => $r['status'],
            'created_at' => $r['created_at'],
        ];
    }, $rows);
    jsonResponse($out);
}

function publicCheckIn(): void {
    $data = getJsonInput();
    $appointmentId = $data['appointment_id'] ?? '';
    if (!$appointmentId) jsonResponse(['error' => 'appointment_id required'], 400);

    $pdo = getDB();
    // Only allow checking in today's scheduled appointments
    $stmt = $pdo->prepare(
        "SELECT id FROM appointments WHERE id = ? AND status = 'scheduled' AND DATE(scheduled_at) = CURDATE()"
    );
    $stmt->execute([$appointmentId]);
    if (!$stmt->fetch()) {
        jsonResponse(['error' => 'Appointment not eligible for check-in'], 400);
    }

    $pdo->prepare("UPDATE appointments SET status = 'arrived', checked_in_at = NOW(), updated_at = NOW() WHERE id = ?")
        ->execute([$appointmentId]);
    jsonResponse(['success' => true]);
}

function listCheckins(): void {
    $pdo = getDB();
    $stmt = $pdo->query('SELECT * FROM patient_checkins ORDER BY created_at DESC LIMIT 500');
    jsonResponse($stmt->fetchAll());
}

function createCheckin(): void {
    $data = getJsonInput();
    $firstName = trim($data['first_name'] ?? '');
    $lastName = trim($data['last_name'] ?? '');

    if (!$firstName || !$lastName) {
        jsonResponse(['error' => 'First and last name required'], 400);
    }

    $pdo = getDB();
    $id = generateUUID();

    $pdo->prepare('INSERT INTO patient_checkins (id, first_name, last_name, phone, reason_for_visit, created_at) VALUES (?, ?, ?, ?, ?, NOW())')
        ->execute([$id, $firstName, $lastName, $data['phone'] ?? null, $data['reason_for_visit'] ?? null]);

    jsonResponse(['success' => true, 'id' => $id], 201);
}

function processCheckin(string $id): void {
    $user = requireStaff();
    $pdo = getDB();
    $pdo->prepare('UPDATE patient_checkins SET processed_at = NOW(), processed_by = ? WHERE id = ?')
        ->execute([$user['sub'], $id]);
    jsonResponse(['success' => true]);
}

function deleteCheckin(string $id): void {
    $pdo = getDB();
    $pdo->prepare('DELETE FROM patient_checkins WHERE id = ?')->execute([$id]);
    jsonResponse(['success' => true]);
}
