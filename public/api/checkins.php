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

switch ($method) {
    case 'GET':
        requireStaff();
        listCheckins();
        break;
    case 'POST':
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
