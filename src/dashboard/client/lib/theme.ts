import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const KEY = 'swaggerz-dashboard-theme';

function stored(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Applies the stored theme before the first render to avoid a flash of the wrong palette. */
export function applyStoredTheme(): void {
  const theme = stored();
  if (theme !== 'system') document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(stored);
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // The preference is not persisted when storage is unavailable.
    }
  }, [theme]);
  return [theme, setTheme];
}
