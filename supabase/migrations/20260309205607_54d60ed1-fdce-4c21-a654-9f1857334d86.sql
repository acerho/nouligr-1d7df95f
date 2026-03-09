
ALTER TABLE public.practice_settings ADD COLUMN visit_duration integer NOT NULL DEFAULT 30;

-- Recreate the public view to include visit_duration
DROP VIEW IF EXISTS public.practice_settings_public;
CREATE VIEW public.practice_settings_public AS
SELECT 
  id, practice_name, doctor_name, phone_number, address, specialty, 
  logo_url, custom_patient_fields, operating_hours, is_closed, closure_reason,
  infobip_base_url, infobip_sender_email, visit_duration,
  created_at, updated_at
FROM public.practice_settings;
