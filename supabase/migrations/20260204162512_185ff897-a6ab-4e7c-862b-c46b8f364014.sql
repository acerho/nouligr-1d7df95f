-- Drop the existing view and recreate without security_invoker
-- This allows public access to practice settings (excluding sensitive fields like API keys)

DROP VIEW IF EXISTS public.practice_settings_public;

CREATE VIEW public.practice_settings_public AS
SELECT 
  id,
  practice_name,
  doctor_name,
  phone_number,
  address,
  specialty,
  logo_url,
  operating_hours,
  custom_patient_fields,
  is_closed,
  closure_reason,
  infobip_base_url,
  infobip_sender_email,
  created_at,
  updated_at
FROM public.practice_settings;

-- Grant SELECT access to both anon and authenticated roles
GRANT SELECT ON public.practice_settings_public TO anon;
GRANT SELECT ON public.practice_settings_public TO authenticated;