-- Create enum for appointment status
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'arrived', 'in_progress', 'completed', 'cancelled');

-- Create practice_settings table for storing office configuration
CREATE TABLE public.practice_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_name TEXT NOT NULL DEFAULT 'Dr. Smith',
    practice_name TEXT NOT NULL DEFAULT 'Medical Practice',
    phone_number TEXT,
    address TEXT,
    specialty TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.practice_settings ENABLE ROW LEVEL SECURITY;

-- Practice settings can be read by anyone (for patient check-in page)
CREATE POLICY "Practice settings are publicly readable" 
ON public.practice_settings 
FOR SELECT 
USING (true);

-- Only authenticated users can update practice settings
CREATE POLICY "Authenticated users can update practice settings" 
ON public.practice_settings 
FOR UPDATE 
TO authenticated
USING (true);

-- Insert default practice settings
INSERT INTO public.practice_settings (doctor_name, practice_name, specialty) 
VALUES ('Dr. Smith', 'Medical Practice', 'General Medicine');

-- Create patients table
CREATE TABLE public.patients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Patients are readable by authenticated users
CREATE POLICY "Authenticated users can read patients" 
ON public.patients 
FOR SELECT 
TO authenticated
USING (true);

-- Authenticated users can insert patients
CREATE POLICY "Authenticated users can insert patients" 
ON public.patients 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Authenticated users can update patients
CREATE POLICY "Authenticated users can update patients" 
ON public.patients 
FOR UPDATE 
TO authenticated
USING (true);

-- Public can insert patients (for self check-in)
CREATE POLICY "Public can insert patients for check-in" 
ON public.patients 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Create appointments table
CREATE TABLE public.appointments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    status public.appointment_status NOT NULL DEFAULT 'scheduled',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    reason_for_visit TEXT,
    notes TEXT,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Appointments are readable by authenticated users
CREATE POLICY "Authenticated users can read appointments" 
ON public.appointments 
FOR SELECT 
TO authenticated
USING (true);

-- Authenticated users can manage appointments
CREATE POLICY "Authenticated users can insert appointments" 
ON public.appointments 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update appointments" 
ON public.appointments 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete appointments" 
ON public.appointments 
FOR DELETE 
TO authenticated
USING (true);

-- Public can insert appointments (for self check-in)
CREATE POLICY "Public can insert appointments for check-in" 
ON public.appointments 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Create clinical_notes table for patient history
CREATE TABLE public.clinical_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage clinical notes" 
ON public.clinical_notes 
FOR ALL 
TO authenticated
USING (true);

-- Create patient_files table for uploaded documents
CREATE TABLE public.patient_files (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage patient files" 
ON public.patient_files 
FOR ALL 
TO authenticated
USING (true);

-- Create notification_logs table
CREATE TABLE public.notification_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL DEFAULT 'status_change',
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage notification logs" 
ON public.notification_logs 
FOR ALL 
TO authenticated
USING (true);

-- Create storage bucket for patient files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('patient-files', 'patient-files', false);

-- Storage policies for patient files
CREATE POLICY "Authenticated users can upload patient files" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'patient-files');

CREATE POLICY "Authenticated users can view patient files" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'patient-files');

CREATE POLICY "Authenticated users can delete patient files" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'patient-files');

-- Create storage bucket for practice logo (public)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('practice-assets', 'practice-assets', true);

-- Storage policies for practice assets
CREATE POLICY "Anyone can view practice assets" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'practice-assets');

CREATE POLICY "Authenticated users can upload practice assets" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'practice-assets');

CREATE POLICY "Authenticated users can update practice assets" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'practice-assets');

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_practice_settings_updated_at
    BEFORE UPDATE ON public.practice_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON public.patients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clinical_notes_updated_at
    BEFORE UPDATE ON public.clinical_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();