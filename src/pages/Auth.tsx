import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Stethoscope, Loader2, CalendarPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [practiceName, setPracticeName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch practice settings from public view
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('practice_settings_public')
        .select('practice_name, logo_url')
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setPracticeName(data.practice_name);
        setLogoUrl(data.logo_url);
      }
    };
    fetchSettings();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t.auth.fillAllFields);
      return;
    }
    
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error(t.auth.invalidCredentials);
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(t.auth.welcomeBack);
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={practiceName || t.auth.medicalOffice} 
              className="mx-auto mb-4 h-14 w-auto object-contain"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-medical">
              <Stethoscope className="h-7 w-7 text-primary-foreground" />
            </div>
          )}
          <h1 className="font-display text-2xl font-bold text-foreground">
            {practiceName || t.auth.medicalOffice}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.auth.practiceManagement}
          </p>
        </div>

        <Card className="medical-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-center">{t.auth.signIn}</CardTitle>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">{t.auth.email}</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder={t.auth.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">{t.auth.password}</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.auth.signingIn}
                  </>
                ) : (
                  t.auth.signIn
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Guest Booking Section */}
        <div className="mt-6 text-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t.auth.orBookAppointment || 'Or book an appointment'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="rounded-lg border bg-card p-3 shadow-sm">
              <QRCodeSVG 
                value={`${window.location.origin}/book`}
                size={120}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t.auth.scanToBook || 'Scan to book appointment'}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/book">
                <CalendarPlus className="mr-2 h-4 w-4" />
                {t.auth.bookAppointment || 'Book Appointment'}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
