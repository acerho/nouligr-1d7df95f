import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { QrCode, Copy, ExternalLink, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

export default function QRSetup() {
  const { settings } = usePracticeSettings();
  const [checkInUrl, setCheckInUrl] = useState('');
  const { t } = useTranslation();

  useEffect(() => { setCheckInUrl(`${window.location.origin}/check-in`); }, []);

  const copyToClipboard = () => { navigator.clipboard.writeText(checkInUrl); toast.success(t.qrSetup.urlCopied); };
  const openCheckInPage = () => { window.open(checkInUrl, '_blank'); };
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkInUrl)}&bgcolor=ffffff&color=2d8a9e`;
  const downloadQR = () => { const link = document.createElement('a'); link.href = qrCodeUrl; link.download = 'check-in-qr-code.png'; document.body.appendChild(link); link.click(); document.body.removeChild(link); toast.success(t.qrSetup.qrDownloaded); };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div><h1 className="font-display text-2xl font-bold text-foreground">{t.qrSetup.title}</h1><p className="text-sm text-muted-foreground">{t.qrSetup.subtitle}</p></div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="medical-card">
            <CardHeader className="text-center"><CardTitle className="text-lg">{t.qrSetup.qrCode}</CardTitle><CardDescription>{t.qrSetup.qrDescription}</CardDescription></CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              <div className="overflow-hidden rounded-2xl border-4 border-primary/10 bg-white p-4 shadow-medical"><img src={qrCodeUrl} alt="Check-in QR Code" className="h-64 w-64" /></div>
              <div className="text-center"><p className="font-medium text-foreground">{settings?.practice_name || 'Medical Practice'}</p><p className="text-sm text-muted-foreground">{t.qrSetup.scanToCheckIn}</p></div>
              <Button onClick={downloadQR} variant="outline" className="gap-2"><Download className="h-4 w-4" />{t.qrSetup.downloadQR}</Button>
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card className="medical-card">
              <CardHeader><CardTitle className="text-lg">{t.qrSetup.checkInUrl}</CardTitle><CardDescription>{t.qrSetup.shareUrl}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2"><Input value={checkInUrl} readOnly className="font-mono text-sm" /><Button variant="outline" size="icon" onClick={copyToClipboard}><Copy className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={openCheckInPage}><ExternalLink className="h-4 w-4" /></Button></div>
              </CardContent>
            </Card>
            <Card className="medical-card">
              <CardHeader><CardTitle className="text-lg">{t.qrSetup.howItWorks}</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-4 text-sm">
                  <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">1</span><div><p className="font-medium text-foreground">{t.qrSetup.step1Title}</p><p className="text-muted-foreground">{t.qrSetup.step1Desc}</p></div></li>
                  <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">2</span><div><p className="font-medium text-foreground">{t.qrSetup.step2Title}</p><p className="text-muted-foreground">{t.qrSetup.step2Desc}</p></div></li>
                  <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">3</span><div><p className="font-medium text-foreground">{t.qrSetup.step3Title}</p><p className="text-muted-foreground">{t.qrSetup.step3Desc}</p></div></li>
                </ol>
              </CardContent>
            </Card>
            <Card className="medical-card border-info/30 bg-info/5"><CardContent className="flex gap-3 py-4"><QrCode className="h-5 w-5 shrink-0 text-info" /><p className="text-sm text-foreground"><span className="font-medium">{t.qrSetup.tip}</span> {t.qrSetup.tipText}</p></CardContent></Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
