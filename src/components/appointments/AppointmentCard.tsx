import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Clock, 
  MoreVertical, 
  PlayCircle, 
  CheckCircle2, 
  User,
  FileText,
  XCircle,
  Calendar,
  Phone,
  QrCode,
  UserCheck,
  CalendarClock,
  Bell,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Appointment, AppointmentStatus } from '@/types/database';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { RescheduleDialog } from './RescheduleDialog';

interface AppointmentCardProps {
  appointment: Appointment;
  onUpdate: () => void;
}

export function AppointmentCard({ appointment, onUpdate }: AppointmentCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const patient = appointment.patient;
  const { t, language } = useTranslation();
  
  const dateLocale = language === 'el' ? el : enUS;

  const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
    scheduled: { label: t.appointments.status.scheduled, className: 'status-scheduled' },
    arrived: { label: t.appointments.status.arrived, className: 'status-arrived' },
    in_progress: { label: t.appointments.status.inProgress, className: 'status-in-progress' },
    completed: { label: t.appointments.status.completed, className: 'status-completed' },
    cancelled: { label: t.appointments.status.cancelled, className: 'status-cancelled' },
  };

  const statusInfo = statusConfig[appointment.status];

  const updateStatus = async (newStatus: AppointmentStatus) => {
    setIsUpdating(true);
    try {
      const updates: Partial<Appointment> = { status: newStatus };
      
      if (newStatus === 'arrived') {
        updates.checked_in_at = new Date().toISOString();
      } else if (newStatus === 'in_progress') {
        updates.started_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', appointment.id);

      if (error) throw error;

      // Log notification
      await supabase.from('notification_logs').insert({
        patient_id: appointment.patient_id,
        appointment_id: appointment.id,
        message: `Appointment status changed to ${newStatus.replace('_', ' ')}`,
        notification_type: 'status_change',
      });

      const statusLabel = statusConfig[newStatus].label;
      toast.success(`${t.appointments.statusUpdated} ${statusLabel}`);
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(t.errors.saveFailed);
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextAction = (): { label: string; status: AppointmentStatus; icon: React.ElementType } | null => {
    switch (appointment.status) {
      case 'scheduled':
        return { label: t.appointments.markArrived, status: 'arrived', icon: User };
      case 'arrived':
        return { label: t.appointments.startVisit, status: 'in_progress', icon: PlayCircle };
      case 'in_progress':
        return { label: t.appointments.complete, status: 'completed', icon: CheckCircle2 };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const waitTime = appointment.checked_in_at 
    ? formatDistanceToNow(new Date(appointment.checked_in_at), { addSuffix: false, locale: dateLocale })
    : null;

  // Format scheduled date/time
  const scheduledDate = appointment.scheduled_at 
    ? format(new Date(appointment.scheduled_at), 'EEE, MMM d', { locale: dateLocale })
    : null;
  const scheduledTime = appointment.scheduled_at 
    ? format(new Date(appointment.scheduled_at), 'HH:mm', { locale: dateLocale })
    : null;

  // Booking source indicator
  const isPatientBooked = (appointment as any).booking_source === 'patient';

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30",
      isPatientBooked && "border-l-4 border-l-info"
    )}>
      <div className="flex items-center gap-4">
        {/* Scheduled Time Column */}
        {scheduledTime && (
          <div className={cn(
            "hidden sm:flex flex-col items-center justify-center min-w-[70px] p-2 rounded-lg border",
            isPatientBooked 
              ? "bg-info/5 border-info/20" 
              : "bg-primary/5 border-primary/10"
          )}>
            <span className={cn(
              "text-lg font-bold",
              isPatientBooked ? "text-info" : "text-primary"
            )}>{scheduledTime}</span>
            <span className="text-xs text-muted-foreground">{scheduledDate}</span>
            {/* Booking source icon */}
            <div className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              isPatientBooked ? "text-info" : "text-muted-foreground"
            )}>
              {isPatientBooked ? (
                <QrCode className="h-3 w-3" />
              ) : (
                <UserCheck className="h-3 w-3" />
              )}
            </div>
          </div>
        )}

        {/* Patient Avatar */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <span className="text-sm font-semibold text-primary">
            {patient?.last_name?.[0]}{patient?.first_name?.[0]}
          </span>
        </div>

        {/* Patient Info */}
        <div className="min-w-0">
          <Link 
            to={`/patients/${appointment.patient_id}`}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {patient?.last_name} {patient?.first_name}
          </Link>
          
          {/* Mobile: Show time inline */}
          {scheduledTime && (
            <div className="sm:hidden flex items-center gap-1 text-sm text-primary font-medium">
              <Calendar className="h-3 w-3" />
              {scheduledDate} at {scheduledTime}
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {patient?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {patient.phone}
              </span>
            )}
            {appointment.reason_for_visit && (
              <>
                {patient?.phone && <span>•</span>}
                <span className="truncate max-w-[200px]">
                  {appointment.reason_for_visit}
                </span>
              </>
            )}
            {waitTime && appointment.status !== 'completed' && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-warning">
                  <Clock className="h-3 w-3" />
                  {t.appointments.waiting} {waitTime}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Status Badge */}
        <span className={cn('status-badge', statusInfo.className)}>
          {statusInfo.label}
        </span>

        {/* Quick Action */}
        {nextAction && (
          <Button
            size="sm"
            onClick={() => updateStatus(nextAction.status)}
            disabled={isUpdating}
            className="hidden sm:flex"
          >
            <nextAction.icon className="mr-1.5 h-4 w-4" />
            {nextAction.label}
          </Button>
        )}

        {/* More Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to={`/patients/${appointment.patient_id}`}>
                <User className="mr-2 h-4 w-4" />
                {t.appointments.viewPatient}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/patients/${appointment.patient_id}?notes=true`}>
                <FileText className="mr-2 h-4 w-4" />
                {t.appointments.addNotes}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {appointment.status === 'scheduled' && (
              <>
                <DropdownMenuItem 
                  onClick={async () => {
                    if (!patient?.phone) {
                      toast.error(t.appointments.noPhoneNoSms || 'No phone number');
                      return;
                    }
                    setSendingReminder(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('send-appointment-reminder', {
                        body: { appointmentId: appointment.id, language }
                      });
                      if (error) throw error;
                      if (data?.success) {
                        toast.success(t.appointments.reminderSent || 'Reminder SMS sent');
                      } else {
                        throw new Error(data?.error || 'Failed to send');
                      }
                    } catch (error) {
                      console.error('Error sending reminder:', error);
                      toast.error(t.appointments.reminderFailed || 'Failed to send reminder');
                    } finally {
                      setSendingReminder(false);
                    }
                  }}
                  disabled={sendingReminder || !patient?.phone}
                >
                  {sendingReminder ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Bell className="mr-2 h-4 w-4" />
                  )}
                  {t.appointments.sendReminder || 'Send Reminder'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRescheduleOpen(true)}>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  {t.appointments.reschedule || 'Reschedule'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatus('arrived')}>
                  <User className="mr-2 h-4 w-4" />
                  {t.appointments.markArrived}
                </DropdownMenuItem>
              </>
            )}
            {appointment.status === 'arrived' && (
              <DropdownMenuItem onClick={() => updateStatus('in_progress')}>
                <PlayCircle className="mr-2 h-4 w-4" />
                {t.appointments.startVisit}
              </DropdownMenuItem>
            )}
            {appointment.status === 'in_progress' && (
              <DropdownMenuItem onClick={() => updateStatus('completed')}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t.appointments.completeVisit}
              </DropdownMenuItem>
            )}
            {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => updateStatus('cancelled')}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {t.common.cancel}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Reschedule Dialog */}
      <RescheduleDialog
        appointment={appointment}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        onRescheduled={onUpdate}
      />
    </div>
  );
}
