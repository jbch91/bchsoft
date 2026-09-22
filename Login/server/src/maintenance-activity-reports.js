import { query } from './db.js';
import { isMaintenanceReportFullySigned } from './maintenance-workflow.js';

const failure = message => Object.assign(new Error(message), { status: 400 });
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const text = value => String(value ?? '').trim();
const searchKey = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const ACTIVITY_REPORT_TITLES = { general: 'INFORME DE ACTIVIDADES DE MANTENIMIENTO', activities: 'DETALLE DE ACTIVIDADES DE MANTENIMIENTO', spares: 'INFORME DE REPUESTOS' };

export function normalizeActivityReportFilters(input = {}) {
  const choose = (key, allowed, fallback) => {
    const value = input[key] === undefined || input[key] === '' ? fallback : input[key];
    if (typeof value !== 'string' || !allowed.includes(value)) throw failure(`Filtro inválido: ${key}.`);
    return value;
  };
  const date = key => {
    const value = input[key];
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || !Number.isFinite(Date.parse(`${value}T12:00:00Z`))
      || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value || value < '1900-01-01') {
      throw failure('Indica fechas válidas de inicio y fin.');
    }
    return value;
  };
  const from = date('from'), to = date('to');
  if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 365) {
    throw failure('El rango debe estar ordenado y abarcar como máximo 366 días.');
  }
  const filters = {
    from, to,
    kind: choose('kind', ['general', 'activities', 'spares'], 'general'),
    dateBasis: choose('dateBasis', ['attention', 'scheduled'], 'attention'),
    category: choose('category', ['biomedical', 'industrial'], 'biomedical'),
    type: choose('type', ['all', 'preventivo', 'correctivo'], 'all'),
    signature: choose('signature', ['all', 'signed', 'pending', 'correction'], 'all'),
    status: choose('status', ['all', 'operativo', 'operativo_observacion', 'fuera_de_servicio', 'no_verificado'], 'all'),
    spareStatus: choose('spareStatus', ['all', 'installed', 'pending'], 'all'),
    backlog: choose('backlog', ['true', 'false'], 'true') === 'true'
  };
  for (const key of ['siteId', 'areaId', 'locationId', 'engineerId']) {
    if (input[key] && (typeof input[key] !== 'string' || !uuid.test(input[key]))) throw failure('Filtro de ubicación o responsable inválido.');
    filters[key] = input[key] || '';
  }
  if (input.search !== undefined && (typeof input.search !== 'string' || input.search.length > 120)) throw failure('La búsqueda admite hasta 120 caracteres.');
  filters.search = text(input.search);
  return filters;
}

export function activityReportAccessError(user, clientId) {
  if (!user?.sub || !user.clientId || user.clientId !== clientId || !uuid.test(clientId)
    || user.roles?.some(role => ['lector', 'superuser', 'platform_admin', 'saas_admin'].includes(role))) return 'Sin acceso a los informes de este cliente.';
  if (!user.permissions?.some(permission => ['maintenance:report:create', 'maintenance:report:sign', 'read:all'].includes(permission))) return 'Sin permiso para consultar informes de mantenimiento.';
  return '';
}

// Scope is always applied before aggregation, including filter options and downloads.
function assetScope(user, params) {
  if (!user.roles?.includes('responsable_area')) return '';
  params.push(user.sub);
  return `AND EXISTS (SELECT 1 FROM reader_access access WHERE access.client_id=$1
    AND access.user_id=$${params.length} AND (access.location_id=a.location_id
      OR (access.location_id IS NULL AND access.area_id=a.area_id)))`;
}

async function tenantForReport(user, clientId, runQuery) {
  const error = activityReportAccessError(user, clientId);
  if (error) throw Object.assign(new Error(error), { status: 403 });
  const client = (await runQuery('SELECT id, name, nit, city, address, email, logo_path, schema_name FROM clients WHERE id=$1', [clientId])).rows[0];
  if (!client || !/^[a-zA-Z0-9_]+$/.test(client.schema_name)) throw Object.assign(new Error('Cliente no encontrado.'), { status: 404 });
  return client;
}

