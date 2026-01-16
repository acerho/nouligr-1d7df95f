export type AppointmentStatus = 'scheduled' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

export interface CustomPatientField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  options?: string[]; // For select type
}

export interface PracticeSettings {
  id: string;
  doctor_name: string;
  practice_name: string;
  phone_number: string | null;
  address: string | null;
  specialty: string | null;
  logo_url: string | null;
  custom_patient_fields: CustomPatientField[] | null;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  illness: string | null;
  custom_fields: Record<string, string | number | boolean> | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  status: AppointmentStatus;
  scheduled_at: string | null;
  reason_for_visit: string | null;
  notes: string | null;
  checked_in_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  patient?: Patient;
}

export interface ClinicalNote {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  note_text: string;
  created_at: string;
  updated_at: string;
}

export interface PatientFile {
  id: string;
  patient_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  patient_id: string | null;
  appointment_id: string | null;
  message: string;
  notification_type: string;
  sent_at: string;
  patient?: Patient;
}
