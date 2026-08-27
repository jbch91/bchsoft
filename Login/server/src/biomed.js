import { query, withTransaction } from './db.js';
import { canonicalizeCatalogValue, ensureEquipmentCatalogPath } from './equipment-catalog.js';
import { assertBiomedicalRiskClassifications } from './biomedical-risk.js';
import { normalizeAssetCategory } from './asset-category.js';
import { assetWarrantyReleaseDate, dateOnlyFromDatabase } from './schedule-workflow.js';

async function getSchemaByClientId(clientId) {
  const { rows } = await query('SELECT schema_name FROM clients WHERE id = $1', [clientId]);
  return rows[0]?.schema_name;
}

export async function listAreas(clientId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT ar.id, ar.name, ar.site_id, s.name AS site_name
     FROM "${schema}".areas ar
     LEFT JOIN "${schema}".sites s ON s.id = ar.site_id
     ORDER BY s.name NULLS FIRST, ar.name`
  );
  return rows;
}

export async function listSites(clientId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT id, name, address FROM "${schema}".sites ORDER BY name`
  );
  return rows;
}

export async function listSitesForScopedUser(clientId, userId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT DISTINCT s.id, s.name, s.address
     FROM "${schema}".sites s
     JOIN "${schema}".areas ar ON ar.site_id = s.id
     WHERE ar.id IN (
       SELECT ra.area_id
       FROM reader_access ra
       WHERE ra.user_id = $1 AND ra.client_id = $2 AND ra.area_id IS NOT NULL
       UNION
       SELECT lo.area_id
       FROM reader_access ra
       JOIN "${schema}".locations lo ON lo.id = ra.location_id
       WHERE ra.user_id = $1 AND ra.client_id = $2 AND ra.location_id IS NOT NULL
     )
     ORDER BY s.name`,
    [userId, clientId]
  );
  return rows;
}

export async function createSite(clientId, name, address) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows: existing } = await query(
    `SELECT id FROM "${schema}".sites WHERE LOWER(name) = LOWER($1)`,
    [name]
  );
  if (existing.length) {
    throw new Error('Sede ya existe');
  }
  const { rows } = await query(
    `INSERT INTO "${schema}".sites (name, address) VALUES ($1,$2) RETURNING id`,
    [name, address || null]
  );
  return rows[0];
}

export async function updateSite(clientId, siteId, payload) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`UPDATE "${schema}".sites SET name = $1, address = $2 WHERE id = $3`, [
    payload.name,
    payload.address || null,
    siteId
  ]);
}

export async function deleteSite(clientId, siteId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM "${schema}".areas WHERE site_id = $1) AS areas_count,
       (SELECT COUNT(*)::int FROM "${schema}".assets WHERE site_id = $1) AS assets_count`,
    [siteId]
  );
  if ((rows[0]?.areas_count || 0) > 0 || (rows[0]?.assets_count || 0) > 0) {
    throw new Error('SITE_IN_USE');
  }
  await query(`DELETE FROM "${schema}".sites WHERE id = $1`, [siteId]);
}

export async function createArea(clientId, name, siteId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows: existing } = await query(
    `SELECT id FROM "${schema}".areas WHERE LOWER(name) = LOWER($1) AND site_id IS NOT DISTINCT FROM $2`,
    [name, siteId || null]
  );
  if (existing.length) {
    throw new Error('Área ya existe');
  }
  const { rows } = await query(
    `INSERT INTO "${schema}".areas (site_id, name) VALUES ($1,$2) RETURNING id`,
    [siteId || null, name]
  );
  return rows[0];
}

export async function listLocations(clientId, areaId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  if (areaId) {
    const { rows } = await query(
      `SELECT lo.id, lo.name, lo.area_id, ar.name AS area_name, ar.site_id, s.name AS site_name
       FROM "${schema}".locations lo
       LEFT JOIN "${schema}".areas ar ON ar.id = lo.area_id
       LEFT JOIN "${schema}".sites s ON s.id = ar.site_id
       WHERE lo.area_id = $1
       ORDER BY lo.name`,
      [areaId]
    );
    return rows;
  }
  const { rows } = await query(
    `SELECT lo.id, lo.name, lo.area_id, ar.name AS area_name, ar.site_id, s.name AS site_name
     FROM "${schema}".locations lo
     LEFT JOIN "${schema}".areas ar ON ar.id = lo.area_id
     LEFT JOIN "${schema}".sites s ON s.id = ar.site_id
     ORDER BY s.name NULLS FIRST, ar.name NULLS FIRST, lo.name`
  );
  return rows;
}

export async function listAreasForScopedUser(clientId, userId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT DISTINCT ar.id, ar.name, ar.site_id, s.name AS site_name
     FROM "${schema}".areas ar
     LEFT JOIN "${schema}".sites s ON s.id = ar.site_id
     WHERE ar.id IN (
       SELECT ra.area_id
       FROM reader_access ra
       WHERE ra.user_id = $1 AND ra.client_id = $2 AND ra.area_id IS NOT NULL
       UNION
       SELECT lo.area_id
       FROM reader_access ra
       JOIN "${schema}".locations lo ON lo.id = ra.location_id
       WHERE ra.user_id = $1 AND ra.client_id = $2 AND ra.location_id IS NOT NULL
     )
     ORDER BY s.name NULLS FIRST, ar.name`,
    [userId, clientId]
  );
  return rows;
}

export async function listLocationsForScopedUser(clientId, userId, areaId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT DISTINCT lo.id, lo.name, lo.area_id, ar.name AS area_name, ar.site_id, s.name AS site_name
     FROM "${schema}".locations lo
     LEFT JOIN "${schema}".areas ar ON ar.id = lo.area_id
     LEFT JOIN "${schema}".sites s ON s.id = ar.site_id
     WHERE (
       lo.area_id IN (
         SELECT ra.area_id
         FROM reader_access ra
         WHERE ra.user_id = $1 AND ra.client_id = $2 AND ra.area_id IS NOT NULL
       )
       OR lo.id IN (
         SELECT ra.location_id
         FROM reader_access ra
         WHERE ra.user_id = $1 AND ra.client_id = $2 AND ra.location_id IS NOT NULL
       )
     )
       AND ($3::uuid IS NULL OR lo.area_id = $3::uuid)
     ORDER BY s.name NULLS FIRST, ar.name NULLS FIRST, lo.name`,
    [userId, clientId, areaId || null]
  );
  return rows;
}