export async function activityReportOptions(user, clientId, category, runQuery = query) {
  const client = await tenantForReport(user, clientId, runQuery);
  if (!['biomedical', 'industrial'].includes(category)) throw failure('Categoría inválida.');
  const params = [clientId, category];
  const scope = assetScope(user, params);
  const { rows } = await runQuery(`SELECT DISTINCT a.site_id, s.name AS site_name, a.area_id,
    ar.name AS area_name, a.location_id, l.name AS location_name
    FROM "${client.schema_name}".assets a
    LEFT JOIN "${client.schema_name}".sites s ON s.id=a.site_id
    LEFT JOIN "${client.schema_name}".areas ar ON ar.id=a.area_id
    LEFT JOIN "${client.schema_name}".locations l ON l.id=a.location_id
    WHERE $1::uuid IS NOT NULL AND a.asset_category=$2 ${scope} ORDER BY s.name, ar.name, l.name`, params);
  return rows;
}

export async function activityReportIdentity(user, clientId, category, runQuery = query) {
  const client = await tenantForReport(user, clientId, runQuery);
  if (!['biomedical', 'industrial'].includes(category)) throw failure('Categoría inválida.');
  const params = [clientId, category];
  const scope = assetScope(user, params);
  const { rows: engineers } = await runQuery(`SELECT DISTINCT u.id, COALESCE(NULLIF(u.display_name,''),u.username) AS name
    FROM maintenance_reports r JOIN "${client.schema_name}".assets a ON a.id=r.asset_id
    JOIN users u ON u.id=r.created_by AND u.client_id=r.client_id
    WHERE r.client_id=$1 AND a.asset_category=$2 ${scope} ORDER BY name`, params);
  delete client.schema_name;
  return { client, engineers };
}

export async function loadActivityReport(user, clientId, filters, runQuery = query) {
  const client = await tenantForReport(user, clientId, runQuery);
  const params = [clientId, filters.category, filters.to];
  const scope = assetScope(user, params);
  const location = [];
  for (const [key, column] of [['siteId','site_id'],['areaId','area_id'],['locationId','location_id']]) {
    if (filters[key]) { params.push(filters[key]); location.push(`AND a.${column}=$${params.length}`); }
  }
  const joins = `JOIN "${client.schema_name}".assets a ON a.id=r.asset_id
    LEFT JOIN "${client.schema_name}".sites s ON s.id=a.site_id
    LEFT JOIN "${client.schema_name}".areas ar ON ar.id=a.area_id
    LEFT JOIN "${client.schema_name}".locations l ON l.id=a.location_id`;
  const fields = `a.code AS asset_code, a.name AS asset_name, a.brand, a.model, a.serial,
    s.name AS site_name, ar.name AS area_name, l.name AS location_name`;
  // All earlier reports are needed to resolve a spare case as of the cutoff, not just the requested month.
  const { rows } = await runQuery(`SELECT r.*, ${fields}, req.requested_by,
    req.planned_date::text AS planned_date, u.display_name AS engineer_name,
    COALESCE(CASE WHEN r.closure_kind='not_located' THEN NULLIF(r.non_execution_details->>'verifiedOn','')::date END,
      r.performed_on, (r.created_at AT TIME ZONE 'America/Bogota')::date)::text AS attention_date,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('role',sig.role,'user_id',sig.user_id))
      FROM report_signatures sig WHERE sig.report_id=r.id),'[]'::jsonb) AS signatures,
    EXISTS (SELECT 1 FROM maintenance_report_corrections c WHERE c.report_id=r.id AND c.resolved_at IS NULL) AS correction_requested
    FROM maintenance_reports r ${joins}
    JOIN maintenance_requests req ON req.id=r.request_id AND req.client_id=r.client_id
    LEFT JOIN users u ON u.id=r.created_by
    WHERE r.client_id=$1 AND r.voided_at IS NULL AND a.asset_category=$2 ${scope} ${location.join(' ')}
      AND (COALESCE(r.performed_on,(r.created_at AT TIME ZONE 'America/Bogota')::date)<=$3::date
        OR (r.type='preventivo' AND req.planned_date<=$3::date))
    ORDER BY r.created_at, r.id LIMIT 10001`, params);
  if (rows.length > 10000) throw failure('Hay demasiados antecedentes. Filtra por sede, área o ubicación para generar un informe completo.');
  const historyParams = [...params, filters.from];
  const historical = (await runQuery(`SELECT r.id, r.asset_id, r.title, r.description,
    r.document_type, r.document_date::text AS attention_date, ${fields}
    FROM "${client.schema_name}".asset_history_files r ${joins}
    WHERE $1::uuid IS NOT NULL AND a.asset_category=$2 ${scope} ${location.join(' ')}
      AND r.document_type IN ('maintenance_preventive','maintenance_corrective')
      AND r.document_date BETWEEN $${historyParams.length}::date AND $3::date
    ORDER BY r.document_date, r.id LIMIT 5001`, historyParams)).rows;
  if (historical.length > 5000) throw failure('Hay demasiados documentos históricos. Reduce el rango o filtra por área.');
  const result = buildActivityReport(rows, historical, filters);
  const options = await activityReportOptions(user, clientId, filters.category, runQuery);
  const scopeLabels = [['siteId','site_id','site_name','SEDE'],['areaId','area_id','area_name','ÁREA'],['locationId','location_id','location_name','UBICACIÓN']]
    .filter(([key]) => filters[key]).map(([key,id,name,label]) => `${label}: ${options.find(row=>row[id]===filters[key])?.[name] || 'SIN COINCIDENCIAS AUTORIZADAS'}`);
  if (filters.engineerId) scopeLabels.push(`INGENIERO: ${rows.find(row=>row.created_by===filters.engineerId)?.engineer_name || 'SIN COINCIDENCIAS AUTORIZADAS'}`);
  delete client.schema_name;
  return { ...result, client, generatedAt: new Date().toISOString(), generatedBy: user.displayName || user.username || 'USUARIO DEL CLIENTE',
    title: ACTIVITY_REPORT_TITLES[filters.kind], filters, scopeLabels,
    notes: activityReportNotes(filters) };
}

