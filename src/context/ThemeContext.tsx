import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@vera_dark_mode';

export interface Theme {
  bg: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  isDark: boolean;
}

const LIGHT: Theme = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  text: '#1A1A2E',
  subtext: '#8E8E93',
  border: '#E5E5EA',
  isDark: false,
};

const DARK: Theme = {
  bg: '#0D1B2A',
  card: '#1A2744',
  text: '#FFFFFF',
  subtext: '#8E9BB5',
  border: '#1E3050',
  isDark: true,
};

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'true') setIsDark(true);
    });
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem(THEME_KEY, String(next));
  }

  return (
    <ThemeContext.Provider value={{ theme: isDark ? DARK : LIGHT, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
