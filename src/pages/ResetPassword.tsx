import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Stethoscope, KeyRound } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useTranslation();
  const token = params.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validToken, setValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setValidToken(false);
      return;
    }
    api<{ valid: boolean }>('/api/auth.php', { query: { action: 'verify-reset-token', token } })
      .then((res) => setValidToken(!!res.valid))
      .catch(() => setValidToken(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{12,}$/;
    if (!passwordRegex.test(newPassword)) {
      toast.error(language === 'el'
        ? 'Ο κωδικός πρέπει να έχει τουλάχιστον 12 χαρακτήρες με κεφαλαία, πεζά, αριθμό και ειδικό χαρακτήρα'
        : 'Password must be at least 12 characters with uppercase, lowercase, number, and special character');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(language === 'el' ? 'Οι κωδικοί δεν ταιριάζουν' : 'Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/auth.php', {
        method: 'POST',
        query: { action: 'reset-password' },
        body: { token, new_password: newPassword },
      });
      toast.success(language === 'el' ? 'Ο κωδικός ενημερώθηκε. Συνδεθείτε με τον νέο κωδικό.' : 'Password updated. Please sign in with your new password.');
      navigate('/auth');
    } catch (e) {
      toast.error((e as ApiError).message || (language === 'el' ? 'Αποτυχία ενημέρωσης' : 'Failed to update password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-medical">
            <Stethoscope className="h-7 w-7 text-primary-foreground" />
          </div>
        </div>

        <Card className="medical-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {language === 'el' ? 'Επαναφορά κωδικού' : 'Reset password'}
            </CardTitle>
            <CardDescription>
              {language === 'el'
                ? 'Επιλέξτε νέο κωδικό για τον λογαριασμό σας'
                : 'Choose a new password for your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {validToken === null ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : !validToken ? (
              <div className="space-y-4 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {language === 'el'
                    ? 'Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος ή έχει λήξει.'
                    : 'This reset link is invalid or has expired.'}
                </p>
                <Button onClick={() => navigate('/auth')}>
                  {language === 'el' ? 'Επιστροφή στη σύνδεση' : 'Back to sign in'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new">{language === 'el' ? 'Νέος κωδικός' : 'New password'}</Label>
                  <Input id="new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={submitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">{language === 'el' ? 'Επιβεβαίωση κωδικού' : 'Confirm password'}</Label>
                  <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={submitting} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{language === 'el' ? 'Αποθήκευση...' : 'Saving...'}</> : (language === 'el' ? 'Αποθήκευση κωδικού' : 'Save password')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}