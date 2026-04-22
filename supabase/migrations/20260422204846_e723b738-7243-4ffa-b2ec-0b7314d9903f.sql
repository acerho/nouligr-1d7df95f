
-- ============================================================
-- 1. Fix is_staff() to require explicit staff/admin role
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('staff'::app_role, 'admin'::app_role)
  )
$$;

-- ============================================================
-- 2. Stop auto-granting staff role on signup
--    (First user still becomes admin to allow initial setup;
--     later signups receive NO role and have no data access.)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  -- Only the very first account becomes admin (bootstrap).
  -- All subsequent signups get NO role and must be promoted by an admin.
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Patients table — remove anon SELECT/UPDATE, keep INSERT
-- ============================================================
DROP POLICY IF EXISTS "Allow public patient lookup for booking" ON public.patients;
DROP POLICY IF EXISTS "Allow public patient update for booking" ON public.patients;

-- Secure RPC for public booking flow:
-- finds patient by exact first/last name; if found updates contact info; if not, creates one.
-- Returns ONLY the patient id — no PHI leaks.
CREATE OR REPLACE FUNCTION public.find_or_create_booking_patient(
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  -- Basic input validation
  IF p_first_name IS NULL OR length(trim(p_first_name)) = 0 THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  IF p_last_name IS NULL OR length(trim(p_last_name)) = 0 THEN
    RAISE EXCEPTION 'Last name is required';
  END IF;
  IF length(p_first_name) > 100 OR length(p_last_name) > 100 THEN
    RAISE EXCEPTION 'Name too long';
  END IF;
  IF p_phone IS NOT NULL AND length(p_phone) > 20 THEN
    RAISE EXCEPTION 'Phone too long';
  END IF;
  IF p_email IS NOT NULL AND length(p_email) > 255 THEN
    RAISE EXCEPTION 'Email too long';
  END IF;

  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE first_name = p_first_name
    AND last_name = p_last_name
  LIMIT 1;

  IF v_patient_id IS NOT NULL THEN
    UPDATE public.patients
    SET phone = COALESCE(NULLIF(p_phone, ''), phone),
        email = COALESCE(NULLIF(p_email, ''), email),
        updated_at = now()
    WHERE id = v_patient_id;
  ELSE
    INSERT INTO public.patients (first_name, last_name, phone, email)
    VALUES (p_first_name, p_last_name, NULLIF(p_phone, ''), NULLIF(p_email, ''))
    RETURNING id INTO v_patient_id;
  END IF;

  RETURN v_patient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_booking_patient(text, text, text, text) TO anon, authenticated;

-- ============================================================
-- 4. Practice settings — remove leftover anon SELECT, restrict to admins
-- ============================================================
DROP POLICY IF EXISTS "Anon can read practice settings for public view" ON public.practice_settings;
DROP POLICY IF EXISTS "Public can read practice settings" ON public.practice_settings;
DROP POLICY IF EXISTS "Staff can read practice settings" ON public.practice_settings;
DROP POLICY IF EXISTS "Staff can update practice settings" ON public.practice_settings;

CREATE POLICY "Admins can read practice settings"
ON public.practice_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update practice settings"
ON public.practice_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Staff still need to read non-sensitive operational fields
-- (booking_enabled, operating_hours, visit_duration, etc.) but NOT api keys.
CREATE OR REPLACE VIEW public.practice_settings_staff
WITH (security_invoker = on) AS
SELECT
  id,
  practice_name,
  doctor_name,
  specialty,
  address,
  phone_number,
  logo_url,
  booking_enabled,
  is_closed,
  closure_reason,
  visit_duration,
  operating_hours,
  custom_patient_fields,
  infobip_sender_email,
  created_at,
  updated_at
FROM public.practice_settings;

-- Allow staff (and admins) to read this safe view
GRANT SELECT ON public.practice_settings_staff TO authenticated;

-- ============================================================
-- 5. Appointments — remove anon SELECT (leaks reason_for_visit)
-- ============================================================
DROP POLICY IF EXISTS "Allow public to check appointment availability" ON public.appointments;

-- Safe RPC for public booking page to check which slots are taken (no PHI)
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_day date)
RETURNS TABLE(scheduled_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.scheduled_at
  FROM public.appointments a
  WHERE a.scheduled_at >= (p_day::timestamp AT TIME ZONE 'Europe/Athens')
    AND a.scheduled_at <  ((p_day + 1)::timestamp AT TIME ZONE 'Europe/Athens')
    AND a.status IN ('scheduled'::appointment_status,
                     'arrived'::appointment_status,
                     'in_progress'::appointment_status);
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon, authenticated;

-- Safe RPC for public front-office waitlist screen — masked surnames, no PHI fields
CREATE OR REPLACE FUNCTION public.get_public_waitlist()
RETURNS TABLE(
  id uuid,
  first_name text,
  masked_last_name text,
  scheduled_at timestamptz,
  status appointment_status,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    p.first_name,
    CASE
      WHEN length(p.last_name) <= 4 THEN p.last_name
      ELSE substring(p.last_name from 1 for 4) || '••••'
    END AS masked_last_name,
    a.scheduled_at,
    a.status,
    a.created_at
  FROM public.appointments a
  JOIN public.patients p ON p.id = a.patient_id
  WHERE a.status IN ('scheduled'::appointment_status, 'arrived'::appointment_status)
    AND (
      a.created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Athens') AT TIME ZONE 'Europe/Athens'
      OR (
        a.scheduled_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Athens') AT TIME ZONE 'Europe/Athens'
        AND a.scheduled_at <  (date_trunc('day', now() AT TIME ZONE 'Europe/Athens') + interval '1 day') AT TIME ZONE 'Europe/Athens'
      )
    )
  ORDER BY a.scheduled_at NULLS LAST, a.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_waitlist() TO anon, authenticated;

-- Safe RPC for anonymous check-in from waitlist (status -> arrived)
CREATE OR REPLACE FUNCTION public.public_check_in_appointment(p_appointment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start timestamptz;
  v_today_end   timestamptz;
  v_updated     int;
BEGIN
  v_today_start := date_trunc('day', now() AT TIME ZONE 'Europe/Athens') AT TIME ZONE 'Europe/Athens';
  v_today_end   := v_today_start + interval '1 day';

  UPDATE public.appointments
  SET status = 'arrived'::appointment_status,
      checked_in_at = now(),
      updated_at = now()
  WHERE id = p_appointment_id
    AND status = 'scheduled'::appointment_status
    AND (
      created_at >= v_today_start
      OR (scheduled_at >= v_today_start AND scheduled_at < v_today_end)
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_check_in_appointment(uuid) TO anon, authenticated;

-- ============================================================
-- 6. Storage policies — require staff role for patient-files bucket
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view patient files"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete patient files" ON storage.objects;

CREATE POLICY "Staff can upload patient files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'patient-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can view patient files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'patient-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete patient files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'patient-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can update patient files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'patient-files' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'patient-files' AND public.is_staff(auth.uid()));
