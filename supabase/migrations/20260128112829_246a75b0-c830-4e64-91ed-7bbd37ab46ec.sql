-- Add email sender configuration to practice_settings
ALTER TABLE public.practice_settings 
ADD COLUMN IF NOT EXISTS infobip_sender_email TEXT DEFAULT NULL;