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
    `SELECT id, name FROM "${schema}".areas ORDER BY name`
  );
  return rows;
}

export async function createArea(clientId, name) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  const { rows: existing } = await query(
    `SELECT id FROM "${schema}".areas WHERE LOWER(name) = LOWER($1)`,
    [name]
  );
  if (existing.length) {
    throw new Error('Área ya existe');
  }
  const { rows } = await query(
    `INSERT INTO "${schema}".areas (name) VALUES ($1) RETURNING id`,
    [name]
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
      `SELECT id, name, area_id FROM "${schema}".locations WHERE area_id = $1 ORDER BY name`,
      [areaId]
    );
    return rows;
  }
  const { rows } = await query(
    `SELECT id, name, area_id FROM "${schema}".locations ORDER BY name`
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

export async function updateArea(clientId, areaId, name) {
  const schema = await getSchemaByClientId(clientId);
  if (!schema) {
    throw new Error('Cliente no encontrado');
  }
  await query(`UPDATE "${schema}".areas SET name = $1 WHERE id = $2`, [name, areaId]);
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
            a.area_id, a.location_id, ar.name AS area_name, lo.name AS location_name
     FROM "${schema}".assets a
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
            a.area_id, a.location_id, ar.name AS area_name, lo.name AS location_name
     FROM "${schema}".assets a
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
    `SELECT a.*, ar.name AS area_name, lo.name AS location_name
     FROM "${schema}".assets a
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
     (code, name, brand, model, serial, invima_reg, area_id, location_id, risk_class, is_mobile, manufacturer,
      acquisition_type, contract_text, acquisition_date, useful_life_years, warranty_years,
      supplier_name, supplier_phone, supplier_email, power_type, voltage, temp_min, temp_max,
      humidity_min, humidity_max, maintenance_frequency, requires_calibration, calibration_frequency)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
     RETURNING id`,
    [
      code,
      name,
      brand,
      model,
      serial,
      invimaReg,
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
         invima_reg = $6, area_id = $7, location_id = $8, risk_class = $9,
         is_mobile = $10, manufacturer = $11,
         acquisition_type = $12, contract_text = $13, acquisition_date = $14,
         useful_life_years = $15, warranty_years = $16, supplier_name = $17,
         supplier_phone = $18, supplier_email = $19, power_type = $20, voltage = $21,
         temp_min = $22, temp_max = $23, humidity_min = $24, humidity_max = $25,
         maintenance_frequency = $26, requires_calibration = $27, calibration_frequency = $28
     WHERE id = $29`,
    [
      code,
      name,
      brand,
      model,
      serial,
      invimaReg,
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
