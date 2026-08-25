export const ASSET_CATEGORIES = Object.freeze(['biomedical', 'industrial']);

const CATEGORY_ALIASES = new Map([
  ['biomedical', 'biomedical'],
  ['biomedico', 'biomedical'],
  ['biomedica', 'biomedical'],
  ['industrial', 'industrial']
]);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function normalizeAssetCategory(value, defaultValue = 'biomedical') {
  const normalized = normalizeText(value || defaultValue);
  const category = CATEGORY_ALIASES.get(normalized);
  if (!category) {
    const error = new Error('Tipo de equipo no permitido. Usa biomedical o industrial.');
    error.code = 'INVALID_ASSET_CATEGORY';
    throw error;
  }
  return category;
}

export function assetCategoryLabel(value) {
  return normalizeAssetCategory(value) === 'industrial' ? 'industrial' : 'biomédico';
}
