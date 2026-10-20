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

  // Automatically sync mobile status bar icon style with current theme
  if (typeof window !== 'undefined') {
    import('@capacitor/core')
      .then(({ Capacitor }) => {
        if (Capacitor.isNativePlatform()) {
          import('@capacitor/status-bar')
            .then(({ StatusBar, Style }) => {
              // Style.Dark = light text/icons for dark theme; Style.Light = dark text/icons for light theme
              StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
              StatusBar.setBackgroundColor({ color: '#00000000' }).catch(() => {});
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
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
