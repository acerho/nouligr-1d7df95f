import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Patient } from '@/types/database';
import { Search, Users, ChevronRight, Loader2, Plus, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { t, language } = useTranslation();

  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
  });

  const dateLocale = language === 'el' ? el : enUS;

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatients(data as Patient[]);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleCreatePatient = async () => {
    if (!newPatient.first_name.trim() || !newPatient.last_name.trim()) {
      toast.error(t.appointments.enterPatientName);
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .insert({
          first_name: newPatient.first_name.trim(),
          last_name: newPatient.last_name.trim(),
          email: newPatient.email.trim() || null,
          phone: newPatient.phone.trim() || null,
          date_of_birth: newPatient.date_of_birth || null,
        })
        .select()
        .single();

      if (error) throw error;

      setPatients(prev => [data as Patient, ...prev]);
      setNewPatient({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '' });
      setDialogOpen(false);
      toast.success(language === 'el' ? 'Ο ασθενής προστέθηκε' : 'Patient added successfully');
    } catch (error) {
      console.error('Error creating patient:', error);
      toast.error(t.errors.saveFailed);
    } finally {
      setCreating(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) ||
           patient.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           patient.phone?.includes(searchTerm);
  });

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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {language === 'el' ? 'Νέος Ασθενής' : 'Add Patient'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
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
              <div className="space-y-4 pt-4">
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
                <div className="space-y-2">
                  <Label htmlFor="dob">{t.patients.dob}</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={newPatient.date_of_birth}
                    onChange={(e) => setNewPatient(prev => ({ ...prev, date_of_birth: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
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
              </div>
            </DialogContent>
          </Dialog>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.common.name}</TableHead>
                    <TableHead>{t.common.contact}</TableHead>
                    <TableHead>{t.common.registered}</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                            <span className="text-sm font-medium text-primary">
                              {patient.first_name[0]}{patient.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {patient.first_name} {patient.last_name}
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
                        <Link to={`/patients/${patient.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
