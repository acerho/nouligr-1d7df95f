-- =====================================================
-- NOULI Medical Practice - Complete Database Export
-- Generated: 2026-03-12
-- Target: MySQL 8.0+
-- =====================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET collation_connection = 'utf8mb4_unicode_ci';

CREATE DATABASE IF NOT EXISTS nouli_medical
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nouli_medical;

-- =====================================================
-- TABLES
-- =====================================================

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  date_of_birth DATE DEFAULT NULL,
  sex VARCHAR(20) DEFAULT NULL,
  illness TEXT DEFAULT NULL,
  national_health_number VARCHAR(100) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  custom_fields JSON DEFAULT ('{}'),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  patient_id CHAR(36) NOT NULL,
  status ENUM('scheduled', 'arrived', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  scheduled_at DATETIME DEFAULT NULL,
  checked_in_at DATETIME DEFAULT NULL,
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  reason_for_visit TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  booking_source VARCHAR(50) NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clinical Notes
CREATE TABLE IF NOT EXISTS clinical_notes (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  patient_id CHAR(36) NOT NULL,
  appointment_id CHAR(36) DEFAULT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_clinical_notes_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_clinical_notes_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Patient Files
CREATE TABLE IF NOT EXISTS patient_files (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  patient_id CHAR(36) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_patient_files_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notification Logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  patient_id CHAR(36) DEFAULT NULL,
  appointment_id CHAR(36) DEFAULT NULL,
  notification_type VARCHAR(50) NOT NULL DEFAULT 'status_change',
  message TEXT NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Patient Check-ins
CREATE TABLE IF NOT EXISTS patient_checkins (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  reason_for_visit TEXT DEFAULT NULL,
  processed_at DATETIME DEFAULT NULL,
  processed_by CHAR(36) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email Verifications
CREATE TABLE IF NOT EXISTS email_verifications (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate Limit Log
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role ENUM('admin', 'staff') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_roles_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Practice Settings
CREATE TABLE IF NOT EXISTS practice_settings (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  practice_name VARCHAR(255) NOT NULL DEFAULT 'Medical Practice',
  doctor_name VARCHAR(255) NOT NULL DEFAULT 'Dr. Smith',
  phone_number VARCHAR(50) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  specialty VARCHAR(255) DEFAULT NULL,
  logo_url TEXT DEFAULT NULL,
  closure_reason TEXT DEFAULT NULL,
  is_closed BOOLEAN DEFAULT FALSE,
  booking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  visit_duration INT NOT NULL DEFAULT 30,
  infobip_api_key TEXT DEFAULT NULL,
  infobip_base_url TEXT DEFAULT NULL,
  infobip_sender_email VARCHAR(255) DEFAULT NULL,
  custom_patient_fields JSON DEFAULT ('[]'),
  operating_hours JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- STORED PROCEDURES (MySQL equivalents)
-- =====================================================

DELIMITER //

CREATE PROCEDURE cleanup_rate_limit_log()
BEGIN
  DELETE FROM rate_limit_log WHERE created_at < NOW() - INTERVAL 1 HOUR;
END //

CREATE FUNCTION has_role(p_user_id CHAR(36), p_role VARCHAR(10))
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = p_role
  );
END //

CREATE FUNCTION is_staff(p_user_id CHAR(36))
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id
  );
END //

DELIMITER ;

-- =====================================================
-- VIEW: practice_settings_public
-- =====================================================

CREATE OR REPLACE VIEW practice_settings_public AS
SELECT
  id, practice_name, doctor_name, phone_number, address, specialty,
  logo_url, closure_reason, is_closed, booking_enabled, visit_duration,
  infobip_base_url, infobip_sender_email,
  custom_patient_fields, operating_hours, created_at, updated_at
FROM practice_settings;

-- =====================================================
-- DATA: patients
-- =====================================================

INSERT INTO patients (id, first_name, last_name, email, phone, date_of_birth, sex, illness, national_health_number, address, custom_fields, created_at, updated_at) VALUES
('3db4d0a4-936e-4901-b5fe-19c27dc0391c', 'Αναστασία', 'Νούλη', 'annouli80@yahoo.com', '6945077647', NULL, NULL, NULL, NULL, NULL, '{}', '2026-02-04 19:31:22', '2026-02-04 19:31:22'),
('6b279421-9169-401d-a962-1c9b2daf7250', 'Ιωάννης', 'Παπαευσταθίου', 'jpapaefstathiou@gmail.com', '6973398690', NULL, NULL, NULL, NULL, NULL, '{}', '2026-02-04 20:18:12', '2026-02-04 20:18:12'),
('dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', 'Βασίλης', 'Σταυρουλλάκης', 'rodosgraph@gmail.com', '6947995801', '1974-02-11', 'male', 'Κολπική μαρμαρυγή', '11027401394', 'Αλυτρώτων Ελλήνων 11', '{}', '2026-02-04 22:21:35', '2026-02-04 22:55:52'),
('758245f3-12bd-4baf-be5c-12a289f2242f', 'ΑΝΑΣΤΑΣΙΑ', 'ΛΥΚΟΥ', 'lykouanastasia@yahoo.gr', '6942204846', NULL, NULL, NULL, NULL, NULL, '{}', '2026-02-05 16:39:30', '2026-02-05 16:39:30'),
('363318c2-ea69-43b0-b657-9c7f0e4466f0', 'Ειρηνη', 'Αυγερινού', 'aug_eirini@hotmail.com', '6942244316', NULL, NULL, NULL, NULL, NULL, '{}', '2026-02-05 16:44:36', '2026-02-05 16:44:36'),
('c4b1bd97-f67a-435f-a43b-f048863bcb6e', 'Babis', 'Assistant', 'babis@gmail.con', '6944266008', NULL, NULL, NULL, NULL, NULL, '{}', '2026-02-17 18:28:33', '2026-02-17 18:28:33');

-- =====================================================
-- DATA: appointments
-- =====================================================

INSERT INTO appointments (id, patient_id, status, scheduled_at, checked_in_at, started_at, completed_at, reason_for_visit, notes, booking_source, created_at, updated_at) VALUES
('e5ad58dc-c278-49d4-8ad1-0cb88aaa32d0', '6b279421-9169-401d-a962-1c9b2daf7250', 'scheduled', '2026-02-09 08:00:00', NULL, NULL, NULL, NULL, NULL, 'patient', '2026-02-04 20:18:12', '2026-02-04 20:18:12'),
('1ad9c8e0-cc1e-4cc2-bb34-0369d3e089ed', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', 'completed', '2026-02-05 07:00:00', '2026-02-04 22:29:12', '2026-02-04 22:30:51', '2026-02-04 22:44:56', 'Τεστ', NULL, 'staff', '2026-02-04 22:21:36', '2026-02-04 22:44:56'),
('a14d8c03-4fcf-4c76-b0da-e9ffdcbac0ce', '758245f3-12bd-4baf-be5c-12a289f2242f', 'scheduled', '2026-02-11 07:00:00', NULL, NULL, NULL, 'Έλεγχος', NULL, 'patient', '2026-02-05 16:39:31', '2026-02-05 16:39:31'),
('90866a62-4fc4-4330-8b6e-efc8735f6d8c', '363318c2-ea69-43b0-b657-9c7f0e4466f0', 'scheduled', '2026-02-09 09:00:00', NULL, NULL, NULL, 'Δηακεβ', NULL, 'patient', '2026-02-05 16:44:36', '2026-02-05 16:44:36'),
('89a9a2fd-5161-42e5-b618-828e02e3e2ab', '3db4d0a4-936e-4901-b5fe-19c27dc0391c', 'scheduled', '2026-02-09 09:30:00', NULL, NULL, NULL, 'Check up', NULL, 'patient', '2026-02-04 19:31:23', '2026-02-07 15:31:12'),
('f9102d86-7198-4f8e-9e20-ad347b516c63', 'c4b1bd97-f67a-435f-a43b-f048863bcb6e', 'scheduled', '2026-02-20 08:00:00', NULL, NULL, NULL, 'Babsi', NULL, 'patient', '2026-02-17 18:28:33', '2026-02-17 18:29:11');

-- =====================================================
-- DATA: clinical_notes
-- =====================================================

INSERT INTO clinical_notes (id, patient_id, appointment_id, note_text, created_at, updated_at) VALUES
('11cb0544-a83d-4178-9a34-f5acbc35d7ce', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', NULL, 'παλμοί καρδιάς = 65, φλεβική πίεση 8,2 - 11,1', '2026-02-04 22:44:31', '2026-02-04 22:44:31');

-- =====================================================
-- DATA: patient_files
-- =====================================================

INSERT INTO patient_files (id, patient_id, file_name, file_url, file_type, created_at) VALUES
('a4a1555b-6b51-40d1-b216-dcf727b26f85', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', 'istockphoto-472681686-612x612.jpg', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3/1770245079358.jpg', 'image/jpeg', '2026-02-04 22:44:39'),
('4c868d7e-d043-4ce0-ab4e-7ead5a3695b0', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', 'cardXplore_sample_report.pdf', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3/1770246956491.pdf', 'application/pdf', '2026-02-04 23:15:57');

-- =====================================================
-- DATA: notification_logs
-- =====================================================

INSERT INTO notification_logs (id, patient_id, appointment_id, notification_type, message, sent_at) VALUES
('e6b6682f-21dc-4892-8a94-ec01483e5b1f', '3db4d0a4-936e-4901-b5fe-19c27dc0391c', '89a9a2fd-5161-42e5-b618-828e02e3e2ab', 'reschedule', 'Appointment rescheduled from 2026-02-09 09:00 to 2026-02-09 10:30', '2026-02-04 19:57:07'),
('786138c0-96f3-4302-b888-efef965fc3cd', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', '1ad9c8e0-cc1e-4cc2-bb34-0369d3e089ed', 'status_change', 'Appointment status changed to in progress', '2026-02-04 22:30:51'),
('b83be015-bb07-42bf-8e0a-b1e44b9f2b80', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', '1ad9c8e0-cc1e-4cc2-bb34-0369d3e089ed', 'status_change', 'Appointment status changed to completed', '2026-02-04 22:44:56'),
('b1c14f3f-9845-4514-84df-a2c1189fc812', '3db4d0a4-936e-4901-b5fe-19c27dc0391c', '89a9a2fd-5161-42e5-b618-828e02e3e2ab', 'reschedule', 'Appointment rescheduled from 2026-02-09 10:30 to 2026-02-09 11:30', '2026-02-07 15:31:12'),
('7f7de4f3-f506-4ae3-bd96-2b0c0fda5147', 'c4b1bd97-f67a-435f-a43b-f048863bcb6e', 'f9102d86-7198-4f8e-9e20-ad347b516c63', 'reschedule', 'Appointment rescheduled from 2026-02-20 09:30 to 2026-02-20 10:00', '2026-02-17 18:29:12');

-- =====================================================
-- DATA: practice_settings
-- =====================================================

INSERT INTO practice_settings (id, practice_name, doctor_name, phone_number, address, specialty, logo_url, is_closed, booking_enabled, visit_duration, infobip_api_key, infobip_base_url, infobip_sender_email, custom_patient_fields, operating_hours, created_at, updated_at) VALUES
('488b197f-1d20-4f08-9009-0c6e84419acd', 'Αναστασία Α. Νούλη', 'Νάνσυ', '22410 27 443', 'Μιχαήλ Νουάρου 3 | T.K. 85133 | Ρόδος', 'Καρδιολόγος', 'https://qjgjilkndpcwjbtpzwya.supabase.co/storage/v1/object/public/practice-assets/logo-1768909531375.png', FALSE, TRUE, 30, '6zjvle.api.infobip.com', 'ec9d49837ab488138c7f690faeb96422-04ce207e-ca35-4cde-a14e-412d0b01a7b9', 'info@nouli.gr', '[]', '{"friday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": true}}, "monday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": true}}, "saturday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": false}}, "sunday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": false}}, "thursday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": true}}, "tuesday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": true}}, "wednesday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": true}}}', '2026-01-16 20:29:07', '2026-01-28 15:52:35');

-- =====================================================
-- DATA: user_roles
-- =====================================================

INSERT INTO user_roles (id, user_id, role, created_at) VALUES
('4b782004-b3b5-4087-a4af-f0a312720f29', '2ef29081-a245-46b5-a8c6-af5cc37c78eb', 'staff', '2026-01-28 14:31:06');

-- =====================================================
-- END OF MYSQL EXPORT
-- =====================================================
