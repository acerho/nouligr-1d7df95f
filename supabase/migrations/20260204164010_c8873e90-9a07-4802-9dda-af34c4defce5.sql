-- Restrict practice_settings access to staff only (protects API keys)
-- Remove the permissive policy for all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read practice settings" ON public.practice_settings;

-- Create a new restrictive policy that only allows staff to read practice_settings
CREATE POLICY "Staff can read practice settings"
ON public.practice_settings
FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));

-- Restrict update to staff only as well
DROP POLICY IF EXISTS "Authenticated users can update practice settings" ON public.practice_settings;

CREATE POLICY "Staff can update practice settings"
ON public.practice_settings
FOR UPDATE
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));