export function buildActivityReport(rows, historical, filters) {
  const within = value => value >= filters.from && value <= filters.to;
  const matches = row => (filters.type === 'all' || row.type === filters.type)
    && (filters.signature === 'all' || row.signature === filters.signature)
    && (filters.status === 'all' || row.status === filters.status)
    && (!filters.engineerId || row.engineerId === filters.engineerId)
    && (!filters.search || searchKey([row.code,row.equipment,row.brand,row.model,row.serial,row.engineer].join(' ')).includes(searchKey(filters.search)));
  const mapped = rows.map(r => ({
    id: r.id, requestId: r.request_id, assetId: r.asset_id, code: r.asset_code, equipment: r.asset_name,
    brand: r.brand, model: r.model, serial: r.serial, site: r.site_name, area: r.area_name, location: r.location_name,
    type: r.type, kind: r.closure_kind, date: r.attention_date, plannedDate: r.planned_date,
    registeredAt: r.created_at, engineerId: r.created_by, engineer: r.engineer_name,
    signature: r.correction_requested ? 'correction' : isMaintenanceReportFullySigned(r, r.signatures) ? 'signed' : 'pending',
    status: r.asset_status_after, summary: r.summary, findings: r.findings, actions: r.actions_taken,
    observations: r.asset_status_observations, spare: r.spare_parts_needed,
    requiresSpare: r.requires_spare_parts, spareState: r.spare_parts_status,
    reason: r.non_execution_details?.reason || ''
  }));
  const periodDate = row => filters.dateBasis === 'scheduled' && row.type === 'preventivo' ? row.plannedDate || row.date : row.date;
  const activities = mapped.filter(row => within(periodDate(row)) && matches(row));
  const normal = activities.filter(row => row.kind !== 'not_located');
  const latest = new Map();
  for (const row of mapped.filter(row => row.kind !== 'not_located' && row.date <= filters.to)
    .sort((a,b) => a.date.localeCompare(b.date) || new Date(a.registeredAt) - new Date(b.registeredAt) || a.id.localeCompare(b.id))) {
    latest.set(row.requestId, row);
  }
  const pending = [...latest.values()].filter(row => row.requiresSpare && row.spareState !== 'recibido'
    && (filters.backlog || row.date >= filters.from) && matches(row))
    .map(row => ({...row, spareResult: 'pending', carriedOver: row.date < filters.from}));
  const installed = mapped.filter(row => row.kind !== 'not_located' && row.requiresSpare
    && row.spareState === 'recibido' && within(row.date) && matches(row))
    .map(row => ({...row, spareResult: 'installed', carriedOver: false}));
  const spares = [...(filters.spareStatus === 'installed' ? [] : pending), ...(filters.spareStatus === 'pending' ? [] : installed)]
    .sort((a,b) => b.date.localeCompare(a.date) || a.code.localeCompare(b.code));
  const documents = historical.map(row => ({ id:row.id, assetId:row.asset_id, code:row.asset_code, equipment:row.asset_name,
    brand:row.brand, model:row.model, serial:row.serial, site:row.site_name, area:row.area_name, location:row.location_name,
    type:row.document_type === 'maintenance_preventive' ? 'preventivo' : 'correctivo', date:row.attention_date,
    title:row.title, description:row.description, signature:'historical', status:'unknown', engineer:'' }))
    .filter(row => !filters.engineerId && matches(row));
  const areas = new Map();
  for (const row of normal) {
    const key = JSON.stringify([row.site,row.area]);
    if (!areas.has(key)) areas.set(key, { site:row.site, area:row.area, preventive:0, corrective:0, assets:new Set() });
    const group = areas.get(key); group[row.type === 'preventivo' ? 'preventive' : 'corrective']++; group.assets.add(row.assetId);
  }
  return {
    summary: { interventions:normal.length, equipment:new Set(normal.map(row=>row.assetId)).size,
      preventive:normal.filter(row=>row.type==='preventivo').length, corrective:normal.filter(row=>row.type==='correctivo').length,
      signed:normal.filter(row=>row.signature==='signed').length, pendingSignature:normal.filter(row=>row.signature==='pending').length,
      corrections:normal.filter(row=>row.signature==='correction').length,
      outOfService:normal.filter(row=>row.status==='fuera_de_servicio').length,
      observations:normal.filter(row=>row.status==='operativo_observacion').length,
      notLocated:activities.length-normal.length, historical:documents.length,
      installed:spares.filter(row=>row.spareResult==='installed').length, pendingSpares:spares.filter(row=>row.spareResult==='pending').length,
      carriedOver:spares.filter(row=>row.carriedOver).length },
    activities:filters.kind==='spares' ? [] : activities.sort((a,b)=>b.date.localeCompare(a.date) || a.code.localeCompare(b.code)),
    spares:filters.kind==='activities' ? [] : spares,
    historical:filters.kind==='spares' ? [] : documents,
    areas:[...areas.values()].map(row=>({...row,equipment:row.assets.size,assets:undefined}))
  };
}

