<?php
/**
 * Appointments API
 * GET    /api/appointments.php                 - List appointments (staff)
 * GET    /api/appointments.php?id=UUID         - Get single appointment
 * GET    /api/appointments.php?patient_id=UUID - Get patient's appointments
 * POST   /api/appointments.php                 - Create appointment
 * PUT    /api/appointments.php?id=UUID         - Update appointment
 * DELETE /api/appointments.php?id=UUID         - Delete appointment
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

switch ($method) {
    case 'GET':
        if ($id) {
            getAppointment($id);
        } elseif (isset($_GET['patient_id'])) {
            getPatientAppointments($_GET['patient_id']);
        } elseif (isset($_GET['availability'])) {
            checkAvailability();
        } else {
            requireStaff();
            listAppointments();
        }
        break;
    case 'POST':
        createAppointment();
        break;
    case 'PUT':
        requireStaff();
        if (!$id) jsonResponse(['error' => 'Appointment ID required'], 400);
        updateAppointment($id);
        break;
    case 'DELETE':
        requireStaff();
        if (!$id) jsonResponse(['error' => 'Appointment ID required'], 400);
        deleteAppointment($id);
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function listAppointments(): void {
    $pdo = getDB();
    $date = $_GET['date'] ?? null;
    $status = $_GET['status'] ?? null;

    $sql = 'SELECT a.*, p.first_name, p.last_name, p.phone as patient_phone, p.email as patient_email 
            FROM appointments a 
            LEFT JOIN patients p ON a.patient_id = p.id';
    $conditions = [];
    $params = [];

    if ($date) {
        $conditions[] = 'DATE(a.scheduled_at) = ?';
        $params[] = $date;
    }
    if ($status) {
        $conditions[] = 'a.status = ?';
        $params[] = $status;
    }

    if ($conditions) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }
    $sql .= ' ORDER BY a.scheduled_at ASC LIMIT 1000';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    // Nest patient data
    $results = [];
    foreach ($stmt->fetchAll() as $row) {
        $results[] = [
            'id' => $row['id'],
            'patient_id' => $row['patient_id'],
            'status' => $row['status'],
            'scheduled_at' => $row['scheduled_at'],
            'reason_for_visit' => $row['reason_for_visit'],
            'notes' => $row['notes'],
            'checked_in_at' => $row['checked_in_at'],
            'started_at' => $row['started_at'],
            'completed_at' => $row['completed_at'],
            'booking_source' => $row['booking_source'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'patient' => [
                'first_name' => $row['first_name'],
                'last_name' => $row['last_name'],
                'phone' => $row['patient_phone'],
                'email' => $row['patient_email'],
            ],
        ];
    }

    jsonResponse($results);
}

function getAppointment(string $id): void {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT a.*, p.first_name, p.last_name, p.phone as patient_phone FROM appointments a LEFT JOIN patients p ON a.patient_id = p.id WHERE a.id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) jsonResponse(['error' => 'Appointment not found'], 404);
    jsonResponse($row);
}

function getPatientAppointments(string $patientId): void {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT * FROM appointments WHERE patient_id = ? ORDER BY scheduled_at DESC');
    $stmt->execute([$patientId]);
    jsonResponse($stmt->fetchAll());
}

function checkAvailability(): void {
    $date = $_GET['date'] ?? null;
    if (!$date) jsonResponse(['error' => 'Date parameter required'], 400);

    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT scheduled_at FROM appointments WHERE DATE(scheduled_at) = ? AND status IN ('scheduled', 'arrived', 'in_progress')");
    $stmt->execute([$date]);
    jsonResponse($stmt->fetchAll());
}

function createAppointment(): void {
    $data = getJsonInput();
    $patientId = $data['patient_id'] ?? '';

    if (!$patientId) jsonResponse(['error' => 'Patient ID is required'], 400);

    $pdo = getDB();
    $id = generateUUID();

    $stmt = $pdo->prepare('INSERT INTO appointments (id, patient_id, status, scheduled_at, reason_for_visit, notes, booking_source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
    $stmt->execute([
        $id,
        $patientId,
        $data['status'] ?? 'scheduled',
        $data['scheduled_at'] ?? null,
        $data['reason_for_visit'] ?? null,
        $data['notes'] ?? null,
        $data['booking_source'] ?? 'staff',
    ]);

    $stmt = $pdo->prepare('SELECT * FROM appointments WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

function updateAppointment(string $id): void {
    $data = getJsonInput();
    $pdo = getDB();

    $fields = [];
    $params = [];
    $allowed = ['status', 'scheduled_at', 'reason_for_visit', 'notes', 'checked_in_at', 'started_at', 'completed_at'];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $data)) {
            $fields[] = "$field = ?";
            $params[] = $data[$field];
        }
    }

    if (empty($fields)) jsonResponse(['error' => 'No fields to update'], 400);

    $fields[] = "updated_at = NOW()";
    $params[] = $id;

    $sql = "UPDATE appointments SET " . implode(', ', $fields) . " WHERE id = ?";
    $pdo->prepare($sql)->execute($params);

    $stmt = $pdo->prepare('SELECT * FROM appointments WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

function deleteAppointment(string $id): void {
    $pdo = getDB();
    $pdo->prepare('DELETE FROM appointments WHERE id = ?')->execute([$id]);
    jsonResponse(['success' => true]);
}
