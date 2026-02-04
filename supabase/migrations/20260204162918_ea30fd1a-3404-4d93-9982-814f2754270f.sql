-- Add policy to allow anon users to read practice_settings (non-sensitive data is already filtered by the app)
-- This is needed because the sidebar loads before auth state is fully resolved

CREATE POLICY "Public can read practice settings"
ON public.practice_settings
FOR SELECT
TO anon
USING (true);