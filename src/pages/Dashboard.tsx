import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  PlayCircle,
  Calendar,
  UserPlus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Appointment } from '@/types/database';
import { AppointmentCard } from '@/components/appointments/AppointmentCard';
import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';

export default function Dashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useTranslation();

  const dateLocale = language === 'el' ? el : enUS;

  const fetchAppointments = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(*)
        `)
        .gte('created_at', today.toISOString())
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAppointments(data as unknown as Appointment[]);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => fetchAppointments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const waitlist = appointments.filter(a => a.status === 'arrived' || (a.status === 'scheduled' && a.checked_in_at));
  const scheduled = appointments.filter(a => a.status === 'scheduled' && !a.checked_in_at);
  const inProgress = appointments.filter(a => a.status === 'in_progress');
  const completed = appointments.filter(a => a.status === 'completed');

  const stats = [
    { 
      label: t.dashboard.waitlist, 
      value: waitlist.length, 
      icon: Users, 
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    },
    { 
      label: t.dashboard.scheduled, 
      value: scheduled.length, 
      icon: Calendar, 
      color: 'text-info',
      bgColor: 'bg-info/10'
    },
    { 
      label: t.dashboard.inProgress, 
      value: inProgress.length, 
      icon: PlayCircle, 
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    { 
      label: t.dashboard.completed, 
      value: completed.length, 
      icon: CheckCircle2, 
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t.dashboard.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, MMMM d, yyyy', { locale: dateLocale })}
            </p>
          </div>
          <Link to="/appointments">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              {t.dashboard.newAppointment}
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="medical-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-3xl font-bold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`rounded-xl p-3 ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Appointments Tabs */}
        <Card className="medical-card">
          <Tabs defaultValue="waitlist" className="w-full">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="font-display text-lg">
                  {t.dashboard.todaysAppointments}
                </CardTitle>
                <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                  <TabsTrigger value="waitlist" className="gap-1 text-xs sm:gap-2 sm:text-sm">
                    {t.dashboard.waitlist}
                    {waitlist.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                        {waitlist.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="scheduled" className="gap-1 text-xs sm:gap-2 sm:text-sm">
                    {t.dashboard.scheduled}
                    {scheduled.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                        {scheduled.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="all" className="text-xs sm:text-sm">{t.common.all}</TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <TabsContent value="waitlist" className="m-0">
                {waitlist.length === 0 ? (
                  <EmptyState 
                    icon={Users} 
                    title={t.dashboard.noPatientWaiting} 
                    description={t.dashboard.patientsCheckInHere}
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {waitlist.map((appointment) => (
                      <AppointmentCard 
                        key={appointment.id} 
                        appointment={appointment}
                        onUpdate={fetchAppointments}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="scheduled" className="m-0">
                {scheduled.length === 0 ? (
                  <EmptyState 
                    icon={Calendar} 
                    title={t.dashboard.noScheduledAppointments} 
                    description={t.dashboard.futureAppointmentsHere}
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {scheduled.map((appointment) => (
                      <AppointmentCard 
                        key={appointment.id} 
                        appointment={appointment}
                        onUpdate={fetchAppointments}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="all" className="m-0">
                {appointments.length === 0 ? (
                  <EmptyState 
                    icon={Clock} 
                    title={t.dashboard.noAppointmentsToday} 
                    description={t.dashboard.createOrWait}
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {appointments.map((appointment) => (
                      <AppointmentCard 
                        key={appointment.id} 
                        appointment={appointment}
                        onUpdate={fetchAppointments}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function EmptyState({ icon: Icon, title, description }: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
