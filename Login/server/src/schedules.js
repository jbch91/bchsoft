import { query, withTransaction } from './db.js';
import { normalizeAssetCategory } from './asset-category.js';
import {
  assetWarrantyReleaseDate,
  buildOperationalMaintenanceOccurrences,
  canCorrectAssetScheduleItems,
  dateOnlyFromDatabase,
  maintenanceScheduleItemHasOperationalEvidence,
  maintenanceScheduleOccurrenceState,
  nextBusinessDateInWindow,
  normalizeAssetScheduleEnrollmentMode,
  normalizeAssetScheduleProgrammingSelection,
  normalizeDateOnly,
  normalizePeriodicityChangeMode,
  normalizePeriodicity
} from './schedule-workflow.js';

function minimumDate(...values) {
  return values.filter(Boolean).sort()[0] || null;
}

function maximumDate(...values) {
  return values.filter(Boolean).sort().at(-1) || null;
}

function emptyAssetScheduleSync(asset) {
  let warrantyReleaseDate = null;
  let warrantyError = null;
  try {
    warrantyReleaseDate = assetWarrantyReleaseDate({
      acquisitionDate: asset.acquisition_date,
      warrantyYears: asset.warranty_years
    });
  } catch (error) {
    warrantyError = error.message;
  }
  return {
    assetId: asset.id,
    status: warrantyError ? 'warranty_data_required' : 'awaiting_schedule',
    warrantyReleaseDate,
    warrantyError,
    schedulesFound: 0,
    schedulesUpdated: 0,
    scheduleIds: [],
    itemsAdded: 0,
    itemsRemoved: 0,
    activeItemsAdded: 0,
    requestsCreated: 0,
    historicalEvidenceRequired: [],
    firstPlannedDate: null,
    latestScheduleYear: null
  };
}

function configurationValue(configuration, key, fallback) {
  return Object.prototype.hasOwnProperty.call(configuration || {}, key)
    ? configuration[key]
    : fallback;
}

function normalizeProgrammingAsset(asset, configuration = {}) {
  const warrantyValue = configurationValue(configuration, 'warrantyYears', asset.warranty_years);
  return {
    ...asset,
    area_id: configurationValue(configuration, 'areaId', asset.area_id) || null,
    location_id: configurationValue(configuration, 'locationId', asset.location_id) || null,
    acquisition_date: configurationValue(
      configuration,
      'acquisitionDate',
      asset.acquisition_date
    ) || null,
    warranty_years:
      warrantyValue === null || warrantyValue === undefined || warrantyValue === ''
        ? null
        : Number(warrantyValue),
    maintenance_frequency: normalizePeriodicity(
      configurationValue(
        configuration,
        'maintenanceFrequency',
        asset.maintenance_frequency
      )
    )
  };
}

function replaceableProgrammingItem(item) {
  return !maintenanceScheduleItemHasOperationalEvidence(item);
}

function maintenanceOccurrencePhase(item, today) {
  if (item.deadlineDate < today) return 'historical';
  if (item.plannedDate <= today) return 'current';
  return 'future';
}

async function removeReplaceableScheduleItems(client, scheduleId, itemIds) {
  if (!itemIds.length) return { itemsRemoved: 0, requestsRemoved: 0 };
  const requests = await client.query(
    `DELETE FROM maintenance_requests
     WHERE schedule_item_id = ANY($1::uuid[])
       AND source = 'cronograma'
       AND status IN ('abierto', 'vencido')
     RETURNING id`,
    [itemIds]
  );
  const deleted = await client.query(
    `DELETE FROM maintenance_schedule_items
     WHERE schedule_id = $1 AND id = ANY($2::uuid[])
     RETURNING id`,
    [scheduleId, itemIds]
  );
  if (deleted.rows.length !== itemIds.length) {
    const error = new Error('El cronograma cambió mientras se confirmaban las fechas.');
    error.code = 'SCHEDULE_EDIT_STATE_CHANGED';
    throw error;
  }
  return {
    itemsRemoved: deleted.rows.length,
    requestsRemoved: requests.rows.length
  };
}

async function createActivePreventiveRequest(client, {
  clientId,
  scheduleId,
  scheduleItemId,
  assetId,
  plannedDate,
  deadlineDate,
  requestedBy
}) {
  const result = await client.query(
    `INSERT INTO maintenance_requests (
       client_id, asset_id, type, description, planned_date, deadline_date, source,
       requested_by, schedule_id, schedule_item_id
     )
     SELECT $1, $2, 'preventivo', 'Mantenimiento preventivo programado',
            $3, $4, 'cronograma', $5, $6, $7
     WHERE NOT EXISTS (
       SELECT 1 FROM maintenance_requests
       WHERE client_id = $1 AND schedule_item_id = $7
     )
     RETURNING id`,
    [
      clientId,
      assetId,
      plannedDate,
      deadlineDate,
      requestedBy,
      scheduleId,
      scheduleItemId
    ]
  );
  return result.rows.length;
}

function publicProgrammingSchedule(plan) {
  return {
    scheduleId: plan.scheduleId,
    year: plan.year,
    status: plan.status,
    itemsToReplace: plan.replaceableItemIds.length,
    preservedItems: plan.preservedItems,
    preservedEvidenceItems: plan.preservedEvidenceItems,
    preservedHistoricalItems: plan.preservedHistoricalItems,
    historicalItems: plan.items.filter((item) => item.phase === 'historical').length,
    currentItems: plan.items.filter((item) => item.phase === 'current').length,
    futureItems: plan.items.filter((item) => item.phase === 'future').length,
    items: plan.items
  };
}

