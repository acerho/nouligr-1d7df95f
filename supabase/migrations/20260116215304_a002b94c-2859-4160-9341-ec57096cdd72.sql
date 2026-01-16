-- Add operating hours and closure status to practice_settings
ALTER TABLE public.practice_settings
ADD COLUMN IF NOT EXISTS operating_hours jsonb DEFAULT '{
  "monday": {"open": "09:00", "close": "17:00", "enabled": true},
  "tuesday": {"open": "09:00", "close": "17:00", "enabled": true},
  "wednesday": {"open": "09:00", "close": "17:00", "enabled": true},
  "thursday": {"open": "09:00", "close": "17:00", "enabled": true},
  "friday": {"open": "09:00", "close": "17:00", "enabled": true},
  "saturday": {"open": "09:00", "close": "13:00", "enabled": false},
  "sunday": {"open": "09:00", "close": "13:00", "enabled": false}
}'::jsonb,
ADD COLUMN IF NOT EXISTS is_closed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS closure_reason text DEFAULT NULL;