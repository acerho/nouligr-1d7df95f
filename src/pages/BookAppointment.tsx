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
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    reasonForVisit: '',
    selectedDate: '',
    selectedTime: '',
  });

  // Check if a day has any enabled shifts
  const isDayEnabled = (dayHours: DayHours): boolean => {
    return dayHours.morning.enabled || dayHours.evening.enabled;
  };

  // Get the latest closing time for a day
  const getLatestCloseTime = (dayHours: DayHours): string => {
    if (dayHours.evening.enabled) return dayHours.evening.close;
    if (dayHours.morning.enabled) return dayHours.morning.close;
    return '00:00';
  };

  // Generate available dates (today + next 14 days, filtered by operating hours)
  const availableDates = useMemo(() => {
    if (!settings?.operating_hours) return [];
    
    const dates: { date: Date; label: string; dayKey: keyof OperatingHours }[] = [];
    const operatingHours = settings.operating_hours as OperatingHours;
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
          label: i === 0 ? `Today, ${format(date, 'MMM d')}` : format(date, 'EEE, MMM d'),
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
    const operatingHours = settings.operating_hours as OperatingHours;
    const dayHours = operatingHours[dayKey];
    
    if (!dayHours || !isDayEnabled(dayHours)) return [];
    
    // Generate slots for both shifts
    let allSlots: string[] = [];
    
    if (dayHours.morning.enabled) {
      allSlots = [...allSlots, ...generateTimeSlots(dayHours.morning.open, dayHours.morning.close)];
    }
    
    if (dayHours.evening.enabled) {
      allSlots = [...allSlots, ...generateTimeSlots(dayHours.evening.open, dayHours.evening.close)];
    }
    
    const now = new Date();
    const isToday = format(selectedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
    
    // Filter out already booked slots and past time slots for today
    return allSlots.filter(slot => {
      // Check if slot is already booked
      if (bookedSlots.includes(`${formData.selectedDate}T${slot}`)) return false;
      
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
        const { data, error } = await supabase
          .from('practice_settings')
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
        .not('status', 'eq', 'cancelled');
      
      if (data) {
        const slots = data
          .filter(apt => apt.scheduled_at)
          .map(apt => {
            const date = new Date(apt.scheduled_at!);
            return `${format(date, 'yyyy-MM-dd')}T${format(date, 'HH:mm')}`;
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
          email: formData.email,
          patientName: `${formData.firstName} ${formData.lastName}`,
        },
      });

      if (error) throw error;

      toast.success('Verification code sent to your email');
      setStep('verify');
    } catch (error) {
      console.error('Error sending verification code:', error);
      toast.error('Failed to send verification code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    setResending(true);
    try {
      const { error } = await supabase.functions.invoke('send-verification-code', {
        body: {
          email: formData.email,
          patientName: `${formData.firstName} ${formData.lastName}`,
        },
      });

      if (error) throw error;

      toast.success('New verification code sent');
    } catch (error) {
      console.error('Error resending code:', error);
      toast.error('Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const verifyAndBook = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setVerifying(true);
    try {
      // Verify the code
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-code', {
        body: {
          email: formData.email,
          code: verificationCode,
        },
      });

      if (verifyError) throw verifyError;

      if (!verifyData?.verified) {
        toast.error('Invalid or expired verification code');
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

      setStep('success');
      toast.success('Appointment booked successfully!');
    } catch (error) {
      console.error('Error booking appointment:', error);
      toast.error('Failed to book appointment. Please try again.');
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

    if (!formData.email) {
      toast.error('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!formData.selectedDate || !formData.selectedTime) {
      toast.error('Please select a date and time for your appointment');
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
              Practice Temporarily Closed
            </h2>
            <p className="mt-2 text-muted-foreground">
              {settings.closure_reason || 'We are currently not accepting new appointments. Please check back later.'}
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
            <CardTitle className="font-display text-xl">Verify Your Email</CardTitle>
            <CardDescription>
              We've sent a 6-digit code to<br />
              <span className="font-medium text-foreground">{formData.email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={verificationCode}
                onChange={setVerificationCode}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={verifyAndBook}
              className="w-full"
              size="lg"
              disabled={verifying || verificationCode.length !== 6}
            >
              {verifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
              ) : (
                'Verify & Book Appointment'
              )}
            </Button>

            <div className="flex flex-col items-center gap-2 text-sm">
              <p className="text-muted-foreground">Didn't receive the code?</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={resendCode}
                disabled={resending}
              >
                {resending ? 'Sending...' : 'Resend Code'}
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
              Back to Form
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
              Appointment Booked!
            </h2>
            <p className="mt-2 text-muted-foreground">
              Your appointment has been scheduled for:
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
              A confirmation has been sent to {formData.email}.<br />
              Please arrive 10 minutes before your scheduled time.
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
              Book Another Appointment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
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
              Book an Appointment
            </CardTitle>
            <CardDescription>Select a convenient date and time for your visit</CardDescription>
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
                  Email Address *
                </Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} 
                  placeholder="your@email.com"
                  required 
                />
                <p className="text-xs text-muted-foreground">
                  We'll send a verification code to confirm your booking
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">{t.appointments.phoneNumber}</Label>
                <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Select Date *</Label>
                <Select 
                  value={formData.selectedDate} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, selectedDate: value, selectedTime: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a date" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.length === 0 ? (
                      <SelectItem value="none" disabled>No available dates</SelectItem>
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
                  <Label>Select Time *</Label>
                  {availableTimeSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No available time slots for this date</p>
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
                  placeholder="Briefly describe your symptoms or reason for visit"
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
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending Verification...</>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Continue to Verification
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
