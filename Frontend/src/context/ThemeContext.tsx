import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Theme = 'mocha' | 'latte';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'mocha',
  toggleTheme: () => {},
  isDark: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('ps-theme');
    if (saved === 'latte' || saved === 'mocha') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'latte' : 'mocha';
  });

  useEffect(() => {
    if (theme === 'latte') {
      document.documentElement.setAttribute('data-theme', 'latte');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('ps-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'mocha' ? 'latte' : 'mocha'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'mocha' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
