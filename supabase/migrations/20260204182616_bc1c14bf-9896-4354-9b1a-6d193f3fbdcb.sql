-- Allow public patient creation for booking flow (unauthenticated users)
CREATE POLICY "Allow public patient creation for booking"
ON public.patients
FOR INSERT
WITH CHECK (true);

-- Allow public appointment creation for booking flow (unauthenticated users)
CREATE POLICY "Allow public appointment creation for booking"
ON public.appointments
FOR INSERT
WITH CHECK (true);