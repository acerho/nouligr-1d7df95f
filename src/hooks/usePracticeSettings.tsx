import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PracticeSettings } from '@/types/database';

interface PracticeSettingsContextType {
  settings: PracticeSettings | null;
  loading: boolean;
  updateSettings: (updates: Partial<PracticeSettings>) => Promise<{ error: Error | null }>;
  refetch: () => Promise<void>;
}

const PracticeSettingsContext = createContext<PracticeSettingsContextType | undefined>(undefined);

export function PracticeSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      // First try to get full settings (for authenticated staff)
      const { data: fullData, error: fullError } = await supabase
        .from('practice_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!fullError && fullData) {
        setSettings(fullData as unknown as PracticeSettings);
        setLoading(false);
        return;
      }

      // Fallback to public view for unauthenticated users (excludes sensitive API keys)
      const { data: publicData, error: publicError } = await supabase
        .from('practice_settings_public')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (publicError) throw publicError;
      setSettings(publicData as unknown as PracticeSettings);
    } catch (error) {
      console.error('Error fetching practice settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (updates: Partial<PracticeSettings>) => {
    if (!settings?.id) return { error: new Error('No settings found') };

    try {
      const { error } = await supabase
        .from('practice_settings')
        .update(updates as any)
        .eq('id', settings.id);

      if (error) throw error;
      
      setSettings(prev => prev ? { ...prev, ...updates } : null);
      return { error: null };
    } catch (error) {
      console.error('Error updating settings:', error);
      return { error: error as Error };
    }
  };

  return (
    <PracticeSettingsContext.Provider value={{ settings, loading, updateSettings, refetch: fetchSettings }}>
      {children}
    </PracticeSettingsContext.Provider>
  );
}

export function usePracticeSettings() {
  const context = useContext(PracticeSettingsContext);
  if (context === undefined) {
    throw new Error('usePracticeSettings must be used within a PracticeSettingsProvider');
  }
  return context;
}
