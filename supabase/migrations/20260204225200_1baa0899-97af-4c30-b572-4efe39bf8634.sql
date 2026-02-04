-- Add address column to patients table
ALTER TABLE public.patients 
ADD COLUMN address text;