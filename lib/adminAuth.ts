const DEFAULT_ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234';
const ADMIN_PIN_KEY = 'chord-grid-admin-pin';

export function getAdminPasscode(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_ADMIN_PIN;
  }
  return DEFAULT_ADMIN_PIN;
}

export function verifyAdminPasscode(input: string): boolean {
  if (!input) return false;
  return input.trim() === getAdminPasscode().trim();
}

export function setAdminPasscode(newPin: string): void {
  if (typeof window !== 'undefined' && newPin.trim()) {
    localStorage.setItem(ADMIN_PIN_KEY, newPin.trim());
  }
}
