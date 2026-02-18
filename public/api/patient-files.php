<?php
/**
 * Patient Files API (staff only)
 * GET    /api/patient-files.php?patient_id=UUID  - List files for patient
 * POST   /api/patient-files.php                   - Upload file
 * DELETE /api/patient-files.php?id=UUID           - Delete file
 */
require_once __DIR__ . '/config.php';

requireStaff();

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

switch ($method) {
    case 'GET':
        $patientId = $_GET['patient_id'] ?? null;
        if (!$patientId) jsonResponse(['error' => 'patient_id required'], 400);
        listFiles($patientId);
        break;
    case 'POST':
        uploadFile();
        break;
    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'File ID required'], 400);
        deleteFile($id);
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function listFiles(string $patientId): void {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT * FROM patient_files WHERE patient_id = ? ORDER BY created_at DESC');
    $stmt->execute([$patientId]);
    jsonResponse($stmt->fetchAll());
}

function uploadFile(): void {
    $patientId = $_POST['patient_id'] ?? '';
    if (!$patientId) jsonResponse(['error' => 'patient_id is required'], 400);

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['error' => 'File upload failed'], 400);
    }

    $file = $_FILES['file'];
    $fileName = basename($file['name']);
    $fileType = $file['type'] ?: mime_content_type($file['tmp_name']);
    
    // Create uploads directory
    $uploadDir = __DIR__ . '/../uploads/patient-files/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $storedName = generateUUID() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $fileName);
    $destPath = $uploadDir . $storedName;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        jsonResponse(['error' => 'Failed to save file'], 500);
    }

    $fileUrl = '/uploads/patient-files/' . $storedName;
    $pdo = getDB();
    $id = generateUUID();

    $pdo->prepare('INSERT INTO patient_files (id, patient_id, file_name, file_url, file_type, created_at) VALUES (?, ?, ?, ?, ?, NOW())')
        ->execute([$id, $patientId, $fileName, $fileUrl, $fileType]);

    $stmt = $pdo->prepare('SELECT * FROM patient_files WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

function deleteFile(string $id): void {
    $pdo = getDB();
    
    // Get file path before deleting
    $stmt = $pdo->prepare('SELECT file_url FROM patient_files WHERE id = ?');
    $stmt->execute([$id]);
    $file = $stmt->fetch();
    
    if ($file && $file['file_url']) {
        $filePath = __DIR__ . '/..' . $file['file_url'];
        if (file_exists($filePath)) unlink($filePath);
    }

    $pdo->prepare('DELETE FROM patient_files WHERE id = ?')->execute([$id]);
    jsonResponse(['success' => true]);
}
