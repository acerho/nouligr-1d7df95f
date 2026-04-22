import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Clock, 
  CheckCircle2,
  Stethoscope,
  HandMetal
} from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { useTranslation } from '@/hooks/useTranslation';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { toast } from 'sonner';

interface WaitlistEntry {
  id: string;
  first_name: string;
  masked_last_name: string;
  scheduled_at: string | null;
  status: 'scheduled' | 'arrived';
  created_at: string;
}

export default function FrontOfficeWaitlist() {
  const [appointments, setAppointments] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const { t, language } = useTranslation();
  const { settings } = usePracticeSettings();

  const dateLocale = language === 'el' ? el : enUS;

  const fetchAppointments = useCallback(async () => {
    try {
      const data = await api<WaitlistEntry[]>('/api/checkins.php', {
        query: { action: 'public-waitlist' },
      });
      setAppointments(data ?? []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    const interval = setInterval(fetchAppointments, 10000);
    return () => clearInterval(interval);
  }, [fetchAppointments]);

  const handleCheckIn = async (appointment: WaitlistEntry) => {
    setCheckingIn(appointment.id);
    try {
      await api('/api/checkins.php', {
        method: 'POST',
        query: { action: 'public-check-in' },
        body: { appointment_id: appointment.id },
      });
      toast.success(t.checkIn.checkInSuccess);
      fetchAppointments();
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error(t.checkIn.checkInError);
    } finally {
      setCheckingIn(null);
    }
  };

  // Sort by scheduled_at time, fallback to created_at for walk-ins
  const sortByAppointmentTime = (a: WaitlistEntry, b: WaitlistEntry) => {
    const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : new Date(a.created_at).getTime();
    const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : new Date(b.created_at).getTime();
    return timeA - timeB;
  };

  const waitingPatients = appointments.filter(a => a.status === 'arrived').sort(sortByAppointmentTime);
  const scheduledPatients = appointments.filter(a => a.status === 'scheduled').sort(sortByAppointmentTime);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {settings?.logo_url && (
                <img 
                  src={settings.logo_url} 
                  alt="Logo" 
                  className="h-12 w-12 rounded-lg object-contain"
                />
              )}
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {settings?.practice_name || t.auth.medicalOffice}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(), 'EEEE, d MMMM yyyy', { locale: dateLocale })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Stethoscope className="h-8 w-8 text-primary" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <HandMetal className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {language === 'el' 
                  ? 'Καλώς ήρθατε! Πατήστε το όνομά σας για να δηλώσετε άφιξη' 
                  : 'Welcome! Tap your name to check in'}
              </h2>
              <p className="text-muted-foreground">
                {language === 'el'
                  ? 'Ο γιατρός θα ενημερωθεί αυτόματα για την παρουσία σας'
                  : 'The doctor will be automatically notified of your arrival'}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-warning/10 p-3">
                <Users className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t.appointments.waiting}
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {waitingPatients.length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-info/10 p-3">
                <Clock className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t.appointments.status.scheduled}
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {scheduledPatients.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {waitingPatients.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-success" />
                {t.checkIn.checkedIn}
                <Badge variant="secondary" className="ml-2">
                  {waitingPatients.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {waitingPatients.map((appointment, index) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-4 bg-success/5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20 text-lg font-bold text-success">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {appointment.first_name} {appointment.masked_last_name}
                        </p>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-success text-success-foreground">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {t.appointments.waiting}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-info" />
              {t.dashboard.todaysAppointments}
              <Badge variant="secondary" className="ml-2">
                {scheduledPatients.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : scheduledPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 font-medium text-foreground">
                  {language === 'el' 
                    ? 'Δεν υπάρχουν άλλα ραντεβού' 
                    : 'No more appointments'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {language === 'el'
                    ? 'Όλοι οι ασθενείς έχουν κάνει check-in'
                    : 'All patients have checked in'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {scheduledPatients.map((appointment) => (
                  <Button
                    key={appointment.id}
                    variant="ghost"
                    className="flex h-auto w-full items-center justify-between rounded-none p-4 hover:bg-primary/5"
                    onClick={() => handleCheckIn(appointment)}
                    disabled={checkingIn === appointment.id}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                        {appointment.first_name?.charAt(0)}
                        {appointment.masked_last_name?.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-semibold text-foreground">
                          {appointment.first_name} {appointment.masked_last_name}
                        </p>
                        {appointment.scheduled_at && (
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(appointment.scheduled_at), 'HH:mm', { locale: dateLocale })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {checkingIn === appointment.id ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <Badge variant="outline" className="border-primary text-primary">
                          {language === 'el' ? 'Πατήστε για Check-in' : 'Tap to Check In'}
                        </Badge>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>{t.checkIn.takeASeat}</p>
        </div>
      </div>
    </div>
  );
}
