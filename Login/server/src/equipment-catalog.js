import { query } from './db.js';
import { canonicalizeCatalogValue, normalizeCatalogText } from './equipment-catalog-text.js';

export { canonicalizeCatalogValue, normalizeCatalogText } from './equipment-catalog-text.js';

function cleanCatalogValue(value, label) {
  const text = canonicalizeCatalogValue(value);
  if (text.length > 160) {
    const error = new Error(`${label} supera los 160 caracteres.`);
    error.code = 'CATALOG_VALUE_TOO_LONG';
    throw error;
  }
  return text;
}

export function buildEquipmentCatalogTree(rows = []) {
  const equipmentById = new Map();

  for (const row of rows) {
    let equipment = equipmentById.get(row.equipment_id);
    if (!equipment) {
      equipment = {
        id: row.equipment_id,
        name: row.equipment_name,
        brands: []
      };
      equipmentById.set(row.equipment_id, equipment);
    }

    if (!row.brand_id) continue;
    let brand = equipment.brands.find((item) => item.id === row.brand_id);
    if (!brand) {
      brand = {
        id: row.brand_id,
        name: row.brand_name,
        models: []
      };
      equipment.brands.push(brand);
    }

    if (row.model_id && !brand.models.some((item) => item.id === row.model_id)) {
      brand.models.push({ id: row.model_id, name: row.model_name });
    }
  }

  const compare = (left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' });
  const equipment = Array.from(equipmentById.values());
  equipment.forEach((item) => {
    item.brands.sort(compare);
    item.brands.forEach((brand) => brand.models.sort(compare));
  });
  return equipment.sort(compare);
}

export async function listEquipmentCatalog() {
  const { rows } = await query(
    `SELECT e.id AS equipment_id,
            e.name AS equipment_name,
            b.id AS brand_id,
            b.name AS brand_name,
            m.id AS model_id,
            m.name AS model_name
     FROM biomedical_equipment_catalog e
     LEFT JOIN biomedical_equipment_brands b
       ON b.equipment_id = e.id AND b.is_active = TRUE
     LEFT JOIN biomedical_equipment_models m
       ON m.brand_id = b.id AND m.is_active = TRUE
     WHERE e.is_active = TRUE
     ORDER BY e.name, b.name, m.name`
  );
  return buildEquipmentCatalogTree(rows);
}

export async function ensureEquipmentCatalogPath({
  equipmentName,
  brand,
  model,
  createdBy = null
} = {}) {
  const equipmentValue = cleanCatalogValue(equipmentName, 'El nombre del equipo');
  const brandValue = cleanCatalogValue(brand, 'La marca');
  const modelValue = cleanCatalogValue(model, 'El modelo');

  if (!equipmentValue) {
    return { equipmentId: null, brandId: null, modelId: null };
  }

  const equipmentNormalized = normalizeCatalogText(equipmentValue);
  const { rows: equipmentRows } = await query(
    `INSERT INTO biomedical_equipment_catalog (name, normalized_name, created_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (normalized_name)
     DO UPDATE SET name = EXCLUDED.name, is_active = TRUE, updated_at = NOW()
     RETURNING id, name`,
    [equipmentValue, equipmentNormalized, createdBy]
  );
  const equipmentRow = equipmentRows[0];
  if (!brandValue) {
    return {
      equipmentId: equipmentRow.id,
      brandId: null,
      modelId: null,
      equipmentName: equipmentValue,
      brand: null,
      model: null
    };
  }

  const brandNormalized = normalizeCatalogText(brandValue);
  const { rows: brandRows } = await query(
    `INSERT INTO biomedical_equipment_brands (equipment_id, name, normalized_name, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (equipment_id, normalized_name)
     DO UPDATE SET name = EXCLUDED.name, is_active = TRUE, updated_at = NOW()
     RETURNING id, name`,
    [equipmentRow.id, brandValue, brandNormalized, createdBy]
  );
  const brandRow = brandRows[0];
  if (!modelValue) {
    return {
      equipmentId: equipmentRow.id,
      brandId: brandRow.id,
      modelId: null,
      equipmentName: equipmentValue,
      brand: brandValue,
      model: null
    };
  }

  const modelNormalized = normalizeCatalogText(modelValue);
  const { rows: modelRows } = await query(
    `INSERT INTO biomedical_equipment_models (brand_id, name, normalized_name, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (brand_id, normalized_name)
     DO UPDATE SET name = EXCLUDED.name, is_active = TRUE, updated_at = NOW()
     RETURNING id, name`,
    [brandRow.id, modelValue, modelNormalized, createdBy]
  );

  return {
    equipmentId: equipmentRow.id,
    brandId: brandRow.id,
    modelId: modelRows[0].id,
    equipmentName: equipmentValue,
    brand: brandValue,
    model: modelValue
  };
}
