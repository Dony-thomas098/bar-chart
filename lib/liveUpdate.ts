import { Capacitor } from '@capacitor/core';

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

    // 3. Trigger silent background update check
    setTimeout(() => {
      checkForLiveUpdate().catch((err) => {
        console.debug('[LiveUpdate] Background check error (non-fatal):', err);
      });
    }, 2500);
  } catch (err) {
    console.debug('[LiveUpdate] Initialization skipped or failed:', err);
  }
}

/**
 * Checks the configured OTA endpoint for a new web bundle.
 */
export async function checkForLiveUpdate(customUrl?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const updateUrl =
    customUrl ||
    process.env.NEXT_PUBLIC_LIVE_UPDATE_URL ||
    'https://github.com/Dony-thomas098/bar-chart/releases/latest/download/update.json';

  updateState.isChecking = true;
  updateState.error = null;
  notifyListeners();

  try {
    const { LiveUpdate } = await import('@capawesome/capacitor-live-update');

    const res = await fetch(updateUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    if (!res.ok) {
      throw new Error(`Manifest check failed: HTTP ${res.status}`);
    }

    const manifest: UpdateManifest = await res.json();
    updateState.latestManifest = manifest;

    const current = await LiveUpdate.getCurrentBundle();
    updateState.currentBundleId = current.bundleId;

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
    console.debug('[LiveUpdate] Update check skipped or failed:', message);
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
 * Resets the app to the default bundled APK/IPA web assets in case of troubleshooting.
 */
export async function resetToDefaultBundle(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LiveUpdate } = await import('@capawesome/capacitor-live-update');
    await LiveUpdate.reset();
    await LiveUpdate.reload();
  } catch (e) {
    console.error('[LiveUpdate] Failed to reset to default bundle:', e);
  }
}
