-- Add sex and national_health_number columns to patients table
ALTER TABLE public.patients 
ADD COLUMN sex text NULL,
ADD COLUMN national_health_number text NULL;