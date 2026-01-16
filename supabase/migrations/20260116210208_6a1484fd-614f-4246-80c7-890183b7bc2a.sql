-- Add custom_patient_fields column to practice_settings
ALTER TABLE public.practice_settings 
ADD COLUMN custom_patient_fields jsonb DEFAULT '[]'::jsonb;