export function activityReportNotes(filters) {
  return [
    filters.dateBasis === 'scheduled'
      ? 'ACTIVIDADES: PREVENTIVOS POR FECHA PROGRAMADA; CORRECTIVOS POR FECHA DE ATENCIÓN. SE CONSERVA LA FECHA REAL DE REGISTRO.'
      : 'ACTIVIDADES: FECHA DE ATENCIÓN DECLARADA; CUANDO NO ESTÁ REGISTRADA SE USA LA FECHA DE CREACIÓN EN HORA COLOMBIA.',
    `REPUESTOS: INSTALACIONES POR FECHA DE ATENCIÓN; PENDIENTES AL ${filters.to}${filters.backlog ? ', INCLUIDOS ANTECEDENTES DE MESES ANTERIORES' : ', SOLO CASOS DEL RANGO'}.`,
    'LAS CIFRAS DE REPUESTOS SON CASOS/REPORTES, NO UNIDADES NI COSTOS. VARIAS INTERVENCIONES PUEDEN CORRESPONDER A UN MISMO EQUIPO.',
    'ESTADO FINAL: EL DECLARADO EN CADA REPORTE. FIRMAS, CORRECCIONES Y UBICACIÓN: INFORMACIÓN ACTUAL AL GENERAR; NO ES UNA COPIA HISTÓRICA INMUTABLE.',
    'PDF HISTÓRICOS: SE LISTAN POR FECHA DEL DOCUMENTO, SIN INFERIR ACTIVIDADES, REPUESTOS NI FIRMAS. NO SE SUMAN COMO INTERVENCIONES DILIGENCIADAS.',
    'LAS CONSTANCIAS DE EQUIPO NO LOCALIZADO NO CUENTAN COMO MANTENIMIENTO REALIZADO.'
  ];
}
