-- Enable RLS on the view and add a policy for public read access
-- Note: Views inherit RLS from their security_invoker setting
-- The view was created with security_invoker=on, so we need to grant SELECT on the view

-- Grant SELECT permission on the public view to anon and authenticated roles
GRANT SELECT ON public.practice_settings_public TO anon;
GRANT SELECT ON public.practice_settings_public TO authenticated;