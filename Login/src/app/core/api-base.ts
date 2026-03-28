// Centralized API/public base URL logic so production can run behind the same origin
// (Nginx reverse proxy) while local dev keeps using http://localhost:5050.

function isLocalhostHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getApiBase(): string {
  const w = window as any;
  const override = w.__BCHSOFT_API_BASE__;
  if (typeof override === 'string' && override.trim()) {
    return trimTrailingSlashes(override.trim());
  }

  return isLocalhostHost(window.location.hostname) ? 'http://localhost:5050' : '/api';
}

export function getPublicBase(): string {
  const w = window as any;
  const override = w.__BCHSOFT_PUBLIC_BASE__;
  if (typeof override === 'string' && override.trim()) {
    return trimTrailingSlashes(override.trim());
  }

  // In production we serve /uploads from the same origin (no prefix).
  return isLocalhostHost(window.location.hostname) ? 'http://localhost:5050' : '';
}

export function joinBase(base: string, path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

