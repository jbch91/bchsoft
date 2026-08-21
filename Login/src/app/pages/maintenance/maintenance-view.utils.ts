export interface MaintenanceAssetLookup {
  id: string;
  code?: string | null;
  serial?: string | null;
}

const IGNORED_LOOKUP_VALUES = new Set([
  'nr',
  'n/a',
  'na',
  'no registra',
  'sin serie',
  'sin serial'
]);

export function normalizeMaintenanceLookup(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function maintenanceAssetMatchesLookup(asset: MaintenanceAssetLookup, rawValue: string): boolean {
  const normalizedRaw = normalizeMaintenanceLookup(rawValue);
  if (!normalizedRaw) return false;

  const lookupTokens = new Set([normalizedRaw]);
  try {
    const url = new URL(rawValue);
    for (const key of ['assetId', 'asset', 'id', 'code', 'serial']) {
      const value = normalizeMaintenanceLookup(url.searchParams.get(key));
      if (value) lookupTokens.add(value);
    }
    const pathToken = normalizeMaintenanceLookup(url.pathname.split('/').filter(Boolean).at(-1));
    if (pathToken) lookupTokens.add(pathToken);
  } catch {
    // Los códigos y seriales escritos manualmente no tienen que ser una URL.
  }

  return [asset.id, asset.code, asset.serial]
    .map((value) => normalizeMaintenanceLookup(value))
    .filter((value) => value && !IGNORED_LOOKUP_VALUES.has(value))
    .some((candidate) =>
      lookupTokens.has(candidate) || (candidate.length >= 4 && normalizedRaw.includes(candidate))
    );
}
