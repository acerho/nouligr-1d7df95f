<?php
/**
 * Patients API (staff-only for GET/PUT/DELETE, public INSERT for booking)
 * GET    /api/patients.php              - List all patients
 * GET    /api/patients.php?id=UUID      - Get single patient
 * POST   /api/patients.php              - Create patient
 * PUT    /api/patients.php?id=UUID      - Update patient
 * DELETE /api/patients.php?id=UUID      - Delete patient
 * GET    /api/patients.php?search=term  - Search patients
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

switch ($method) {
    case 'GET':
        requireStaff();
        $id ? getPatient($id) : listPatients();
        break;
    case 'POST':
        createPatient();
        break;
    case 'PUT':
        requireStaff();
        if (!$id) jsonResponse(['error' => 'Patient ID required'], 400);
        updatePatient($id);
        break;
    case 'DELETE':
        requireStaff();
        if (!$id) jsonResponse(['error' => 'Patient ID required'], 400);
        deletePatient($id);
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function listPatients(): void {
    $pdo = getDB();
    $search = $_GET['search'] ?? null;

    if ($search) {
        $search = "%$search%";
        $stmt = $pdo->prepare('SELECT * FROM patients WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ? OR national_health_number LIKE ? ORDER BY created_at DESC LIMIT 1000');
        $stmt->execute([$search, $search, $search, $search, $search]);
    } else {
        $stmt = $pdo->query('SELECT * FROM patients ORDER BY created_at DESC LIMIT 1000');
    }

    jsonResponse($stmt->fetchAll());
}

function getPatient(string $id): void {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT * FROM patients WHERE id = ?');
    $stmt->execute([$id]);
    $patient = $stmt->fetch();

    if (!$patient) jsonResponse(['error' => 'Patient not found'], 404);
    jsonResponse($patient);
}

function createPatient(): void {
    $data = getJsonInput();
    $firstName = trim($data['first_name'] ?? '');
    $lastName = trim($data['last_name'] ?? '');

    if (!$firstName || !$lastName) {
        jsonResponse(['error' => 'First name and last name are required'], 400);
    }

    // Validate AMKA if provided (must be 11 digits)
    if (!empty($data['national_health_number']) && !preg_match('/^\d{11}$/', $data['national_health_number'])) {
        jsonResponse(['error' => 'AMKA must be exactly 11 digits'], 400);
    }

    $pdo = getDB();
    $id = generateUUID();

    $stmt = $pdo->prepare('INSERT INTO patients (id, first_name, last_name, email, phone, date_of_birth, sex, national_health_number, illness, address, custom_fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
    $stmt->execute([
        $id,
        $firstName,
        $lastName,
        $data['email'] ?? null,
        $data['phone'] ?? null,
        $data['date_of_birth'] ?? null,
        $data['sex'] ?? null,
        $data['national_health_number'] ?? null,
        $data['illness'] ?? null,
        $data['address'] ?? null,
        json_encode($data['custom_fields'] ?? new \stdClass()),
    ]);

    $stmt = $pdo->prepare('SELECT * FROM patients WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

function updatePatient(string $id): void {
    $data = getJsonInput();
    $pdo = getDB();

    $fields = [];
    $params = [];
    $allowed = ['first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'sex', 'national_health_number', 'illness', 'address'];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $data)) {
            $fields[] = "$field = ?";
            $params[] = $data[$field];
        }
    }

    if (array_key_exists('custom_fields', $data)) {
        $fields[] = "custom_fields = ?";
        $params[] = json_encode($data['custom_fields']);
    }

    if (empty($fields)) jsonResponse(['error' => 'No fields to update'], 400);

    $fields[] = "updated_at = NOW()";
    $params[] = $id;

    $sql = "UPDATE patients SET " . implode(', ', $fields) . " WHERE id = ?";
    $pdo->prepare($sql)->execute($params);

    $stmt = $pdo->prepare('SELECT * FROM patients WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

function deletePatient(string $id): void {
    $pdo = getDB();
    $stmt = $pdo->prepare('DELETE FROM patients WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(['success' => true]);
}
