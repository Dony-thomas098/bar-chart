export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'chord-grid-theme';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const val = localStorage.getItem(THEME_STORAGE_KEY);
  if (val === 'light' || val === 'dark' || val === 'system') {
    return val;
  }
  return 'system';
}

export function applyTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && systemPrefersDark);

  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
}

export function setTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  applyTheme(mode);
  window.dispatchEvent(new CustomEvent('chord-grid-theme-change', { detail: mode }));
}

export function initTheme() {
  if (typeof window === 'undefined') return;

  const current = getStoredTheme();
  applyTheme(current);

  // Listen for OS system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system');
    }
  };

  try {
    mediaQuery.addEventListener('change', handleSystemChange);
  } catch {
    mediaQuery.addListener(handleSystemChange);
  }

  // Listen for storage changes across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) {
      applyTheme(getStoredTheme());
      window.dispatchEvent(new CustomEvent('chord-grid-theme-change', { detail: getStoredTheme() }));
    }
  });
}
