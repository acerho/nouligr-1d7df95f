import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { translations, Language, TranslationKeys } from '@/i18n/translations';

interface TranslationContextType {
  t: TranslationKeys;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('app_language');
    return (stored === 'el' || stored === 'en') ? stored : 'el';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('app_language');
      if (stored === 'el' || stored === 'en') {
        setLanguageState(stored);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom language change events
    const handleLanguageChange = (e: CustomEvent<Language>) => {
      setLanguageState(e.detail);
    };
    window.addEventListener('languageChange', handleLanguageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, []);

  const t = translations[language];

  return (
    <TranslationContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
