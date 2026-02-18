# Nouli Medical - PHP API

## Setup Instructions

### 1. Database Setup
Import `database-export-mysql.sql` into your MySQL database via phpMyAdmin.

Then create the `auth_users` table (not in the export):

```sql
CREATE TABLE auth_users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    last_sign_in_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE auth_sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Configuration
Edit `config.php` and set:
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`
- `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_SENDER_EMAIL`
- `JWT_SECRET` (random 32+ character string)

### 3. File Uploads
Create an `uploads/patient-files/` directory with write permissions:
```bash
mkdir -p uploads/patient-files
chmod 755 uploads/patient-files
```

### 4. .htaccess
Place the provided `.htaccess` in your `httpdocs/` root for React Router support.

## API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth.php?action=login` | Public | Login |
| `POST /api/auth.php?action=register` | Public | Register |
| `GET /api/auth.php?action=me` | Token | Current user |
| `GET/POST/PUT/DELETE /api/patients.php` | Staff | Patient CRUD |
| `GET/POST/PUT/DELETE /api/appointments.php` | Mixed | Appointments |
| `GET/PUT /api/settings.php` | Mixed | Practice settings |
| `GET/POST/PUT/DELETE /api/clinical-notes.php` | Staff | Clinical notes |
| `GET/POST/DELETE /api/patient-files.php` | Staff | File uploads |
| `GET/POST /api/notifications.php` | Staff | Notification logs |
| `GET/POST/PUT/DELETE /api/checkins.php` | Mixed | Patient check-ins |
| `POST /api/send-verification-code.php` | Public | SMS verification |
| `POST /api/verify-code.php` | Public | Verify SMS code |
| `POST /api/send-sms.php?action=*` | Mixed | SMS/Email sending |
| `GET/PUT /api/user-roles.php` | Admin | Manage roles |

## Authentication
All authenticated endpoints require `Authorization: Bearer <token>` header.
Get a token via `POST /api/auth.php?action=login`.
