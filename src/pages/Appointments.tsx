import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { Appointment, Patient, OperatingHours, DayHours } from '@/types/database';
import { Calendar, Plus, Loader2, List, CalendarDays } from 'lucide-react';
import { AppointmentCard } from '@/components/appointments/AppointmentCard';
import { AppointmentsCalendar } from '@/components/appointments/AppointmentsCalendar';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const { t } = useTranslation();
  const { settings } = usePracticeSettings();

  const [newAppointment, setNewAppointment] = useState({
    patientId: '',
    firstName: '',
    lastName: '',
    phone: '',
    scheduledDate: '',
    scheduledTime: '',
    reasonForVisit: '',
    isNewPatient: true,
  });

  // Get today's date in YYYY-MM-DD format for min date (stable reference)
  const [today] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  // Current time buffer for same-day bookings (recalculated on dialog open)
  const [currentBufferMinutes, setCurrentBufferMinutes] = useState(0);

  // Update buffer when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      const now = new Date();
      setCurrentBufferMinutes(now.getHours() * 60 + now.getMinutes() + 30);
    }
  }, [dialogOpen]);

  // Get day name from date string
  const getDayName = (dateStr: string): keyof OperatingHours | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    const days: (keyof OperatingHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  // Get booked time slots for the selected date
  const bookedTimeSlots = useMemo(() => {
    if (!newAppointment.scheduledDate) return [];
    
    return appointments
      .filter(apt => {
        if (!apt.scheduled_at) return false;
        // Only consider scheduled appointments (not cancelled/completed)
        if (apt.status === 'cancelled' || apt.status === 'completed') return false;
        // Convert to local date for comparison
        const aptLocalDate = new Date(apt.scheduled_at);
        const aptDateString = `${aptLocalDate.getFullYear()}-${String(aptLocalDate.getMonth() + 1).padStart(2, '0')}-${String(aptLocalDate.getDate()).padStart(2, '0')}`;
        return aptDateString === newAppointment.scheduledDate;
      })
      .map(apt => {
        // Convert to local time for display
        const aptLocalTime = new Date(apt.scheduled_at!);
        const hours = String(aptLocalTime.getHours()).padStart(2, '0');
        const minutes = String(aptLocalTime.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      });
  }, [appointments, newAppointment.scheduledDate]);

  // Generate available time slots based on operating hours
  const availableTimeSlots = useMemo(() => {
    const operatingHours = settings?.operating_hours as OperatingHours | null;
    const selectedDate = newAppointment.scheduledDate;
    const step = (settings as any)?.visit_duration || 30;
    
    // If no date selected, return empty
    if (!selectedDate) return [];

    // Check if today - use stable buffer
    const isToday = selectedDate === today;
    const bufferMinutes = isToday ? currentBufferMinutes : 0;

    // Fallback: generate all time slots (08:00 - 20:00) if no operating hours configured
    if (!operatingHours) {
      const slots: string[] = [];
      for (let minutes = 8 * 60; minutes < 20 * 60; minutes += step) {
        if (isToday && minutes < bufferMinutes) continue;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        // Skip booked slots
        if (!bookedTimeSlots.includes(timeString)) {
          slots.push(timeString);
        }
      }
      return slots;
    }

    const dayName = getDayName(selectedDate);
    if (!dayName) return [];

    const dayData = operatingHours[dayName];
    if (!dayData) return [];

    const slots: string[] = [];

    // Helper to add slots from a shift
    const addSlotsFromShift = (shift: { open: string; close: string; enabled: boolean }) => {
      if (!shift.enabled) return;

      const [openHour, openMin] = shift.open.split(':').map(Number);
      const [closeHour, closeMin] = shift.close.split(':').map(Number);
      
      const startMinutes = openHour * 60 + openMin;
      const endMinutes = closeHour * 60 + closeMin;

      for (let minutes = startMinutes; minutes < endMinutes; minutes += step) {
        // Skip past times for today
        if (isToday && minutes < bufferMinutes) continue;

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        // Skip booked slots
        if (!bookedTimeSlots.includes(timeString)) {
          slots.push(timeString);
        }
      }
    };

    // Check if dayData has the new format (morning/evening shifts) or old format (single shift)
    const dayHours = dayData as unknown as Record<string, unknown>;
    if (dayHours.morning && typeof dayHours.morning === 'object') {
      // New format with morning/evening shifts
      addSlotsFromShift(dayHours.morning as { open: string; close: string; enabled: boolean });
      if (dayHours.evening && typeof dayHours.evening === 'object') {
        addSlotsFromShift(dayHours.evening as { open: string; close: string; enabled: boolean });
      }
    } else if (dayHours.open && dayHours.close) {
      // Old format with single shift
      addSlotsFromShift(dayHours as unknown as { open: string; close: string; enabled: boolean });
    }

    return slots.sort();
  }, [settings?.operating_hours, newAppointment.scheduledDate, today, currentBufferMinutes, bookedTimeSlots]);

  // Reset time when date changes if current time is no longer valid
  useEffect(() => {
    if (newAppointment.scheduledTime && !availableTimeSlots.includes(newAppointment.scheduledTime)) {
      setNewAppointment(prev => ({ ...prev, scheduledTime: '' }));
    }
  }, [availableTimeSlots, newAppointment.scheduledTime]);

  const fetchData = async () => {
    try {
      const [appointmentsData, patientsData] = await Promise.all([
        api<Appointment[]>('/api/appointments.php'),
        api<Patient[]>('/api/patients.php'),
      ]);
      setAppointments(appointmentsData ?? []);
      const sorted = [...(patientsData ?? [])].sort((a, b) =>
        a.last_name.localeCompare(b.last_name)
      );
      setPatients(sorted);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateAppointment = async () => {
    setCreating(true);
    try {
      let patientId = newAppointment.patientId;
      let patientPhone = newAppointment.phone;
      let patientName = `${newAppointment.firstName} ${newAppointment.lastName}`;
      let patientEmail = '';

      if (newAppointment.isNewPatient) {
        if (!newAppointment.firstName || !newAppointment.lastName) {
          toast.error(t.appointments.enterPatientName);
          setCreating(false);
          return;
        }

        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            first_name: newAppointment.firstName,
            last_name: newAppointment.lastName,
            phone: newAppointment.phone || null,
          })
          .select('id')
          .single();

        if (patientError) throw patientError;
        patientId = newPatient.id;
      } else {
        // Get existing patient's details for SMS
        const selectedPatient = patients.find(p => p.id === newAppointment.patientId);
        if (selectedPatient) {
          patientPhone = selectedPatient.phone || '';
          patientName = `${selectedPatient.first_name} ${selectedPatient.last_name}`;
          patientEmail = selectedPatient.email || '';
        }
      }

      if (!patientId) {
        toast.error(t.appointments.selectOrCreate);
        setCreating(false);
        return;
      }

      // Combine date and time for scheduled_at - convert local time to ISO with timezone
      let scheduledAt = null;
      if (newAppointment.scheduledDate && newAppointment.scheduledTime) {
        const localDate = new Date(`${newAppointment.scheduledDate}T${newAppointment.scheduledTime}:00`);
        scheduledAt = localDate.toISOString();
      } else if (newAppointment.scheduledDate) {
        const localDate = new Date(`${newAppointment.scheduledDate}T09:00:00`);
        scheduledAt = localDate.toISOString();
      }

      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patientId,
          status: 'scheduled',
          scheduled_at: scheduledAt,
          reason_for_visit: newAppointment.reasonForVisit || null,
          booking_source: 'staff',
        });

      if (appointmentError) throw appointmentError;

      toast.success(t.appointments.appointmentCreated);

      // Send SMS notification if patient has a phone number
      if (patientPhone && scheduledAt) {
        try {
          const appointmentDate = new Date(scheduledAt);
          const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const formattedTime = `${String(appointmentDate.getHours()).padStart(2, '0')}:${String(appointmentDate.getMinutes()).padStart(2, '0')}`;

          const { data: sessionData } = await supabase.auth.getSession();
          
          await supabase.functions.invoke('send-appointment-confirmation', {
            body: {
              email: patientEmail || 'noemail@placeholder.com',
              phone: patientPhone,
              patientName: patientName,
              appointmentDate: formattedDate,
              appointmentTime: formattedTime,
              practiceName: settings?.practice_name || 'Medical Practice',
              practiceAddress: settings?.address || '',
              practicePhone: settings?.phone_number || '',
              reasonForVisit: newAppointment.reasonForVisit || '',
              language: 'el',
            },
          });
          console.log('SMS notification sent successfully');
        } catch (smsError) {
          console.error('Failed to send SMS notification:', smsError);
          // Don't fail the whole operation if SMS fails
        }
      }

      setDialogOpen(false);
      setNewAppointment({
        patientId: '',
        firstName: '',
        lastName: '',
        phone: '',
        scheduledDate: '',
        scheduledTime: '',
        reasonForVisit: '',
        isNewPatient: true,
      });
      fetchData();
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error(t.errors.saveFailed);
    } finally {
      setCreating(false);
    }
  };

  // Filter out cancelled appointments and completed appointments from past days
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const visibleAppointments = appointments
    .filter(a => {
      // Always hide cancelled appointments
      if (a.status === 'cancelled') {
        return false;
      }
      // Hide completed appointments from past days
      if (a.status === 'completed') {
        const appointmentDate = a.scheduled_at ? new Date(a.scheduled_at) : new Date(a.created_at);
        appointmentDate.setHours(0, 0, 0, 0);
        if (appointmentDate < todayStart) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by scheduled_at ascending (date first, then time)
      // Appointments without a scheduled_at go to the bottom
      if (!a.scheduled_at && !b.scheduled_at) return 0;
      if (!a.scheduled_at) return 1;
      if (!b.scheduled_at) return -1;
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    });

  const filteredAppointments = filterStatus === 'all' 
    ? visibleAppointments 
    : visibleAppointments.filter(a => a.status === filterStatus);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{t.appointments.title}</h1>
            <p className="text-sm text-muted-foreground">
              {t.appointments.subtitle}
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t.dashboard.newAppointment}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t.appointments.createAppointment}</DialogTitle>
                <DialogDescription>
                  {t.appointments.scheduleNew}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t.appointments.patientType}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={newAppointment.isNewPatient ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewAppointment(prev => ({ ...prev, isNewPatient: true, patientId: '' }))}
                    >
                      {t.appointments.newPatient}
                    </Button>
                    <Button
                      type="button"
                      variant={!newAppointment.isNewPatient ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewAppointment(prev => ({ ...prev, isNewPatient: false }))}
                    >
                      {t.appointments.existingPatient}
                    </Button>
                  </div>
                </div>

                {newAppointment.isNewPatient ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">{t.appointments.firstName} *</Label>
                        <Input
                          id="firstName"
                          value={newAppointment.firstName}
                          onChange={(e) => setNewAppointment(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="John"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">{t.appointments.lastName} *</Label>
                        <Input
                          id="lastName"
                          value={newAppointment.lastName}
                          onChange={(e) => setNewAppointment(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t.appointments.phone}</Label>
                      <Input
                        id="phone"
                        value={newAppointment.phone}
                        onChange={(e) => setNewAppointment(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>{t.appointments.selectPatient} *</Label>
                    <Select
                      value={newAppointment.patientId}
                      onValueChange={(value) => setNewAppointment(prev => ({ ...prev, patientId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t.appointments.choosePatient} />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.first_name} {patient.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">{t.appointments.date}</Label>
                    <Input
                      id="scheduledDate"
                      type="date"
                      min={today}
                      value={newAppointment.scheduledDate}
                      onChange={(e) => setNewAppointment(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduledTime">{t.appointments.time}</Label>
                    <Select
                      value={newAppointment.scheduledTime}
                      onValueChange={(value) => setNewAppointment(prev => ({ ...prev, scheduledTime: value }))}
                      disabled={!newAppointment.scheduledDate || availableTimeSlots.length === 0}
                    >
                      <SelectTrigger className="font-mono">
                        <SelectValue placeholder={availableTimeSlots.length === 0 && newAppointment.scheduledDate ? "No slots" : "--:--"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]" position="popper" sideOffset={4}>
                        {availableTimeSlots.map((time) => (
                          <SelectItem key={time} value={time} className="font-mono">
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">{t.appointments.reasonForVisit}</Label>
                  <Textarea
                    id="reason"
                    value={newAppointment.reasonForVisit}
                    onChange={(e) => setNewAppointment(prev => ({ ...prev, reasonForVisit: e.target.value }))}
                    placeholder={t.appointments.briefDescription}
                    rows={2}
                  />
                </div>

                <Button 
                  onClick={handleCreateAppointment} 
                  className="w-full"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.common.creating}
                    </>
                  ) : (
                    t.appointments.createAppointment
                  )}
                </Button>
              </div>
            </DialogContent>
        </Dialog>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => setViewMode('list')}
          >
            <List className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{t.appointments.listView || 'List'}</span>
            <span className="sm:hidden">List</span>
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarDays className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{t.appointments.calendarView || 'Calendar'}</span>
            <span className="sm:hidden">Cal</span>
          </Button>
        </div>

        {viewMode === 'calendar' ? (
          <AppointmentsCalendar appointments={filteredAppointments} />
        ) : (
          <Card className="medical-card">
            <CardHeader className="border-b border-border">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="font-display text-lg">
                  {t.appointments.allAppointments} ({filteredAppointments.length})
                </CardTitle>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t.appointments.status.all} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.appointments.status.all}</SelectItem>
                    <SelectItem value="scheduled">{t.appointments.status.scheduled}</SelectItem>
                    <SelectItem value="arrived">{t.appointments.status.arrived}</SelectItem>
                    <SelectItem value="in_progress">{t.appointments.status.inProgress}</SelectItem>
                    <SelectItem value="completed">{t.appointments.status.completed}</SelectItem>
                    <SelectItem value="cancelled">{t.appointments.status.cancelled}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                  <h3 className="mt-4 font-medium text-foreground">{t.appointments.noAppointments}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.appointments.createToStart}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onUpdate={fetchData}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
