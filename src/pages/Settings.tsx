import { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Save, Loader2, Building2, Phone, MapPin, Stethoscope, Languages } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings, loading } = usePracticeSettings();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    doctor_name: settings?.doctor_name || '',
    practice_name: settings?.practice_name || '',
    phone_number: settings?.phone_number || '',
    address: settings?.address || '',
    specialty: settings?.specialty || '',
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('app_language') || 'en';
  });

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    localStorage.setItem('app_language', value);
    toast.success(value === 'el' ? 'Η γλώσσα άλλαξε σε Ελληνικά' : 'Language changed to English');
  };

  // Update form when settings load
  useState(() => {
    if (settings) {
      setFormData({
        doctor_name: settings.doctor_name || '',
        practice_name: settings.practice_name || '',
        phone_number: settings.phone_number || '',
        address: settings.address || '',
        specialty: settings.specialty || '',
      });
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateSettings(formData);
    setSaving(false);
    
    if (error) {
      toast.error('Failed to save settings');
    } else {
      toast.success('Settings saved successfully');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('practice-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('practice-assets')
        .getPublicUrl(fileName);

      await updateSettings({ logo_url: publicUrl });
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your practice information and preferences
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Logo Upload Card */}
          <Card className="medical-card">
            <CardHeader>
              <CardTitle className="text-lg">Practice Logo</CardTitle>
              <CardDescription>
                Upload your practice logo to display across the app
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="relative h-32 w-32 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted">
                {settings?.logo_url ? (
                  <img 
                    src={settings.logo_url} 
                    alt="Practice Logo" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2 className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Logo
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Practice Details Card */}
          <Card className="medical-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Practice Details</CardTitle>
              <CardDescription>
                This information will be displayed on patient-facing pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="practice_name" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Practice Name
                  </Label>
                  <Input
                    id="practice_name"
                    name="practice_name"
                    value={formData.practice_name}
                    onChange={handleInputChange}
                    placeholder="Enter practice name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doctor_name" className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    Doctor's Name
                  </Label>
                  <Input
                    id="doctor_name"
                    name="doctor_name"
                    value={formData.doctor_name}
                    onChange={handleInputChange}
                    placeholder="Dr. John Smith"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone_number" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone_number"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty" className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    Specialty
                  </Label>
                  <Input
                    id="specialty"
                    name="specialty"
                    value={formData.specialty}
                    onChange={handleInputChange}
                    placeholder="General Medicine"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Address
                </Label>
                <Textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="123 Medical Center Drive, Suite 100&#10;City, State 12345"
                  rows={3}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Language Settings Card */}
          <Card className="medical-card lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Language / Γλώσσα</CardTitle>
              <CardDescription>
                Select your preferred language for the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs space-y-2">
                <Label htmlFor="language" className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  Display Language
                </Label>
                <Select value={language} onValueChange={handleLanguageChange}>
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">
                      <span className="flex items-center gap-2">
                        🇬🇧 English
                      </span>
                    </SelectItem>
                    <SelectItem value="el">
                      <span className="flex items-center gap-2">
                        🇬🇷 Ελληνικά (Greek)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
