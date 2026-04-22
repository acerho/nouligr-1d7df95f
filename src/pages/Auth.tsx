import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Stethoscope, Loader2, CalendarPlus } from 'lucide-react';
import { api } from '@/lib/api';
import type { PracticeSettings } from '@/types/database';
import QRCode from 'react-qr-code';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [practiceName, setPracticeName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const { signIn, user, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch practice settings (public)
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api<Partial<PracticeSettings>>('/api/settings.php');
        if (data) {
          setPracticeName(data.practice_name ?? null);
          setLogoUrl(data.logo_url ?? null);
          setBookingEnabled(data.booking_enabled !== false);
        }
      } catch {
        /* ignore */
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
      if (/invalid|incorrect|wrong/i.test(error.message)) {
        toast.error(t.auth.invalidCredentials);
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(t.auth.welcomeBack);
      navigate('/dashboard');
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      toast.error(language === 'el' ? 'Εισάγετε email' : 'Enter your email');
      return;
    }
    setForgotSubmitting(true);
    const { error } = await requestPasswordReset(forgotEmail.trim());
    setForgotSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(language === 'el'
        ? 'Αν το email υπάρχει, θα λάβετε σύνδεσμο επαναφοράς.'
        : 'If the email exists, you will receive a reset link.');
      setForgotOpen(false);
      setForgotEmail('');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
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

        {/* Guest Booking Section */}
        {bookingEnabled && (
          <div className="mb-6 text-center space-y-4">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-lg border bg-card p-3 shadow-sm">
                <QRCode 
                  value={`${window.location.origin}/book`}
                  size={120}
                  level="M"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.auth.scanToBook || 'Scan to book appointment'}
              </p>
              <Button asChild variant="outline" className="w-full max-w-xs">
                <Link to="/book">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  {t.auth.bookAppointment || 'Book Appointment'}
                </Link>
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t.auth.staffLogin || 'Staff Login'}
                </span>
              </div>
            </div>
          </div>
        )}

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
              <button
                type="button"
                onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                className="block w-full text-center text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                {language === 'el' ? 'Ξεχάσατε τον κωδικό;' : 'Forgot password?'}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'el' ? 'Επαναφορά κωδικού' : 'Reset password'}</DialogTitle>
            <DialogDescription>
              {language === 'el'
                ? 'Θα σας στείλουμε σύνδεσμο επαναφοράς στο email σας.'
                : "We'll email you a link to reset your password."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              disabled={forgotSubmitting}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotOpen(false)} disabled={forgotSubmitting}>
              {language === 'el' ? 'Άκυρο' : 'Cancel'}
            </Button>
            <Button onClick={handleForgotPassword} disabled={forgotSubmitting}>
              {forgotSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{language === 'el' ? 'Αποστολή...' : 'Sending...'}</> : (language === 'el' ? 'Αποστολή συνδέσμου' : 'Send reset link')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
