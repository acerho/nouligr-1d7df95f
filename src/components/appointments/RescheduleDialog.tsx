import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { Loader2, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import type { Appointment, OperatingHours } from '@/types/database';
import { format } from 'date-fns';

interface RescheduleDialogProps {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescheduled: () => void;
}

export function RescheduleDialog({ 
  appointment, 
  open, 
  onOpenChange, 
  onRescheduled 
}: RescheduleDialogProps) {
  const { t, language } = useTranslation();
  const { settings } = usePracticeSettings();
  const [saving, setSaving] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  
  // Get current appointment date/time
  const currentDate = appointment.scheduled_at 
    ? format(new Date(appointment.scheduled_at), 'yyyy-MM-dd')
    : '';
  const currentTime = appointment.scheduled_at 
    ? format(new Date(appointment.scheduled_at), 'HH:mm')
    : '';
  
  const [newDate, setNewDate] = useState(currentDate);
  const [newTime, setNewTime] = useState(currentTime);
  const [existingAppointments, setExistingAppointments] = useState<{ scheduled_at: string }[]>([]);

  // Today's date for min date
  const today = new Date().toISOString().split('T')[0];
  
  // Buffer for same-day bookings
  const [currentBufferMinutes, setCurrentBufferMinutes] = useState(0);

  useEffect(() => {
    if (open) {
      setNewDate(currentDate);
      setNewTime(currentTime);
      const now = new Date();
      setCurrentBufferMinutes(now.getHours() * 60 + now.getMinutes() + 30);
      fetchExistingAppointments();
    }
  }, [open, currentDate, currentTime]);

  const fetchExistingAppointments = async () => {
    try {
      const data = await api<Array<{ id: string; scheduled_at: string | null; status: string }>>(
        '/api/appointments.php'
      );
      const filtered = (data ?? [])
        .filter(a => a.id !== appointment.id)
        .filter(a => ['scheduled', 'arrived', 'in_progress'].includes(a.status))
        .filter(a => !!a.scheduled_at)
        .map(a => ({ scheduled_at: a.scheduled_at as string }));
      setExistingAppointments(filtered);
    } catch {
      setExistingAppointments([]);
    }
  };

  // Get booked time slots for the selected date
  const bookedTimeSlots = useMemo(() => {
    if (!newDate) return [];
    
    return existingAppointments
      .filter(apt => {
        if (!apt.scheduled_at) return false;
        const aptLocalDate = new Date(apt.scheduled_at);
        const aptDateString = `${aptLocalDate.getFullYear()}-${String(aptLocalDate.getMonth() + 1).padStart(2, '0')}-${String(aptLocalDate.getDate()).padStart(2, '0')}`;
        return aptDateString === newDate;
      })
      .map(apt => {
        const aptLocalTime = new Date(apt.scheduled_at!);
        const hours = String(aptLocalTime.getHours()).padStart(2, '0');
        const minutes = String(aptLocalTime.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      });
  }, [existingAppointments, newDate]);

  // Get day name from date string
  const getDayName = (dateStr: string): keyof OperatingHours | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    const days: (keyof OperatingHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  // Generate available time slots based on operating hours
  const availableTimeSlots = useMemo(() => {
    const operatingHours = settings?.operating_hours as OperatingHours | null;
    const step = 30;
    
    if (!newDate) return [];

    const isToday = newDate === today;
    const bufferMinutes = isToday ? currentBufferMinutes : 0;

    // Fallback: generate all time slots (08:00 - 20:00) if no operating hours configured
    if (!operatingHours) {
      const slots: string[] = [];
      for (let minutes = 8 * 60; minutes < 20 * 60; minutes += step) {
        if (isToday && minutes < bufferMinutes) continue;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        if (!bookedTimeSlots.includes(timeString)) {
          slots.push(timeString);
        }
      }
      return slots;
    }

    const dayName = getDayName(newDate);
    if (!dayName) return [];

    const dayData = operatingHours[dayName];
    if (!dayData) return [];

    const slots: string[] = [];

    const addSlotsFromShift = (shift: { open: string; close: string; enabled: boolean }) => {
      if (!shift.enabled) return;

      const [openHour, openMin] = shift.open.split(':').map(Number);
      const [closeHour, closeMin] = shift.close.split(':').map(Number);
      
      const startMinutes = openHour * 60 + openMin;
      const endMinutes = closeHour * 60 + closeMin;

      for (let minutes = startMinutes; minutes < endMinutes; minutes += step) {
        if (isToday && minutes < bufferMinutes) continue;

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        if (!bookedTimeSlots.includes(timeString)) {
          slots.push(timeString);
        }
      }
    };

    const dayHours = dayData as unknown as Record<string, unknown>;
    if (dayHours.morning && typeof dayHours.morning === 'object') {
      addSlotsFromShift(dayHours.morning as { open: string; close: string; enabled: boolean });
      if (dayHours.evening && typeof dayHours.evening === 'object') {
        addSlotsFromShift(dayHours.evening as { open: string; close: string; enabled: boolean });
      }
    } else if (dayHours.open && dayHours.close) {
      addSlotsFromShift(dayHours as unknown as { open: string; close: string; enabled: boolean });
    }

    return slots.sort();
  }, [settings?.operating_hours, newDate, today, currentBufferMinutes, bookedTimeSlots]);

  // Reset time when date changes if current time is no longer valid
  useEffect(() => {
    if (newTime && !availableTimeSlots.includes(newTime)) {
      setNewTime('');
    }
  }, [availableTimeSlots, newTime]);

  const hasChanges = newDate !== currentDate || newTime !== currentTime;
  const patient = appointment.patient;

  const handleReschedule = async () => {
    if (!newDate || !newTime) {
      toast.error(t.bookAppointment?.selectDateTime || 'Please select date and time');
      return;
    }

    setSaving(true);
    try {
      // Create new scheduled_at timestamp
      const localDate = new Date(`${newDate}T${newTime}:00`);
      const scheduledAt = localDate.toISOString();

      await api('/api/appointments.php', {
        method: 'PUT',
        query: { id: appointment.id },
        body: { scheduled_at: scheduledAt },
      });

      try {
        await api('/api/notifications.php', {
          method: 'POST',
          body: {
            patient_id: appointment.patient_id,
            appointment_id: appointment.id,
            message: `Appointment rescheduled from ${currentDate} ${currentTime} to ${newDate} ${newTime}`,
            notification_type: 'reschedule',
          },
        });
      } catch { /* ignore */ }

      // Send SMS notification if patient has phone number
      if (patient?.phone) {
        setSendingSms(true);
        try {
          await api('/api/send-sms.php', {
            method: 'POST',
            query: { action: 'reschedule' },
            body: {
              phone: patient.phone,
              patientName: `${patient.first_name} ${patient.last_name}`,
              oldDate: currentDate,
              oldTime: currentTime,
              newDate: newDate,
              newTime: newTime,
              practiceName: settings?.practice_name || 'Medical Practice',
              practicePhone: settings?.phone_number,
              language: language,
            },
          });
          toast.success(t.appointments?.rescheduledWithSms || 'Appointment rescheduled and SMS sent');
        } catch (smsErr) {
          console.error('Failed to send SMS:', smsErr);
            toast.warning(t.appointments?.rescheduledNoSms || 'Rescheduled but SMS failed to send');
        } finally {
          setSendingSms(false);
        }
      } else {
        toast.success(t.appointments?.appointmentRescheduled || 'Appointment rescheduled');
      }

      onOpenChange(false);
      onRescheduled();
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      toast.error(t.errors?.saveFailed || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            {t.appointments?.reschedule || 'Reschedule Appointment'}
          </DialogTitle>
          <DialogDescription>
            {t.appointments?.rescheduleDescription || 'Change the date and time for this appointment. The patient will be notified via SMS.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Patient info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium">
              {patient?.first_name} {patient?.last_name}
            </p>
            {patient?.phone && (
              <p className="text-xs text-muted-foreground">{patient.phone}</p>
            )}
            {currentDate && currentTime && (
              <p className="text-xs text-muted-foreground mt-1">
                {t.appointments?.currentSchedule || 'Current'}: {currentDate} {t.appointments?.at || 'at'} {currentTime}
              </p>
            )}
          </div>

          {/* New date */}
          <div className="space-y-2">
            <Label htmlFor="newDate">{t.appointments?.newDate || 'New Date'}</Label>
            <Input
              id="newDate"
              type="date"
              min={today}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>

          {/* New time */}
          <div className="space-y-2">
            <Label htmlFor="newTime">{t.appointments?.newTime || 'New Time'}</Label>
            <Select
              value={newTime}
              onValueChange={setNewTime}
              disabled={!newDate || availableTimeSlots.length === 0}
            >
              <SelectTrigger className="font-mono">
                <SelectValue 
                  placeholder={
                    availableTimeSlots.length === 0 && newDate 
                      ? (t.bookAppointment?.noAvailableSlots || 'No slots') 
                      : '--:--'
                  } 
                />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {availableTimeSlots.map((time) => (
                  <SelectItem key={time} value={time} className="font-mono">
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!patient?.phone && (
            <p className="text-xs text-warning">
              {t.appointments?.noPhoneNoSms || 'No phone number - SMS will not be sent'}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common?.cancel || 'Cancel'}
          </Button>
          <Button 
            onClick={handleReschedule} 
            disabled={saving || sendingSms || !hasChanges || !newDate || !newTime}
          >
            {saving || sendingSms ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {sendingSms 
                  ? (t.appointments?.sendingSms || 'Sending SMS...') 
                  : (t.common?.saving || 'Saving...')
                }
              </>
            ) : (
              t.appointments?.confirmReschedule || 'Confirm Reschedule'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
