-- ===========================================
-- MySQL Schema for Medical Practice App
-- Compatible with Hostinger MySQL 8.0+
-- ===========================================

-- Create database (run this first in hPanel)
-- CREATE DATABASE medical_practice CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ===========================================
-- ENUM TYPES (MySQL uses ENUM directly)
-- ===========================================

-- ===========================================
-- USERS TABLE (replaces Supabase auth.users)
-- ===========================================
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email_verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- ===========================================
-- USER ROLES TABLE
-- ===========================================
CREATE TABLE user_roles (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    role ENUM('admin', 'staff') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_role (user_id, role),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_roles_user_id (user_id)
) ENGINE=InnoDB;

-- ===========================================
-- PATIENTS TABLE
-- ===========================================
CREATE TABLE patients (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    date_of_birth DATE NULL,
    sex VARCHAR(20) NULL,
    address TEXT NULL,
    illness TEXT NULL,
    national_health_number VARCHAR(100) NULL,
    custom_fields JSON DEFAULT ('{}'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_patients_phone (phone),
    INDEX idx_patients_email (email),
    INDEX idx_patients_name (last_name, first_name)
) ENGINE=InnoDB;

-- ===========================================
-- APPOINTMENTS TABLE
-- ===========================================
CREATE TABLE appointments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    patient_id CHAR(36) NOT NULL,
    status ENUM('scheduled', 'arrived', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
    scheduled_at TIMESTAMP NULL,
    checked_in_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    reason_for_visit TEXT NULL,
    notes TEXT NULL,
    booking_source VARCHAR(50) DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    INDEX idx_appointments_patient (patient_id),
    INDEX idx_appointments_scheduled (scheduled_at),
    INDEX idx_appointments_status (status)
) ENGINE=InnoDB;

-- ===========================================
-- CLINICAL NOTES TABLE
-- ===========================================
CREATE TABLE clinical_notes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    patient_id CHAR(36) NOT NULL,
    appointment_id CHAR(36) NULL,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    INDEX idx_clinical_notes_patient (patient_id)
) ENGINE=InnoDB;

-- ===========================================
-- PATIENT FILES TABLE
-- ===========================================
CREATE TABLE patient_files (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    patient_id CHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    INDEX idx_patient_files_patient (patient_id)
) ENGINE=InnoDB;

-- ===========================================
-- PATIENT CHECKINS TABLE
-- ===========================================
CREATE TABLE patient_checkins (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    reason_for_visit TEXT NULL,
    processed_at TIMESTAMP NULL,
    processed_by CHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_checkins_created (created_at)
) ENGINE=InnoDB;

-- ===========================================
-- NOTIFICATION LOGS TABLE
-- ===========================================
CREATE TABLE notification_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    patient_id CHAR(36) NULL,
    appointment_id CHAR(36) NULL,
    notification_type VARCHAR(100) DEFAULT 'status_change',
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    INDEX idx_notification_logs_patient (patient_id)
) ENGINE=InnoDB;

-- ===========================================
-- EMAIL VERIFICATIONS TABLE
-- ===========================================
CREATE TABLE email_verifications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_verifications_email (email),
    INDEX idx_email_verifications_code (code)
) ENGINE=InnoDB;

-- ===========================================
-- RATE LIMIT LOG TABLE
-- ===========================================
CREATE TABLE rate_limit_log (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    identifier VARCHAR(255) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rate_limit_identifier (identifier, action_type, created_at)
) ENGINE=InnoDB;

-- ===========================================
-- PRACTICE SETTINGS TABLE
-- ===========================================
CREATE TABLE practice_settings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    practice_name VARCHAR(255) DEFAULT 'Medical Practice',
    doctor_name VARCHAR(255) DEFAULT 'Dr. Smith',
    phone_number VARCHAR(50) NULL,
    address TEXT NULL,
    specialty VARCHAR(255) NULL,
    logo_url TEXT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    closure_reason TEXT NULL,
    operating_hours JSON DEFAULT ('{"monday":{"open":"09:00","close":"17:00","enabled":true},"tuesday":{"open":"09:00","close":"17:00","enabled":true},"wednesday":{"open":"09:00","close":"17:00","enabled":true},"thursday":{"open":"09:00","close":"17:00","enabled":true},"friday":{"open":"09:00","close":"17:00","enabled":true},"saturday":{"open":"09:00","close":"13:00","enabled":false},"sunday":{"open":"09:00","close":"13:00","enabled":false}}'),
    custom_patient_fields JSON DEFAULT ('[]'),
    infobip_api_key VARCHAR(255) NULL,
    infobip_base_url VARCHAR(255) NULL,
    infobip_sender_email VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ===========================================
-- INSERT DEFAULT PRACTICE SETTINGS
-- ===========================================
INSERT INTO practice_settings (id, practice_name, doctor_name) 
VALUES (UUID(), 'Medical Practice', 'Dr. Smith');

-- ===========================================
-- STORED PROCEDURE: Check if user has role
-- ===========================================
DELIMITER //
CREATE FUNCTION has_role(p_user_id CHAR(36), p_role VARCHAR(20))
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE role_exists BOOLEAN DEFAULT FALSE;
    SELECT EXISTS(
        SELECT 1 FROM user_roles 
        WHERE user_id = p_user_id AND role = p_role
    ) INTO role_exists;
    RETURN role_exists;
END //
DELIMITER ;

-- ===========================================
-- STORED PROCEDURE: Check if user is staff
-- ===========================================
DELIMITER //
CREATE FUNCTION is_staff(p_user_id CHAR(36))
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE staff_exists BOOLEAN DEFAULT FALSE;
    SELECT EXISTS(
        SELECT 1 FROM user_roles WHERE user_id = p_user_id
    ) INTO staff_exists;
    RETURN staff_exists;
END //
DELIMITER ;

-- ===========================================
-- STORED PROCEDURE: Cleanup old rate limit logs
-- ===========================================
DELIMITER //
CREATE PROCEDURE cleanup_rate_limit_log()
BEGIN
    DELETE FROM rate_limit_log 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR);
END //
DELIMITER ;

-- ===========================================
-- EVENT: Auto cleanup rate limit logs hourly
-- ===========================================
CREATE EVENT IF NOT EXISTS cleanup_rate_limits
ON SCHEDULE EVERY 1 HOUR
DO CALL cleanup_rate_limit_log();
