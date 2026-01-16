import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Stethoscope, Phone, MapPin } from 'lucide-react';
import type { PracticeSettings } from '@/types/database';
import { useTranslation } from '@/hooks/useTranslation';

export default function CheckIn() {
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    reasonForVisit: '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName) {
      toast.error(t.checkIn.enterName);
      return;
    }

    setSubmitting(true);
    try {
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('first_name', formData.firstName)
        .eq('last_name', formData.lastName)
        .maybeSingle();

      let patientId: string;

      if (existingPatient) {
        patientId = existingPatient.id;
      } else {
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone || null,
          })
          .select('id')
          .single();

        if (patientError) throw patientError;
        patientId = newPatient.id;
      }

      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patientId,
          status: 'arrived',
          reason_for_visit: formData.reasonForVisit || null,
          checked_in_at: new Date().toISOString(),
        });

      if (appointmentError) throw appointmentError;

      setSubmitted(true);
      toast.success(t.checkIn.checkInSuccess);
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error(t.checkIn.checkInError);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="medical-card w-full max-w-md text-center">
          <CardContent className="py-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {t.checkIn.checkedIn}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t.checkIn.takeASeat}
            </p>
            <Button 
              variant="outline" 
              className="mt-8"
              onClick={() => {
                setSubmitted(false);
                setFormData({ firstName: '', lastName: '', phone: '', reasonForVisit: '' });
              }}
            >
              {t.checkIn.checkInAnother}
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
            <CardTitle className="font-display text-xl">{t.checkIn.title}</CardTitle>
            <CardDescription>{t.checkIn.subtitle}</CardDescription>
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
                <Label htmlFor="phone">{t.appointments.phoneNumber}</Label>
                <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">{t.appointments.reasonForVisit}</Label>
                <Textarea id="reason" value={formData.reasonForVisit} onChange={(e) => setFormData(prev => ({ ...prev, reasonForVisit: e.target.value }))} placeholder={t.checkIn.reasonPlaceholder} rows={3} />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.checkIn.checkingIn}</> : t.checkIn.checkInButton}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