async function buildAssetScheduleProgrammingPlans(client, {
  clientId,
  schema,
  assetId,
  today,
  configuration = {},
  lock = false
}) {
  const tenantResult = await client.query(
    'SELECT schema_name FROM clients WHERE id = $1',
    [clientId]
  );
  const tenantSchema = tenantResult.rows[0]?.schema_name;
  if (!tenantSchema || (schema && schema !== tenantSchema)) {
    const error = new Error('El cliente del cronograma no es válido.');
    error.code = 'SCHEDULE_CLIENT_MISMATCH';
    throw error;
  }

  const assetResult = await client.query(
    `SELECT id, area_id, location_id, acquisition_date, warranty_years, created_at,
            maintenance_frequency, asset_category, status
     FROM "${tenantSchema}".assets
     WHERE id = $1
     ${lock ? 'FOR UPDATE' : ''}`,
    [assetId]
  );
  const storedAsset = assetResult.rows[0];
  if (!storedAsset || String(storedAsset.status || 'activo') === 'dado_de_baja') {
    const error = new Error('El equipo no está disponible para programar mantenimiento.');
    error.code = 'SCHEDULE_ITEM_MISMATCH';
    throw error;
  }
  const asset = normalizeProgrammingAsset(storedAsset, configuration);
  const warrantyReleaseDate = assetWarrantyReleaseDate({
    acquisitionDate: asset.acquisition_date,
    warrantyYears: asset.warranty_years
  });
  const category = normalizeAssetCategory(asset.asset_category);
  const currentYear = Number(today.slice(0, 4));
  const scheduleResult = await client.query(
    `SELECT id, client_id, asset_category, year, start_date, status, created_by
     FROM maintenance_schedules
     WHERE client_id = $1
       AND asset_category = $2
       AND year >= $3
       AND status IN ('draft', 'approved')
     ORDER BY year ASC, created_at ASC
     ${lock ? 'FOR UPDATE' : ''}`,
    [clientId, category, currentYear]
  );
  const correctionStateResult = await client.query(
    `SELECT item.status, item.report_id, item.completion_source,
            item.legacy_history_file_id, item.historical_resolution,
            EXISTS (
              SELECT 1 FROM maintenance_requests request
              WHERE request.schedule_item_id = item.id
                AND request.status NOT IN ('abierto', 'vencido')
            ) AS has_blocking_request
     FROM maintenance_schedule_items item
     JOIN maintenance_schedules schedule ON schedule.id = item.schedule_id
     WHERE schedule.client_id = $1
       AND schedule.asset_category = $2
       AND schedule.year >= $3
       AND schedule.status IN ('draft', 'approved', 'closed')
       AND item.asset_id = $4
     ${lock ? 'FOR UPDATE OF item' : ''}`,
    [clientId, category, currentYear, asset.id]
  );
  const correctionAllowed = canCorrectAssetScheduleItems(correctionStateResult.rows);
  const requestedChangeMode = normalizePeriodicityChangeMode(configuration.changeMode);
  const changeMode = requestedChangeMode === 'correction' && !correctionAllowed
    ? 'operational'
    : requestedChangeMode;
  const correctionBlockedReason = correctionAllowed
    ? null
    : 'El equipo ya tiene mantenimientos realizados, firmas, PDFs, una novedad declarada o trabajo operativo iniciado. La historia se conservará y la nueva periodicidad aplicará desde hoy.';

  const plans = [];
  for (const schedule of scheduleResult.rows) {
    const targetItemsResult = await client.query(
      `SELECT item.id, item.frequency, item.planned_date, item.deadline_date, item.status,
              item.report_id, item.completion_source, item.legacy_history_file_id,
              item.historical_resolution, item.non_execution_reason,
              EXISTS (
                SELECT 1 FROM maintenance_requests request
                WHERE request.schedule_item_id = item.id
                  AND request.status NOT IN ('abierto', 'vencido')
              ) AS has_blocking_request
       FROM maintenance_schedule_items item
       WHERE item.schedule_id = $1 AND item.asset_id = $2
       ${lock ? 'FOR UPDATE OF item' : ''}`,
      [schedule.id, asset.id]
    );
    const scheduleYearStart = `${schedule.year}-01-01`;
    const effectiveDate = changeMode === 'operational' && schedule.year === currentYear
      ? today
      : scheduleYearStart;
    const replaceableItems = targetItemsResult.rows.filter((item) =>
      replaceableProgrammingItem(item)
      && (
        changeMode === 'correction'
        || dateOnlyFromDatabase(item.deadline_date, 'La fecha límite') >= effectiveDate
      )
    );
    const replaceableIds = new Set(replaceableItems.map((item) => item.id));
    const preservedItems = targetItemsResult.rows.filter((item) => !replaceableIds.has(item.id));

    let referenceItems = [];
    if (asset.area_id) {
      const referencesResult = await client.query(
        `SELECT item.planned_date, reference_asset.area_id, reference_asset.location_id
         FROM maintenance_schedule_items AS item
         JOIN "${tenantSchema}".assets AS reference_asset ON reference_asset.id = item.asset_id
         WHERE item.schedule_id = $1
           AND reference_asset.area_id = $2
           AND item.asset_id <> $3`,
        [schedule.id, asset.area_id, asset.id]
      );
      referenceItems = referencesResult.rows;
    }

    const scheduleStart = dateOnlyFromDatabase(
      schedule.start_date,
      'La fecha inicial del cronograma'
    );
    const eligibleFrom = maximumDate(
      scheduleYearStart,
      warrantyReleaseDate,
      effectiveDate
    );
    const desired = buildOperationalMaintenanceOccurrences({
      year: schedule.year,
      startDate: scheduleStart,
      frequency: asset.maintenance_frequency,
      availableFrom: eligibleFrom,
      referenceItems,
      locationId: asset.location_id
    });
    const occupiedMonths = new Set(
      preservedItems.map((item) => dateOnlyFromDatabase(item.planned_date).slice(0, 7))
    );
    const items = [];
    for (const occurrence of desired) {
      const month = occurrence.plannedDate.slice(0, 7);
      if (occupiedMonths.has(month)) continue;
      occupiedMonths.add(month);
      let plannedDate = occurrence.plannedDate;
      if (
        schedule.year === currentYear
        && occurrence.deadlineDate >= today
        && plannedDate < today
      ) {
        plannedDate = nextBusinessDateInWindow(today, occurrence.deadlineDate) || plannedDate;
      }
      const item = {
        month,
        plannedDate,
        minDate: maximumDate(`${month}-01`, eligibleFrom),
        maxDate: occurrence.deadlineDate,
        deadlineDate: occurrence.deadlineDate
      };
      const phase = maintenanceOccurrencePhase(item, today);
      items.push({
        ...item,
        phase,
        historicalResolution: phase === 'historical' ? 'pending_evidence' : null,
        nonExecutionReason: ''
      });
    }
    const preservedOperationalDates = preservedItems
      .filter((item) => dateOnlyFromDatabase(item.deadline_date) >= today)
      .map((item) => dateOnlyFromDatabase(item.planned_date));
    plans.push({
      scheduleId: schedule.id,
      year: schedule.year,
      status: schedule.status,
      createdBy: schedule.created_by,
      replaceableItemIds: replaceableItems.map((item) => item.id),
      preservedItems: preservedItems.length,
      preservedEvidenceItems: preservedItems.filter(
        (item) => maintenanceScheduleItemHasOperationalEvidence(item)
      ).length,
      preservedHistoricalItems: preservedItems.filter(
        (item) => dateOnlyFromDatabase(item.deadline_date) < today
      ).length,
      preservedOperationalDates,
      items,
      changed: replaceableItems.length > 0 || items.length > 0
    });
  }

  return {
    asset,
    storedAsset,
    warrantyReleaseDate,
    plans,
    requestedChangeMode,
    changeMode,
    effectiveDate: changeMode === 'operational' ? today : `${currentYear}-01-01`,
    correctionAllowed,
    correctionBlockedReason
  };
}