export async function createLocation(clientId, areaId, name) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `INSERT INTO "${schema}".locations (area_id, name) VALUES ($1,$2) RETURNING id`,
    [areaId, name]
  );
  return rows[0];
}

export async function updateArea(clientId, areaId, payload) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`UPDATE "${schema}".areas SET name = $1, site_id = $2 WHERE id = $3`, [
    payload.name,
    payload.siteId || null,
    areaId
  ]);
}

export async function deleteArea(clientId, areaId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`DELETE FROM "${schema}".areas WHERE id = $1`, [areaId]);
}

export async function updateLocation(clientId, locationId, payload) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { name, areaId } = payload;
  await query(
    `UPDATE "${schema}".locations SET name = $1, area_id = $2 WHERE id = $3`,
    [name, areaId || null, locationId]
  );
}

export async function deleteLocation(clientId, locationId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`DELETE FROM "${schema}".locations WHERE id = $1`, [locationId]);
}

export async function listAssets(clientId, { assetCategory = null } = {}) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const category = assetCategory ? normalizeAssetCategory(assetCategory) : null;
  const params = category ? [clientId, category] : [clientId];
  const categoryWhere = category ? 'WHERE a.asset_category = $2' : '';
  const { rows } = await query(
    `SELECT a.id, a.asset_category, a.code, a.name, a.brand, a.model, a.serial, a.location, a.status, a.created_at,
            a.photo_path, a.invima_reg, a.risk_class, a.requires_sanitary_classification,
            a.requires_electrical_classification, a.electrical_protection_class, a.applied_part_type,
            a.is_mobile, a.manufacturer,
            a.acquisition_type, a.contract_text, a.acquisition_date, a.useful_life_years, a.warranty_years,
            a.supplier_name, a.supplier_phone, a.supplier_email, a.power_type, a.voltage,
            a.temp_min, a.temp_max, a.humidity_min, a.humidity_max,
            a.maintenance_frequency, a.requires_calibration, a.calibration_frequency,
            a.equipment_catalog_model_id,
            a.hv_engineer_user_id, a.hv_engineer_signed_at,
            hu.display_name AS hv_engineer_name, hu.signature_path AS hv_engineer_signature_path,
            hu.invima_registration AS hv_engineer_invima_registration,
            EXISTS (
              SELECT 1
              FROM maintenance_requests maintenance_request
              WHERE maintenance_request.client_id = $1
                AND maintenance_request.asset_id = a.id
                AND maintenance_request.status = 'espera_repuesto'
            ) AS has_pending_spare,
            a.site_id, s.name AS site_name, a.area_id, a.location_id, ar.name AS area_name, lo.name AS location_name
     FROM "${schema}".assets a
     LEFT JOIN "${schema}".sites s ON s.id = a.site_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     LEFT JOIN "${schema}".locations lo ON lo.id = a.location_id
     LEFT JOIN public.users hu ON hu.id = a.hv_engineer_user_id
     ${categoryWhere}
     ORDER BY created_at DESC`,
    params
  );
  return rows;
}

