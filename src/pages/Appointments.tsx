import { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import type { Appointment, Patient } from '@/types/database';
import { Calendar, Plus, Loader2 } from 'lucide-react';
import { AppointmentCard } from '@/components/appointments/AppointmentCard';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { t } = useTranslation();

  const [newAppointment, setNewAppointment] = useState({
    patientId: '',
    firstName: '',
    lastName: '',
    phone: '',
    scheduledAt: '',
    reasonForVisit: '',
    isNewPatient: true,
  });

  const fetchData = async () => {
    try {
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(*)
        `)
        .order('created_at', { ascending: false });

      if (appointmentsError) throw appointmentsError;
      setAppointments(appointmentsData as unknown as Appointment[]);

      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .order('last_name', { ascending: true });

      if (patientsError) throw patientsError;
      setPatients(patientsData as Patient[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAppointment = async () => {
    setCreating(true);
    try {
      let patientId = newAppointment.patientId;

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
      }

      if (!patientId) {
        toast.error(t.appointments.selectOrCreate);
        setCreating(false);
        return;
      }

      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patientId,
          status: 'scheduled',
          scheduled_at: newAppointment.scheduledAt || null,
          reason_for_visit: newAppointment.reasonForVisit || null,
          booking_source: 'staff',
        });

      if (appointmentError) throw appointmentError;

      toast.success(t.appointments.appointmentCreated);
      setDialogOpen(false);
      setNewAppointment({
        patientId: '',
        firstName: '',
        lastName: '',
        phone: '',
        scheduledAt: '',
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

  const filteredAppointments = filterStatus === 'all' 
    ? appointments 
    : appointments.filter(a => a.status === filterStatus);

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

                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">{t.appointments.scheduledDateTime}</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={newAppointment.scheduledAt}
                    onChange={(e) => setNewAppointment(prev => ({ ...prev, scheduledAt: e.target.value }))}
                  />
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
      </div>
    </DashboardLayout>
  );
}
