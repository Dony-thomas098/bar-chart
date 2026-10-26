import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '[Supabase] Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing from environment variables. Please check your .env.local file.'
    );
  }
}

// Custom fetch wrapper that prevents unhandled net::ERR_INTERNET_DISCONNECTED when offline
const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.reject(new TypeError('Failed to fetch (offline)'));
  }
  return fetch(input, init);
};

// Fallback to placeholder in headless test environments to prevent createClient constructor crash
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: customFetch as typeof fetch,
    },
  }
);

// Manage autoRefreshToken based on browser online/offline status to prevent ERR_INTERNET_DISCONNECTED polling
if (typeof window !== 'undefined') {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      supabase.auth.stopAutoRefresh();
    } catch {}
  }

  window.addEventListener('online', () => {
    try {
      supabase.auth.startAutoRefresh();
    } catch {}
  });

  window.addEventListener('offline', () => {
    try {
      supabase.auth.stopAutoRefresh();
    } catch {}
  });
}
