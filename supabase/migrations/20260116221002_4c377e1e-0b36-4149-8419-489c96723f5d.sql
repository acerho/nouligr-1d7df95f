-- Add booking_source column to appointments table
ALTER TABLE public.appointments
ADD COLUMN booking_source text NOT NULL DEFAULT 'staff';

-- Add comment explaining the values
COMMENT ON COLUMN public.appointments.booking_source IS 'Values: staff (booked by doctor/staff), patient (booked via QR code)';