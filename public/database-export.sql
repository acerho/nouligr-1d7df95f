-- =====================================================
-- NOULI Medical Practice - Complete Database Export
-- Generated: 2026-02-18
-- Target: PostgreSQL with Supabase Auth extensions
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'staff');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('scheduled', 'arrived', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLES
-- =====================================================

-- Patients
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  sex TEXT,
  illness TEXT,
  national_health_number TEXT,
  address TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  status appointment_status NOT NULL DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reason_for_visit TEXT,
  notes TEXT,
  booking_source TEXT NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clinical Notes
CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  appointment_id UUID REFERENCES public.appointments(id),
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patient Files
CREATE TABLE IF NOT EXISTS public.patient_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notification Logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID,
  appointment_id UUID,
  notification_type TEXT NOT NULL DEFAULT 'status_change',
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patient Check-ins
CREATE TABLE IF NOT EXISTS public.patient_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  reason_for_visit TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email Verifications
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate Limit Log
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  action_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Practice Settings
CREATE TABLE IF NOT EXISTS public.practice_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_name TEXT NOT NULL DEFAULT 'Medical Practice',
  doctor_name TEXT NOT NULL DEFAULT 'Dr. Smith',
  phone_number TEXT,
  address TEXT,
  specialty TEXT,
  logo_url TEXT,
  closure_reason TEXT,
  is_closed BOOLEAN DEFAULT false,
  infobip_api_key TEXT,
  infobip_base_url TEXT,
  infobip_sender_email TEXT,
  custom_patient_fields JSONB DEFAULT '[]'::jsonb,
  operating_hours JSONB DEFAULT '{"friday": {"open": "09:00", "close": "17:00", "enabled": true}, "monday": {"open": "09:00", "close": "17:00", "enabled": true}, "sunday": {"open": "09:00", "close": "13:00", "enabled": false}, "tuesday": {"open": "09:00", "close": "17:00", "enabled": true}, "saturday": {"open": "09:00", "close": "13:00", "enabled": false}, "thursday": {"open": "09:00", "close": "17:00", "enabled": true}, "wednesday": {"open": "09:00", "close": "17:00", "enabled": true}}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limit_log WHERE created_at < now() - interval '1 hour';
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clinical_notes_updated_at BEFORE UPDATE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_practice_settings_updated_at BEFORE UPDATE ON public.practice_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PUBLIC VIEW (practice_settings_public)
-- =====================================================

CREATE OR REPLACE VIEW public.practice_settings_public AS
SELECT
  id, practice_name, doctor_name, phone_number, address, specialty,
  logo_url, closure_reason, is_closed, infobip_base_url, infobip_sender_email,
  custom_patient_fields, operating_hours, created_at, updated_at
FROM public.practice_settings;

-- =====================================================
-- DATA: patients
-- =====================================================

INSERT INTO public.patients (id, first_name, last_name, email, phone, date_of_birth, sex, illness, national_health_number, address, custom_fields, created_at, updated_at) VALUES
('3db4d0a4-936e-4901-b5fe-19c27dc0391c', 'Αναστασία', 'Νούλη', 'annouli80@yahoo.com', '6945077647', NULL, NULL, NULL, NULL, NULL, '{}'::jsonb, '2026-02-04 19:31:22.96899+00', '2026-02-04 19:31:22.96899+00'),
('6b279421-9169-401d-a962-1c9b2daf7250', 'Ιωάννης', 'Παπαευσταθίου', 'jpapaefstathiou@gmail.com', '6973398690', NULL, NULL, NULL, NULL, NULL, '{}'::jsonb, '2026-02-04 20:18:12.314239+00', '2026-02-04 20:18:12.314239+00'),
('dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', 'Βασίλης', 'Σταυρουλλάκης', 'rodosgraph@gmail.com', '6947995801', '1974-02-11', 'male', 'Κολπική μαρμαρυγή', '11027401394', 'Αλυτρώτων Ελλήνων 11', '{}'::jsonb, '2026-02-04 22:21:35.935626+00', '2026-02-04 22:55:52.601986+00'),
('758245f3-12bd-4baf-be5c-12a289f2242f', 'ΑΝΑΣΤΑΣΙΑ', 'ΛΥΚΟΥ', 'lykouanastasia@yahoo.gr', '6942204846', NULL, NULL, NULL, NULL, NULL, '{}'::jsonb, '2026-02-05 16:39:30.900651+00', '2026-02-05 16:39:30.900651+00'),
('363318c2-ea69-43b0-b657-9c7f0e4466f0', 'Ειρηνη', 'Αυγερινού', 'aug_eirini@hotmail.com', '6942244316', NULL, NULL, NULL, NULL, NULL, '{}'::jsonb, '2026-02-05 16:44:36.259178+00', '2026-02-05 16:44:36.259178+00'),
('c4b1bd97-f67a-435f-a43b-f048863bcb6e', 'Babis', 'Assistant', 'babis@gmail.con', '6944266008', NULL, NULL, NULL, NULL, NULL, '{}'::jsonb, '2026-02-17 18:28:33.110769+00', '2026-02-17 18:28:33.110769+00');

-- =====================================================
-- DATA: appointments
-- =====================================================

INSERT INTO public.appointments (id, patient_id, status, scheduled_at, checked_in_at, started_at, completed_at, reason_for_visit, notes, booking_source, created_at, updated_at) VALUES
('e5ad58dc-c278-49d4-8ad1-0cb88aaa32d0', '6b279421-9169-401d-a962-1c9b2daf7250', 'scheduled', '2026-02-09 08:00:00+00', NULL, NULL, NULL, NULL, NULL, 'patient', '2026-02-04 20:18:12.586879+00', '2026-02-04 20:18:12.586879+00'),
('1ad9c8e0-cc1e-4cc2-bb34-0369d3e089ed', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', 'completed', '2026-02-05 07:00:00+00', '2026-02-04 22:29:12.146+00', '2026-02-04 22:30:51.716+00', '2026-02-04 22:44:56.3+00', 'Τεστ', NULL, 'staff', '2026-02-04 22:21:36.303086+00', '2026-02-04 22:44:56.421669+00'),
('a14d8c03-4fcf-4c76-b0da-e9ffdcbac0ce', '758245f3-12bd-4baf-be5c-12a289f2242f', 'scheduled', '2026-02-11 07:00:00+00', NULL, NULL, NULL, 'Έλεγχος', NULL, 'patient', '2026-02-05 16:39:31.099824+00', '2026-02-05 16:39:31.099824+00'),
('90866a62-4fc4-4330-8b6e-efc8735f6d8c', '363318c2-ea69-43b0-b657-9c7f0e4466f0', 'scheduled', '2026-02-09 09:00:00+00', NULL, NULL, NULL, 'Δηακεβ', NULL, 'patient', '2026-02-05 16:44:36.465401+00', '2026-02-05 16:44:36.465401+00'),
('89a9a2fd-5161-42e5-b618-828e02e3e2ab', '3db4d0a4-936e-4901-b5fe-19c27dc0391c', 'scheduled', '2026-02-09 09:30:00+00', NULL, NULL, NULL, 'Check up', NULL, 'patient', '2026-02-04 19:31:23.286033+00', '2026-02-07 15:31:12.129197+00'),
('f9102d86-7198-4f8e-9e20-ad347b516c63', 'c4b1bd97-f67a-435f-a43b-f048863bcb6e', 'scheduled', '2026-02-20 08:00:00+00', NULL, NULL, NULL, 'Babsi', NULL, 'patient', '2026-02-17 18:28:33.296802+00', '2026-02-17 18:29:11.893029+00');

-- =====================================================
-- DATA: clinical_notes
-- =====================================================

INSERT INTO public.clinical_notes (id, patient_id, appointment_id, note_text, created_at, updated_at) VALUES
('11cb0544-a83d-4178-9a34-f5acbc35d7ce', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', NULL, 'παλμοί καρδιάς = 65, φλεβική πίεση 8,2 - 11,1', '2026-02-04 22:44:31.460551+00', '2026-02-04 22:44:31.460551+00');

-- =====================================================
-- DATA: patient_files
-- =====================================================

INSERT INTO public.patient_files (id, patient_id, file_name, file_url, file_type, created_at) VALUES
('a4a1555b-6b51-40d1-b216-dcf727b26f85', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', 'istockphoto-472681686-612x612.jpg', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3/1770245079358.jpg', 'image/jpeg', '2026-02-04 22:44:39.909235+00'),
('4c868d7e-d043-4ce0-ab4e-7ead5a3695b0', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', 'cardXplore_sample_report.pdf', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3/1770246956491.pdf', 'application/pdf', '2026-02-04 23:15:57.33456+00');

-- =====================================================
-- DATA: notification_logs
-- =====================================================

INSERT INTO public.notification_logs (id, patient_id, appointment_id, notification_type, message, sent_at) VALUES
('e6b6682f-21dc-4892-8a94-ec01483e5b1f', '3db4d0a4-936e-4901-b5fe-19c27dc0391c', '89a9a2fd-5161-42e5-b618-828e02e3e2ab', 'reschedule', 'Appointment rescheduled from 2026-02-09 09:00 to 2026-02-09 10:30', '2026-02-04 19:57:07.472673+00'),
('786138c0-96f3-4302-b888-efef965fc3cd', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', '1ad9c8e0-cc1e-4cc2-bb34-0369d3e089ed', 'status_change', 'Appointment status changed to in progress', '2026-02-04 22:30:51.947291+00'),
('b83be015-bb07-42bf-8e0a-b1e44b9f2b80', 'dddc697b-47c6-4c6e-a0d2-09e1e582f5c3', '1ad9c8e0-cc1e-4cc2-bb34-0369d3e089ed', 'status_change', 'Appointment status changed to completed', '2026-02-04 22:44:56.555454+00'),
('b1c14f3f-9845-4514-84df-a2c1189fc812', '3db4d0a4-936e-4901-b5fe-19c27dc0391c', '89a9a2fd-5161-42e5-b618-828e02e3e2ab', 'reschedule', 'Appointment rescheduled from 2026-02-09 10:30 to 2026-02-09 11:30', '2026-02-07 15:31:12.461659+00'),
('7f7de4f3-f506-4ae3-bd96-2b0c0fda5147', 'c4b1bd97-f67a-435f-a43b-f048863bcb6e', 'f9102d86-7198-4f8e-9e20-ad347b516c63', 'reschedule', 'Appointment rescheduled from 2026-02-20 09:30 to 2026-02-20 10:00', '2026-02-17 18:29:12.098108+00');

-- =====================================================
-- DATA: practice_settings
-- =====================================================

INSERT INTO public.practice_settings (id, practice_name, doctor_name, phone_number, address, specialty, logo_url, is_closed, infobip_api_key, infobip_base_url, infobip_sender_email, custom_patient_fields, operating_hours, created_at, updated_at) VALUES
('488b197f-1d20-4f08-9009-0c6e84419acd', 'Αναστασία Α. Νούλη', 'Νάνσυ', '22410 27 443', 'Μιχαήλ Νουάρου 3 | T.K. 85133 | Ρόδος', 'Καρδιολόγος', 'https://qjgjilkndpcwjbtpzwya.supabase.co/storage/v1/object/public/practice-assets/logo-1768909531375.png', false, '6zjvle.api.infobip.com', 'ec9d49837ab488138c7f690faeb96422-04ce207e-ca35-4cde-a14e-412d0b01a7b9', 'info@nouli.gr', '[]'::jsonb, '{"friday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": true}}, "monday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": true}}, "saturday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": false}}, "sunday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": false}}, "thursday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": true}}, "tuesday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": true}}, "wednesday": {"evening": {"open": "17:00", "close": "21:00", "enabled": false}, "morning": {"open": "09:00", "close": "13:00", "enabled": true}}}'::jsonb, '2026-01-16 20:29:07.247641+00', '2026-01-28 15:52:35.746959+00');

-- =====================================================
-- DATA: user_roles
-- =====================================================

INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES
('4b782004-b3b5-4087-a4af-f0a312720f29', '2ef29081-a245-46b5-a8c6-af5cc37c78eb', 'staff', '2026-01-28 14:31:06.986672+00');

-- =====================================================
-- END OF EXPORT
-- =====================================================
