/** The color theme preference, stored where Starlight's own bootstrapping script reads it. */
export type Theme = 'auto' | 'light' | 'dark';

const KEY = 'starlight-theme';

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(theme: Theme): void {
  const resolved =
    theme === 'auto'
      ? matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme;
  document.documentElement.dataset.theme = resolved;
  try {
    localStorage.setItem(KEY, theme === 'auto' ? '' : theme);
  } catch {
    // Without storage the choice lasts until the page is left.
  }
}