export async function listAssetsForBlankMaintenanceProtocols(
  clientId,
  { assetIds = null, assetCategory = null, limit = 501 } = {}
) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const selected = Array.isArray(assetIds) ? assetIds : null;
  const params = [];
  let selectedClause = '';
  let categoryClause = '';
  if (assetCategory) {
    params.push(normalizeAssetCategory(assetCategory));
    categoryClause = `AND a.asset_category = $${params.length}`;
  }
  if (selected) {
    params.push(selected);
    selectedClause = `AND a.id = ANY($${params.length}::uuid[])`;
  }
  params.push(limit);
  const { rows } = await query(
    `SELECT a.id, a.asset_category, a.code, a.name, a.brand, a.model, a.serial, a.status,
            a.manufacturer, a.maintenance_frequency,
            s.name AS site_name, ar.name AS area_name, lo.name AS location_name
     FROM "${schema}".assets a
     LEFT JOIN "${schema}".sites s ON s.id = a.site_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     LEFT JOIN "${schema}".locations lo ON lo.id = a.location_id
     WHERE COALESCE(a.status, 'activo') <> 'dado_de_baja'
       ${categoryClause}
       ${selectedClause}
     ORDER BY
       COALESCE(s.name, ''),
       COALESCE(ar.name, ''),
       COALESCE(lo.name, ''),
       COALESCE(a.code, ''),
       COALESCE(a.name, '')
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

export async function listAssetsForReader(clientId, userId, { assetCategory = null } = {}) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows: accessRows } = await query(
    'SELECT area_id, location_id FROM reader_access WHERE user_id = $1 AND client_id = $2',
    [userId, clientId]
  );
  const areaIds = accessRows.filter((row) => row.area_id).map((row) => row.area_id);
  const locationIds = accessRows.filter((row) => row.location_id).map((row) => row.location_id);
  if (!areaIds.length && !locationIds.length) {
    return [];
  }

  let where = '';
  const params = [clientId];
  if (locationIds.length && areaIds.length) {
    params.push(locationIds, areaIds);
    where = 'AND (a.location_id = ANY($2) OR a.area_id = ANY($3))';
  } else if (locationIds.length) {
    params.push(locationIds);
    where = 'AND a.location_id = ANY($2)';
  } else {
    params.push(areaIds);
    where = 'AND a.area_id = ANY($2)';
  }
  if (assetCategory) {
    params.push(normalizeAssetCategory(assetCategory));
    where += ` AND a.asset_category = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT a.id, a.asset_category, a.code, a.name, a.brand, a.model, a.serial, a.location, a.status, a.created_at,
            a.photo_path, a.invima_reg, a.risk_class, a.requires_sanitary_classification,
            a.requires_electrical_classification, a.electrical_protection_class, a.applied_part_type,
            a.is_mobile, a.manufacturer,
            a.acquisition_type, a.contract_text, a.acquisition_date, a.useful_life_years, a.warranty_years,
            a.supplier_name, a.supplier_phone, a.supplier_email, a.power_type, a.voltage,
            a.temp_min, a.temp_max, a.humidity_min, a.humidity_max,
            a.maintenance_frequency, a.requires_calibration, a.calibration_frequency,
            a.equipment_catalog_model_id,
            a.hv_engineer_user_id, a.hv_engineer_signed_at,
            hu.display_name AS hv_engineer_name, hu.signature_path AS hv_engineer_signature_path,
            hu.invima_registration AS hv_engineer_invima_registration,
            EXISTS (
              SELECT 1
              FROM maintenance_requests maintenance_request
              WHERE maintenance_request.client_id = $1
                AND maintenance_request.asset_id = a.id
                AND maintenance_request.status = 'espera_repuesto'
            ) AS has_pending_spare,
            a.site_id, s.name AS site_name, a.area_id, a.location_id, ar.name AS area_name, lo.name AS location_name
     FROM "${schema}".assets a
     LEFT JOIN "${schema}".sites s ON s.id = a.site_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     LEFT JOIN "${schema}".locations lo ON lo.id = a.location_id
     LEFT JOIN public.users hu ON hu.id = a.hv_engineer_user_id
     WHERE 1=1 ${where}
     ORDER BY created_at DESC`,
    params
  );
  return rows;
}

export async function readerCanAccessAsset(clientId, userId, assetId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows: accessRows } = await query(
    'SELECT area_id, location_id FROM reader_access WHERE user_id = $1 AND client_id = $2',
    [userId, clientId]
  );
  const areaIds = accessRows.filter((row) => row.area_id).map((row) => row.area_id);
  const locationIds = accessRows.filter((row) => row.location_id).map((row) => row.location_id);
  if (!areaIds.length && !locationIds.length) {
    return false;
  }

  let where = '';
  let params = [];
  if (locationIds.length && areaIds.length) {
    where = 'AND (a.location_id = ANY($2) OR a.area_id = ANY($3))';
    params = [assetId, locationIds, areaIds];
  } else if (locationIds.length) {
    where = 'AND a.location_id = ANY($2)';
    params = [assetId, locationIds];
  } else {
    where = 'AND a.area_id = ANY($2)';
    params = [assetId, areaIds];
  }

  const { rows } = await query(
    `SELECT a.id
     FROM "${schema}".assets a
     WHERE a.id = $1 ${where}
     LIMIT 1`,
    params
  );
  return rows.length > 0;
}

export async function getAssetById(clientId, assetId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT a.*, s.name AS site_name, ar.name AS area_name, lo.name AS location_name,
            hu.display_name AS hv_engineer_name,
            hu.signature_path AS hv_engineer_signature_path,
            hu.invima_registration AS hv_engineer_invima_registration,
            hu.document_type AS hv_engineer_document_type,
            hu.document_number AS hv_engineer_document_number
     FROM "${schema}".assets a
     LEFT JOIN "${schema}".sites s ON s.id = a.site_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     LEFT JOIN "${schema}".locations lo ON lo.id = a.location_id
     LEFT JOIN public.users hu ON hu.id = a.hv_engineer_user_id
     WHERE a.id = $1`,
    [assetId]
  );
  const asset = rows[0];
  if (!asset) {
    return null;
  }

  const accessories = await query(
    `SELECT id, name, quantity, brand, serial FROM "${schema}".asset_accessories WHERE asset_id = $1`,
    [assetId]
  );
  const cleaning = await query(
    `SELECT id, procedure, frequency, responsible FROM "${schema}".asset_cleaning WHERE asset_id = $1`,
    [assetId]
  );
  const recommendations = await query(
    `SELECT id, text FROM "${schema}".asset_recommendations WHERE asset_id = $1`,
    [assetId]
  );
  const documents = await query(
    `SELECT id, doc_type, file_path FROM "${schema}".asset_documents WHERE asset_id = $1`,
    [assetId]
  );

  return {
    ...asset,
    accessories: accessories.rows,
    cleaning: cleaning.rows,
    recommendations: recommendations.rows,
    documents: documents.rows
  };
}

