import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Patient } from '@/types/database';
import { Search, Users, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { useTranslation } from '@/hooks/useTranslation';

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { t, language } = useTranslation();

  const dateLocale = language === 'el' ? el : enUS;

  useEffect(() => {
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

    fetchPatients();
  }, []);

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