export async function previewApprovedAssetScheduleProgramming({
  clientId,
  schema,
  assetId,
  today,
  configuration
}) {
  const normalizedToday = normalizeDateOnly(today, 'La fecha actual');
  return withTransaction(async (client) => {
    const result = await buildAssetScheduleProgrammingPlans(client, {
      clientId,
      schema,
      assetId,
      today: normalizedToday,
      configuration
    });
    const schedules = result.plans
      .filter((plan) => plan.status === 'approved' && plan.changed)
      .map(publicProgrammingSchedule);
    return {
      assetId: result.asset.id,
      previousFrequency: result.storedAsset.maintenance_frequency,
      frequency: result.asset.maintenance_frequency,
      effectiveToday: normalizedToday,
      changeMode: result.changeMode,
      effectiveDate: result.effectiveDate,
      correctionAllowed: result.correctionAllowed,
      correctionBlockedReason: result.correctionBlockedReason,
      warrantyReleaseDate: result.warrantyReleaseDate,
      requiresConfirmation: schedules.length > 0,
      schedules
    };
  });
}

export async function applyAssetScheduleProgramming({
  clientId,
  schema,
  assetId,
  today,
  actorUserId = null,
  selection
}) {
  const normalizedToday = normalizeDateOnly(today, 'La fecha actual');
  return withTransaction(async (client) => {
    const result = await buildAssetScheduleProgrammingPlans(client, {
      clientId,
      schema,
      assetId,
      today: normalizedToday,
      lock: true,
      configuration: {
        changeMode: selection?.changeMode
      }
    });
    const approvedPlans = result.plans.filter(
      (plan) => plan.status === 'approved' && plan.changed
    );
    const normalizedSelection = normalizeAssetScheduleProgrammingSelection(
      selection,
      approvedPlans.map(publicProgrammingSchedule),
      {
        expectedChangeMode: result.changeMode,
        expectedEffectiveDate: result.effectiveDate
      }
    );
    const selectionBySchedule = new Map(
      normalizedSelection.schedules.map((schedule) => [schedule.scheduleId, schedule.items])
    );
    const updatedScheduleIds = new Set();
    let itemsAdded = 0;
    let itemsRemoved = 0;
    let requestsRemoved = 0;
    let activeItemsAdded = 0;
    let requestsCreated = 0;
    let firstPlannedDate = null;
    const historicalEvidenceRequired = [];
    let historicalNotPerformed = 0;

    for (const plan of result.plans) {
      const selectedItems = plan.status === 'approved'
        ? selectionBySchedule.get(plan.scheduleId) || []
        : plan.items;
      for (const plannedDate of plan.preservedOperationalDates) {
        firstPlannedDate = minimumDate(firstPlannedDate, plannedDate);
      }
      for (const item of selectedItems) {
        if (item.deadlineDate >= normalizedToday) {
          firstPlannedDate = minimumDate(firstPlannedDate, item.plannedDate);
        }
      }
      if (!plan.changed) continue;

      if (plan.replaceableItemIds.length) {
        const removed = await removeReplaceableScheduleItems(
          client,
          plan.scheduleId,
          plan.replaceableItemIds
        );
        itemsRemoved += removed.itemsRemoved;
        requestsRemoved += removed.requestsRemoved;
      }
      if (selectedItems.length) {
        const programmingConfirmed = plan.status === 'approved';
        const itemStatuses = selectedItems.map((item) =>
          maintenanceScheduleOccurrenceState(item, {
            today: normalizedToday,
            scheduleStatus: plan.status
          }).status
        );
        const inserted = await client.query(
          `INSERT INTO maintenance_schedule_items
             (schedule_id, asset_id, frequency, planned_date, deadline_date, status,
              historical_resolution, non_execution_reason,
              non_execution_recorded_at, non_execution_recorded_by,
              programming_confirmed, programmed_at, programmed_by)
           SELECT $1, $2, $3, data.planned_date, data.deadline_date, data.item_status,
                  data.historical_resolution, data.non_execution_reason,
                  CASE WHEN data.historical_resolution = 'not_performed' THEN NOW() ELSE NULL END,
                  CASE WHEN data.historical_resolution = 'not_performed' THEN $10::uuid ELSE NULL END,
                  $9,
                  CASE WHEN $9 THEN NOW() ELSE NULL END,
                  CASE WHEN $9 THEN $10::uuid ELSE NULL END
           FROM UNNEST($4::date[], $5::date[], $6::text[], $7::text[], $8::text[])
             AS data(planned_date, deadline_date, item_status, historical_resolution,
                     non_execution_reason)
           RETURNING id, planned_date, deadline_date, status, historical_resolution`,
          [
            plan.scheduleId,
            result.asset.id,
            result.asset.maintenance_frequency,
            selectedItems.map((item) => item.plannedDate),
            selectedItems.map((item) => item.deadlineDate),
            itemStatuses,
            selectedItems.map((item) => item.historicalResolution || null),
            selectedItems.map((item) => item.nonExecutionReason || null),
            programmingConfirmed,
            actorUserId || plan.createdBy
          ]
        );
        itemsAdded += inserted.rows.length;
        for (const item of inserted.rows) {
          const plannedDate = dateOnlyFromDatabase(item.planned_date);
          const deadlineDate = dateOnlyFromDatabase(item.deadline_date);
          if (
            item.status === 'expired'
            && item.historical_resolution === 'pending_evidence'
          ) {
            historicalEvidenceRequired.push({
              scheduleId: plan.scheduleId,
              scheduleItemId: item.id,
              scheduleYear: plan.year,
              plannedDate,
              deadlineDate
            });
          }
          if (item.historical_resolution === 'not_performed') {
            historicalNotPerformed += 1;
          }
          if (item.status === 'active') {
            activeItemsAdded += 1;
            requestsCreated += await createActivePreventiveRequest(client, {
              clientId,
              scheduleId: plan.scheduleId,
              scheduleItemId: item.id,
              assetId: result.asset.id,
              plannedDate,
              deadlineDate,
              requestedBy: actorUserId || plan.createdBy
            });
          }
        }
      }
      updatedScheduleIds.add(plan.scheduleId);
    }

    if (updatedScheduleIds.size) {
      await client.query(
        'UPDATE maintenance_schedules SET pdf_path = NULL WHERE id = ANY($1::uuid[])',
        [Array.from(updatedScheduleIds)]
      );
    }

    const latestScheduleYear = result.plans.reduce(
      (latest, plan) => Math.max(latest, plan.year),
      0
    ) || null;
    let status = 'awaiting_schedule';
    if (firstPlannedDate) {
      status = 'scheduled';
    } else if (
      result.warrantyReleaseDate
      && latestScheduleYear
      && result.warrantyReleaseDate > `${latestScheduleYear}-12-31`
    ) {
      status = 'warranty';
    } else if (result.plans.length) {
      status = 'next_cycle';
    }
    const assetResult = {
      assetId: result.asset.id,
      status,
      warrantyReleaseDate: result.warrantyReleaseDate,
      warrantyError: null,
      schedulesFound: result.plans.length,
      schedulesUpdated: updatedScheduleIds.size,
      scheduleIds: Array.from(updatedScheduleIds),
      itemsAdded,
      itemsRemoved,
      requestsRemoved,
      activeItemsAdded,
      requestsCreated,
      historicalEvidenceRequired,
      historicalNotPerformed,
      periodicityChangeMode: result.changeMode,
      periodicityEffectiveDate: result.effectiveDate,
      firstPlannedDate,
      latestScheduleYear
    };
    return {
      schedulesUpdated: updatedScheduleIds.size,
      itemsAdded,
      itemsRemoved,
      requestsRemoved,
      activeItemsAdded,
      requestsCreated,
      historicalEvidenceRequired,
      historicalNotPerformed,
      periodicityChangeMode: result.changeMode,
      periodicityEffectiveDate: result.effectiveDate,
      assets: [assetResult]
    };
  });
}

