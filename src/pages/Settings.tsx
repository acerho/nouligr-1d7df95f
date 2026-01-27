import { useState, useRef, useEffect } from 'react';
// Settings page for practice configuration
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Save, Loader2, Building2, Phone, MapPin, Stethoscope, Languages, Plus, Trash2, FileText, Clock, AlertTriangle, Palette } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme, themeConfigs, type ThemeColor } from '@/hooks/useTheme';
import type { CustomPatientField, ShiftHours, DayHours, OperatingHours } from '@/types/database';

const defaultShift: ShiftHours = { open: '09:00', close: '13:00', enabled: true };
const defaultEveningShift: ShiftHours = { open: '17:00', close: '21:00', enabled: false };

const defaultOperatingHours: OperatingHours = {
  monday: { morning: { ...defaultShift }, evening: { ...defaultEveningShift } },
  tuesday: { morning: { ...defaultShift }, evening: { ...defaultEveningShift } },
  wednesday: { morning: { ...defaultShift }, evening: { ...defaultEveningShift } },
  thursday: { morning: { ...defaultShift }, evening: { ...defaultEveningShift } },
  friday: { morning: { ...defaultShift }, evening: { ...defaultEveningShift } },
  saturday: { morning: { open: '09:00', close: '13:00', enabled: false }, evening: { open: '17:00', close: '21:00', enabled: false } },
  sunday: { morning: { open: '09:00', close: '13:00', enabled: false }, evening: { open: '17:00', close: '21:00', enabled: false } },
};

const dayNames: Record<keyof OperatingHours, { en: string; el: string }> = {
  monday: { en: 'Monday', el: 'Δευτέρα' },
  tuesday: { en: 'Tuesday', el: 'Τρίτη' },
  wednesday: { en: 'Wednesday', el: 'Τετάρτη' },
  thursday: { en: 'Thursday', el: 'Πέμπτη' },
  friday: { en: 'Friday', el: 'Παρασκευή' },
  saturday: { en: 'Saturday', el: 'Σάββατο' },
  sunday: { en: 'Sunday', el: 'Κυριακή' },
};

