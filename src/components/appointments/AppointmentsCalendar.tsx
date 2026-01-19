import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addWeeks, subWeeks, addMonths, subMonths, isToday } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import type { Appointment } from '@/types/database';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface AppointmentsCalendarProps {
  appointments: Appointment[];
  onSelectAppointment?: (appointment: Appointment) => void;
}

export function AppointmentsCalendar({ appointments, onSelectAppointment }: AppointmentsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const { t, language } = useTranslation();
  const dateLocale = language === 'el' ? el : enUS;

  const days = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const monthDays = eachDayOfInterval({ start, end });
      
      // Add padding days from previous month
      const firstDayOfMonth = start.getDay();
      const paddingStart = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
      const startPadding = startOfWeek(start, { weekStartsOn: 1 });
      const paddingDays = eachDayOfInterval({ start: startPadding, end: new Date(start.getTime() - 1) });
      
      // Add padding days for end of month
      const lastDayOfMonth = end.getDay();
      const paddingEnd = lastDayOfMonth === 0 ? 0 : 7 - lastDayOfMonth;
      const endPadding = paddingEnd > 0 
        ? eachDayOfInterval({ start: new Date(end.getTime() + 1), end: endOfWeek(end, { weekStartsOn: 1 }) })
        : [];
      
      return [...paddingDays, ...monthDays, ...endPadding];
    }
  }, [currentDate, viewMode]);

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(apt => {
      if (!apt.scheduled_at) return false;
      return isSameDay(new Date(apt.scheduled_at), day);
    });
  };

  const navigatePrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-info/20 text-info border-info/30';
      case 'arrived': return 'bg-warning/20 text-warning border-warning/30';
      case 'in_progress': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'completed': return 'bg-success/20 text-success border-success/30';
      case 'cancelled': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekDayNamesEl = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];
  const dayNames = language === 'el' ? weekDayNamesEl : weekDayNames;

  return (
    <Card className="medical-card">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="font-display text-lg">
              {viewMode === 'week' 
                ? `${format(days[0], 'd MMM', { locale: dateLocale })} - ${format(days[days.length - 1], 'd MMM yyyy', { locale: dateLocale })}`
                : format(currentDate, 'MMMM yyyy', { locale: dateLocale })
              }
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              {language === 'el' ? 'Σήμερα' : 'Today'}
            </Button>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'week' | 'month')}>
              <TabsList>
                <TabsTrigger value="week">
                  {language === 'el' ? 'Εβδομάδα' : 'Week'}
                </TabsTrigger>
                <TabsTrigger value="month">
                  {language === 'el' ? 'Μήνας' : 'Month'}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {dayNames.map((day) => (
            <div 
              key={day} 
              className="px-2 py-3 text-center text-sm font-medium text-muted-foreground border-r border-border last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className={cn(
          "grid grid-cols-7",
          viewMode === 'week' ? 'min-h-[400px]' : ''
        )}>
          {days.map((day, index) => {
            const dayAppointments = getAppointmentsForDay(day);
            const isCurrentMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true;
            const isCurrentDay = isToday(day);
            
            return (
              <div 
                key={index}
                className={cn(
                  "border-r border-b border-border last:border-r-0 p-2 transition-colors",
                  viewMode === 'week' ? 'min-h-[400px]' : 'min-h-[100px]',
                  !isCurrentMonth && 'bg-muted/30',
                  isCurrentDay && 'bg-primary/5'
                )}
              >
                <div className={cn(
                  "mb-2 text-sm font-medium",
                  isCurrentDay && 'flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground mx-auto',
                  !isCurrentMonth && 'text-muted-foreground'
                )}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-1">
                  {dayAppointments.slice(0, viewMode === 'week' ? 10 : 3).map((apt) => (
                    <button
                      key={apt.id}
                      onClick={() => onSelectAppointment?.(apt)}
                      className={cn(
                        "w-full text-left px-2 py-1 rounded text-xs border transition-colors hover:opacity-80",
                        getStatusColor(apt.status)
                      )}
                    >
                      <div className="font-medium truncate">
                        {apt.scheduled_at && format(new Date(apt.scheduled_at), 'HH:mm')}
                        {' '}
                        {apt.patient?.first_name} {apt.patient?.last_name?.charAt(0)}.
                      </div>
                      {viewMode === 'week' && apt.reason_for_visit && (
                        <div className="text-[10px] truncate opacity-80">
                          {apt.reason_for_visit}
                        </div>
                      )}
                    </button>
                  ))}
                  
                  {dayAppointments.length > (viewMode === 'week' ? 10 : 3) && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{dayAppointments.length - (viewMode === 'week' ? 10 : 3)} {language === 'el' ? 'ακόμα' : 'more'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}