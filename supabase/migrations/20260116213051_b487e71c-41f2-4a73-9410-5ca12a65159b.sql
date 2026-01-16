-- Add illness column to patients table
ALTER TABLE public.patients
ADD COLUMN illness text;