export default function Settings() {
  const { settings, updateSettings, loading } = usePracticeSettings();
  const [saving, setSaving] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();

  const [formData, setFormData] = useState({
    doctor_name: settings?.doctor_name || '',
    practice_name: settings?.practice_name || '',
    phone_number: settings?.phone_number || '',
    address: settings?.address || '',
    specialty: settings?.specialty || '',
  });

  // Custom fields state
  const [customFields, setCustomFields] = useState<CustomPatientField[]>(
    (settings?.custom_patient_fields as CustomPatientField[]) || []
  );
  const [newField, setNewField] = useState<Omit<CustomPatientField, 'id'>>({
    name: '',
    label: '',
    type: 'text',
    required: false,
    options: [],
  });
  const [newFieldOptions, setNewFieldOptions] = useState('');

  // Operating hours state
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(defaultOperatingHours);
  const [isClosed, setIsClosed] = useState(false);
  const [closureReason, setClosureReason] = useState('');
  const [savingHours, setSavingHours] = useState(false);
  const [savingClosure, setSavingClosure] = useState(false);

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
            close: dayData.close || '13:00',
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
        migrated[day] = defaultOperatingHours[day];
      }
    }
    
    return migrated as OperatingHours;
  };

  // Initialize operating hours from settings
  useEffect(() => {
    if (settings) {
      const hours = settings.operating_hours;
      if (hours) {
        const migratedHours = migrateOperatingHours(hours);
        setOperatingHours(migratedHours);
      }
      setIsClosed(settings.is_closed || false);
      setClosureReason(settings.closure_reason || '');
    }
  }, [settings]);

  const handleLanguageChange = (value: 'en' | 'el') => {
    setLanguage(value);
    toast.success(t.settings.languageChanged);
  };

  useState(() => {
    if (settings) {
      setFormData({
        doctor_name: settings.doctor_name || '',
        practice_name: settings.practice_name || '',
        phone_number: settings.phone_number || '',
        address: settings.address || '',
        specialty: settings.specialty || '',
      });
      setCustomFields((settings.custom_patient_fields as CustomPatientField[]) || []);
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
      toast.error(t.settings.settingsFailed);
    } else {
      toast.success(t.settings.settingsSaved);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t.errors.uploadImageOnly);
      return;
    }
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('practice-assets').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('practice-assets').getPublicUrl(fileName);
      await updateSettings({ logo_url: publicUrl });
      toast.success(t.settings.logoUploaded);
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error(t.errors.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const handleAddField = () => {
    if (!newField.name.trim()) {
      toast.error(t.settings.enterFieldName);
      return;
    }
    if (!newField.label.trim()) {
      toast.error(language === 'el' ? 'Εισάγετε ετικέτα πεδίου' : 'Please enter a field label');
      return;
    }

    const fieldToAdd: CustomPatientField = {
      ...newField,
      id: crypto.randomUUID(),
      options: newField.type === 'select' 
        ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean) 
        : undefined,
    };

    setCustomFields(prev => [...prev, fieldToAdd]);
    setNewField({ name: '', label: '', type: 'text', required: false, options: [] });
    setNewFieldOptions('');
    toast.success(t.settings.fieldAdded);
  };

  const handleRemoveField = (fieldId: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== fieldId));
    toast.success(t.settings.fieldRemoved);
  };

  const handleSaveCustomFields = async () => {
    setSavingFields(true);
    const { error } = await updateSettings({ custom_patient_fields: customFields } as any);
    setSavingFields(false);
    if (error) {
      toast.error(t.settings.settingsFailed);
    } else {
      toast.success(t.settings.fieldsSaved);
    }
  };

  const handleShiftChange = (day: keyof OperatingHours, shift: 'morning' | 'evening', field: keyof ShiftHours, value: string | boolean) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [shift]: { ...prev[day][shift], [field]: value }
      }
    }));
  };

  const handleSaveOperatingHours = async () => {
    setSavingHours(true);
    const { error } = await updateSettings({ operating_hours: operatingHours } as any);
    setSavingHours(false);
    if (error) {
      toast.error(t.settings.settingsFailed);
    } else {
      toast.success(language === 'el' ? 'Ωράριο αποθηκεύτηκε' : 'Operating hours saved');
    }
  };

  const handleToggleClosure = async () => {
    const newClosedState = !isClosed;
    if (!newClosedState) {
      // Opening practice - clear reason
      setSavingClosure(true);
      const { error } = await updateSettings({ 
        is_closed: false, 
        closure_reason: null 
      } as any);
      setSavingClosure(false);
      if (!error) {
        setIsClosed(false);
        setClosureReason('');
        toast.success(language === 'el' ? 'Το ιατρείο είναι ανοιχτό' : 'Practice is now open');
      }
    } else {
      // Closing practice - need reason
      if (!closureReason.trim()) {
        toast.error(language === 'el' ? 'Εισάγετε λόγο κλεισίματος' : 'Please enter a closure reason');
        return;
      }
      setSavingClosure(true);
      const { error } = await updateSettings({ 
        is_closed: true, 
        closure_reason: closureReason 
      } as any);
      setSavingClosure(false);
      if (!error) {
        setIsClosed(true);
        toast.success(language === 'el' ? 'Το ιατρείο είναι κλειστό' : 'Practice is now closed');
      }
    }
  };

  const getFieldTypeName = (type: CustomPatientField['type']) => {
    return t.settings.fieldTypes[type];
  };

  if (loading) {
    return <DashboardLayout><div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t.settings.title}</h1>
          <p className="text-sm text-muted-foreground">{t.settings.subtitle}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="medical-card">
            <CardHeader>
              <CardTitle className="text-lg">{t.settings.practiceLogo}</CardTitle>
              <CardDescription>{t.settings.logoDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="relative h-32 w-32 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted">
                {settings?.logo_url ? <img src={settings.logo_url} alt="Practice Logo" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Building2 className="h-12 w-12 text-muted-foreground" /></div>}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.common.uploading}</> : <><Upload className="mr-2 h-4 w-4" />{t.settings.uploadLogo}</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="medical-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">{t.settings.practiceDetails}</CardTitle>
              <CardDescription>{t.settings.detailsDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="practice_name" className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{t.settings.practiceName}</Label>
                  <Input id="practice_name" name="practice_name" value={formData.practice_name} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doctor_name" className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-muted-foreground" />{t.settings.doctorName}</Label>
                  <Input id="doctor_name" name="doctor_name" value={formData.doctor_name} onChange={handleInputChange} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone_number" className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{t.appointments.phoneNumber}</Label>
                  <Input id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty" className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-muted-foreground" />{t.settings.specialty}</Label>
                  <Input id="specialty" name="specialty" value={formData.specialty} onChange={handleInputChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{t.settings.address}</Label>
                <Textarea id="address" name="address" value={formData.address} onChange={handleInputChange} rows={3} />
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.common.saving}</> : <><Save className="mr-2 h-4 w-4" />{t.settings.saveChanges}</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="medical-card lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">{t.settings.language}</CardTitle>
              <CardDescription>{t.settings.languageDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs space-y-2">
                <Label htmlFor="language" className="flex items-center gap-2"><Languages className="h-4 w-4 text-muted-foreground" />{t.settings.displayLanguage}</Label>
                <Select value={language} onValueChange={handleLanguageChange}>
                  <SelectTrigger id="language"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en"><span className="flex items-center gap-2">🇬🇧 English</span></SelectItem>
                    <SelectItem value="el"><span className="flex items-center gap-2">🇬🇷 Ελληνικά (Greek)</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Color Theme Card */}
          <Card className="medical-card lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-primary" />
                {language === 'el' ? 'Χρωματικό Θέμα' : 'Color Theme'}
              </CardTitle>
              <CardDescription>
                {language === 'el' 
                  ? 'Επιλέξτε το χρωματικό θέμα για ολόκληρη την εφαρμογή' 
                  : 'Choose the color theme for the entire application'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {(Object.keys(themeConfigs) as ThemeColor[]).map((themeKey) => {
                  const config = themeConfigs[themeKey];
                  const isSelected = theme === themeKey;
                  return (
                    <button
                      key={themeKey}
                      onClick={() => {
                        setTheme(themeKey);
                        toast.success(language === 'el' ? 'Το θέμα άλλαξε' : 'Theme changed');
                      }}
                      className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:scale-105 ${
                        isSelected 
                          ? 'border-primary bg-primary/5 shadow-md' 
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div 
                        className={`h-12 w-12 rounded-full ${config.preview} shadow-inner`}
                      />
                      <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                        {language === 'el' ? config.nameEl : config.name}
                      </span>
                      {isSelected && (
                        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Practice Closure Toggle */}
          <Card className={`medical-card lg:col-span-3 ${isClosed ? 'border-destructive/50 bg-destructive/5' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className={`h-5 w-5 ${isClosed ? 'text-destructive' : 'text-muted-foreground'}`} />
                {language === 'el' ? 'Κατάσταση Λειτουργίας' : 'Practice Status'}
              </CardTitle>
              <CardDescription>
                {language === 'el' 
                  ? 'Κλείστε προσωρινά το ιατρείο για διακοπές, αργίες ή άλλους λόγους' 
                  : 'Temporarily close the practice for holidays, vacations, or other reasons'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">
                    {isClosed 
                      ? (language === 'el' ? '🔴 Το ιατρείο είναι ΚΛΕΙΣΤΟ' : '🔴 Practice is CLOSED')
                      : (language === 'el' ? '🟢 Το ιατρείο είναι ΑΝΟΙΧΤΟ' : '🟢 Practice is OPEN')
                    }
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {isClosed && closureReason && `${language === 'el' ? 'Λόγος' : 'Reason'}: ${closureReason}`}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="closureReason">
                  {language === 'el' ? 'Λόγος κλεισίματος' : 'Closure reason'}
                </Label>
                <Input
                  id="closureReason"
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  placeholder={language === 'el' ? 'π.χ. Διακοπές, Αργία, Εκπαίδευση...' : 'e.g. Holiday, Vacation, Training...'}
                  disabled={isClosed}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant={isClosed ? 'default' : 'destructive'}
                  onClick={handleToggleClosure}
                  disabled={savingClosure}
                >
                  {savingClosure ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.common.saving}</>
                  ) : isClosed ? (
                    language === 'el' ? 'Άνοιγμα Ιατρείου' : 'Open Practice'
                  ) : (
                    language === 'el' ? 'Κλείσιμο Ιατρείου' : 'Close Practice'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Operating Hours Card */}
          <Card className="medical-card lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                {language === 'el' ? 'Ωράριο Λειτουργίας' : 'Operating Hours'}
              </CardTitle>
              <CardDescription>
                {language === 'el' 
                  ? 'Ορίστε τις ώρες λειτουργίας για κάθε ημέρα της εβδομάδας' 
                  : 'Set the operating hours for each day of the week'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {(Object.keys(operatingHours) as (keyof OperatingHours)[]).map((day) => (
                  <div 
                    key={day} 
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="mb-3 font-medium text-foreground">
                      {dayNames[day][language]}
                    </div>
                    
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Morning Shift */}
                      <div className={`rounded-lg border border-border p-3 ${operatingHours[day].morning.enabled ? 'bg-background' : 'bg-muted/50'}`}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            {language === 'el' ? '🌅 Πρωί' : '🌅 Morning'}
                          </span>
                          <Switch
                            checked={operatingHours[day].morning.enabled}
                            onCheckedChange={(checked) => handleShiftChange(day, 'morning', 'enabled', checked)}
                          />
                        </div>
                        {operatingHours[day].morning.enabled && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={operatingHours[day].morning.open}
                              onValueChange={(value) => handleShiftChange(day, 'morning', 'open', value)}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 48 }, (_, i) => {
                                  const hour = Math.floor(i / 2);
                                  const min = (i % 2) * 30;
                                  const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                                  return <SelectItem key={time} value={time}>{time}</SelectItem>;
                                })}
                              </SelectContent>
                            </Select>
                            <span className="text-muted-foreground">-</span>
                            <Select
                              value={operatingHours[day].morning.close}
                              onValueChange={(value) => handleShiftChange(day, 'morning', 'close', value)}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 48 }, (_, i) => {
                                  const hour = Math.floor(i / 2);
                                  const min = (i % 2) * 30;
                                  const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                                  return <SelectItem key={time} value={time}>{time}</SelectItem>;
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {/* Evening Shift */}
                      <div className={`rounded-lg border border-border p-3 ${operatingHours[day].evening.enabled ? 'bg-background' : 'bg-muted/50'}`}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            {language === 'el' ? '🌙 Απόγευμα' : '🌙 Evening'}
                          </span>
                          <Switch
                            checked={operatingHours[day].evening.enabled}
                            onCheckedChange={(checked) => handleShiftChange(day, 'evening', 'enabled', checked)}
                          />
                        </div>
                        {operatingHours[day].evening.enabled && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={operatingHours[day].evening.open}
                              onValueChange={(value) => handleShiftChange(day, 'evening', 'open', value)}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 48 }, (_, i) => {
                                  const hour = Math.floor(i / 2);
                                  const min = (i % 2) * 30;
                                  const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                                  return <SelectItem key={time} value={time}>{time}</SelectItem>;
                                })}
                              </SelectContent>
                            </Select>
                            <span className="text-muted-foreground">-</span>
                            <Select
                              value={operatingHours[day].evening.close}
                              onValueChange={(value) => handleShiftChange(day, 'evening', 'close', value)}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 48 }, (_, i) => {
                                  const hour = Math.floor(i / 2);
                                  const min = (i % 2) * 30;
                                  const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                                  return <SelectItem key={time} value={time}>{time}</SelectItem>;
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end border-t border-border pt-4">
                <Button onClick={handleSaveOperatingHours} disabled={savingHours}>
                  {savingHours ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.common.saving}</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" />{t.settings.saveChanges}</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Custom Patient Fields Card */}
          <Card className="medical-card lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                {t.settings.customPatientFields}
              </CardTitle>
              <CardDescription>{t.settings.customFieldsDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add New Field Form */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-2">
                    <Label htmlFor="fieldName">{t.settings.fieldName}</Label>
                    <Input
                      id="fieldName"
                      value={newField.name}
                      onChange={(e) => setNewField(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={language === 'el' ? 'π.χ. amka' : 'e.g. insurance_id'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fieldLabel">{language === 'el' ? 'Ετικέτα Πεδίου' : 'Field Label'}</Label>
                    <Input
                      id="fieldLabel"
                      value={newField.label}
                      onChange={(e) => setNewField(prev => ({ ...prev, label: e.target.value }))}
                      placeholder={language === 'el' ? 'π.χ. ΑΜΚΑ' : 'e.g. Insurance ID'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fieldType">{t.settings.fieldType}</Label>
                    <Select
                      value={newField.type}
                      onValueChange={(value: CustomPatientField['type']) => setNewField(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger id="fieldType"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">{t.settings.fieldTypes.text}</SelectItem>
                        <SelectItem value="number">{t.settings.fieldTypes.number}</SelectItem>
                        <SelectItem value="date">{t.settings.fieldTypes.date}</SelectItem>
                        <SelectItem value="select">{t.settings.fieldTypes.select}</SelectItem>
                        <SelectItem value="textarea">{t.settings.fieldTypes.textarea}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newField.type === 'select' && (
                    <div className="space-y-2">
                      <Label htmlFor="fieldOptions">{t.settings.selectOptions}</Label>
                      <Input
                        id="fieldOptions"
                        value={newFieldOptions}
                        onChange={(e) => setNewFieldOptions(e.target.value)}
                        placeholder={t.settings.optionsPlaceholder}
                      />
                    </div>
                  )}
                  <div className="flex items-end gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="fieldRequired"
                        checked={newField.required}
                        onCheckedChange={(checked) => setNewField(prev => ({ ...prev, required: checked as boolean }))}
                      />
                      <Label htmlFor="fieldRequired" className="text-sm">{t.settings.required}</Label>
                    </div>
                    <Button onClick={handleAddField} size="sm" className="ml-auto">
                      <Plus className="mr-1 h-4 w-4" />
                      {t.settings.addField}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Existing Fields List */}
              {customFields.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>{t.settings.noCustomFields}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {customFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{field.label || field.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {field.name} • {getFieldTypeName(field.type)}
                            {field.required && <span className="ml-2 text-destructive">*</span>}
                            {field.type === 'select' && field.options && (
                              <span className="ml-2">({field.options.join(', ')})</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveField(field.id)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Save Fields Button */}
              <div className="flex justify-end border-t border-border pt-4">
                <Button onClick={handleSaveCustomFields} disabled={savingFields}>
                  {savingFields ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.common.saving}</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" />{t.settings.saveChanges}</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