export async function createAsset(clientId, payload) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }

  const {
    code,
    name,
    brand,
    model,
    serial,
    invimaReg,
    siteId,
    areaId,
    locationId,
    riskClass,
    requiresSanitaryClassification,
    requiresElectricalClassification,
    electricalProtectionClass,
    appliedPartType,
    isMobile,
    manufacturer,
    acquisitionType,
    contractText,
    acquisitionDate,
    usefulLifeYears,
    warrantyYears,
    supplierName,
    supplierPhone,
    supplierEmail,
    powerType,
    voltage,
    tempMin,
    tempMax,
    humidityMin,
    humidityMax,
    maintenanceFrequency,
    requiresCalibration,
    calibrationFrequency,
    assetCategory,
    hvEngineerUserId,
    catalogCreatedBy
  } = payload;
  const equipmentName = canonicalizeCatalogValue(name);
  const equipmentBrand = canonicalizeCatalogValue(brand);
  const equipmentModel = canonicalizeCatalogValue(model);
  const category = normalizeAssetCategory(assetCategory);
  const risk = category === 'industrial'
    ? {
        riskClass: null,
        requiresSanitaryClassification: false,
        requiresElectricalClassification: false,
        electricalProtectionClass: null,
        appliedPartType: null
      }
    : assertBiomedicalRiskClassifications({
        riskClass,
        requiresSanitaryClassification,
        requiresElectricalClassification,
        electricalProtectionClass,
        appliedPartType
      });
  const assetRequiresCalibration = category === 'industrial' ? false : Boolean(requiresCalibration);
  const assetCalibrationFrequency = assetRequiresCalibration ? calibrationFrequency : null;
  assetWarrantyReleaseDate({ acquisitionDate, warrantyYears });
  const catalogPath = await ensureEquipmentCatalogPath({
    equipmentName,
    brand: equipmentBrand,
    model: equipmentModel,
    assetCategory: category,
    submittedBy: catalogCreatedBy,
    submittedClientId: clientId
  });
  const { rows } = await query(
    `INSERT INTO "${schema}".assets
     (code, name, brand, model, serial, invima_reg, site_id, area_id, location_id, risk_class,
      requires_sanitary_classification, requires_electrical_classification, electrical_protection_class, applied_part_type,
      is_mobile, manufacturer,
      acquisition_type, contract_text, acquisition_date, useful_life_years, warranty_years,
      supplier_name, supplier_phone, supplier_email, power_type, voltage, temp_min, temp_max,
      humidity_min, humidity_max, maintenance_frequency, requires_calibration, calibration_frequency,
      asset_category, hv_engineer_user_id, hv_engineer_signed_at, equipment_catalog_model_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
             $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,
             $34,$35, CASE WHEN $35::uuid IS NULL THEN NULL ELSE NOW() END, $36)
     RETURNING id`,
    [
      code,
      equipmentName,
      equipmentBrand || null,
      equipmentModel || null,
      serial,
      invimaReg,
      siteId,
      areaId,
      locationId,
      risk.riskClass,
      risk.requiresSanitaryClassification,
      risk.requiresElectricalClassification,
      risk.electricalProtectionClass,
      risk.appliedPartType,
      isMobile,
      manufacturer,
      acquisitionType,
      contractText,
      acquisitionDate,
      usefulLifeYears,
      warrantyYears,
      supplierName,
      supplierPhone,
      supplierEmail,
      powerType,
      voltage,
      tempMin,
      tempMax,
      humidityMin,
      humidityMax,
      maintenanceFrequency,
      assetRequiresCalibration,
      assetCalibrationFrequency,
      category,
      hvEngineerUserId || null,
      catalogPath.modelId
    ]
  );
  return {
    ...rows[0],
    catalogReview: {
      status: catalogPath.reviewStatus,
      pendingNodes: catalogPath.pendingNodes
    }
  };
}

export async function setAssetPhoto(clientId, assetId, photoPath) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(
    `UPDATE "${schema}".assets SET photo_path = $1 WHERE id = $2`,
    [photoPath, assetId]
  );
}

export async function updateAsset(clientId, assetId, payload) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const {
    code,
    name,
    brand,
    model,
    serial,
    invimaReg,
    siteId,
    areaId,
    locationId,
    riskClass,
    requiresSanitaryClassification,
    requiresElectricalClassification,
    electricalProtectionClass,
    appliedPartType,
    isMobile,
    manufacturer,
    acquisitionType,
    contractText,
    acquisitionDate,
    usefulLifeYears,
    warrantyYears,
    supplierName,
    supplierPhone,
    supplierEmail,
    powerType,
    voltage,
    tempMin,
    tempMax,
    humidityMin,
    humidityMax,
    maintenanceFrequency,
    requiresCalibration,
    calibrationFrequency,
    assetCategory,
    hvEngineerUserId,
    catalogCreatedBy
  } = payload;
  const equipmentName = canonicalizeCatalogValue(name);
  const equipmentBrand = canonicalizeCatalogValue(brand);
  const equipmentModel = canonicalizeCatalogValue(model);
  const category = normalizeAssetCategory(assetCategory);
  const risk = category === 'industrial'
    ? {
        riskClass: null,
        requiresSanitaryClassification: false,
        requiresElectricalClassification: false,
        electricalProtectionClass: null,
        appliedPartType: null
      }
    : assertBiomedicalRiskClassifications({
        riskClass,
        requiresSanitaryClassification,
        requiresElectricalClassification,
        electricalProtectionClass,
        appliedPartType
      });
  const assetRequiresCalibration = category === 'industrial' ? false : Boolean(requiresCalibration);
  const assetCalibrationFrequency = assetRequiresCalibration ? calibrationFrequency : null;
  assetWarrantyReleaseDate({ acquisitionDate, warrantyYears });
  const catalogPath = await ensureEquipmentCatalogPath({
    equipmentName,
    brand: equipmentBrand,
    model: equipmentModel,
    assetCategory: category,
    submittedBy: catalogCreatedBy,
    submittedClientId: clientId
  });
  await query(
    `UPDATE "${schema}".assets
     SET code = $1, name = $2, brand = $3, model = $4, serial = $5,
         invima_reg = $6, site_id = $7, area_id = $8, location_id = $9, risk_class = $10,
         requires_sanitary_classification = $11, requires_electrical_classification = $12,
         electrical_protection_class = $13, applied_part_type = $14,
         is_mobile = $15, manufacturer = $16,
         acquisition_type = $17, contract_text = $18, acquisition_date = $19,
         useful_life_years = $20, warranty_years = $21, supplier_name = $22,
         supplier_phone = $23, supplier_email = $24, power_type = $25, voltage = $26,
         temp_min = $27, temp_max = $28, humidity_min = $29, humidity_max = $30,
         maintenance_frequency = $31, requires_calibration = $32, calibration_frequency = $33,
         asset_category = $34,
         hv_engineer_user_id = COALESCE($35::uuid, hv_engineer_user_id),
         hv_engineer_signed_at = CASE WHEN $35::uuid IS NULL THEN hv_engineer_signed_at ELSE NOW() END,
         equipment_catalog_model_id = $36
     WHERE id = $37`,
    [
      code,
      equipmentName,
      equipmentBrand || null,
      equipmentModel || null,
      serial,
      invimaReg,
      siteId || null,
      areaId || null,
      locationId || null,
      risk.riskClass,
      risk.requiresSanitaryClassification,
      risk.requiresElectricalClassification,
      risk.electricalProtectionClass,
      risk.appliedPartType,
      isMobile,
      manufacturer,
      acquisitionType,
      contractText,
      acquisitionDate,
      usefulLifeYears,
      warrantyYears,
      supplierName,
      supplierPhone,
      supplierEmail,
      powerType,
      voltage,
      tempMin,
      tempMax,
      humidityMin,
      humidityMax,
      maintenanceFrequency,
      assetRequiresCalibration,
      assetCalibrationFrequency,
      category,
      hvEngineerUserId || null,
      catalogPath.modelId,
      assetId
    ]
  );
  return {
    catalogReview: {
      status: catalogPath.reviewStatus,
      pendingNodes: catalogPath.pendingNodes
    }
  };
}

