-- Remove the public read policy that exposes sensitive API keys
DROP POLICY IF EXISTS "Public can read practice settings" ON public.practice_settings;

-- Ensure only authenticated staff can read the full practice_settings table (with API keys)
-- The existing "Authenticated users can read practice settings" policy remains for staff access