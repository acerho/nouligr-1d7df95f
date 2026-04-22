import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  Calendar,
  FileText,
  Upload,
  Loader2,
  Clock,
  Plus,
  ClipboardList,
  HeartPulse,
  Download,
  Pencil,
  CreditCard,
  MapPin,
  ExternalLink,
  Printer
} from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { api, getToken } from '@/lib/api';
import type { Patient, Appointment, ClinicalNote, PatientFile, CustomPatientField } from '@/types/database';
import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useTranslation } from '@/hooks/useTranslation';

export default function PatientProfile() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const showNotes = searchParams.get('notes') === 'true';
  const { settings } = usePracticeSettings();
  const { t, language } = useTranslation();
  const dateLocale = language === 'el' ? el : enUS;

  const statusConfig = {
    scheduled: { label: t.appointments.status.scheduled, className: 'status-scheduled' },
    arrived: { label: t.appointments.status.arrived, className: 'status-arrived' },
    in_progress: { label: t.appointments.status.inProgress, className: 'status-in-progress' },
    completed: { label: t.appointments.status.completed, className: 'status-completed' },
    cancelled: { label: t.appointments.status.cancelled, className: 'status-cancelled' },
  };

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [updatingNote, setUpdatingNote] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    illness: '',
    national_health_number: '',
    sex: '',
    address: '',
    custom_fields: {} as Record<string, string | number | boolean>,
  });

  const customFields = (settings?.custom_patient_fields as CustomPatientField[] | null) || [];

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!id) return;

      try {
        const [patientData, appointmentsData, notesData, filesData] = await Promise.all([
          api<Patient>('/api/patients.php', { query: { id } }),
          api<Appointment[]>('/api/appointments.php', { query: { patient_id: id } }),
          api<ClinicalNote[]>('/api/clinical-notes.php', { query: { patient_id: id } }),
          api<PatientFile[]>('/api/patient-files.php', { query: { patient_id: id } }),
        ]);
        setPatient(patientData);
        setAppointments(appointmentsData ?? []);
        setNotes(notesData ?? []);
        setFiles(filesData ?? []);

      } catch (error) {
        console.error('Error fetching patient data:', error);
        toast.error(t.patientProfile.failedToLoad);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [id]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;

    setSavingNote(true);
    try {
      await api('/api/clinical-notes.php', {
        method: 'POST',
        body: { patient_id: id, note_text: newNote.trim() },
      });
      const notesData = await api<ClinicalNote[]>('/api/clinical-notes.php', { query: { patient_id: id } });
      setNotes(notesData ?? []);
      setNewNote('');
      toast.success(t.patientProfile.noteAdded);
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error(t.patientProfile.failedToAddNote);
    } finally {
      setSavingNote(false);
    }
  };

  const handleStartEditNote = (note: ClinicalNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note_text);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleUpdateNote = async () => {
    if (!editingNoteId || !editingNoteText.trim()) return;
    setUpdatingNote(true);
    try {
      await api('/api/clinical-notes.php', {
        method: 'PUT',
        query: { id: editingNoteId },
        body: { note_text: editingNoteText.trim() },
      });
      setNotes(prev => prev.map(n => n.id === editingNoteId ? { ...n, note_text: editingNoteText.trim() } : n));
      handleCancelEditNote();
      toast.success(t.patientProfile.noteUpdated);
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error(t.patientProfile.failedToUpdateNote);
    } finally {
      setUpdatingNote(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('patient_id', id);
      formData.append('file', file);
      await api('/api/patient-files.php', { method: 'POST', body: formData, raw: true });
      const filesData = await api<PatientFile[]>('/api/patient-files.php', { query: { patient_id: id } });
      setFiles(filesData ?? []);
      toast.success(t.patientProfile.fileUploaded);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(t.patientProfile.failedToUpload);
    } finally {
      setUploadingFile(false);
    }
  };

  const downloadFileBlob = async (filePath: string): Promise<Blob> => {
    // file_url stored by the PHP API is an absolute path like /uploads/patient-files/...
    // Auth not required for static uploads on the standalone server, but include token if present.
    const token = getToken();
    const res = await fetch(filePath, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      const blob = await downloadFileBlob(filePath);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error(t.patientProfile.failedToDownload);
    }
  };

  const handlePreviewFile = async (filePath: string, fileType: string | null, fileName: string) => {
    try {
      const data = await downloadFileBlob(filePath);

      // Escape HTML special chars to prevent XSS via crafted file names
      const escapeHtml = (str: string) =>
        String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      const safeFileName = escapeHtml(fileName);

      // Determine MIME type based on file extension or stored type
      let mimeType = 'application/octet-stream';
      const extension = filePath.split('.').pop()?.toLowerCase();
      const isPdf = extension === 'pdf';
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '');
      
      if (isPdf) {
        mimeType = 'application/pdf';
      } else if (['jpg', 'jpeg'].includes(extension || '')) {
        mimeType = 'image/jpeg';
      } else if (extension === 'png') {
        mimeType = 'image/png';
      } else if (extension === 'gif') {
        mimeType = 'image/gif';
      } else if (extension === 'webp') {
        mimeType = 'image/webp';
      } else if (fileType) {
        mimeType = fileType;
      }

      // Convert blob to base64 data URL for cross-window compatibility
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        
        // Calculate popup dimensions
        const popupWidth = 900;
        const popupHeight = 700;
        const left = (window.screen.width - popupWidth) / 2;
        const top = (window.screen.height - popupHeight) / 2;

        // Open popup window
        const popup = window.open(
          '',
          'FilePreview',
          `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );

        if (popup) {
          if (isPdf) {
            // For PDFs, embed using object tag for better compatibility
            popup.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>${safeFileName}</title>
                  <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    html, body { height: 100%; width: 100%; overflow: hidden; background: #525659; }
                    object, embed { width: 100%; height: 100%; }
                  </style>
                </head>
                <body>
                  <object data="${base64Data}" type="application/pdf" width="100%" height="100%">
                    <embed src="${base64Data}" type="application/pdf" width="100%" height="100%" />
                  </object>
                </body>
              </html>
            `);
          } else if (isImage) {
            // For images, display centered with dark background
            popup.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>${safeFileName}</title>
                  <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                      min-height: 100vh;
                      background: #1a1a1a; 
                      display: flex; 
                      justify-content: center; 
                      align-items: center; 
                      padding: 20px;
                    }
                    img { 
                      max-width: 100%; 
                      max-height: calc(100vh - 40px); 
                      object-fit: contain;
                      border-radius: 4px;
                      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    }
                  </style>
                </head>
                <body>
                  <img src="${base64Data}" alt="${safeFileName}" />
                </body>
              </html>
            `);
          } else {
            // For other files, create a download link
            popup.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>${safeFileName}</title>
                  <style>
                    body { 
                      font-family: system-ui, sans-serif;
                      background: #1a1a1a; 
                      color: white;
                      display: flex; 
                      justify-content: center; 
                      align-items: center; 
                      min-height: 100vh;
                      flex-direction: column;
                      gap: 16px;
                    }
                    a {
                      background: #3b82f6;
                      color: white;
                      padding: 12px 24px;
                      border-radius: 8px;
                      text-decoration: none;
                    }
                    a:hover { background: #2563eb; }
                  </style>
                </head>
                <body>
                  <p>Preview not available for this file type</p>
                  <a href="${base64Data}" download="${safeFileName}">Download File</a>
                </body>
              </html>
            `);
          }
          popup.document.close();
        }
      };
      
      reader.readAsDataURL(data);
    } catch (error) {
      console.error('Error previewing file:', error);
      toast.error(t.patientProfile.failedToDownload);
    }
  };

  const openEditDialog = () => {
    if (!patient) return;
    setEditForm({
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email || '',
      phone: patient.phone || '',
      date_of_birth: patient.date_of_birth || '',
      illness: patient.illness || '',
      national_health_number: patient.national_health_number || '',
      sex: patient.sex || '',
      address: patient.address || '',
      custom_fields: patient.custom_fields || {},
    });
    setEditDialogOpen(true);
  };

  const handleSavePatient = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api('/api/patients.php', {
        method: 'PUT',
        query: { id },
        body: {
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email || null,
          phone: editForm.phone || null,
          date_of_birth: editForm.date_of_birth || null,
          illness: editForm.illness || null,
          national_health_number: editForm.national_health_number || null,
          sex: editForm.sex || null,
          address: editForm.address || null,
          custom_fields: editForm.custom_fields,
        },
      });

      // Update local state
      setPatient(prev => prev ? {
        ...prev,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        date_of_birth: editForm.date_of_birth || null,
        illness: editForm.illness || null,
        national_health_number: editForm.national_health_number || null,
        sex: editForm.sex || null,
        address: editForm.address || null,
        custom_fields: editForm.custom_fields,
      } : null);

      setEditDialogOpen(false);
      toast.success(t.patientProfile.patientUpdated);
    } catch (error) {
      console.error('Error updating patient:', error);
      toast.error(t.patientProfile.failedToUpdate);
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPDF = async () => {
    if (!patient) return;
    try {
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const html2canvas = html2canvasMod.default;

      const dob = patient.date_of_birth
        ? format(new Date(patient.date_of_birth), 'dd/MM/yyyy', { locale: dateLocale })
        : '-';
      const age = patient.date_of_birth
        ? `${differenceInYears(new Date(), new Date(patient.date_of_birth))} ${t.patientProfile.yearsOld}`
        : '';
      const practiceName = settings?.practice_name || '';
      const doctorName = settings?.doctor_name || '';
      const generatedDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: dateLocale });

      const notesHtml = notes.length
        ? notes
            .map(
              (n) => `
              <div style="margin-bottom:10px; padding:8px 10px; border-left:3px solid #2563eb; background:#f8fafc;">
                <div style="font-size:11px; color:#64748b; margin-bottom:4px;">
                  ${format(new Date(n.created_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}
                </div>
                <div style="font-size:13px; color:#0f172a; white-space:pre-wrap;">${n.note_text.replace(/</g, '&lt;')}</div>
              </div>`
            )
            .join('')
        : `<div style="color:#94a3b8; font-size:13px; font-style:italic;">${t.patientProfile.noNotes}</div>`;

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.width = '794px'; // A4 width @ 96dpi
      container.style.padding = '40px';
      container.style.background = '#ffffff';
      container.style.fontFamily = 'Arial, Helvetica, sans-serif';
      container.style.color = '#0f172a';
      container.innerHTML = `
        <div style="border-bottom:2px solid #2563eb; padding-bottom:12px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:20px; font-weight:bold; color:#0f172a;">${practiceName}</div>
              <div style="font-size:12px; color:#64748b;">${doctorName}</div>
            </div>
            <div style="text-align:right; font-size:11px; color:#64748b;">
              ${t.patientProfile.generatedOn} ${generatedDate}
            </div>
          </div>
          <div style="font-size:16px; font-weight:600; color:#2563eb; margin-top:10px;">
            ${t.patientProfile.printPdfTitle}
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <tr>
              <td style="padding:8px 4px; width:35%; color:#64748b;">${t.appointments.lastName}</td>
              <td style="padding:8px 4px; font-weight:600;">${patient.last_name}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:8px 4px; color:#64748b;">${t.appointments.firstName}</td>
              <td style="padding:8px 4px; font-weight:600;">${patient.first_name}</td>
            </tr>
            <tr>
              <td style="padding:8px 4px; color:#64748b;">${language === 'el' ? 'Ημερομηνία Γέννησης' : 'Date of Birth'}</td>
              <td style="padding:8px 4px; font-weight:600;">${dob}${age ? ' (' + age + ')' : ''}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:8px 4px; color:#64748b;">${t.patients.amka}</td>
              <td style="padding:8px 4px; font-weight:600;">${patient.national_health_number || '-'}</td>
            </tr>
            <tr>
              <td style="padding:8px 4px; color:#64748b; vertical-align:top;">${t.patientProfile.illness}</td>
              <td style="padding:8px 4px; font-weight:600; white-space:pre-wrap;">${(patient.illness || '-').replace(/</g, '&lt;')}</td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:14px; font-weight:bold; color:#2563eb; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:10px;">
            ${t.patientProfile.clinicalNotes}
          </div>
          ${notesHtml}
        </div>

        <div>
          <div style="font-size:14px; font-weight:bold; color:#2563eb; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:10px;">
            ${t.patientProfile.emptyClinicalNotes}
          </div>
          <div style="border:1px solid #cbd5e1; border-radius:4px; min-height:260px; background:#ffffff;"></div>
        </div>
      `;
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = `${patient.last_name}_${patient.first_name}`.replace(/[^\p{L}\p{N}_-]/gu, '');
      pdf.save(`${safeName || 'patient'}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('PDF error');
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

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="text-center">
          <h2 className="text-lg font-medium">{t.patients.patientNotFound}</h2>
          <Link to="/patients">
            <Button variant="link">{t.patients.backToPatients}</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link to="/patients">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl truncate">
              {patient.first_name} {patient.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t.patients.patientSince} {format(new Date(patient.created_at), 'MMMM yyyy', { locale: dateLocale })}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Patient Info Card */}
          <Card className="medical-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{t.patients.patientInfo}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrintPDF}>
                  <Printer className="mr-2 h-4 w-4" />
                  {t.patientProfile.print}
                </Button>
                <Button variant="outline" size="sm" onClick={openEditDialog}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t.common.edit}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <span className="text-2xl font-bold text-primary">
                  {patient.first_name[0]}{patient.last_name[0]}
                </span>
              </div>
              
              <div className="space-y-3 text-sm">
                {/* Illness - at the top */}
                <div className="flex items-center gap-3">
                  <HeartPulse className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{t.patientProfile.illness}</span>
                    <span className="font-medium">{patient.illness || '-'}</span>
                  </div>
                </div>

                {/* Sex/Gender */}
                {patient.sex && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">{t.patients.sex}</span>
                      <span className="font-medium">
                        {patient.sex === 'male' ? t.patients.male : patient.sex === 'female' ? t.patients.female : patient.sex}
                      </span>
                    </div>
                  </div>
                )}

                {/* National Health Number (AMKA) */}
                {patient.national_health_number && (
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">{t.patients.amka}</span>
                      <span className="font-medium">{patient.national_health_number}</span>
                    </div>
                  </div>
                )}

                {patient.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{patient.email}</span>
                  </div>
                )}
                {patient.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{patient.phone}</span>
                  </div>
                )}
                {patient.date_of_birth && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <span>{format(new Date(patient.date_of_birth), 'MMMM d, yyyy', { locale: dateLocale })}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="font-medium text-primary">
                        {differenceInYears(new Date(), new Date(patient.date_of_birth))} {t.patientProfile.yearsOld}
                      </span>
                    </div>
                  </div>
                )}

                {/* Address */}
                {patient.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">{t.patients.address}</span>
                      <span className="font-medium">{patient.address}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Fields Section */}
              {customFields.length > 0 && (
                <div className="border-t pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{t.patientProfile.additionalInfo}</span>
                  </div>
                  <div className="space-y-2">
                    {customFields.map((field) => {
                      const fieldValue = patient.custom_fields?.[field.name];
                      const displayValue = fieldValue !== undefined && fieldValue !== '' 
                        ? String(fieldValue) 
                        : '-';
                      
                      return (
                        <div key={field.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{field.label || field.name}</span>
                          <span className="font-medium text-foreground">{displayValue}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  {t.patients.totalVisits}: {appointments.length}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tabs Section */}
          <Card className="medical-card lg:col-span-2">
            <Tabs defaultValue={showNotes ? 'notes' : 'history'}>
              <CardHeader className="border-b border-border pb-4">
                <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                  <TabsTrigger value="history" className="text-xs sm:text-sm">{t.patientProfile.visitHistory}</TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs sm:text-sm">{t.patientProfile.clinicalNotes}</TabsTrigger>
                  <TabsTrigger value="files" className="text-xs sm:text-sm">{t.patientProfile.files}</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="p-0">
                {/* Visit History */}
                <TabsContent value="history" className="m-0">
                  {appointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">{t.patientProfile.noVisits}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {appointments.map((apt) => (
                        <div key={apt.id} className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-medium text-foreground">
                              {format(new Date(apt.created_at), 'MMMM d, yyyy', { locale: dateLocale })}
                            </p>
                            {apt.reason_for_visit && (
                              <p className="text-sm text-muted-foreground">
                                {apt.reason_for_visit}
                              </p>
                            )}
                          </div>
                          <span className={cn('status-badge', statusConfig[apt.status].className)}>
                            {statusConfig[apt.status].label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Clinical Notes */}
                <TabsContent value="notes" className="m-0">
                  <div className="border-b border-border p-4">
                    <Textarea
                      placeholder={t.patientProfile.addNoteplaceholder}
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={3}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button 
                        onClick={handleAddNote} 
                        disabled={!newNote.trim() || savingNote}
                        size="sm"
                      >
                        {savingNote ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        {t.patientProfile.addNote}
                      </Button>
                    </div>
                  </div>
                  
                  {notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">{t.patientProfile.noNotes}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {notes.map((note) => (
                        <div key={note.id} className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(note.created_at), 'MMM d, yyyy HH:mm', { locale: dateLocale })}
                            </p>
                            {editingNoteId !== note.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartEditNote(note)}
                              >
                                <Pencil className="mr-1 h-3.5 w-3.5" />
                                {t.common.edit}
                              </Button>
                            )}
                          </div>
                          {editingNoteId === note.id ? (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                rows={3}
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelEditNote}
                                  disabled={updatingNote}
                                >
                                  {t.common.cancel}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleUpdateNote}
                                  disabled={!editingNoteText.trim() || updatingNote}
                                >
                                  {updatingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  {t.common.save}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1 whitespace-pre-wrap text-foreground">
                              {note.note_text}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Files */}
                <TabsContent value="files" className="m-0">
                  <div className="border-b border-border p-4">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                      <Button variant="outline" disabled={uploadingFile} asChild>
                        <span>
                          {uploadingFile ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          {t.patientProfile.uploadFile}
                        </span>
                      </Button>
                    </label>
                  </div>

                  {files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">{t.patientProfile.noFiles}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {files.map((file) => (
                        <div 
                          key={file.id} 
                          className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                              <button
                                onClick={() => handlePreviewFile(file.file_url, file.file_type, file.file_name)}
                                className="flex items-center gap-1 font-medium text-foreground hover:text-primary hover:underline transition-colors"
                              >
                                {file.file_name}
                                <ExternalLink className="h-3 w-3" />
                              </button>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(file.created_at), 'MMM d, yyyy', { locale: dateLocale })}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadFile(file.file_url, file.file_name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Edit Patient Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.patientProfile.editPatient}</DialogTitle>
            <DialogDescription>
              {t.patientProfile.editPatientDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit_first_name">{t.appointments.firstName} *</Label>
                <Input
                  id="edit_first_name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_last_name">{t.appointments.lastName} *</Label>
                <Input
                  id="edit_last_name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_illness">{t.patientProfile.illnessCondition}</Label>
              <Input
                id="edit_illness"
                value={editForm.illness}
                onChange={(e) => setEditForm(prev => ({ ...prev, illness: e.target.value }))}
                placeholder={t.patientProfile.illnessPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_amka">{t.patients.amka}</Label>
              <Input
                id="edit_amka"
                value={editForm.national_health_number}
                onChange={(e) => setEditForm(prev => ({ ...prev, national_health_number: e.target.value }))}
                placeholder={t.patients.amkaPlaceholder || ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_sex">{t.patients.sex}</Label>
              <Select
                value={editForm.sex}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, sex: value }))}
              >
                <SelectTrigger id="edit_sex">
                  <SelectValue placeholder={t.patients.sexPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t.patients.male}</SelectItem>
                  <SelectItem value="female">{t.patients.female}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_address">{t.patients.address}</Label>
              <Input
                id="edit_address"
                value={editForm.address}
                onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder={t.patients.addressPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_phone">{t.appointments.phone}</Label>
              <Input
                id="edit_phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_dob">{t.patients.dob}</Label>
              <Input
                id="edit_dob"
                type="date"
                value={editForm.date_of_birth}
                onChange={(e) => setEditForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
              />
            </div>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="mb-3 text-sm font-medium">{t.patientProfile.additionalInfo}</h4>
                <div className="space-y-3">
                  {customFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={`custom_${field.id}`}>
                        {field.label || field.name}
                        {field.required && ' *'}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          id={`custom_${field.id}`}
                          value={String(editForm.custom_fields[field.name] || '')}
                          onChange={(e) => setEditForm(prev => ({
                            ...prev,
                            custom_fields: { ...prev.custom_fields, [field.name]: e.target.value }
                          }))}
                          rows={3}
                        />
                      ) : field.type === 'select' && field.options ? (
                        <Select
                          value={String(editForm.custom_fields[field.name] || '')}
                          onValueChange={(value) => setEditForm(prev => ({
                            ...prev,
                            custom_fields: { ...prev.custom_fields, [field.name]: value }
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`${language === 'el' ? 'Epilexte' : 'Select'} ${field.label || field.name}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`custom_${field.id}`}
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          value={String(editForm.custom_fields[field.name] || '')}
                          onChange={(e) => setEditForm(prev => ({
                            ...prev,
                            custom_fields: { ...prev.custom_fields, [field.name]: e.target.value }
                          }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="flex-1"
              >
                {t.common.cancel}
              </Button>
              <Button
                onClick={handleSavePatient}
                disabled={saving || !editForm.first_name || !editForm.last_name}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.common.saving}
                  </>
                ) : (
                  t.patientProfile.saveChanges
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