export async function updateAssetStatus(clientId, assetId, status) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`UPDATE "${schema}".assets SET status = $1 WHERE id = $2`, [status, assetId]);
}

export async function deleteAsset(clientId, assetId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  return withTransaction(async (client) => {
    const assetResult = await client.query(
      `SELECT id FROM "${schema}".assets WHERE id = $1 FOR UPDATE`,
      [assetId]
    );
    if (!assetResult.rows.length) {
      return {
        deleted: false,
        maintenanceScheduleItemsRemoved: 0,
        calibrationScheduleItemsRemoved: 0
      };
    }

    const maintenanceItems = await client.query(
      `DELETE FROM maintenance_schedule_items AS item
       USING maintenance_schedules AS schedule
       WHERE item.schedule_id = schedule.id
         AND schedule.client_id = $1
         AND item.asset_id = $2
       RETURNING item.schedule_id`,
      [clientId, assetId]
    );
    const affectedScheduleIds = Array.from(
      new Set(maintenanceItems.rows.map((row) => row.schedule_id))
    );
    if (affectedScheduleIds.length) {
      await client.query(
        `UPDATE maintenance_schedules
         SET pdf_path = NULL
         WHERE id = ANY($1::uuid[])`,
        [affectedScheduleIds]
      );
    }

    const calibrationItems = await client.query(
      `DELETE FROM calibration_schedule_items AS item
       USING calibration_schedules AS schedule
       WHERE item.schedule_id = schedule.id
         AND schedule.client_id = $1
         AND item.asset_id = $2
       RETURNING item.id`,
      [clientId, assetId]
    );

    await client.query(`DELETE FROM "${schema}".assets WHERE id = $1`, [assetId]);
    return {
      deleted: true,
      maintenanceScheduleItemsRemoved: maintenanceItems.rowCount ?? 0,
      calibrationScheduleItemsRemoved: calibrationItems.rowCount ?? 0
    };
  });
}

export async function setAssetHvEngineer(clientId, assetId, engineerUserId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(
    `UPDATE "${schema}".assets
     SET hv_engineer_user_id = $1,
         hv_engineer_signed_at = NOW()
     WHERE id = $2`,
    [engineerUserId, assetId]
  );
}

export async function moveAsset(clientId, assetId, payload) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }

  const before = await getAssetById(clientId, assetId);
  if (!before) {
    throw new Error('Equipo no encontrado');
  }

  await query(
    `UPDATE "${schema}".assets
     SET code = $1,
         site_id = $2,
         area_id = $3,
         location_id = $4
     WHERE id = $5`,
    [
      payload.code || before.code,
      payload.siteId || null,
      payload.areaId || null,
      payload.locationId || null,
      assetId
    ]
  );

  const after = await getAssetById(clientId, assetId);
  return { before, after };
}

