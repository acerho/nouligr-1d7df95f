-- =====================================================
-- SECURITY FIX: Protect sensitive data in practice_settings
-- =====================================================

-- Create a public view that excludes the API key
CREATE OR REPLACE VIEW public.practice_settings_public
WITH (security_invoker = on) AS
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
-- Note: infobip_api_key is intentionally excluded

-- Drop the old public SELECT policy
DROP POLICY IF EXISTS "Practice settings are publicly readable" ON public.practice_settings;

-- Create restrictive SELECT policy - only authenticated users can read
CREATE POLICY "Authenticated users can read practice settings"
ON public.practice_settings
FOR SELECT
TO authenticated
USING (true);

-- Public users can only read through the view (which excludes API key)
-- Note: The view uses security_invoker so it respects RLS

-- =====================================================
-- SECURITY FIX: Restrict email_verifications access
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can create verification" ON public.email_verifications;
DROP POLICY IF EXISTS "Anyone can read verification" ON public.email_verifications;
DROP POLICY IF EXISTS "Anyone can update verification" ON public.email_verifications;

-- Block direct table access - only edge functions with service role can access
-- This prevents code enumeration and brute force attacks
CREATE POLICY "No direct access to email_verifications"
ON public.email_verifications
FOR SELECT
USING (false);

CREATE POLICY "No direct insert to email_verifications"
ON public.email_verifications
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct update to email_verifications"
ON public.email_verifications
FOR UPDATE
USING (false);

-- =====================================================
-- SECURITY FIX: Add rate limiting table
-- =====================================================

-- Create rate limit tracking table
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action_type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS - only service role can access
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- No direct access - only edge functions with service role
CREATE POLICY "No direct access to rate_limit_log"
ON public.rate_limit_log
FOR ALL
USING (false);

-- Create index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_lookup 
ON public.rate_limit_log (identifier, action_type, created_at DESC);

-- Clean up old rate limit entries (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_log 
  WHERE created_at < now() - interval '1 hour';
END;
$$;