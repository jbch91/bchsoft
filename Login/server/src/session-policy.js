const DEFAULT_MAX_ACTIVE_SESSIONS = 3;
const MAX_CONFIGURABLE_SESSIONS = 10;

export function normalizeMaxActiveSessions(value, fallback = DEFAULT_MAX_ACTIVE_SESSIONS) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_CONFIGURABLE_SESSIONS);
}

export function normalizeSessionContext(context = {}) {
  return {
    userAgent: normalizeText(context.userAgent, 500),
    ipAddress: normalizeText(context.ipAddress, 120)
  };
}

export function describeSessionDevice(userAgent) {
  const value = String(userAgent || '');
  if (!value) return 'Dispositivo desconocido';

  let browser = 'Navegador';
  if (/Edg\//i.test(value)) browser = 'Microsoft Edge';
  else if (/CriOS\//i.test(value)) browser = 'Google Chrome';
  else if (/Chrome\//i.test(value)) browser = 'Google Chrome';
  else if (/FxiOS\//i.test(value)) browser = 'Mozilla Firefox';
  else if (/Firefox\//i.test(value)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(value) && /Version\//i.test(value)) browser = 'Safari';

  let device = 'computador';
  if (/iPhone/i.test(value)) device = 'iPhone';
  else if (/iPad/i.test(value)) device = 'iPad';
  else if (/Android/i.test(value) && /Mobile/i.test(value)) device = 'celular Android';
  else if (/Android/i.test(value)) device = 'tableta Android';
  else if (/Macintosh|Mac OS X/i.test(value)) device = 'Mac';
  else if (/Windows/i.test(value)) device = 'Windows';
  else if (/Linux/i.test(value)) device = 'Linux';

  return `${browser} en ${device}`;
}

function normalizeText(value, maxLength) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}