export async function createAssetMovement(clientId, payload) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { before, after, movedBy, movedByName, movedByRole, notes } = payload;
  const { rows } = await query(
    `INSERT INTO "${schema}".asset_movements (
       asset_id, from_code, to_code,
       from_site_id, from_site_name, to_site_id, to_site_name,
       from_area_id, from_area_name, to_area_id, to_area_name,
       from_location_id, from_location_name, to_location_id, to_location_name,
       moved_by, moved_by_name, moved_by_role, notes
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [
      after.id,
      before.code,
      after.code,
      before.site_id,
      before.site_name,
      after.site_id,
      after.site_name,
      before.area_id,
      before.area_name,
      after.area_id,
      after.area_name,
      before.location_id,
      before.location_name,
      after.location_id,
      after.location_name,
      movedBy,
      movedByName,
      movedByRole,
      notes || null
    ]
  );
  return rows[0];
}

export async function updateAssetMovementPdf(clientId, movementId, pdfPath) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`UPDATE "${schema}".asset_movements SET pdf_path = $1 WHERE id = $2`, [pdfPath, movementId]);
}

export async function listAssetMovements(clientId, assetId, limit = 4, offset = 0) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT *
     FROM "${schema}".asset_movements
     WHERE asset_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [assetId, limit, offset]
  );
  return rows;
}

export async function listHistoricalMaintenanceOccurrences(clientId, assetId, documentDate) {
  const { rows } = await query(
    `WITH occurrences AS (
       SELECT i.id, i.schedule_id, i.asset_id, i.frequency, i.planned_date, i.deadline_date,
              i.status, i.completion_source, i.legacy_history_file_id,
              i.historical_resolution, i.non_execution_reason, s.year,
              s.status AS schedule_status,
              ROW_NUMBER() OVER (
                PARTITION BY i.schedule_id, i.asset_id
                ORDER BY i.planned_date ASC, i.id ASC
              )::int AS occurrence_number
       FROM maintenance_schedule_items i
       JOIN maintenance_schedules s ON s.id = i.schedule_id
       WHERE s.client_id = $1
         AND i.asset_id = $2
     )
     SELECT occurrence.*,
            request.id AS request_id,
            request.status AS request_status,
            (
              occurrence.schedule_status = 'approved'
              AND occurrence.status IN ('pending', 'active', 'expired')
              AND occurrence.legacy_history_file_id IS NULL
              AND occurrence.historical_resolution IS DISTINCT FROM 'not_performed'
              AND COALESCE(request.status, 'abierto') IN ('abierto', 'vencido')
            ) AS eligible,
            CASE
              WHEN occurrence.schedule_status = 'draft' THEN 'Aprueba primero el cronograma.'
              WHEN occurrence.schedule_status <> 'approved' THEN 'El cronograma no admite conciliaciones.'
              WHEN occurrence.status = 'done' THEN 'Esta ocurrencia ya está realizada.'
              WHEN occurrence.legacy_history_file_id IS NOT NULL THEN 'Ya tiene un PDF histórico conciliado.'
              WHEN occurrence.historical_resolution = 'not_performed' THEN 'Este periodo fue registrado como no realizado.'
              WHEN request.status NOT IN ('abierto', 'vencido') THEN 'La solicitud tiene un proceso operativo en curso.'
              ELSE NULL
            END AS unavailable_reason
     FROM occurrences occurrence
     LEFT JOIN LATERAL (
       SELECT id, status
       FROM maintenance_requests
       WHERE schedule_item_id = occurrence.id
       ORDER BY
         CASE WHEN status IN ('abierto', 'vencido') THEN 1 ELSE 0 END ASC,
         created_at DESC
       LIMIT 1
     ) request ON TRUE
     WHERE DATE_TRUNC('month', occurrence.planned_date) = DATE_TRUNC('month', $3::date)
     ORDER BY occurrence.year ASC, occurrence.planned_date ASC`,
    [clientId, assetId, documentDate]
  );
  return rows;
}

export async function listPendingHistoricalMaintenanceEvidence(
  clientId,
  { year, assetCategory = 'biomedical', readerUserId = null } = {}
) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const category = normalizeAssetCategory(assetCategory);
  const { rows } = await query(
    `WITH occurrences AS (
       SELECT i.id, i.schedule_id, i.asset_id, i.frequency, i.planned_date,
              i.deadline_date, i.status, i.report_id, i.completion_source,
              i.legacy_history_file_id, i.historical_resolution,
              s.year, s.status AS schedule_status,
              a.code, a.name, a.brand, a.model, a.serial,
              a.site_id, site.name AS site_name,
              a.area_id, area.name AS area_name,
              a.location_id, location.name AS location_name,
              ROW_NUMBER() OVER (
                PARTITION BY i.schedule_id, i.asset_id
                ORDER BY i.planned_date ASC, i.id ASC
              )::int AS occurrence_number
       FROM maintenance_schedule_items i
       JOIN maintenance_schedules s ON s.id = i.schedule_id
       JOIN "${schema}".assets a ON a.id = i.asset_id
       LEFT JOIN "${schema}".sites site ON site.id = a.site_id
       LEFT JOIN "${schema}".areas area ON area.id = a.area_id
       LEFT JOIN "${schema}".locations location ON location.id = a.location_id
       WHERE s.client_id = $1
         AND s.year = $2
         AND s.asset_category = $3
         AND COALESCE(a.asset_category, 'biomedical') = $3
         AND COALESCE(a.status, 'activo') <> 'dado_de_baja'
         AND (
           $4::uuid IS NULL
           OR EXISTS (
             SELECT 1
             FROM reader_access ra
             WHERE ra.client_id = $1
               AND ra.user_id = $4::uuid
               AND (
                 (ra.area_id IS NOT NULL AND ra.area_id = a.area_id)
                 OR (ra.location_id IS NOT NULL AND ra.location_id = a.location_id)
               )
           )
         )
     )
     SELECT occurrence.*,
            request.id AS request_id,
            request.status AS request_status,
            (
              occurrence.schedule_status = 'approved'
              AND occurrence.status IN ('pending', 'active', 'expired')
              AND COALESCE(request.status, 'abierto') IN ('abierto', 'vencido')
            ) AS eligible,
            CASE
              WHEN occurrence.schedule_status = 'draft' THEN 'Aprueba primero el cronograma.'
              WHEN occurrence.schedule_status <> 'approved' THEN 'El cronograma no admite conciliaciones.'
              WHEN request.status NOT IN ('abierto', 'vencido') THEN 'La solicitud tiene un proceso operativo en curso.'
              ELSE NULL
            END AS unavailable_reason
     FROM occurrences occurrence
     LEFT JOIN LATERAL (
       SELECT id, status
       FROM maintenance_requests
       WHERE schedule_item_id = occurrence.id
       ORDER BY
         CASE WHEN status IN ('abierto', 'vencido') THEN 1 ELSE 0 END ASC,
         created_at DESC
       LIMIT 1
     ) request ON TRUE
     WHERE occurrence.deadline_date < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date
       AND occurrence.status IN ('pending', 'active', 'expired')
       AND occurrence.report_id IS NULL
       AND occurrence.completion_source IS NULL
       AND occurrence.legacy_history_file_id IS NULL
       AND (
         occurrence.historical_resolution IS NULL
         OR occurrence.historical_resolution = 'pending_evidence'
       )
     ORDER BY occurrence.planned_date ASC, occurrence.area_name ASC,
              occurrence.location_name ASC, occurrence.code ASC`,
    [clientId, year, category, readerUserId || null]
  );
  return rows;
}

function historicalReconciliationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function createAssetHistoryFile(clientId, payload) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const {
    assetId,
    title,
    description,
    documentDate,
    documentType,
    maintenanceScheduleItemId,
    filePath,
    uploadedBy,
    uploadedByName
  } = payload;

  return withTransaction(async (client) => {
    let occurrence = null;
    let requestRows = [];
    if (maintenanceScheduleItemId) {
      const occurrenceResult = await client.query(
        `SELECT i.id, i.schedule_id, i.asset_id, i.planned_date, i.deadline_date, i.status,
                i.legacy_history_file_id, i.historical_resolution,
                s.status AS schedule_status, s.year
         FROM maintenance_schedule_items i
         JOIN maintenance_schedules s ON s.id = i.schedule_id
         WHERE i.id = $1 AND i.asset_id = $2 AND s.client_id = $3
         FOR UPDATE OF i, s`,
        [maintenanceScheduleItemId, assetId, clientId]
      );
      occurrence = occurrenceResult.rows[0] || null;
      if (!occurrence) {
        throw historicalReconciliationError(
          'HISTORICAL_OCCURRENCE_NOT_FOUND',
          'La ocurrencia seleccionada no pertenece al equipo y cliente indicados.'
        );
      }
      if (occurrence.schedule_status !== 'approved') {
        throw historicalReconciliationError(
          'HISTORICAL_SCHEDULE_NOT_APPROVED',
          'El cronograma debe estar aprobado antes de conciliar un mantenimiento histórico.'
        );
      }
      if (occurrence.status === 'done' || occurrence.legacy_history_file_id) {
        throw historicalReconciliationError(
          'HISTORICAL_OCCURRENCE_COMPLETED',
          'La ocurrencia seleccionada ya está registrada como realizada.'
        );
      }
      if (occurrence.historical_resolution === 'not_performed') {
        throw historicalReconciliationError(
          'HISTORICAL_OCCURRENCE_NOT_PERFORMED',
          'El periodo seleccionado fue registrado como no realizado y no admite conciliación automática.'
        );
      }
      if (!['pending', 'active', 'expired'].includes(occurrence.status)) {
        throw historicalReconciliationError(
          'HISTORICAL_OCCURRENCE_INVALID_STATUS',
          'La ocurrencia seleccionada no admite conciliación histórica.'
        );
      }
      if (
        dateOnlyFromDatabase(occurrence.planned_date, 'La fecha programada').slice(0, 7) !==
        documentDate.slice(0, 7)
      ) {
        throw historicalReconciliationError(
          'HISTORICAL_OCCURRENCE_MONTH_MISMATCH',
          'La fecha real del documento debe pertenecer al mes de la ocurrencia seleccionada.'
        );
      }

      const requestsResult = await client.query(
        `SELECT id, status
         FROM maintenance_requests
         WHERE schedule_item_id = $1
         FOR UPDATE`,
        [occurrence.id]
      );
      requestRows = requestsResult.rows;
      const activeRequest = requestRows.find(
        (request) => !['abierto', 'vencido'].includes(request.status)
      );
      if (activeRequest) {
        throw historicalReconciliationError(
          'HISTORICAL_REQUEST_IN_PROGRESS',
          'La solicitud asociada tiene un proceso operativo en curso y no puede cerrarse mediante migración.'
        );
      }
    }

    const { rows } = await client.query(
      `INSERT INTO "${schema}".asset_history_files (
         asset_id, title, description, document_date, file_path, uploaded_by, uploaded_by_name,
         document_type, maintenance_schedule_item_id
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        assetId,
        title || 'Documento histórico migrado',
        description || null,
        documentDate,
        filePath,
        uploadedBy || null,
        uploadedByName || null,
        documentType || 'other',
        maintenanceScheduleItemId || null
      ]
    );
    const historyFile = rows[0];

    if (occurrence) {
      await client.query(
        `UPDATE maintenance_schedule_items
         SET status = 'done',
             completed_at = ($2::date::timestamp AT TIME ZONE 'America/Bogota'),
             report_id = NULL,
             completion_source = 'historical_pdf',
             legacy_history_file_id = $3,
             historical_resolution = 'evidence_uploaded',
             non_execution_reason = NULL,
             non_execution_recorded_at = NULL,
             non_execution_recorded_by = NULL
         WHERE id = $1`,
        [occurrence.id, documentDate, historyFile.id]
      );
      await client.query(
        `UPDATE maintenance_requests
         SET status = 'firmado', updated_at = NOW()
         WHERE schedule_item_id = $1 AND status IN ('abierto', 'vencido')`,
        [occurrence.id]
      );
      await client.query('UPDATE maintenance_schedules SET pdf_path = NULL WHERE id = $1', [
        occurrence.schedule_id
      ]);
      await client.query(
        `UPDATE maintenance_schedules schedule
         SET status = 'closed'
         WHERE schedule.id = $1
           AND NOT EXISTS (
             SELECT 1
             FROM maintenance_schedule_items item
             WHERE item.schedule_id = schedule.id AND item.status NOT IN ('done', 'warranty')
           )`,
        [occurrence.schedule_id]
      );
    }

    return {
      ...historyFile,
      reconciliation: occurrence
        ? {
            scheduleId: occurrence.schedule_id,
            scheduleItemId: occurrence.id,
            scheduleYear: occurrence.year,
            plannedDate: occurrence.planned_date,
            closedRequestIds: requestRows.map((request) => request.id)
          }
        : null
    };
  });
}

