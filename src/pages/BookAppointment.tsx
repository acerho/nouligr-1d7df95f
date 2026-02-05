import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Stethoscope, Phone, MapPin, Calendar, Clock, AlertTriangle, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import type { PracticeSettings, OperatingHours, DayHours, ShiftHours } from '@/types/database';
import { useTranslation } from '@/hooks/useTranslation';
import { format, addDays } from 'date-fns';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const SLOT_DURATION_MINUTES = 30;

function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = [];
  const [openHour, openMin] = openTime.split(':').map(Number);
  const [closeHour, closeMin] = closeTime.split(':').map(Number);
  
  let currentHour = openHour;
  let currentMin = openMin;
  
  while (currentHour < closeHour || (currentHour === closeHour && currentMin < closeMin)) {
    slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`);
    currentMin += SLOT_DURATION_MINUTES;
    if (currentMin >= 60) {
      currentHour += 1;
      currentMin -= 60;
    }
  }
  
  return slots;
}

function getDayName(date: Date): keyof OperatingHours {
  const days: (keyof OperatingHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

type BookingStep = 'form' | 'verify' | 'success';

export default function BookAppointment() {
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<BookingStep>('form');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const { t, language } = useTranslation();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    reasonForVisit: '',
    selectedDate: '',
    selectedTime: '',
  });

  // Helper function to migrate old operating hours format to new format
  const migrateOperatingHours = (hours: any): OperatingHours => {
    const days: (keyof OperatingHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const migrated: any = {};
    
    for (const day of days) {
      const dayData = hours[day];
      
      // Check if it's old format (has 'enabled' directly on day)
      if (dayData && typeof dayData.enabled === 'boolean' && !dayData.morning) {
        // Migrate old format to new format
        migrated[day] = {
          morning: {
            open: dayData.open || '09:00',
            close: dayData.close || '17:00',
            enabled: dayData.enabled
          },
          evening: {
            open: '17:00',
            close: '21:00',
            enabled: false
          }
        };
      } else if (dayData && dayData.morning) {
        // Already in new format
        migrated[day] = dayData;
      } else {
        // Use default
        migrated[day] = {
          morning: { open: '09:00', close: '13:00', enabled: false },
          evening: { open: '17:00', close: '21:00', enabled: false }
        };
      }
    }
    
    return migrated as OperatingHours;
  };

  // Check if a day has any enabled shifts
  const isDayEnabled = (dayHours: DayHours): boolean => {
    if (!dayHours || !dayHours.morning || !dayHours.evening) return false;
    return dayHours.morning.enabled || dayHours.evening.enabled;
  };

  // Get the latest closing time for a day
  const getLatestCloseTime = (dayHours: DayHours): string => {
    if (dayHours.evening?.enabled) return dayHours.evening.close;
    if (dayHours.morning?.enabled) return dayHours.morning.close;
    return '00:00';
  };

  // Generate available dates (today + next 14 days, filtered by operating hours)
  const availableDates = useMemo(() => {
    if (!settings?.operating_hours) return [];
    
    const dates: { date: Date; label: string; dayKey: keyof OperatingHours }[] = [];
    const rawHours = settings.operating_hours;
    const operatingHours = migrateOperatingHours(rawHours);
    const now = new Date();
    
    // Start from today (i = 0) to allow same-day bookings
    for (let i = 0; i <= 14; i++) {
      const date = addDays(new Date(), i);
      const dayKey = getDayName(date);
      const dayHours = operatingHours[dayKey];
      
      if (dayHours && isDayEnabled(dayHours)) {
        // For today, check if there's still time left before closing
        if (i === 0) {
          const closeTime = getLatestCloseTime(dayHours);
          const [closeHour, closeMin] = closeTime.split(':').map(Number);
          const closeDate = new Date();
          closeDate.setHours(closeHour, closeMin, 0, 0);
          
          // Skip today if already past closing time
          if (now >= closeDate) continue;
        }
        
        dates.push({
          date,
          label: i === 0 ? `${t.bookAppointment.today}, ${format(date, 'MMM d')}` : format(date, 'EEE, MMM d'),
          dayKey,
        });
      }
    }
    
    return dates;
  }, [settings?.operating_hours]);

  // Generate time slots for selected date (combining morning and evening shifts)
  const availableTimeSlots = useMemo(() => {
    if (!formData.selectedDate || !settings?.operating_hours) return [];
    
    const selectedDate = new Date(formData.selectedDate);
    const dayKey = getDayName(selectedDate);
    const rawHours = settings.operating_hours;
    const operatingHours = migrateOperatingHours(rawHours);
    const dayHours = operatingHours[dayKey];
    
    if (!dayHours || !isDayEnabled(dayHours)) return [];
    
    // Generate slots for both shifts
    let allSlots: string[] = [];
    
    if (dayHours.morning?.enabled) {
      allSlots = [...allSlots, ...generateTimeSlots(dayHours.morning.open, dayHours.morning.close)];
    }
    
    if (dayHours.evening?.enabled) {
      allSlots = [...allSlots, ...generateTimeSlots(dayHours.evening.open, dayHours.evening.close)];
    }
    
    const now = new Date();
    const isToday = format(selectedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
    
    // Filter out already booked slots and past time slots for today
    return allSlots.filter(slot => {
      // Check if slot is already booked - compare just the time (HH:mm)
      if (bookedSlots.includes(slot)) return false;
      
      // For today, filter out past time slots (with 30 min buffer)
      if (isToday) {
        const [slotHour, slotMin] = slot.split(':').map(Number);
        const slotTime = new Date();
        slotTime.setHours(slotHour, slotMin, 0, 0);
        
        // Add 30 minute buffer - can't book slots less than 30 mins away
        const bufferTime = new Date(now.getTime() + 30 * 60 * 1000);
        if (slotTime <= bufferTime) return false;
      }
      
      return true;
    });
  }, [formData.selectedDate, settings?.operating_hours, bookedSlots]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Use the public view which excludes sensitive API keys
        const { data, error } = await supabase
          .from('practice_settings_public')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setSettings(data as PracticeSettings);
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Fetch booked appointments when date changes
  useEffect(() => {
    const fetchBookedSlots = async () => {
      if (!formData.selectedDate) return;
      
      const startOfSelectedDay = new Date(formData.selectedDate);
      startOfSelectedDay.setHours(0, 0, 0, 0);
      const endOfSelectedDay = new Date(formData.selectedDate);
      endOfSelectedDay.setHours(23, 59, 59, 999);
      
      const { data } = await supabase
        .from('appointments')
        .select('scheduled_at')
        .gte('scheduled_at', startOfSelectedDay.toISOString())
        .lte('scheduled_at', endOfSelectedDay.toISOString())
        .in('status', ['scheduled', 'arrived', 'in_progress']);
      
      if (data) {
        // Extract just the time (HH:mm) from each appointment in local timezone
        const slots = data
          .filter(apt => apt.scheduled_at)
          .map(apt => {
            const date = new Date(apt.scheduled_at!);
            // Return just the time portion in HH:mm format
            return format(date, 'HH:mm');
          });
        setBookedSlots(slots);
      }
    };
    
    fetchBookedSlots();
  }, [formData.selectedDate]);

  // Auto-redirect after successful booking
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        setStep('form');
        setVerificationCode('');
        setFormData({ firstName: '', lastName: '', phone: '', email: '', reasonForVisit: '', selectedDate: '', selectedTime: '' });
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [step]);

  const sendVerificationCode = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('send-verification-code', {
        body: {
          phone: formData.phone,
          patientName: `${formData.firstName} ${formData.lastName}`,
          language: language,
        },
      });

      if (error) throw error;

      toast.success(t.bookAppointment.verificationCodeSent);
      setStep('verify');
    } catch (error) {
      console.error('Error sending verification code:', error);
      toast.error(t.bookAppointment.failedToSendCode);
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    setResending(true);
    try {
      const { error } = await supabase.functions.invoke('send-verification-code', {
        body: {
          phone: formData.phone,
          patientName: `${formData.firstName} ${formData.lastName}`,
          language: language,
        },
      });

      if (error) throw error;

      toast.success(t.bookAppointment.newCodeSent);
    } catch (error) {
      console.error('Error resending code:', error);
      toast.error(t.bookAppointment.failedToResend);
    } finally {
      setResending(false);
    }
  };

  const verifyAndBook = async () => {
    if (verificationCode.length !== 4) {
      toast.error(t.bookAppointment.enterFullCode);
      return;
    }

    setVerifying(true);
    try {
      // Verify the code
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-code', {
        body: {
          phone: formData.phone,
          code: verificationCode,
        },
      });

      if (verifyError) throw verifyError;

      if (!verifyData?.verified) {
        toast.error(t.bookAppointment.invalidCode);
        setVerifying(false);
        return;
      }

      // Find or create patient
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('first_name', formData.firstName)
        .eq('last_name', formData.lastName)
        .maybeSingle();

      let patientId: string;

      if (existingPatient) {
        patientId = existingPatient.id;
        // Update phone and email if provided
        await supabase
          .from('patients')
          .update({ 
            phone: formData.phone || null,
            email: formData.email,
          })
          .eq('id', patientId);
      } else {
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone || null,
            email: formData.email,
          })
          .select('id')
          .single();

        if (patientError) throw patientError;
        patientId = newPatient.id;
      }

      // Create scheduled appointment
      const [hours, minutes] = formData.selectedTime.split(':').map(Number);
      const scheduledAt = new Date(formData.selectedDate);
      scheduledAt.setHours(hours, minutes, 0, 0);

      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patientId,
          status: 'scheduled',
          reason_for_visit: formData.reasonForVisit || null,
          scheduled_at: scheduledAt.toISOString(),
          booking_source: 'patient',
        });

      if (appointmentError) throw appointmentError;

      // Send confirmation SMS to patient
      const formattedDate = format(scheduledAt, 'EEEE, MMMM d, yyyy');
      const formattedTime = formData.selectedTime;
      
      try {
        await supabase.functions.invoke('send-booking-confirmation', {
          body: {
            phone: formData.phone,
            patientName: `${formData.firstName} ${formData.lastName}`,
            appointmentDate: formattedDate,
            appointmentTime: formattedTime,
            practiceName: settings?.practice_name || 'Medical Practice',
            practiceAddress: settings?.address || undefined,
            practicePhone: settings?.phone_number || undefined,
            reasonForVisit: formData.reasonForVisit || undefined,
            language: language,
          },
        });
        console.log('Confirmation SMS sent to patient');
      } catch (confirmError) {
        console.error('Failed to send confirmation SMS:', confirmError);
        // Don't fail the booking if confirmation fails
      }

      setStep('success');
      toast.success(t.bookAppointment.appointmentSuccess);
    } catch (error) {
      console.error('Error booking appointment:', error);
      toast.error(t.bookAppointment.appointmentFailed);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName) {
      toast.error(t.checkIn.enterName);
      return;
    }

    if (!formData.phone) {
      toast.error(t.bookAppointment.enterPhone);
      return;
    }

    // Basic phone validation - at least 10 digits
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error(t.bookAppointment.invalidPhone);
      return;
    }

    if (!formData.selectedDate || !formData.selectedTime) {
      toast.error(t.bookAppointment.selectDateTime);
      return;
    }

    await sendVerificationCode();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if practice is closed
  if (settings?.is_closed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="medical-card w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-warning/10">
              <AlertTriangle className="h-10 w-10 text-warning" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {t.bookAppointment.practiceClosed}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {settings.closure_reason || t.bookAppointment.practiceClosedDefault}
            </p>
            <div className="mt-6 text-sm text-muted-foreground">
              <p className="font-medium">{settings.practice_name}</p>
              {settings.phone_number && (
                <p className="flex items-center justify-center gap-1 mt-1">
                  <Phone className="h-4 w-4" /> {settings.phone_number}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verification step
  if (step === 'verify') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="medical-card w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-display text-xl">{t.bookAppointment.verifyPhone}</CardTitle>
            <CardDescription>
              {t.bookAppointment.codeSentTo}<br />
              <span className="font-medium text-foreground">{formData.phone}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={4}
                value={verificationCode}
                onChange={setVerificationCode}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={verifyAndBook}
              className="w-full"
              size="lg"
              disabled={verifying || verificationCode.length !== 4}
            >
              {verifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.bookAppointment.verifying}</>
              ) : (
                t.bookAppointment.verifyAndBook
              )}
            </Button>

            <div className="flex flex-col items-center gap-2 text-sm">
              <p className="text-muted-foreground">{t.bookAppointment.didntReceiveCode}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={resendCode}
                disabled={resending}
              >
                {resending ? t.bookAppointment.sending : t.bookAppointment.resendCode}
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep('form');
                setVerificationCode('');
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.bookAppointment.backToForm}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success step
  if (step === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="medical-card w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {t.bookAppointment.appointmentBooked}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t.bookAppointment.appointmentScheduledFor}
            </p>
            <div className="mt-4 rounded-lg bg-muted/50 p-4">
              <p className="font-medium text-foreground">
                {format(new Date(formData.selectedDate), 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-primary font-bold text-lg">
                {formData.selectedTime}
              </p>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {t.bookAppointment.confirmationSentTo} {formData.email}.<br />
              {t.bookAppointment.arriveEarly}
            </p>
            <Button 
              variant="outline" 
              className="mt-8"
              onClick={() => {
                setStep('form');
                setVerificationCode('');
                setFormData({ firstName: '', lastName: '', phone: '', email: '', reasonForVisit: '', selectedDate: '', selectedTime: '' });
              }}
            >
              {t.bookAppointment.bookAnother}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background p-4">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <div className="mx-auto max-w-lg animate-slide-up">
        <div className="mb-8 text-center">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Practice Logo" className="mx-auto mb-4 h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary">
              <Stethoscope className="h-8 w-8 text-primary-foreground" />
            </div>
          )}
          <h1 className="font-display text-2xl font-bold text-foreground">
            {settings?.practice_name || 'Medical Practice'}
          </h1>
          {settings?.doctor_name && <p className="mt-1 text-muted-foreground">{settings.doctor_name}</p>}
          {settings?.specialty && <p className="text-sm text-muted-foreground">{settings.specialty}</p>}
        </div>

        {(settings?.phone_number || settings?.address) && (
          <div className="mb-6 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            {settings.phone_number && <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{settings.phone_number}</span>}
            {settings.address && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{settings.address.split('\n')[0]}</span>}
          </div>
        )}

        <Card className="medical-card">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-xl flex items-center justify-center gap-2">
              <Calendar className="h-5 w-5" />
              {t.bookAppointment.title}
            </CardTitle>
            <CardDescription>{t.bookAppointment.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t.appointments.firstName} *</Label>
                  <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t.appointments.lastName} *</Label>
                  <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {t.bookAppointment.emailAddress} *
                </Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} 
                  placeholder={t.bookAppointment.emailPlaceholder}
                  required 
                />
                <p className="text-xs text-muted-foreground">
                  {t.bookAppointment.emailConfirmationNote}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {t.appointments.phoneNumber} *
                </Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                    +30
                  </span>
                  <Input 
                    id="phone" 
                    type="tel" 
                    className="rounded-l-none"
                    value={formData.phone} 
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} 
                    placeholder="6912345678"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.bookAppointment.smsVerificationNote}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">{t.bookAppointment.selectDate} *</Label>
                <Select 
                  value={formData.selectedDate} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, selectedDate: value, selectedTime: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.bookAppointment.chooseDate} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.length === 0 ? (
                      <SelectItem value="none" disabled>{t.bookAppointment.noAvailableDates}</SelectItem>
                    ) : (
                      availableDates.map(({ date, label }) => (
                        <SelectItem key={date.toISOString()} value={format(date, 'yyyy-MM-dd')}>
                          {label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {formData.selectedDate && (
                <div className="space-y-2">
                  <Label>{t.bookAppointment.selectTime} *</Label>
                  {availableTimeSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">{t.bookAppointment.noAvailableSlots}</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableTimeSlots.map((time) => (
                        <Button
                          key={time}
                          type="button"
                          variant={formData.selectedTime === time ? 'default' : 'outline'}
                          size="sm"
                          className="text-sm"
                          onClick={() => setFormData(prev => ({ ...prev, selectedTime: time }))}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {time}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">{t.appointments.reasonForVisit}</Label>
                <Textarea 
                  id="reason" 
                  value={formData.reasonForVisit} 
                  onChange={(e) => setFormData(prev => ({ ...prev, reasonForVisit: e.target.value }))} 
                  placeholder={t.bookAppointment.reasonPlaceholder}
                  rows={3} 
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg" 
                disabled={submitting || !formData.selectedDate || !formData.selectedTime || !formData.email}
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.bookAppointment.sendingVerification}</>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    {t.bookAppointment.continueToVerification}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
