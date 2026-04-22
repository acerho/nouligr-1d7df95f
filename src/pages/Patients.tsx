import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import type { Patient, CustomPatientField, Appointment, ClinicalNote } from '@/types/database';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { Search, Users, ChevronRight, Loader2, Plus, UserPlus, MoreHorizontal, Pencil, Trash2, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { t, language } = useTranslation();
  const { settings } = usePracticeSettings();

  // Get custom fields from practice settings
  const customFields = (settings?.custom_patient_fields as CustomPatientField[]) || [];

  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    sex: '',
    national_health_number: '',
    illness: '',
    address: '',
  });

  const [editPatient, setEditPatient] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    sex: '',
    national_health_number: '',
    illness: '',
    address: '',
  });

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [editCustomFieldValues, setEditCustomFieldValues] = useState<Record<string, string>>({});

  const dateLocale = language === 'el' ? el : enUS;

  const fetchPatients = async () => {
    try {
      const data = await api<Patient[]>('/api/patients.php');
      const sorted = [...(data ?? [])].sort((a, b) => {
        const ln = a.last_name.localeCompare(b.last_name, language === 'el' ? 'el' : 'en');
        if (ln !== 0) return ln;
        return a.first_name.localeCompare(b.first_name, language === 'el' ? 'el' : 'en');
      });
      setPatients(sorted);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // Reset custom field values when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      const initialValues: Record<string, string> = {};
      customFields.forEach(field => {
        initialValues[field.id] = '';
      });
      setCustomFieldValues(initialValues);
    }
  }, [dialogOpen, customFields.length]);

  const handleCustomFieldChange = (fieldId: string, value: string) => {
    setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleCreatePatient = async () => {
    if (!newPatient.first_name.trim() || !newPatient.last_name.trim()) {
      toast.error(t.appointments.enterPatientName);
      return;
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.required && !customFieldValues[field.id]?.trim()) {
        toast.error(language === 'el' 
          ? `Το πεδίο "${field.name}" είναι υποχρεωτικό` 
          : `The field "${field.name}" is required`);
        return;
      }
    }

    setCreating(true);
    try {
      // Transform custom field values to use field names as keys
      const customFieldsData: Record<string, string> = {};
      customFields.forEach(field => {
        if (customFieldValues[field.id]) {
          customFieldsData[field.name] = customFieldValues[field.id];
        }
      });

      const { data, error } = await supabase
        .from('patients')
        .insert({
          first_name: newPatient.first_name.trim(),
          last_name: newPatient.last_name.trim(),
          email: newPatient.email.trim() || null,
          phone: newPatient.phone.trim() || null,
          date_of_birth: newPatient.date_of_birth || null,
          sex: newPatient.sex || null,
          national_health_number: newPatient.national_health_number.trim() || null,
          illness: newPatient.illness.trim() || null,
          address: newPatient.address.trim() || null,
          custom_fields: Object.keys(customFieldsData).length > 0 ? customFieldsData : null,
        })
        .select()
        .single();

      if (error) throw error;

      setPatients(prev => [...prev, data as Patient].sort((a, b) => {
        const ln = a.last_name.localeCompare(b.last_name, language === 'el' ? 'el' : 'en');
        if (ln !== 0) return ln;
        return a.first_name.localeCompare(b.first_name, language === 'el' ? 'el' : 'en');
      }));
      setNewPatient({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', sex: '', national_health_number: '', illness: '', address: '' });
      setCustomFieldValues({});
      setDialogOpen(false);
      toast.success(language === 'el' ? 'Ο ασθενής προστέθηκε' : 'Patient added successfully');
    } catch (error) {
      console.error('Error creating patient:', error);
      toast.error(t.errors.saveFailed);
    } finally {
      setCreating(false);
    }
  };

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setEditPatient({
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email || '',
      phone: patient.phone || '',
      date_of_birth: patient.date_of_birth || '',
      sex: patient.sex || '',
      national_health_number: patient.national_health_number || '',
      illness: patient.illness || '',
      address: patient.address || '',
    });
    // Set edit custom field values
    const editValues: Record<string, string> = {};
    customFields.forEach(field => {
      editValues[field.id] = patient.custom_fields?.[field.name]?.toString() || '';
    });
    setEditCustomFieldValues(editValues);
    setEditDialogOpen(true);
  };

  const handleUpdatePatient = async () => {
    if (!selectedPatient) return;
    if (!editPatient.first_name.trim() || !editPatient.last_name.trim()) {
      toast.error(t.appointments.enterPatientName);
      return;
    }

    setUpdating(true);
    try {
      // Transform custom field values to use field names as keys
      const customFieldsData: Record<string, string> = {};
      customFields.forEach(field => {
        if (editCustomFieldValues[field.id]) {
          customFieldsData[field.name] = editCustomFieldValues[field.id];
        }
      });

      const { data, error } = await supabase
        .from('patients')
        .update({
          first_name: editPatient.first_name.trim(),
          last_name: editPatient.last_name.trim(),
          email: editPatient.email.trim() || null,
          phone: editPatient.phone.trim() || null,
          date_of_birth: editPatient.date_of_birth || null,
          sex: editPatient.sex || null,
          national_health_number: editPatient.national_health_number.trim() || null,
          illness: editPatient.illness.trim() || null,
          address: editPatient.address.trim() || null,
          custom_fields: Object.keys(customFieldsData).length > 0 ? customFieldsData : null,
        })
        .eq('id', selectedPatient.id)
        .select()
        .single();

      if (error) throw error;

      setPatients(prev => prev.map(p => p.id === selectedPatient.id ? (data as Patient) : p));
      setEditDialogOpen(false);
      setSelectedPatient(null);
      toast.success(language === 'el' ? 'Ο ασθενής ενημερώθηκε' : 'Patient updated successfully');
    } catch (error) {
      console.error('Error updating patient:', error);
      toast.error(t.errors.saveFailed);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!selectedPatient) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', selectedPatient.id);

      if (error) throw error;

      setPatients(prev => prev.filter(p => p.id !== selectedPatient.id));
      setDeleteDialogOpen(false);
      setSelectedPatient(null);
      toast.success(language === 'el' ? 'Ο ασθενής διαγράφηκε' : 'Patient deleted successfully');
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast.error(t.errors.saveFailed);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditCustomFieldChange = (fieldId: string, value: string) => {
    setEditCustomFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const renderEditCustomFieldInput = (field: CustomPatientField) => {
    const value = editCustomFieldValues[field.id] || '';

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={`edit-${field.id}`}
            value={value}
            onChange={(e) => handleEditCustomFieldChange(field.id, e.target.value)}
            placeholder={field.label || field.name}
            rows={3}
          />
        );
      case 'number':
        return (
          <Input
            id={`edit-${field.id}`}
            type="number"
            value={value}
            onChange={(e) => handleEditCustomFieldChange(field.id, e.target.value)}
            placeholder={field.label || field.name}
          />
        );
      case 'date':
        return (
          <Input
            id={`edit-${field.id}`}
            type="date"
            value={value}
            onChange={(e) => handleEditCustomFieldChange(field.id, e.target.value)}
          />
        );
      case 'select':
        return (
          <Select value={value} onValueChange={(v) => handleEditCustomFieldChange(field.id, v)}>
            <SelectTrigger id={`edit-${field.id}`}>
              <SelectValue placeholder={language === 'el' ? 'Επιλέξτε...' : 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return (
          <Input
            id={`edit-${field.id}`}
            type="text"
            value={value}
            onChange={(e) => handleEditCustomFieldChange(field.id, e.target.value)}
            placeholder={field.label || field.name}
          />
        );
    }
  };

  const renderCustomFieldInput = (field: CustomPatientField) => {
    const value = customFieldValues[field.id] || '';

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={field.id}
            value={value}
            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
            placeholder={field.label || field.name}
            rows={3}
          />
        );
      case 'number':
        return (
          <Input
            id={field.id}
            type="number"
            value={value}
            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
            placeholder={field.label || field.name}
          />
        );
      case 'date':
        return (
          <Input
            id={field.id}
            type="date"
            value={value}
            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
          />
        );
      case 'select':
        return (
          <Select value={value} onValueChange={(v) => handleCustomFieldChange(field.id, v)}>
            <SelectTrigger id={field.id}>
              <SelectValue placeholder={language === 'el' ? 'Επιλέξτε...' : 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return (
          <Input
            id={field.id}
            type="text"
            value={value}
            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
            placeholder={field.label || field.name}
          />
        );
    }
  };

  const filteredPatients = patients.filter(patient => {
    const term = searchTerm.toLowerCase();
    const fullName1 = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    const fullName2 = `${patient.last_name} ${patient.first_name}`.toLowerCase();
    return fullName1.includes(term) ||
           fullName2.includes(term) ||
           patient.email?.toLowerCase().includes(term) ||
           patient.phone?.includes(searchTerm);
  });

  const handleExportToExcel = async () => {
    if (patients.length === 0) {
      toast.error(language === 'el' ? 'Den yparxoun astheneis gia exagogi' : 'No patients to export');
      return;
    }

    setExporting(true);
    try {
      // Fetch all appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .order('scheduled_at', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      // Fetch all clinical notes
      const { data: clinicalNotesData, error: notesError } = await supabase
        .from('clinical_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      const workbook = XLSX.utils.book_new();

      // Sheet 1: Patients
      const patientsExportData = patients.map(patient => {
        const baseData: Record<string, string | null> = {
          [language === 'el' ? 'Onoma' : 'First Name']: patient.first_name,
          [language === 'el' ? 'Eponymo' : 'Last Name']: patient.last_name,
          [language === 'el' ? 'Email' : 'Email']: patient.email || '',
          [language === 'el' ? 'Tilefono' : 'Phone']: patient.phone || '',
          [language === 'el' ? 'Im. Gennisis' : 'Date of Birth']: patient.date_of_birth || '',
          [language === 'el' ? 'Fylo' : 'Sex']: patient.sex || '',
          [language === 'el' ? 'AMKA' : 'National Health Number']: patient.national_health_number || '',
          [language === 'el' ? 'Pathisi' : 'Illness']: patient.illness || '',
          [language === 'el' ? 'Im. Egrafis' : 'Registered']: patient.created_at 
            ? format(new Date(patient.created_at), 'dd/MM/yyyy', { locale: dateLocale }) 
            : '',
        };

        // Add custom fields
        if (patient.custom_fields && typeof patient.custom_fields === 'object') {
          Object.entries(patient.custom_fields).forEach(([key, value]) => {
            baseData[key] = value?.toString() || '';
          });
        }

        return baseData;
      });

      const patientsSheet = XLSX.utils.json_to_sheet(patientsExportData);
      if (patientsExportData.length > 0) {
        patientsSheet['!cols'] = Object.keys(patientsExportData[0]).map(key => ({
          wch: Math.max(key.length, 15)
        }));
      }
      XLSX.utils.book_append_sheet(workbook, patientsSheet, language === 'el' ? 'Astheneis' : 'Patients');

      // Sheet 2: Appointments
      const appointmentsExportData = (appointmentsData || []).map(apt => {
        const patient = patients.find(p => p.id === apt.patient_id);
        const statusTranslations: Record<string, string> = {
          scheduled: language === 'el' ? 'Programmatismeno' : 'Scheduled',
          arrived: language === 'el' ? 'Eftase' : 'Arrived',
          in_progress: language === 'el' ? 'Se exelixi' : 'In Progress',
          completed: language === 'el' ? 'Oloklirothike' : 'Completed',
          cancelled: language === 'el' ? 'Akyromeno' : 'Cancelled',
        };
        return {
          [language === 'el' ? 'Asthenis' : 'Patient']: patient 
            ? `${patient.first_name} ${patient.last_name}` 
            : '',
          [language === 'el' ? 'Imerominía' : 'Date']: apt.scheduled_at 
            ? format(new Date(apt.scheduled_at), 'dd/MM/yyyy', { locale: dateLocale }) 
            : '',
          [language === 'el' ? 'Ora' : 'Time']: apt.scheduled_at 
            ? format(new Date(apt.scheduled_at), 'HH:mm', { locale: dateLocale }) 
            : '',
          [language === 'el' ? 'Katastasi' : 'Status']: statusTranslations[apt.status] || apt.status,
          [language === 'el' ? 'Logos Episkepsis' : 'Reason for Visit']: apt.reason_for_visit || '',
          [language === 'el' ? 'Simeiosis' : 'Notes']: apt.notes || '',
          [language === 'el' ? 'Pigi Kratisis' : 'Booking Source']: apt.booking_source === 'patient' 
            ? (language === 'el' ? 'Asthenis' : 'Patient') 
            : (language === 'el' ? 'Prosopiko' : 'Staff'),
          [language === 'el' ? 'Dimiourgithike' : 'Created']: apt.created_at 
            ? format(new Date(apt.created_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale }) 
            : '',
        };
      });

      if (appointmentsExportData.length > 0) {
        const appointmentsSheet = XLSX.utils.json_to_sheet(appointmentsExportData);
        appointmentsSheet['!cols'] = Object.keys(appointmentsExportData[0]).map(key => ({
          wch: Math.max(key.length, 20)
        }));
        XLSX.utils.book_append_sheet(workbook, appointmentsSheet, language === 'el' ? 'Rantevou' : 'Appointments');
      }

      // Sheet 3: Clinical Notes
      const clinicalNotesExportData = (clinicalNotesData || []).map(note => {
        const patient = patients.find(p => p.id === note.patient_id);
        return {
          [language === 'el' ? 'Asthenis' : 'Patient']: patient 
            ? `${patient.first_name} ${patient.last_name}` 
            : '',
          [language === 'el' ? 'Simiosi' : 'Note']: note.note_text || '',
          [language === 'el' ? 'Imerominía' : 'Date']: note.created_at 
            ? format(new Date(note.created_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale }) 
            : '',
          [language === 'el' ? 'Teleftaia Enimerosi' : 'Last Updated']: note.updated_at 
            ? format(new Date(note.updated_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale }) 
            : '',
        };
      });

      if (clinicalNotesExportData.length > 0) {
        const notesSheet = XLSX.utils.json_to_sheet(clinicalNotesExportData);
        notesSheet['!cols'] = Object.keys(clinicalNotesExportData[0]).map(key => ({
          wch: key.includes('Note') || key.includes('Simiosi') ? 50 : Math.max(key.length, 20)
        }));
        XLSX.utils.book_append_sheet(workbook, notesSheet, language === 'el' ? 'Klinikes Simioseis' : 'Clinical Notes');
      }

      // Generate filename with date
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const filename = language === 'el' 
        ? `Backup_Asthenon_${dateStr}.xlsx` 
        : `Patients_Backup_${dateStr}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);
      toast.success(language === 'el' ? 'To archeio katevike' : 'File downloaded');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error(language === 'el' ? 'Apotyhia exagogis' : 'Export failed');
    } finally {
      setExporting(false);
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{t.patients.title}</h1>
            <p className="text-sm text-muted-foreground">
              {t.patients.subtitle}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportToExcel} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {t.patients.exportExcel}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {language === 'el' ? 'Νέος Ασθενής' : 'Add Patient'}
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  {language === 'el' ? 'Προσθήκη Νέου Ασθενή' : 'Add New Patient'}
                </DialogTitle>
                <DialogDescription>
                  {language === 'el' 
                    ? 'Συμπληρώστε τα στοιχεία του ασθενή' 
                    : 'Enter the patient details below'}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4 pt-4">
                  {/* Standard Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">{t.appointments.firstName} *</Label>
                      <Input
                        id="first_name"
                        value={newPatient.first_name}
                        onChange={(e) => setNewPatient(prev => ({ ...prev, first_name: e.target.value }))}
                        placeholder={language === 'el' ? 'Όνομα' : 'First name'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">{t.appointments.lastName} *</Label>
                      <Input
                        id="last_name"
                        value={newPatient.last_name}
                        onChange={(e) => setNewPatient(prev => ({ ...prev, last_name: e.target.value }))}
                        placeholder={language === 'el' ? 'Επώνυμο' : 'Last name'}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t.auth.email}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newPatient.email}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t.appointments.phone}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={newPatient.phone}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+30 123 456 7890"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dob">{t.patients.dob}</Label>
                      <Input
                        id="dob"
                        type="date"
                        value={newPatient.date_of_birth}
                        onChange={(e) => setNewPatient(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sex">{language === 'el' ? 'Φύλο' : 'Sex'}</Label>
                      <Select 
                        value={newPatient.sex} 
                        onValueChange={(v) => setNewPatient(prev => ({ ...prev, sex: v }))}
                      >
                        <SelectTrigger id="sex">
                          <SelectValue placeholder={language === 'el' ? 'Επιλέξτε...' : 'Select...'} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="male">{language === 'el' ? 'Άνδρας' : 'Male'}</SelectItem>
                          <SelectItem value="female">{language === 'el' ? 'Γυναίκα' : 'Female'}</SelectItem>
                          <SelectItem value="other">{language === 'el' ? 'Άλλο' : 'Other'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="national_health_number">{language === 'el' ? 'ΑΜΚΑ' : 'National Health Number'}</Label>
                    <Input
                      id="national_health_number"
                      value={newPatient.national_health_number}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, national_health_number: e.target.value }))}
                      placeholder={language === 'el' ? 'Εισάγετε ΑΜΚΑ' : 'Enter health number'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">{t.patients.address}</Label>
                    <Input
                      id="address"
                      value={newPatient.address}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, address: e.target.value }))}
                      placeholder={t.patients.addressPlaceholder}
                    />
                  </div>

                  {/* Custom Fields Section */}
                  {customFields.length > 0 && (
                    <>
                      <div className="border-t border-border pt-4">
                        <p className="text-sm font-medium text-muted-foreground mb-3">
                          {language === 'el' ? 'Πρόσθετα Πεδία' : 'Additional Fields'}
                        </p>
                      </div>
                      {customFields.map((field) => (
                        <div key={field.id} className="space-y-2">
                          <Label htmlFor={field.id}>
                            {field.label || field.name}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          {renderCustomFieldInput(field)}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button onClick={handleCreatePatient} disabled={creating}>
                  {creating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.common.creating}</>
                  ) : (
                    <><UserPlus className="mr-2 h-4 w-4" />{t.common.create}</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card className="medical-card">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="font-display text-lg">
                {t.patients.allPatients} ({patients.length})
              </CardTitle>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t.common.searchPatients}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 font-medium text-foreground">
                  {searchTerm ? t.patients.noPatientsFound : t.patients.noPatients}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm 
                    ? t.patients.adjustSearch 
                    : t.patients.patientsAppear
                  }
                </p>
                {!searchTerm && (
                  <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {language === 'el' ? 'Προσθήκη Ασθενή' : 'Add Patient'}
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="divide-y divide-border md:hidden">
                  {filteredPatients.map((patient) => (
                    <div key={patient.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/patients/${patient.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <span className="text-sm font-medium text-primary">
                              {patient.last_name[0]}{patient.first_name[0]}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">
                              {patient.last_name} {patient.first_name}
                            </p>
                            {patient.phone && (
                              <p className="text-sm text-muted-foreground truncate">{patient.phone}</p>
                            )}
                            {patient.email && (
                              <p className="text-sm text-muted-foreground truncate">{patient.email}</p>
                            )}
                          </div>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditPatient(patient)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {language === 'el' ? 'Επεξεργασία' : 'Edit'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => {
                                setSelectedPatient(patient);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {language === 'el' ? 'Διαγραφή' : 'Delete'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.common.name}</TableHead>
                        <TableHead>{t.common.contact}</TableHead>
                        <TableHead>{t.common.registered}</TableHead>
                        <TableHead className="w-24">{language === 'el' ? 'Ενέργειες' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPatients.map((patient) => (
                        <TableRow key={patient.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                                <span className="text-sm font-medium text-primary">
                                  {patient.last_name[0]}{patient.first_name[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {patient.last_name} {patient.first_name}
                                </p>
                                {patient.date_of_birth && (
                                  <p className="text-sm text-muted-foreground">
                                    {t.patients.dob}: {format(new Date(patient.date_of_birth), 'MMM d, yyyy', { locale: dateLocale })}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {patient.email && (
                                <p className="text-muted-foreground">{patient.email}</p>
                              )}
                              {patient.phone && (
                                <p className="text-muted-foreground">{patient.phone}</p>
                              )}
                              {!patient.email && !patient.phone && (
                                <p className="text-muted-foreground">{t.common.noContactInfo}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(patient.created_at), 'MMM d, yyyy', { locale: dateLocale })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditPatient(patient)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    {language === 'el' ? 'Επεξεργασία' : 'Edit'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => {
                                      setSelectedPatient(patient);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {language === 'el' ? 'Διαγραφή' : 'Delete'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Link to={`/patients/${patient.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit Patient Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                {language === 'el' ? 'Επεξεργασία Ασθενή' : 'Edit Patient'}
              </DialogTitle>
              <DialogDescription>
                {language === 'el' 
                  ? 'Ενημερώστε τα στοιχεία του ασθενή' 
                  : 'Update the patient details below'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 pt-4">
                {/* Standard Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_first_name">{t.appointments.firstName} *</Label>
                    <Input
                      id="edit_first_name"
                      value={editPatient.first_name}
                      onChange={(e) => setEditPatient(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder={language === 'el' ? 'Όνομα' : 'First name'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_last_name">{t.appointments.lastName} *</Label>
                    <Input
                      id="edit_last_name"
                      value={editPatient.last_name}
                      onChange={(e) => setEditPatient(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder={language === 'el' ? 'Επώνυμο' : 'Last name'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_illness">{language === 'el' ? 'Ασθένεια' : 'Illness'}</Label>
                  <Input
                    id="edit_illness"
                    value={editPatient.illness}
                    onChange={(e) => setEditPatient(prev => ({ ...prev, illness: e.target.value }))}
                    placeholder={language === 'el' ? 'π.χ. Διαβήτης' : 'e.g. Diabetes'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_address">{t.patients.address}</Label>
                  <Input
                    id="edit_address"
                    value={editPatient.address}
                    onChange={(e) => setEditPatient(prev => ({ ...prev, address: e.target.value }))}
                    placeholder={t.patients.addressPlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_email">{t.auth.email}</Label>
                  <Input
                    id="edit_email"
                    type="email"
                    value={editPatient.email}
                    onChange={(e) => setEditPatient(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_phone">{t.appointments.phone}</Label>
                  <Input
                    id="edit_phone"
                    type="tel"
                    value={editPatient.phone}
                    onChange={(e) => setEditPatient(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+30 123 456 7890"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_dob">{t.patients.dob}</Label>
                    <Input
                      id="edit_dob"
                      type="date"
                      value={editPatient.date_of_birth}
                      onChange={(e) => setEditPatient(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_sex">{language === 'el' ? 'Φύλο' : 'Sex'}</Label>
                    <Select 
                      value={editPatient.sex} 
                      onValueChange={(v) => setEditPatient(prev => ({ ...prev, sex: v }))}
                    >
                      <SelectTrigger id="edit_sex">
                        <SelectValue placeholder={language === 'el' ? 'Επιλέξτε...' : 'Select...'} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="male">{language === 'el' ? 'Άνδρας' : 'Male'}</SelectItem>
                        <SelectItem value="female">{language === 'el' ? 'Γυναίκα' : 'Female'}</SelectItem>
                        <SelectItem value="other">{language === 'el' ? 'Άλλο' : 'Other'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_national_health_number">{language === 'el' ? 'ΑΜΚΑ' : 'National Health Number'}</Label>
                  <Input
                    id="edit_national_health_number"
                    value={editPatient.national_health_number}
                    onChange={(e) => setEditPatient(prev => ({ ...prev, national_health_number: e.target.value }))}
                    placeholder={language === 'el' ? 'Εισάγετε ΑΜΚΑ' : 'Enter health number'}
                  />
                </div>

                {/* Custom Fields Section */}
                {customFields.length > 0 && (
                  <>
                    <div className="border-t border-border pt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-3">
                        {language === 'el' ? 'Πρόσθετα Πεδία' : 'Additional Fields'}
                      </p>
                    </div>
                    {customFields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={`edit-${field.id}`}>
                          {field.label || field.name}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {renderEditCustomFieldInput(field)}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button onClick={handleUpdatePatient} disabled={updating}>
                {updating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{language === 'el' ? 'Αποθήκευση...' : 'Saving...'}</>
                ) : (
                  <><Pencil className="mr-2 h-4 w-4" />{t.common.save}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === 'el' ? 'Διαγραφή Ασθενή' : 'Delete Patient'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {language === 'el' 
                  ? `Είστε σίγουροι ότι θέλετε να διαγράψετε τον ασθενή "${selectedPatient?.first_name} ${selectedPatient?.last_name}"; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.`
                  : `Are you sure you want to delete patient "${selectedPatient?.first_name} ${selectedPatient?.last_name}"? This action cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePatient}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleting}
              >
                {deleting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{language === 'el' ? 'Διαγραφή...' : 'Deleting...'}</>
                ) : (
                  <><Trash2 className="mr-2 h-4 w-4" />{language === 'el' ? 'Διαγραφή' : 'Delete'}</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