export async function listAssetHistory(clientId, assetId, { from, to, order = 'asc', limit = 4, offset = 0 } = {}) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }

  const params = [assetId, clientId];
  const clauses = ['event_date IS NOT NULL'];
  if (from) {
    params.push(from);
    clauses.push(`event_date >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    clauses.push(`event_date < ($${params.length}::date + INTERVAL '1 day')`);
  }
  params.push(limit);
  const limitParam = params.length;
  params.push(offset);
  const offsetParam = params.length;
  const orderDir = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const { rows } = await query(
    `WITH history AS (
       SELECT
         r.id,
         'maintenance_report' AS item_type,
         r.type AS subtype,
         COALESCE(
           (SELECT MAX(s.signed_at) FROM report_signatures s WHERE s.report_id = r.id),
           r.created_at
         ) AS event_date,
         COALESCE(NULLIF(r.summary, ''), 'Reporte de mantenimiento') AS title,
         r.findings AS description,
         r.pdf_path,
         NULL::uuid AS maintenance_schedule_item_id,
         COALESCE(
           (SELECT MAX(s.signed_at) FROM report_signatures s WHERE s.report_id = r.id),
           r.created_at
         ) AS created_at
       FROM maintenance_reports r
       JOIN maintenance_requests req ON req.id = r.request_id
       WHERE r.asset_id = $1
         AND r.client_id = $2
         AND EXISTS (
           SELECT 1
           FROM report_signatures s
           WHERE s.report_id = r.id
             AND s.role = 'ingeniero_biomedico'
         )
         AND (
           (
             r.type = 'preventivo'
             AND EXISTS (
               SELECT 1
               FROM report_signatures s
               WHERE s.report_id = r.id
                 AND s.role IN ('almacenista', 'lector', 'viewer', 'visor', 'superuser')
             )
           )
           OR (
             r.type <> 'preventivo'
             AND EXISTS (
               SELECT 1
               FROM report_signatures s
               WHERE s.report_id = r.id
                 AND (
                   s.user_id = req.requested_by
                   OR s.role IN ('almacenista', 'lector', 'viewer', 'visor', 'superuser')
                 )
             )
           )
         )

       UNION ALL

       SELECT
         i.id,
         'calibration_report' AS item_type,
         'calibracion' AS subtype,
         COALESCE(i.completed_at, i.planned_date) AS event_date,
         'Certificado de calibración' AS title,
         i.frequency AS description,
         i.pdf_path,
         NULL::uuid AS maintenance_schedule_item_id,
         COALESCE(i.completed_at, i.planned_date) AS created_at
       FROM calibration_schedule_items i
       JOIN calibration_schedules s ON s.id = i.schedule_id
       WHERE i.asset_id = $1
         AND s.client_id = $2
         AND i.pdf_path IS NOT NULL

       UNION ALL

       SELECT
         m.id,
         'movement_report' AS item_type,
         'movimiento' AS subtype,
         m.created_at AS event_date,
         'Movimiento de equipo' AS title,
         CONCAT_WS(' → ',
           NULLIF(CONCAT_WS(' / ', m.from_site_name, m.from_area_name, m.from_location_name), ''),
           NULLIF(CONCAT_WS(' / ', m.to_site_name, m.to_area_name, m.to_location_name), '')
         ) AS description,
         m.pdf_path,
         NULL::uuid AS maintenance_schedule_item_id,
         m.created_at
       FROM "${schema}".asset_movements m
       WHERE m.asset_id = $1

       UNION ALL

       SELECT
         f.id,
         'legacy_pdf' AS item_type,
         f.document_type AS subtype,
         f.document_date::timestamptz AS event_date,
         f.title,
         f.description,
         f.file_path AS pdf_path,
         f.maintenance_schedule_item_id,
         f.created_at
       FROM "${schema}".asset_history_files f
       WHERE f.asset_id = $1
     )
     SELECT *
     FROM history
     WHERE ${clauses.join(' AND ')}
     ORDER BY event_date ${orderDir}, created_at ${orderDir}, title ASC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );
  return rows;
}

