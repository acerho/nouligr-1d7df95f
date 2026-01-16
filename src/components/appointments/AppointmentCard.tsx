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
  XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Appointment, AppointmentStatus } from '@/types/database';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface AppointmentCardProps {
  appointment: Appointment;
  onUpdate: () => void;
}

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'status-scheduled' },
  arrived: { label: 'Arrived', className: 'status-arrived' },
  in_progress: { label: 'In Progress', className: 'status-in-progress' },
  completed: { label: 'Completed', className: 'status-completed' },
  cancelled: { label: 'Cancelled', className: 'status-cancelled' },
};

export function AppointmentCard({ appointment, onUpdate }: AppointmentCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const patient = appointment.patient;
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

      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextAction = (): { label: string; status: AppointmentStatus; icon: React.ElementType } | null => {
    switch (appointment.status) {
      case 'scheduled':
        return { label: 'Mark Arrived', status: 'arrived', icon: User };
      case 'arrived':
        return { label: 'Start Visit', status: 'in_progress', icon: PlayCircle };
      case 'in_progress':
        return { label: 'Complete', status: 'completed', icon: CheckCircle2 };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const waitTime = appointment.checked_in_at 
    ? formatDistanceToNow(new Date(appointment.checked_in_at), { addSuffix: false })
    : null;

  return (
    <div className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-4">
        {/* Patient Avatar */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <span className="text-sm font-semibold text-primary">
            {patient?.first_name?.[0]}{patient?.last_name?.[0]}
          </span>
        </div>

        {/* Patient Info */}
        <div className="min-w-0">
          <Link 
            to={`/patients/${appointment.patient_id}`}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {patient?.first_name} {patient?.last_name}
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {appointment.reason_for_visit && (
              <span className="truncate max-w-[200px]">
                {appointment.reason_for_visit}
              </span>
            )}
            {waitTime && appointment.status !== 'completed' && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Waiting {waitTime}
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
                View Patient
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/patients/${appointment.patient_id}?notes=true`}>
                <FileText className="mr-2 h-4 w-4" />
                Add Notes
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {appointment.status === 'scheduled' && (
              <DropdownMenuItem onClick={() => updateStatus('arrived')}>
                <User className="mr-2 h-4 w-4" />
                Mark Arrived
              </DropdownMenuItem>
            )}
            {appointment.status === 'arrived' && (
              <DropdownMenuItem onClick={() => updateStatus('in_progress')}>
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Visit
              </DropdownMenuItem>
            )}
            {appointment.status === 'in_progress' && (
              <DropdownMenuItem onClick={() => updateStatus('completed')}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete Visit
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
                  Cancel
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
