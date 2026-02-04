-- Drop and recreate the view WITHOUT security_invoker so it uses definer rights
-- This allows anon users to read through the view while the base table remains protected

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
FROM practice_settings;

-- Ensure anon and authenticated can select from the view
GRANT SELECT ON public.practice_settings_public TO anon;
GRANT SELECT ON public.practice_settings_public TO authenticated;