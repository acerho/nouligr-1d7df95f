<?php
/**
 * User Roles API (admin only)
 * GET    /api/user-roles.php           - List all user roles
 * PUT    /api/user-roles.php?id=UUID   - Update a user's role
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        requireAdmin();
        listRoles();
        break;
    case 'PUT':
        requireAdmin();
        $id = $_GET['id'] ?? null;
        if (!$id) jsonResponse(['error' => 'User role ID required'], 400);
        updateRole($id);
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function listRoles(): void {
    $pdo = getDB();
    $stmt = $pdo->query('SELECT ur.*, u.email FROM user_roles ur JOIN auth_users u ON ur.user_id = u.id ORDER BY ur.created_at ASC');
    jsonResponse($stmt->fetchAll());
}

function updateRole(string $id): void {
    $data = getJsonInput();
    $role = $data['role'] ?? '';
    
    if (!in_array($role, ['admin', 'staff'])) {
        jsonResponse(['error' => 'Invalid role. Must be admin or staff'], 400);
    }

    $pdo = getDB();
    $pdo->prepare('UPDATE user_roles SET role = ? WHERE id = ?')->execute([$role, $id]);
    jsonResponse(['success' => true]);
}
