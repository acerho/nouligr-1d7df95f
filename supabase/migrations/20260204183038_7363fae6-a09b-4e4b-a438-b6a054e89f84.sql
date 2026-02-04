-- Allow public to check if patient exists by name (for booking flow)
CREATE POLICY "Allow public patient lookup for booking"
ON public.patients
FOR SELECT
USING (true);

-- Allow public to update patient phone/email during booking
CREATE POLICY "Allow public patient update for booking"
ON public.patients
FOR UPDATE
USING (true);