-- Add Infobip configuration columns to practice_settings table
ALTER TABLE public.practice_settings 
ADD COLUMN IF NOT EXISTS infobip_api_key text,
ADD COLUMN IF NOT EXISTS infobip_base_url text;