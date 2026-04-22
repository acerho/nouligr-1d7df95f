import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
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

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api<PracticeSettings | Record<string, never>>('/api/settings.php');
      setSettings((data as PracticeSettings) ?? null);
    } catch (error) {
      console.error('Error fetching practice settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<PracticeSettings>) => {
    try {
      const data = await api<PracticeSettings>('/api/settings.php', {
        method: 'PUT',
        body: updates,
      });
      setSettings(data);
      return { error: null };
    } catch (error) {
      console.error('Error updating settings:', error);
      return { error: new Error((error as ApiError).message || 'Update failed') };
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
