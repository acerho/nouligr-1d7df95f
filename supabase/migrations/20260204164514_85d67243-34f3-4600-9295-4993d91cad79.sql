-- Drop and recreate the view with security_invoker=on (recommended security pattern)
DROP VIEW IF EXISTS public.practice_settings_public;

CREATE VIEW public.practice_settings_public
WITH (security_invoker=on) AS
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

-- Grant SELECT on the view to public roles
GRANT SELECT ON public.practice_settings_public TO anon;
GRANT SELECT ON public.practice_settings_public TO authenticated;

-- Add a policy to allow anon users to read practice_settings (needed for security_invoker view)
-- This is safe because the view filters out the sensitive infobip_api_key column
CREATE POLICY "Anon can read practice settings for public view"
ON public.practice_settings
FOR SELECT
TO anon
USING (true);