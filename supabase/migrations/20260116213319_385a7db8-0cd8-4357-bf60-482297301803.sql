-- Add DELETE policy for patients table
CREATE POLICY "Authenticated users can delete patients"
ON public.patients
FOR DELETE
USING (true);