export async function createSchedule({
  clientId,
  year,
  startDate,
  createdBy,
  pdfPath,
  assetCategory = 'biomedical'
}) {
  const category = normalizeAssetCategory(assetCategory);
  const { rows } = await query(
    `INSERT INTO maintenance_schedules (client_id, year, start_date, created_by, pdf_path, asset_category)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [clientId, year, startDate, createdBy, pdfPath || null, category]
  );
  return rows[0];
}

export async function createScheduleWithItems({
  clientId,
  year,
  startDate,
  createdBy,
  items,
  assetCategory = 'biomedical'
}) {
  const category = normalizeAssetCategory(assetCategory);
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [
      `maintenance-schedule:${clientId}:${category}`,
      year
    ]);
    const existing = await client.query(
      'SELECT id FROM maintenance_schedules WHERE client_id = $1 AND year = $2 AND asset_category = $3 LIMIT 1',
      [clientId, year, category]
    );
    if (existing.rows.length) return null;

    const scheduleResult = await client.query(
      `INSERT INTO maintenance_schedules (client_id, year, start_date, created_by, pdf_path, asset_category)
       VALUES ($1,$2,$3,$4,NULL,$5)
       RETURNING id, client_id, asset_category, year, start_date, status, engineer_edited,
                 engineer_edit_enabled, engineer_edit_enabled_by, engineer_edit_enabled_at,
                 created_by, pdf_path`,
      [clientId, year, startDate, createdBy, category]
    );
    const schedule = scheduleResult.rows[0];
    await client.query(
      `INSERT INTO maintenance_schedule_items
         (schedule_id, asset_id, frequency, planned_date, deadline_date)
       SELECT $1, data.asset_id, data.frequency, data.planned_date, data.deadline_date
       FROM UNNEST($2::uuid[], $3::text[], $4::date[], $5::date[])
         AS data(asset_id, frequency, planned_date, deadline_date)`,
      [
        schedule.id,
        items.map((item) => item.assetId),
        items.map((item) => item.frequency),
        items.map((item) => item.plannedDate),
        items.map((item) => item.deadlineDate)
      ]
    );
    return schedule;
  });
}

export async function listSchedules(clientId, year, assetCategory = 'biomedical') {
  const params = [clientId, normalizeAssetCategory(assetCategory)];
  let where = 'schedule.client_id = $1 AND schedule.asset_category = $2';
  if (year) {
    params.push(year);
    where += ` AND schedule.year = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT schedule.id, schedule.client_id, schedule.asset_category, schedule.year, schedule.start_date, schedule.status,
            schedule.engineer_edited, schedule.engineer_edit_enabled,
            schedule.engineer_edit_enabled_by, schedule.engineer_edit_enabled_at,
            schedule.created_at, schedule.approved_at, schedule.pdf_path,
            (SELECT COUNT(*)::int FROM maintenance_schedule_items item
             WHERE item.schedule_id = schedule.id) AS total_items,
            (SELECT COUNT(*)::int FROM maintenance_schedule_items item
             WHERE item.schedule_id = schedule.id AND item.programming_confirmed) AS programmed_items
     FROM maintenance_schedules schedule
     WHERE ${where}
     ORDER BY schedule.year DESC, schedule.created_at DESC`,
    params
  );
  return rows;
}

export async function syncAssetsIntoMaintenanceSchedules({
  clientId,
  schema,
  assetIds,
  today,
  actorUserId = null,
  replaceFuturePending = false,
  replaceOpenCurrent = false,
  enrollmentMode = 'new'
}) {
  const ids = Array.from(new Set((assetIds || []).map((value) => String(value || '').trim()).filter(Boolean)));
  if (!ids.length) {
    return { schedulesUpdated: 0, itemsAdded: 0, itemsRemoved: 0, assets: [] };
  }
  const normalizedToday = normalizeDateOnly(today, 'La fecha actual');
  const currentYear = Number(normalizedToday.slice(0, 4));
  const normalizedEnrollmentMode = normalizeAssetScheduleEnrollmentMode(enrollmentMode);
  const reconstructCurrentYear = normalizedEnrollmentMode === 'existing_omitted';

  return withTransaction(async (client) => {
    const tenantResult = await client.query(
      'SELECT schema_name FROM clients WHERE id = $1',
      [clientId]
    );
    const tenantSchema = tenantResult.rows[0]?.schema_name;
    if (!tenantSchema || (schema && schema !== tenantSchema)) {
      const error = new Error('El cliente del cronograma no es válido.');
      error.code = 'SCHEDULE_CLIENT_MISMATCH';
      throw error;
    }
    const assetResult = await client.query(
      `SELECT id, area_id, location_id, acquisition_date, warranty_years,
              maintenance_frequency, asset_category, status
       FROM "${tenantSchema}".assets
       WHERE id = ANY($1::uuid[])
       FOR UPDATE`,
      [ids]
    );
    const assets = assetResult.rows.filter(
      (asset) => asset.maintenance_frequency && String(asset.status || 'activo') !== 'dado_de_baja'
    );
    const detailsByAsset = new Map(
      assets.map((asset) => [asset.id, emptyAssetScheduleSync(asset)])
    );
    if (!assets.length) {
      return { schedulesUpdated: 0, itemsAdded: 0, itemsRemoved: 0, assets: [] };
    }

    const categories = Array.from(
      new Set(assets.map((asset) => normalizeAssetCategory(asset.asset_category)))
    );
    const scheduleResult = await client.query(
      `SELECT id, client_id, asset_category, year, start_date, status, created_by
       FROM maintenance_schedules
       WHERE client_id = $1
         AND asset_category = ANY($2::text[])
         AND year >= $3
         AND status IN ('draft', 'approved')
       ORDER BY year ASC, created_at ASC
       FOR UPDATE`,
      [clientId, categories, currentYear]
    );

    let totalAdded = 0;
    let totalRemoved = 0;
    let totalRequestsRemoved = 0;
    let totalActiveAdded = 0;
    let totalRequestsCreated = 0;
    const historicalEvidenceRequired = [];
    const updatedScheduleIds = new Set();

    for (const schedule of scheduleResult.rows) {
      const changedAssetIds = new Set();
      const scheduleCategory = normalizeAssetCategory(schedule.asset_category);
      const scheduleAssets = assets.filter(
        (asset) =>
          normalizeAssetCategory(asset.asset_category) === scheduleCategory
          && !detailsByAsset.get(asset.id)?.warrantyError
      );
      if (!scheduleAssets.length) continue;
      const scheduleAssetIds = scheduleAssets.map((asset) => asset.id);
      for (const asset of scheduleAssets) {
        const detail = detailsByAsset.get(asset.id);
        detail.schedulesFound += 1;
        detail.latestScheduleYear = Math.max(detail.latestScheduleYear || 0, schedule.year);
      }

      if (replaceFuturePending || replaceOpenCurrent) {
        const replaceable = await client.query(
          `SELECT item.id, item.asset_id
           FROM maintenance_schedule_items AS item
           WHERE item.schedule_id = $1
             AND item.asset_id = ANY($2::uuid[])
             AND (
               ($4::boolean AND item.status = 'pending' AND item.planned_date >= $3::date)
               OR (
                 $5::boolean
                 AND item.status IN ('pending', 'active')
                 AND item.deadline_date >= $3::date
               )
             )
             AND item.report_id IS NULL
             AND item.completion_source IS NULL
             AND item.legacy_history_file_id IS NULL
             AND item.historical_resolution IS DISTINCT FROM 'not_performed'
             AND NOT EXISTS (
               SELECT 1
               FROM maintenance_requests AS request
               WHERE request.schedule_item_id = item.id
                 AND request.status NOT IN ('abierto', 'vencido')
             )
           FOR UPDATE OF item`,
          [
            schedule.id,
            scheduleAssetIds,
            normalizedToday,
            replaceFuturePending,
            replaceOpenCurrent
          ]
        );
        if (replaceable.rows.length) {
          const removed = await removeReplaceableScheduleItems(
            client,
            schedule.id,
            replaceable.rows.map((item) => item.id)
          );
          totalRemoved += removed.itemsRemoved;
          totalRequestsRemoved += removed.requestsRemoved;
          updatedScheduleIds.add(schedule.id);
          for (const row of replaceable.rows) {
            detailsByAsset.get(row.asset_id).itemsRemoved += 1;
            changedAssetIds.add(row.asset_id);
          }
        }
      }

      const existingResult = await client.query(
        `SELECT asset_id, planned_date, deadline_date, status
         FROM maintenance_schedule_items
         WHERE schedule_id = $1 AND asset_id = ANY($2::uuid[])`,
        [schedule.id, scheduleAssetIds]
      );
      const existingByAsset = new Map(scheduleAssetIds.map((assetId) => [assetId, []]));
      for (const item of existingResult.rows) {
        existingByAsset.get(item.asset_id)?.push(item);
      }

      const areaIds = Array.from(
        new Set(scheduleAssets.map((asset) => asset.area_id).filter(Boolean))
      );
      let referenceItems = [];
      if (areaIds.length) {
        const referencesResult = await client.query(
          `SELECT item.planned_date, asset.area_id, asset.location_id
           FROM maintenance_schedule_items AS item
           JOIN "${tenantSchema}".assets AS asset ON asset.id = item.asset_id
           WHERE item.schedule_id = $1
             AND asset.area_id = ANY($2::uuid[])
             AND NOT (item.asset_id = ANY($3::uuid[]))`,
          [schedule.id, areaIds, scheduleAssetIds]
        );
        referenceItems = referencesResult.rows;
      }

      const additions = [];
      const scheduleStart = dateOnlyFromDatabase(schedule.start_date, 'La fecha inicial del cronograma');
      const scheduleYearStart = `${schedule.year}-01-01`;
      for (const asset of scheduleAssets) {
        const detail = detailsByAsset.get(asset.id);
        const availableFrom = maximumDate(
          reconstructCurrentYear && schedule.year === currentYear
            ? scheduleYearStart
            : schedule.year === currentYear
              ? normalizedToday
              : scheduleYearStart,
          reconstructCurrentYear && asset.acquisition_date
            ? dateOnlyFromDatabase(asset.acquisition_date, 'La fecha de adquisición')
            : null,
          detail.warrantyReleaseDate
        );
        const assetReferences = asset.area_id
          ? referenceItems.filter((item) => item.area_id === asset.area_id)
          : [];
        const desired = buildOperationalMaintenanceOccurrences({
          year: schedule.year,
          startDate: scheduleStart,
          frequency: asset.maintenance_frequency,
          availableFrom,
          referenceItems: assetReferences,
          locationId: asset.location_id
        });
        const existing = existingByAsset.get(asset.id) || [];
        const occupiedMonths = new Set(
          existing.map((item) => dateOnlyFromDatabase(item.planned_date).slice(0, 7))
        );
        for (const item of existing) {
          const plannedDate = dateOnlyFromDatabase(item.planned_date);
          if (dateOnlyFromDatabase(item.deadline_date) >= availableFrom) {
            detail.firstPlannedDate = minimumDate(detail.firstPlannedDate, plannedDate);
          }
        }
        for (const occurrence of desired) {
          if (occupiedMonths.has(occurrence.plannedDate.slice(0, 7))) continue;
          occupiedMonths.add(occurrence.plannedDate.slice(0, 7));
          const occurrenceState = maintenanceScheduleOccurrenceState(occurrence, {
            today: normalizedToday,
            scheduleStatus: schedule.status,
            historicalBackfill: reconstructCurrentYear
          });
          additions.push({
            assetId: asset.id,
            frequency: asset.maintenance_frequency,
            ...occurrence,
            status: occurrenceState.status,
            historicalResolution: occurrenceState.historicalResolution
          });
          detail.itemsAdded += 1;
          changedAssetIds.add(asset.id);
          detail.firstPlannedDate = minimumDate(
            detail.firstPlannedDate,
            occurrence.plannedDate
          );
        }
      }

      if (additions.length) {
        const programmingConfirmed = schedule.status === 'approved';
        const inserted = await client.query(
          `INSERT INTO maintenance_schedule_items
             (schedule_id, asset_id, frequency, planned_date, deadline_date, status,
              historical_resolution, programming_confirmed, programmed_at, programmed_by)
           SELECT $1, data.asset_id, data.frequency, data.planned_date, data.deadline_date,
                  data.item_status, data.historical_resolution, $8,
                  CASE WHEN $8 THEN NOW() ELSE NULL END,
                  CASE WHEN $8 THEN $9::uuid ELSE NULL END
           FROM UNNEST($2::uuid[], $3::text[], $4::date[], $5::date[], $6::text[], $7::text[])
             AS data(asset_id, frequency, planned_date, deadline_date, item_status,
                     historical_resolution)
           RETURNING id, asset_id, planned_date, deadline_date, status, historical_resolution`,
          [
            schedule.id,
            additions.map((item) => item.assetId),
            additions.map((item) => item.frequency),
            additions.map((item) => item.plannedDate),
            additions.map((item) => item.deadlineDate),
            additions.map((item) => item.status),
            additions.map((item) => item.historicalResolution),
            programmingConfirmed,
            actorUserId || schedule.created_by
          ]
        );
        totalAdded += inserted.rows.length;
        for (const item of inserted.rows) {
          if (
            item.status === 'expired'
            && item.historical_resolution === 'pending_evidence'
          ) {
            const evidence = {
              scheduleId: schedule.id,
              scheduleItemId: item.id,
              scheduleYear: schedule.year,
              plannedDate: dateOnlyFromDatabase(item.planned_date),
              deadlineDate: dateOnlyFromDatabase(item.deadline_date)
            };
            historicalEvidenceRequired.push(evidence);
            const detail = detailsByAsset.get(item.asset_id);
            if (detail) detail.historicalEvidenceRequired.push(evidence);
          }
          if (item.status !== 'active') continue;
          totalActiveAdded += 1;
          const detail = detailsByAsset.get(item.asset_id);
          if (detail) detail.activeItemsAdded += 1;
          const created = await createActivePreventiveRequest(client, {
            clientId,
            scheduleId: schedule.id,
            scheduleItemId: item.id,
            assetId: item.asset_id,
            plannedDate: dateOnlyFromDatabase(item.planned_date),
            deadlineDate: dateOnlyFromDatabase(item.deadline_date),
            requestedBy: actorUserId || schedule.created_by
          });
          totalRequestsCreated += created;
          if (detail) detail.requestsCreated += created;
        }
        updatedScheduleIds.add(schedule.id);
      }

      for (const assetId of changedAssetIds) {
        const detail = detailsByAsset.get(assetId);
        if (detail) {
          detail.schedulesUpdated += 1;
          if (!detail.scheduleIds.includes(schedule.id)) detail.scheduleIds.push(schedule.id);
        }
      }
    }

    if (updatedScheduleIds.size) {
      await client.query(
        'UPDATE maintenance_schedules SET pdf_path = NULL WHERE id = ANY($1::uuid[])',
        [Array.from(updatedScheduleIds)]
      );
    }

    const details = Array.from(detailsByAsset.values()).map((detail) => {
      if (detail.warrantyError) {
        detail.status = 'warranty_data_required';
      } else if (detail.firstPlannedDate) {
        detail.status = 'scheduled';
      } else if (
        detail.warrantyReleaseDate
        && detail.latestScheduleYear
        && detail.warrantyReleaseDate > `${detail.latestScheduleYear}-12-31`
      ) {
        detail.status = 'warranty';
      } else if (detail.schedulesFound) {
        detail.status = 'next_cycle';
      }
      return detail;
    });

    return {
      schedulesUpdated: updatedScheduleIds.size,
      itemsAdded: totalAdded,
      itemsRemoved: totalRemoved,
      requestsRemoved: totalRequestsRemoved,
      activeItemsAdded: totalActiveAdded,
      requestsCreated: totalRequestsCreated,
      historicalEvidenceRequired,
      enrollmentMode: normalizedEnrollmentMode,
      assets: details
    };
  });
}

export async function getScheduleById(scheduleId) {
  const { rows } = await query(
    `SELECT id, client_id, asset_category, year, start_date, status, engineer_edited,
            engineer_edit_enabled, engineer_edit_enabled_by, engineer_edit_enabled_at,
            created_by, pdf_path
     FROM maintenance_schedules
     WHERE id = $1`,
    [scheduleId]
  );
  return rows[0];
}

export async function setSchedulePdf(scheduleId, pdfPath) {
  await query('UPDATE maintenance_schedules SET pdf_path = $1 WHERE id = $2', [pdfPath, scheduleId]);
}

export async function approveSchedule(scheduleId) {
  const { rows } = await query(
    `UPDATE maintenance_schedules AS schedule
     SET status = 'approved',
         approved_at = NOW(),
         engineer_edit_enabled = FALSE,
         engineer_edit_enabled_by = NULL,
         engineer_edit_enabled_at = NULL
     WHERE schedule.id = $1
       AND schedule.status = 'draft'
       AND NOT EXISTS (
         SELECT 1 FROM maintenance_schedule_items item
         WHERE item.schedule_id = schedule.id AND NOT item.programming_confirmed
       )
     RETURNING schedule.id`,
    [scheduleId]
  );
  return rows[0];
}

export async function setScheduleEngineerEditAccess(scheduleId, enabled, enabledBy) {
  const { rows } = await query(
    `UPDATE maintenance_schedules
     SET engineer_edit_enabled = $2,
         engineer_edit_enabled_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END,
         engineer_edit_enabled_at = CASE WHEN $2 THEN NOW() ELSE NULL END
     WHERE id = $1 AND status = 'approved'
     RETURNING id, engineer_edit_enabled, engineer_edit_enabled_by, engineer_edit_enabled_at`,
    [scheduleId, enabled, enabledBy]
  );
  return rows[0];
}

export async function listScheduleItemsWithSchema(scheduleId, schema) {
  const { rows } = await query(
    `SELECT i.id, i.schedule_id, i.asset_id, i.frequency, i.planned_date, i.deadline_date,
            CASE
              WHEN i.status IN ('pending', 'active', 'expired', 'warranty')
                AND i.report_id IS NULL
                AND i.completion_source IS NULL
                AND i.legacy_history_file_id IS NULL
                AND (
                  i.warranty_resolution = 'covered'
                  OR (
                    i.warranty_resolution IS DISTINCT FROM 'perform'
                    AND a.warranty_years IS NOT NULL
                    AND (
                      a.acquisition_date IS NULL
                      OR i.planned_date < (
                        a.acquisition_date + make_interval(years => a.warranty_years)
                      )::date
                    )
                  )
                )
                THEN 'warranty'
              WHEN i.status = 'warranty' THEN
                CASE
                  WHEN i.deadline_date < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date
                    THEN 'expired'
                  WHEN i.planned_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date
                    THEN 'active'
                  ELSE 'pending'
                END
              ELSE i.status
            END AS status,
            i.status AS persisted_status,
            i.programming_confirmed, i.programmed_at, i.programmed_by,
            i.report_id, i.completion_source, i.legacy_history_file_id,
            i.historical_resolution, i.non_execution_reason,
            i.non_execution_recorded_at, i.non_execution_recorded_by,
            i.warranty_resolution, i.warranty_resolved_at, i.warranty_resolved_by,
            a.code, a.name, a.brand, a.model, a.serial, a.area_id, a.site_id, a.location_id,
            a.maintenance_frequency AS asset_maintenance_frequency,
            a.acquisition_date, a.warranty_years,
            CASE
              WHEN a.acquisition_date IS NOT NULL AND a.warranty_years IS NOT NULL
                THEN (a.acquisition_date + make_interval(years => a.warranty_years))::date
              ELSE NULL
            END AS warranty_release_date,
            ar.name AS area_name, s.name AS site_name, lo.name AS location_name
     FROM maintenance_schedule_items i
     JOIN "${schema}".assets a ON a.id = i.asset_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     LEFT JOIN "${schema}".sites s ON s.id = a.site_id
     LEFT JOIN "${schema}".locations lo ON lo.id = a.location_id
     WHERE i.schedule_id = $1
     ORDER BY i.planned_date ASC`,
    [scheduleId]
  );
  return rows;
}

export async function insertScheduleItems(items) {
  for (const item of items) {
    await query(
      `INSERT INTO maintenance_schedule_items (schedule_id, asset_id, frequency, planned_date, deadline_date)
       VALUES ($1,$2,$3,$4,$5)`,
      [item.scheduleId, item.assetId, item.frequency, item.plannedDate, item.deadlineDate]
    );
  }
}

export async function updateScheduleItems(
  scheduleId,
  items,
  {
    markEngineerEdited: edited = false,
    consumeEngineerEdit = false,
    expectedStatus = null,
    confirmProgramming = false,
    programmedBy = null
  } = {}
) {
  return withTransaction(async (client) => {
    const { rows: scheduleRows } = await client.query(
      `SELECT status, engineer_edit_enabled
       FROM maintenance_schedules
       WHERE id = $1
       FOR UPDATE`,
      [scheduleId]
    );
    const schedule = scheduleRows[0];
    if (!schedule || (expectedStatus && schedule.status !== expectedStatus)) {
      const error = new Error('El cronograma cambió de estado. Actualiza la información.');
      error.code = 'SCHEDULE_EDIT_STATE_CHANGED';
      throw error;
    }
    if (consumeEngineerEdit && (schedule.status !== 'approved' || !schedule.engineer_edit_enabled)) {
      const error = new Error('La autorización de edición ya no está disponible.');
      error.code = 'SCHEDULE_EDIT_LOCKED';
      throw error;
    }

    let rows = [];
    if (items.length) {
      const result = await client.query(
        `UPDATE maintenance_schedule_items AS target
         SET planned_date = data.planned_date,
             deadline_date = data.deadline_date,
             programming_confirmed = CASE WHEN $5 THEN TRUE ELSE target.programming_confirmed END,
             programmed_at = CASE WHEN $5 THEN NOW() ELSE target.programmed_at END,
             programmed_by = CASE WHEN $5 THEN $6::uuid ELSE target.programmed_by END
         FROM UNNEST($2::uuid[], $3::date[], $4::date[])
           AS data(id, planned_date, deadline_date)
         WHERE target.schedule_id = $1 AND target.id = data.id
         RETURNING target.id`,
        [
          scheduleId,
          items.map((item) => item.id),
          items.map((item) => item.plannedDate),
          items.map((item) => item.deadlineDate),
          confirmProgramming,
          programmedBy
        ]
      );
      rows = result.rows;
    }
    if (rows.length !== items.length) {
      const error = new Error('Uno de los elementos no pertenece al cronograma.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }
    if (edited || consumeEngineerEdit) {
      await client.query(
        `UPDATE maintenance_schedules
         SET engineer_edited = CASE WHEN $2 THEN TRUE ELSE engineer_edited END,
             engineer_edit_enabled = CASE WHEN $3 THEN FALSE ELSE engineer_edit_enabled END,
             engineer_edit_enabled_by = CASE WHEN $3 THEN NULL ELSE engineer_edit_enabled_by END,
             engineer_edit_enabled_at = CASE WHEN $3 THEN NULL ELSE engineer_edit_enabled_at END
         WHERE id = $1`,
        [scheduleId, edited, consumeEngineerEdit]
      );
    }
    return rows;
  });
}

export async function rescheduleDraftAsset({
  scheduleId,
  clientId,
  schema,
  assetId,
  assetCategory = 'biomedical',
  frequency,
  items
}) {
  const category = normalizeAssetCategory(assetCategory);
  return withTransaction(async (client) => {
    const { rows: scheduleRows } = await client.query(
      `SELECT id, status, asset_category
       FROM maintenance_schedules
       WHERE id = $1 AND client_id = $2
       FOR UPDATE`,
      [scheduleId, clientId]
    );
    const schedule = scheduleRows[0];
    if (!schedule || normalizeAssetCategory(schedule.asset_category) !== category) {
      const error = new Error('El cronograma no corresponde al equipo seleccionado.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }
    if (schedule.status !== 'draft') {
      const error = new Error('Solo se puede reprogramar un equipo mientras el cronograma está en borrador.');
      error.code = 'SCHEDULE_EDIT_STATE_CHANGED';
      throw error;
    }

    const { rows: assetRows } = await client.query(
      `SELECT id, asset_category, maintenance_frequency
       FROM "${schema}".assets
       WHERE id = $1
       FOR UPDATE`,
      [assetId]
    );
    const asset = assetRows[0];
    if (!asset || normalizeAssetCategory(asset.asset_category) !== category) {
      const error = new Error('El equipo no pertenece a este cronograma.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }

    const { rows: currentItems } = await client.query(
      `SELECT id, status, report_id, completion_source, legacy_history_file_id,
              historical_resolution
       FROM maintenance_schedule_items
       WHERE schedule_id = $1 AND asset_id = $2
       FOR UPDATE`,
      [scheduleId, assetId]
    );
    if (!currentItems.length) {
      const error = new Error('El equipo no tiene mantenimientos dentro de este cronograma.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }
    if (
      currentItems.some(
        (item) =>
          item.status !== 'pending' ||
          item.report_id ||
          item.completion_source ||
          item.legacy_history_file_id ||
          item.historical_resolution === 'not_performed'
      )
    ) {
      const error = new Error('El equipo ya tiene mantenimientos operativos o históricos y no puede regenerarse.');
      error.code = 'SCHEDULE_EDIT_LOCKED';
      throw error;
    }
    if (!Array.isArray(items) || !items.length) {
      const error = new Error('La periodicidad no generó fechas para este cronograma.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }

    await client.query(
      `UPDATE "${schema}".assets
       SET maintenance_frequency = $2
       WHERE id = $1`,
      [assetId, frequency]
    );
    await client.query(
      'DELETE FROM maintenance_schedule_items WHERE schedule_id = $1 AND asset_id = $2',
      [scheduleId, assetId]
    );
    await client.query(
      `INSERT INTO maintenance_schedule_items
         (schedule_id, asset_id, frequency, planned_date, deadline_date)
       SELECT $1, $2, $3, data.planned_date, data.deadline_date
       FROM UNNEST($4::date[], $5::date[]) AS data(planned_date, deadline_date)`,
      [
        scheduleId,
        assetId,
        frequency,
        items.map((item) => item.plannedDate),
        items.map((item) => item.deadlineDate)
      ]
    );
    await client.query('UPDATE maintenance_schedules SET pdf_path = NULL WHERE id = $1', [scheduleId]);

    return {
      oldFrequency: asset.maintenance_frequency,
      frequency,
      oldItemCount: currentItems.length,
      newItemCount: items.length
    };
  });
}

export async function countScheduleItems(scheduleId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM maintenance_schedule_items WHERE schedule_id = $1',
    [scheduleId]
  );
  return rows[0]?.count ?? 0;
}

export async function countPendingScheduleItems(scheduleId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count
     FROM maintenance_schedule_items
     WHERE schedule_id = $1 AND status = 'pending'`,
    [scheduleId]
  );
  return rows[0]?.count ?? 0;
}

