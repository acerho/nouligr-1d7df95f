-- Grant SELECT on the public view to anon role for public access
GRANT SELECT ON public.practice_settings_public TO anon;

-- Also grant to authenticated users
GRANT SELECT ON public.practice_settings_public TO authenticated;