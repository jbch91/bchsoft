import { query } from './db.js';

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
      `SELECT lo.id, lo.name, lo.area_id, ar.site_id, s.name AS site_name
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
    `SELECT lo.id, lo.name, lo.area_id, ar.site_id, s.name AS site_name
     FROM "${schema}".locations lo
     LEFT JOIN "${schema}".areas ar ON ar.id = lo.area_id
     LEFT JOIN "${schema}".sites s ON s.id = ar.site_id
     ORDER BY s.name NULLS FIRST, ar.name NULLS FIRST, lo.name`
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

export async function listAssets(clientId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows } = await query(
    `SELECT a.id, a.code, a.name, a.brand, a.model, a.serial, a.location, a.status, a.created_at,
            a.photo_path, a.invima_reg, a.risk_class, a.is_mobile, a.manufacturer,
            a.acquisition_type, a.contract_text, a.acquisition_date, a.useful_life_years, a.warranty_years,
            a.supplier_name, a.supplier_phone, a.supplier_email, a.power_type, a.voltage,
            a.temp_min, a.temp_max, a.humidity_min, a.humidity_max,
            a.maintenance_frequency, a.requires_calibration, a.calibration_frequency,
            a.site_id, s.name AS site_name, a.area_id, a.location_id, ar.name AS area_name, lo.name AS location_name
     FROM "${schema}".assets a
     LEFT JOIN "${schema}".sites s ON s.id = a.site_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     LEFT JOIN "${schema}".locations lo ON lo.id = a.location_id
     ORDER BY created_at DESC`
  );
  return rows;
}

export async function listAssetsForReader(clientId, userId) {
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
  let params = [];
  if (locationIds.length && areaIds.length) {
    where = 'AND (a.location_id = ANY($1) OR a.area_id = ANY($2))';
    params = [locationIds, areaIds];
  } else if (locationIds.length) {
    where = 'AND a.location_id = ANY($1)';
    params = [locationIds];
  } else {
    where = 'AND a.area_id = ANY($1)';
    params = [areaIds];
  }

  const { rows } = await query(
    `SELECT a.id, a.code, a.name, a.brand, a.model, a.serial, a.location, a.status, a.created_at,
            a.photo_path, a.invima_reg, a.risk_class, a.is_mobile, a.manufacturer,
            a.acquisition_type, a.contract_text, a.acquisition_date, a.useful_life_years, a.warranty_years,
            a.supplier_name, a.supplier_phone, a.supplier_email, a.power_type, a.voltage,
            a.temp_min, a.temp_max, a.humidity_min, a.humidity_max,
            a.maintenance_frequency, a.requires_calibration, a.calibration_frequency,
            a.site_id, s.name AS site_name, a.area_id, a.location_id, ar.name AS area_name, lo.name AS location_name
     FROM "${schema}".assets a
     LEFT JOIN "${schema}".sites s ON s.id = a.site_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     LEFT JOIN "${schema}".locations lo ON lo.id = a.location_id
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
    `SELECT a.*, s.name AS site_name, ar.name AS area_name, lo.name AS location_name
     FROM "${schema}".assets a
     LEFT JOIN "${schema}".sites s ON s.id = a.site_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     LEFT JOIN "${schema}".locations lo ON lo.id = a.location_id
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
    calibrationFrequency
  } = payload;
  const { rows } = await query(
    `INSERT INTO "${schema}".assets
     (code, name, brand, model, serial, invima_reg, site_id, area_id, location_id, risk_class, is_mobile, manufacturer,
      acquisition_type, contract_text, acquisition_date, useful_life_years, warranty_years,
      supplier_name, supplier_phone, supplier_email, power_type, voltage, temp_min, temp_max,
      humidity_min, humidity_max, maintenance_frequency, requires_calibration, calibration_frequency)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
             $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
     RETURNING id`,
    [
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
      calibrationFrequency
    ]
  );
  return rows[0];
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
    calibrationFrequency
  } = payload;
  await query(
    `UPDATE "${schema}".assets
     SET code = $1, name = $2, brand = $3, model = $4, serial = $5,
         invima_reg = $6, site_id = $7, area_id = $8, location_id = $9, risk_class = $10,
         is_mobile = $11, manufacturer = $12,
         acquisition_type = $13, contract_text = $14, acquisition_date = $15,
         useful_life_years = $16, warranty_years = $17, supplier_name = $18,
         supplier_phone = $19, supplier_email = $20, power_type = $21, voltage = $22,
         temp_min = $23, temp_max = $24, humidity_min = $25, humidity_max = $26,
         maintenance_frequency = $27, requires_calibration = $28, calibration_frequency = $29
     WHERE id = $30`,
    [
      code,
      name,
      brand,
      model,
      serial,
      invimaReg,
      siteId || null,
      areaId || null,
      locationId || null,
      riskClass,
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
      assetId
    ]
  );
}

export async function deleteAsset(clientId, assetId) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`DELETE FROM "${schema}".assets WHERE id = $1`, [assetId]);
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
