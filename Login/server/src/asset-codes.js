import { query, withTransaction } from './db.js';

function codeError(message, code = 'ASSET_CODE_INVALID', status = 400) {
  return Object.assign(new Error(message), { code, status });
}

export function normalizeAssetCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (!code || code.length > 80 || /[\u0000-\u001f\u007f]/.test(code)) {
    throw codeError('El codigo es obligatorio y debe tener como maximo 80 caracteres validos.');
  }
  return code;
}

function numberedCode(value) {
  const match = String(value || '').trim().toUpperCase().match(/^(.*\D)(\d{1,18})$/);
  if (!match || !/[A-Z]/.test(match[1])) return null;
  return { prefix: match[1], width: match[2].length, number: BigInt(match[2]) };
}

export function hospitalCodePrefix(name) {
  const words = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\bE\s*\.?\s*S\s*\.?\s*E\b\.?/g, ' ')
    .match(/[A-Z0-9]+/g) || [];
  const omitted = new Set(['DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'Y', 'ESE', 'SAS', 'SA', 'LTDA']);
  const initials = words.filter(word => !omitted.has(word)).map(word => word[0]).join('').slice(0, 12);
  return `${initials || 'EQ'}-`;
}

export function assetCodePlan(clientName, codes, sequence = null) {
  const groups = new Map();
  for (const value of codes) {
    const parsed = numberedCode(value);
    if (!parsed) continue;
    const group = groups.get(parsed.prefix) || { prefix: parsed.prefix, width: parsed.width, count: 0, max: 0n };
    group.count += 1;
    group.width = Math.max(group.width, parsed.width);
    group.max = group.max > parsed.number ? group.max : parsed.number;
    groups.set(group.prefix, group);
  }
  const established = [...groups.values()].sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix))[0];
  const prefix = sequence?.prefix ?? established?.prefix ?? hospitalCodePrefix(clientName);
  const group = groups.get(prefix);
  const width = Math.max(Number(sequence?.number_width || 0), group?.width || (sequence ? 1 : established?.width || 4));
  const stored = BigInt(sequence?.last_number || 0);
  const last = stored > (group?.max || 0n) ? stored : (group?.max || 0n);
  const next = last + 1n;
  const candidate = prefix + next.toString().padStart(width, '0');
  const suggestion = next > 999999999999999999n || candidate.length > 80 ? null : normalizeAssetCode(candidate);
  return { prefix, width, last, next, suggestion };
}

async function codeContext(db, clientId) {
  const { rows: clients } = await db.query('SELECT name, schema_name FROM clients WHERE id = $1', [clientId]);
  const client = clients[0];
  if (!client) throw codeError('Cliente no encontrado.', 'ASSET_CODE_CLIENT_NOT_FOUND', 404);
  const table = `"${client.schema_name.replace(/"/g, '""')}".assets`;
  const { rows: assets } = await db.query(`SELECT id, code FROM ${table}`);
  const { rows: sequences } = await db.query('SELECT * FROM asset_code_sequences WHERE client_id = $1', [clientId]);
  return { client, assets, sequence: sequences[0] || null };
}

export async function getAssetCodeSuggestion(clientId, { code, assetId } = {}) {
  const { client, assets, sequence } = await codeContext({ query }, clientId);
  if (assetId && !assets.some(asset => asset.id === assetId)) {
    throw codeError('Equipo no encontrado.', 'ASSET_CODE_ASSET_NOT_FOUND', 404);
  }
  const plan = assetCodePlan(client.name, assets.map(asset => asset.code), sequence);
  if (code === undefined && !plan.suggestion) throw codeError('La numeracion automatica alcanzo su limite. Usa un codigo manual.');
  const normalized = code === undefined ? plan.suggestion : normalizeAssetCode(code);
  const current = assets.find(asset => asset.id === assetId);
  const unchanged = current && current.code.trim().toUpperCase() === normalized;
  const available = Boolean(unchanged) || !assets.some(asset => asset.id !== assetId && asset.code.trim().toUpperCase() === normalized);
  return { code: normalized, available, suggestion: plan.suggestion, prefix: plan.prefix };
}

export async function withAssetCode(clientId, { code, automatic = false, assetId }, save) {
  return withTransaction(async db => {
    // All creation, editing and transfer paths use the same client-level lock.
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['asset-code', clientId]);
    const { client, assets, sequence } = await codeContext(db, clientId);
    const current = assets.find(asset => asset.id === assetId);
    if (assetId && !current) throw codeError('Equipo no encontrado.', 'ASSET_CODE_ASSET_NOT_FOUND', 404);
    const plan = assetCodePlan(client.name, assets.length ? assets.map(asset => asset.code) : (automatic ? [] : [code]), sequence);
    if (automatic && !assetId && !plan.suggestion) throw codeError('La numeracion automatica alcanzo su limite. Usa un codigo manual.');
    const normalized = automatic && !assetId ? plan.suggestion : normalizeAssetCode(code);
    const unchanged = current && current.code.trim().toUpperCase() === normalized;
    if (!unchanged && assets.some(asset => asset.id !== assetId && asset.code.trim().toUpperCase() === normalized)) {
      throw codeError('Este codigo ya existe en este cliente. Escribe otro o utiliza el codigo automatico.', 'ASSET_CODE_EXISTS', 409);
    }
    const assigned = unchanged ? current.code : normalized;
    const result = await save(db, assigned);
    const parsed = numberedCode(assigned);
    const last = parsed?.prefix === plan.prefix && parsed.number > plan.last ? parsed.number : plan.last;
    await db.query(
      `INSERT INTO asset_code_sequences (client_id, prefix, number_width, last_number)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (client_id) DO UPDATE SET
         number_width = GREATEST(asset_code_sequences.number_width, EXCLUDED.number_width),
         last_number = GREATEST(asset_code_sequences.last_number, EXCLUDED.last_number)`,
      [clientId, plan.prefix, Math.max(plan.width, parsed?.prefix === plan.prefix ? parsed.width : 0), last.toString()]
    );
    return { ...result, code: assigned, codeAdjusted: automatic && assigned !== String(code || '').trim().toUpperCase() };
  });
}
