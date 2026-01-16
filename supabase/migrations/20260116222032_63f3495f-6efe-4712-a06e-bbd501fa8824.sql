-- Create table to store email verification codes
CREATE TABLE public.email_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for booking form)
CREATE POLICY "Anyone can create verification" 
ON public.email_verifications 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to select (to verify code)
CREATE POLICY "Anyone can read verification" 
ON public.email_verifications 
FOR SELECT 
USING (true);

-- Allow anyone to update (to mark as verified)
CREATE POLICY "Anyone can update verification" 
ON public.email_verifications 
FOR UPDATE 
USING (true);

-- Add index for faster lookups
CREATE INDEX idx_email_verifications_email_code ON public.email_verifications(email, code);