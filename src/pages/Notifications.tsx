import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { NotificationLog } from '@/types/database';
import { Bell, MessageSquare, Loader2, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { useTranslation } from '@/hooks/useTranslation';

export default function Notifications() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useTranslation();
  const dateLocale = language === 'el' ? el : enUS;

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data, error } = await supabase.from('notification_logs').select(`*, patient:patients(first_name, last_name)`).order('sent_at', { ascending: false }).limit(100);
        if (error) throw error;
        setLogs(data as unknown as NotificationLog[]);
      } catch (error) {
        console.error('Error fetching notification logs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) {
    return <DashboardLayout><div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t.notifications.title}</h1>
          <p className="text-sm text-muted-foreground">{t.notifications.subtitle}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><MessageSquare className="h-5 w-5 text-primary" />{t.notifications.smsNotifications}</CardTitle>
              <CardDescription>{t.notifications.configureSms}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{t.notifications.comingSoon}</p>
                    <p className="mt-1 text-muted-foreground">{t.notifications.comingSoonText}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <p className="font-medium text-foreground">{t.notifications.plannedFeatures}</p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />{t.notifications.appointmentReminders}</li>
                  <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />{t.notifications.statusChangeNotifications}</li>
                  <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" />{t.notifications.customTemplates}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="medical-card lg:col-span-2">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg"><Bell className="h-5 w-5 text-primary" />{t.notifications.notificationLog}</CardTitle>
              <CardDescription>{t.notifications.recentActivity}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4"><Bell className="h-8 w-8 text-muted-foreground" /></div>
                  <h3 className="mt-4 font-medium text-foreground">{t.notifications.noNotifications}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t.notifications.notificationsAppear}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10"><Bell className="h-4 w-4 text-primary" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">{log.message}</p>
                            {log.patient && <p className="text-sm text-muted-foreground">{t.notifications.patient}: {(log.patient as any).first_name} {(log.patient as any).last_name}</p>}
                          </div>
                          <Badge variant="secondary" className="shrink-0">{log.notification_type.replace('_', ' ')}</Badge>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{format(new Date(log.sent_at), 'MMM d, yyyy HH:mm', { locale: dateLocale })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
