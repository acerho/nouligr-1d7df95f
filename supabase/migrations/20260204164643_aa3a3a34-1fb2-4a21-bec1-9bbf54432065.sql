-- Remove the anon policy that exposes the API key
DROP POLICY IF EXISTS "Anon can read practice settings for public view" ON public.practice_settings;