export async function countUnprogrammedScheduleItems(scheduleId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count
     FROM maintenance_schedule_items
     WHERE schedule_id = $1 AND NOT programming_confirmed`,
    [scheduleId]
  );
  return rows[0]?.count ?? 0;
}

export async function setScheduleClosedIfDone(scheduleId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS pending
     FROM maintenance_schedule_items
     WHERE schedule_id = $1 AND status NOT IN ('done', 'warranty')`,
    [scheduleId]
  );
  if ((rows[0]?.pending ?? 0) === 0) {
    await query(`UPDATE maintenance_schedules SET status = 'closed' WHERE id = $1`, [scheduleId]);
  }
}

export async function deleteDraftSchedule(scheduleId) {
  const { rows } = await query(
    `DELETE FROM maintenance_schedules
     WHERE id = $1 AND status = 'draft'
     RETURNING id, pdf_path`,
    [scheduleId]
  );
  return rows[0];
}

export async function markScheduleItemDone(scheduleId, itemId, reportId) {
  await query(
    `UPDATE maintenance_schedule_items
     SET status = 'done',
         completed_at = NOW(),
         report_id = $3,
         completion_source = 'software_report',
         legacy_history_file_id = NULL,
         historical_resolution = NULL,
         non_execution_reason = NULL,
         non_execution_recorded_at = NULL,
         non_execution_recorded_by = NULL
     WHERE id = $1 AND schedule_id = $2`,
    [itemId, scheduleId, reportId]
  );
}

export async function findScheduleItemForAsset(scheduleId, assetId, date) {
  const { rows } = await query(
    `SELECT id
     FROM maintenance_schedule_items
     WHERE schedule_id = $1
       AND asset_id = $2
       AND status NOT IN ('done', 'warranty')
       AND planned_date <= $3
       AND deadline_date >= $3
     ORDER BY planned_date ASC
     LIMIT 1`,
    [scheduleId, assetId, date]
  );
  return rows[0];
}
