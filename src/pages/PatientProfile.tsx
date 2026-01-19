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
  Pencil
} from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Patient, Appointment, ClinicalNote, PatientFile, CustomPatientField } from '@/types/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
const statusConfig = {
  scheduled: { label: 'Scheduled', className: 'status-scheduled' },
  arrived: { label: 'Arrived', className: 'status-arrived' },
  in_progress: { label: 'In Progress', className: 'status-in-progress' },
  completed: { label: 'Completed', className: 'status-completed' },
  cancelled: { label: 'Cancelled', className: 'status-cancelled' },
};

export default function PatientProfile() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const showNotes = searchParams.get('notes') === 'true';
  const { settings } = usePracticeSettings();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    illness: '',
    custom_fields: {} as Record<string, string | number | boolean>,
  });

  const customFields = (settings?.custom_patient_fields as CustomPatientField[] | null) || [];

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!id) return;

      try {
        // Fetch patient
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('id', id)
          .single();

        if (patientError) throw patientError;
        setPatient(patientData as Patient);

        // Fetch appointments
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('appointments')
          .select('*')
          .eq('patient_id', id)
          .order('created_at', { ascending: false });

        if (appointmentsError) throw appointmentsError;
        setAppointments(appointmentsData as Appointment[]);

        // Fetch clinical notes
        const { data: notesData, error: notesError } = await supabase
          .from('clinical_notes')
          .select('*')
          .eq('patient_id', id)
          .order('created_at', { ascending: false });

        if (notesError) throw notesError;
        setNotes(notesData as ClinicalNote[]);

        // Fetch files
        const { data: filesData, error: filesError } = await supabase
          .from('patient_files')
          .select('*')
          .eq('patient_id', id)
          .order('created_at', { ascending: false });

        if (filesError) throw filesError;
        setFiles(filesData as PatientFile[]);

      } catch (error) {
        console.error('Error fetching patient data:', error);
        toast.error('Failed to load patient data');
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
      const { error } = await supabase
        .from('clinical_notes')
        .insert({
          patient_id: id,
          note_text: newNote.trim(),
        });

      if (error) throw error;

      // Refresh notes
      const { data: notesData } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false });

      setNotes(notesData as ClinicalNote[]);
      setNewNote('');
      toast.success('Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('patient-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the file path instead of public URL (bucket is private)
      await supabase.from('patient_files').insert({
        patient_id: id,
        file_name: file.name,
        file_url: filePath, // Store path, not URL
        file_type: file.type,
      });

      // Refresh files
      const { data: filesData } = await supabase
        .from('patient_files')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false });

      setFiles(filesData as PatientFile[]);
      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      // Use Supabase storage download for private bucket
      const { data, error } = await supabase.storage
        .from('patient-files')
        .download(filePath);

      if (error) throw error;

      // Create download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
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
      custom_fields: patient.custom_fields || {},
    });
    setEditDialogOpen(true);
  };

  const handleSavePatient = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email || null,
          phone: editForm.phone || null,
          date_of_birth: editForm.date_of_birth || null,
          illness: editForm.illness || null,
          custom_fields: editForm.custom_fields,
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setPatient(prev => prev ? {
        ...prev,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        date_of_birth: editForm.date_of_birth || null,
        illness: editForm.illness || null,
        custom_fields: editForm.custom_fields,
      } : null);

      setEditDialogOpen(false);
      toast.success('Patient information updated');
    } catch (error) {
      console.error('Error updating patient:', error);
      toast.error('Failed to update patient');
    } finally {
      setSaving(false);
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
          <h2 className="text-lg font-medium">Patient not found</h2>
          <Link to="/patients">
            <Button variant="link">Back to patients</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/patients">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {patient.first_name} {patient.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Patient since {format(new Date(patient.created_at), 'MMMM yyyy')}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Patient Info Card */}
          <Card className="medical-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Patient Information</CardTitle>
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
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
                    <span className="text-xs text-muted-foreground">Illness</span>
                    <span className="font-medium">{patient.illness || '-'}</span>
                  </div>
                </div>

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
                      <span>{format(new Date(patient.date_of_birth), 'MMMM d, yyyy')}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium text-primary">
                        {differenceInYears(new Date(), new Date(patient.date_of_birth))} years old
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Fields Section */}
              {customFields.length > 0 && (
                <div className="border-t pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Additional Information</span>
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
                  Total Visits: {appointments.length}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tabs Section */}
          <Card className="medical-card lg:col-span-2">
            <Tabs defaultValue={showNotes ? 'notes' : 'history'}>
              <CardHeader className="border-b border-border pb-4">
                <TabsList>
                  <TabsTrigger value="history">Visit History</TabsTrigger>
                  <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="p-0">
                {/* Visit History */}
                <TabsContent value="history" className="m-0">
                  {appointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">No visits yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {appointments.map((apt) => (
                        <div key={apt.id} className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-medium text-foreground">
                              {format(new Date(apt.created_at), 'MMMM d, yyyy')}
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
                      placeholder="Add a clinical note..."
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
                        Add Note
                      </Button>
                    </div>
                  </div>
                  
                  {notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">No notes yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {notes.map((note) => (
                        <div key={note.id} className="p-4">
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-foreground">
                            {note.note_text}
                          </p>
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
                          Upload File
                        </span>
                      </Button>
                    </label>
                  </div>

                  {files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">No files uploaded</p>
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
                              <p className="font-medium text-foreground">{file.file_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(file.created_at), 'MMM d, yyyy')}
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
            <DialogTitle>Edit Patient Information</DialogTitle>
            <DialogDescription>
              Update the patient's details below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit_first_name">First Name *</Label>
                <Input
                  id="edit_first_name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_last_name">Last Name *</Label>
                <Input
                  id="edit_last_name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_illness">Illness / Condition</Label>
              <Input
                id="edit_illness"
                value={editForm.illness}
                onChange={(e) => setEditForm(prev => ({ ...prev, illness: e.target.value }))}
                placeholder="Primary condition or diagnosis"
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
              <Label htmlFor="edit_phone">Phone</Label>
              <Input
                id="edit_phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_dob">Date of Birth</Label>
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
                <h4 className="mb-3 text-sm font-medium">Additional Information</h4>
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
                            <SelectValue placeholder={`Select ${field.label || field.name}`} />
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
                Cancel
              </Button>
              <Button
                onClick={handleSavePatient}
                disabled={saving || !editForm.first_name || !editForm.last_name}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
