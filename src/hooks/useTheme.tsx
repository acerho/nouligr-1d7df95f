import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeColor = 
  | 'medical-blue' 
  | 'forest-green' 
  | 'royal-purple' 
  | 'warm-coral' 
  | 'ocean-teal'
  | 'sunset-orange';

interface ThemeContextType {
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app-color-theme';

export const themeConfigs: Record<ThemeColor, { name: string; nameEl: string; primary: string; accent: string; preview: string }> = {
  'medical-blue': {
    name: 'Medical Blue',
    nameEl: 'Ιατρικό Μπλε',
    primary: '200 65% 45%',
    accent: '175 50% 45%',
    preview: 'bg-gradient-to-r from-[hsl(200,65%,45%)] to-[hsl(175,50%,45%)]',
  },
  'forest-green': {
    name: 'Forest Green',
    nameEl: 'Δασικό Πράσινο',
    primary: '150 45% 40%',
    accent: '120 40% 45%',
    preview: 'bg-gradient-to-r from-[hsl(150,45%,40%)] to-[hsl(120,40%,45%)]',
  },
  'royal-purple': {
    name: 'Royal Purple',
    nameEl: 'Βασιλικό Μωβ',
    primary: '270 50% 50%',
    accent: '290 45% 55%',
    preview: 'bg-gradient-to-r from-[hsl(270,50%,50%)] to-[hsl(290,45%,55%)]',
  },
  'warm-coral': {
    name: 'Warm Coral',
    nameEl: 'Ζεστό Κοραλί',
    primary: '10 70% 55%',
    accent: '25 80% 55%',
    preview: 'bg-gradient-to-r from-[hsl(10,70%,55%)] to-[hsl(25,80%,55%)]',
  },
  'ocean-teal': {
    name: 'Ocean Teal',
    nameEl: 'Ωκεάνιο Τιρκουάζ',
    primary: '185 60% 40%',
    accent: '170 55% 45%',
    preview: 'bg-gradient-to-r from-[hsl(185,60%,40%)] to-[hsl(170,55%,45%)]',
  },
  'sunset-orange': {
    name: 'Sunset Orange',
    nameEl: 'Πορτοκαλί Ηλιοβασίλεμα',
    primary: '25 85% 50%',
    accent: '40 90% 50%',
    preview: 'bg-gradient-to-r from-[hsl(25,85%,50%)] to-[hsl(40,90%,50%)]',
  },
};

function applyTheme(theme: ThemeColor) {
  const config = themeConfigs[theme];
  const root = document.documentElement;
  
  // Apply primary and accent colors
  root.style.setProperty('--primary', config.primary);
  root.style.setProperty('--accent', config.accent);
  root.style.setProperty('--ring', config.primary);
  root.style.setProperty('--sidebar-primary', config.primary);
  root.style.setProperty('--sidebar-ring', config.primary);
  
  // Update info color to match primary
  root.style.setProperty('--info', config.primary);
  
  // Update medical gradient
  const [h, s, l] = config.primary.split(' ');
  const [ah, as, al] = config.accent.split(' ');
  root.style.setProperty(
    '--medical-gradient',
    `linear-gradient(135deg, hsl(${h}, ${s}, ${l}) 0%, hsl(${ah}, ${as}, ${al}) 100%)`
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColor>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeColor | null;
      return stored && stored in themeConfigs ? stored : 'medical-blue';
    }
    return 'medical-blue';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (newTheme: ThemeColor) => {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
