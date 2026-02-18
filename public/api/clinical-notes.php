<?php
/**
 * Clinical Notes API (staff only)
 * GET    /api/clinical-notes.php?patient_id=UUID   - Get notes for patient
 * POST   /api/clinical-notes.php                    - Create note
 * PUT    /api/clinical-notes.php?id=UUID            - Update note
 * DELETE /api/clinical-notes.php?id=UUID            - Delete note
 */
require_once __DIR__ . '/config.php';

requireStaff();

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

switch ($method) {
    case 'GET':
        $patientId = $_GET['patient_id'] ?? null;
        if (!$patientId) jsonResponse(['error' => 'patient_id required'], 400);
        listNotes($patientId);
        break;
    case 'POST':
        createNote();
        break;
    case 'PUT':
        if (!$id) jsonResponse(['error' => 'Note ID required'], 400);
        updateNote($id);
        break;
    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'Note ID required'], 400);
        deleteNote($id);
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function listNotes(string $patientId): void {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT * FROM clinical_notes WHERE patient_id = ? ORDER BY created_at DESC');
    $stmt->execute([$patientId]);
    jsonResponse($stmt->fetchAll());
}

function createNote(): void {
    $data = getJsonInput();
    if (empty($data['patient_id']) || empty($data['note_text'])) {
        jsonResponse(['error' => 'patient_id and note_text are required'], 400);
    }

    $pdo = getDB();
    $id = generateUUID();

    $stmt = $pdo->prepare('INSERT INTO clinical_notes (id, patient_id, appointment_id, note_text, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())');
    $stmt->execute([$id, $data['patient_id'], $data['appointment_id'] ?? null, $data['note_text']]);

    $stmt = $pdo->prepare('SELECT * FROM clinical_notes WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

function updateNote(string $id): void {
    $data = getJsonInput();
    if (empty($data['note_text'])) jsonResponse(['error' => 'note_text is required'], 400);

    $pdo = getDB();
    $pdo->prepare('UPDATE clinical_notes SET note_text = ?, updated_at = NOW() WHERE id = ?')
        ->execute([$data['note_text'], $id]);

    $stmt = $pdo->prepare('SELECT * FROM clinical_notes WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

function deleteNote(string $id): void {
    $pdo = getDB();
    $pdo->prepare('DELETE FROM clinical_notes WHERE id = ?')->execute([$id]);
    jsonResponse(['success' => true]);
}
