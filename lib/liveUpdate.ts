import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface UpdateManifest {
  version: string;
  bundleId: string;
  url: string;
  checksum?: string;
  releaseDate?: string;
  notes?: string;
}

export interface LiveUpdateState {
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  updateReady: boolean;
  currentBundleId: string | null;
  latestManifest: UpdateManifest | null;
  error: string | null;
}

let updateState: LiveUpdateState = {
  isChecking: false,
  isDownloading: false,
  downloadProgress: 0,
  updateReady: false,
  currentBundleId: null,
  latestManifest: null,
  error: null,
};

type StateListener = (state: LiveUpdateState) => void;
const listeners = new Set<StateListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener({ ...updateState });
    } catch (e) {
      console.error('[LiveUpdate] Listener error:', e);
    }
  });
}

export function subscribeLiveUpdate(listener: StateListener): () => void {
  listeners.add(listener);
  listener({ ...updateState });
  return () => {
    listeners.delete(listener);
  };
}

export function getLiveUpdateState(): LiveUpdateState {
  return { ...updateState };
}

/**
 * Robustly fetches the update manifest across native and webview environments.
 * Uses native CapacitorHttp on Android & iOS to bypass WebView CORS policies and follow 302 redirects.
 */
async function fetchUpdateManifest(candidateUrls: string[]): Promise<UpdateManifest> {
  let lastError: any = null;

  for (const url of candidateUrls) {
    // 1. Try CapacitorHttp first on native devices (Java/Swift, zero CORS restrictions, follows 302 redirects)
    if (Capacitor.isNativePlatform() && CapacitorHttp) {
      try {
        console.log('[LiveUpdate] Fetching manifest via CapacitorHttp:', url);
        const res = await CapacitorHttp.get({
          url,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        if (res.status === 200 && res.data) {
          const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          if (parsed && parsed.bundleId) {
            console.log('[LiveUpdate] Successfully fetched manifest via CapacitorHttp from:', url);
            return parsed as UpdateManifest;
          }
        }
      } catch (nativeErr) {
        lastError = nativeErr;
        console.debug('[LiveUpdate] CapacitorHttp attempt failed for', url, nativeErr);
      }
    }

    // 2. Fallback to standard fetch (works for raw.githubusercontent.com and CORS-enabled hosts)
    try {
      console.log('[LiveUpdate] Fetching manifest via standard fetch:', url);
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (res.ok) {
        const parsed = await res.json();
        if (parsed && parsed.bundleId) {
          console.log('[LiveUpdate] Successfully fetched manifest via fetch from:', url);
          return parsed as UpdateManifest;
        }
      }
    } catch (fetchErr) {
      lastError = fetchErr;
      console.debug('[LiveUpdate] Standard fetch attempt failed for', url, fetchErr);
    }
  }

  throw lastError || new Error('Failed to fetch update manifest from all candidate endpoints.');
}

/**
 * Initializes Live Update on native devices.
 * 1. Calls ready() to notify native watchdog that the current bundle booted cleanly.
 * 2. Runs a background check for newer bundles.
 */
export async function initLiveUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const { LiveUpdate } = await import('@capawesome/capacitor-live-update');

    // 1. Mark app as ready to prevent rollback watchdog timeout
    const readyResult = await LiveUpdate.ready();
    console.log('[LiveUpdate] App marked ready:', readyResult);

    const current = await LiveUpdate.getCurrentBundle();
    updateState.currentBundleId = current.bundleId;
    notifyListeners();

    // 2. Listen for download progress
    LiveUpdate.addListener('downloadBundleProgress', (event) => {
      updateState.downloadProgress = Math.round(event.progress * 100);
      notifyListeners();
    });

    // 3. Trigger background update check after 2 seconds
    setTimeout(() => {
      checkForLiveUpdate().catch((err) => {
        console.debug('[LiveUpdate] Background check error (non-fatal):', err);
      });
    }, 2000);
  } catch (err) {
    console.debug('[LiveUpdate] Initialization skipped or failed:', err);
  }
}

/**
 * Checks configured OTA endpoints for a new web bundle.
 */
export async function checkForLiveUpdate(customUrl?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const candidateUrls = [
    customUrl,
    process.env.NEXT_PUBLIC_LIVE_UPDATE_URL,
    'https://raw.githubusercontent.com/Dony-thomas098/bar-chart/main/public/update.json',
    'https://github.com/Dony-thomas098/bar-chart/releases/latest/download/update.json',
  ].filter(Boolean) as string[];

  updateState.isChecking = true;
  updateState.error = null;
  notifyListeners();

  try {
    const { LiveUpdate } = await import('@capawesome/capacitor-live-update');

    const manifest = await fetchUpdateManifest(candidateUrls);
    updateState.latestManifest = manifest;

    const current = await LiveUpdate.getCurrentBundle();
    updateState.currentBundleId = current.bundleId;

    console.log(`[LiveUpdate] Active bundle: ${current.bundleId || 'default (built-in)'}`);
    console.log(`[LiveUpdate] Remote bundle: ${manifest.bundleId}`);

    // Check if the remote bundleId is different from active bundle
    if (manifest.bundleId && manifest.bundleId !== current.bundleId && manifest.url) {
      console.log(
        `[LiveUpdate] New bundle available: ${manifest.bundleId} (active: ${current.bundleId || 'default'})`
      );

      // Download bundle silently
      updateState.isDownloading = true;
      notifyListeners();

      await LiveUpdate.downloadBundle({
        bundleId: manifest.bundleId,
        url: manifest.url,
        checksum: manifest.checksum,
        artifactType: 'zip',
      });

      // Stage bundle for next app restart
      await LiveUpdate.setNextBundle({
        bundleId: manifest.bundleId,
      });

      updateState.isDownloading = false;
      updateState.updateReady = true;
      notifyListeners();

      console.log(`[LiveUpdate] Bundle ${manifest.bundleId} downloaded & staged successfully.`);
      return true;
    } else {
      console.log('[LiveUpdate] App bundle is up to date.');
      return false;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[LiveUpdate] Update check failed:', message);
    updateState.error = message;
    return false;
  } finally {
    updateState.isChecking = false;
    updateState.isDownloading = false;
    notifyListeners();
  }
}

/**
 * Applies the downloaded update immediately by reloading the webview.
 */
export async function applyLiveUpdateNow(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    window.location.reload();
    return;
  }

  try {
    const { LiveUpdate } = await import('@capawesome/capacitor-live-update');
    await LiveUpdate.reload();
  } catch (e) {
    console.error('[LiveUpdate] Failed to reload webview:', e);
    window.location.reload();
  }
}

/**
 * Triggers the update ready banner for UI testing and verification.
 */
export function triggerTestUpdateBanner(): void {
  updateState.updateReady = true;
  updateState.latestManifest = {
    version: '0.1.0',
    bundleId: 'bundle-test-preview',
    url: '',
    notes: 'Test update banner preview'
  };
  notifyListeners();
}

if (typeof window !== 'undefined') {
  (window as any).__testOtaBanner = triggerTestUpdateBanner;
}

