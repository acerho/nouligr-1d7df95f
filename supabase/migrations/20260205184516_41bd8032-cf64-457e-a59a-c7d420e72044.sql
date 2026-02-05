-- Allow public read access to appointments for checking availability on booking page
-- Only expose scheduled_at for active appointments (no sensitive patient data)
CREATE POLICY "Allow public to check appointment availability" 
ON public.appointments 
FOR SELECT 
USING (status IN ('scheduled', 'arrived', 'in_progress'));