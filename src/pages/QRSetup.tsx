import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { QrCode, Copy, ExternalLink, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

export default function QRSetup() {
  const { settings } = usePracticeSettings();
  const [bookingUrl, setBookingUrl] = useState('');
  const { t } = useTranslation();

  useEffect(() => { setBookingUrl(`${window.location.origin}/book`); }, []);

  const copyToClipboard = () => { navigator.clipboard.writeText(bookingUrl); toast.success('URL copied to clipboard'); };
  const openBookingPage = () => { window.open(bookingUrl, '_blank'); };
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(bookingUrl)}&bgcolor=ffffff&color=2d8a9e`;
  const downloadQR = () => { const link = document.createElement('a'); link.href = qrCodeUrl; link.download = 'appointment-booking-qr.png'; document.body.appendChild(link); link.click(); document.body.removeChild(link); toast.success('QR Code downloaded'); };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Appointment Booking QR Code
          </h1>
          <p className="text-sm text-muted-foreground">Let patients book appointments by scanning this QR code</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="medical-card">
            <CardHeader className="text-center">
              <CardTitle className="text-lg">QR Code</CardTitle>
              <CardDescription>Patients can scan this to book appointments online</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              <div className="overflow-hidden rounded-2xl border-4 border-primary/10 bg-white p-4 shadow-medical">
                <img src={qrCodeUrl} alt="Appointment Booking QR Code" className="h-64 w-64" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{settings?.practice_name || 'Medical Practice'}</p>
                <p className="text-sm text-muted-foreground">Scan to book an appointment</p>
              </div>
              <Button onClick={downloadQR} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download QR Code
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card className="medical-card">
              <CardHeader>
                <CardTitle className="text-lg">Booking URL</CardTitle>
                <CardDescription>Share this link with your patients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input value={bookingUrl} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={copyToClipboard}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={openBookingPage}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="medical-card">
              <CardHeader>
                <CardTitle className="text-lg">How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4 text-sm">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">1</span>
                    <div>
                      <p className="font-medium text-foreground">Patient Scans QR Code</p>
                      <p className="text-muted-foreground">Using their phone camera or a QR scanner app</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">2</span>
                    <div>
                      <p className="font-medium text-foreground">Select Date & Time</p>
                      <p className="text-muted-foreground">Based on your practice's operating hours and availability</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">3</span>
                    <div>
                      <p className="font-medium text-foreground">Appointment Confirmed</p>
                      <p className="text-muted-foreground">The appointment appears on your dashboard automatically</p>
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>
            <Card className="medical-card border-info/30 bg-info/5">
              <CardContent className="flex gap-3 py-4">
                <QrCode className="h-5 w-5 shrink-0 text-info" />
                <p className="text-sm text-foreground">
                  <span className="font-medium">Tip:</span> Print this QR code and display it at your reception desk, waiting room, or on business cards to make booking easy for patients.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
