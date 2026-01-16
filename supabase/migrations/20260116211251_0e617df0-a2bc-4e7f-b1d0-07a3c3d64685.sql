-- Add custom_fields column to patients table to store dynamic field values
ALTER TABLE public.patients 
ADD COLUMN custom_fields jsonb DEFAULT '{}'::jsonb;