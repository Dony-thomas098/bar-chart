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

const updateState: LiveUpdateState = {
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

export function subscribeLiveUpdate(listener: StateListener): () => void {
  listeners.add(listener);
  try {
    listener({ ...updateState });
  } catch (e) {
    console.error('[LiveUpdate] Listener error:', e);
  }

  return () => {
    listeners.delete(listener);
  };
}

export function getLiveUpdateState(): LiveUpdateState {
  return { ...updateState };
}

export async function initLiveUpdate(): Promise<void> {
  // No-op for web/PWA
  return;
}

export async function checkForLiveUpdate(_customUrl?: string): Promise<boolean> {
  // Web and PWA updates are handled by the service worker
  return false;
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener({ ...updateState });
    } catch (e) {
      console.error('[LiveUpdate] Listener error:', e);
    }
  });
}

export function triggerTestUpdateBanner(): void {
  updateState.updateReady = true;
  notifyListeners();
}

export async function applyLiveUpdateNow(): Promise<void> {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