export async function listAssetHistoryFiles(clientId, assetId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT *
     FROM "${schema}".asset_history_files
     WHERE asset_id = $1
     ORDER BY document_date ASC, created_at ASC`,
    [assetId]
  );
  return rows;
}

export async function getAssetHistoryFileById(clientId, fileId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT *
     FROM "${schema}".asset_history_files
     WHERE id = $1`,
    [fileId]
  );
  return rows[0] || null;
}

export async function isAssetHistoryFileReconciled(clientId, fileId) {
  const { rows } = await query(
    `SELECT 1
     FROM maintenance_schedule_items item
     JOIN maintenance_schedules schedule ON schedule.id = item.schedule_id
     WHERE schedule.client_id = $1 AND item.legacy_history_file_id = $2
     LIMIT 1`,
    [clientId, fileId]
  );
  return rows.length > 0;
}

export async function deleteAssetHistoryFile(clientId, fileId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const file = await getAssetHistoryFileById(clientId, fileId);
  await query(`DELETE FROM "${schema}".asset_history_files WHERE id = $1`, [fileId]);
  return file;
}

export async function getAssetMovementById(clientId, movementId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT m.*, a.code AS asset_code, a.name AS asset_name, a.brand AS asset_brand,
            a.model AS asset_model, a.serial AS asset_serial
     FROM "${schema}".asset_movements m
     LEFT JOIN "${schema}".assets a ON a.id = m.asset_id
     WHERE m.id = $1`,
    [movementId]
  );
  return rows[0] || null;
}

export async function replaceAccessories(clientId, assetId, accessories) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`DELETE FROM "${schema}".asset_accessories WHERE asset_id = $1`, [assetId]);
  for (const acc of accessories) {
    await query(
      `INSERT INTO "${schema}".asset_accessories (asset_id, name, quantity, brand, serial)
       VALUES ($1,$2,$3,$4,$5)`,
      [assetId, acc.name, acc.quantity || 1, acc.brand || null, acc.serial || null]
    );
  }
}

export async function replaceCleaning(clientId, assetId, cleaning) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`DELETE FROM "${schema}".asset_cleaning WHERE asset_id = $1`, [assetId]);
  for (const item of cleaning) {
    await query(
      `INSERT INTO "${schema}".asset_cleaning (asset_id, procedure, frequency, responsible)
       VALUES ($1,$2,$3,$4)`,
      [assetId, item.procedure, item.frequency || null, item.responsible || null]
    );
  }
}

export async function replaceRecommendations(clientId, assetId, recommendations) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`DELETE FROM "${schema}".asset_recommendations WHERE asset_id = $1`, [assetId]);
  for (const rec of recommendations) {
    await query(
      `INSERT INTO "${schema}".asset_recommendations (asset_id, text)
       VALUES ($1,$2)`,
      [assetId, rec.text]
    );
  }
}

export async function replaceDocuments(clientId, assetId, documents) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`DELETE FROM "${schema}".asset_documents WHERE asset_id = $1`, [assetId]);
  for (const doc of documents) {
    await query(
      `INSERT INTO "${schema}".asset_documents (asset_id, doc_type, file_path)
       VALUES ($1,$2,$3)`,
      [assetId, doc.doc_type, doc.file_path]
    );
  }
}
