export function canonicalizeCatalogValue(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('es-CO');
}

export function normalizeCatalogText(value) {
  return canonicalizeCatalogValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
