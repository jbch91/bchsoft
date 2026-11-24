import { query } from './db.js';

export function validateNewUsername(value) {
  const username = typeof value === 'string' ? value.trim() : '';
  if (!username || username.length > 80 || /[\u0000-\u001f\u007f]/.test(username)) {
    throw Object.assign(new Error('El usuario debe tener entre 1 y 80 caracteres, sin saltos de línea.'),
      { code: 'INVALID_USERNAME', status: 400 });
  }
  return username;
}

function slug(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
}

export function hospitalUsername(base, client) {
  const prefix = slug(base).slice(0, 40).replace(/\.+$/g, '');
  if (!prefix) throw Object.assign(new Error('Escribe un usuario base con letras o números.'), { status: 400, code: 'INVALID_USERNAME' });
  if (!client) return prefix;
  const generic = new Set(['ese', 'e', 's', 'hospital', 'centro', 'salud', 'clinica', 'ips', 'sas', 'sa', 'ltda', 'de', 'del', 'el', 'la', 'las', 'los']);
  const hospital = slug(client.name).split('.').filter(word => word && !generic.has(word)).join('.');
  const city = slug(client.city).split('.').filter(word => word && !['el', 'la', 'los', 'las'].includes(word)).join('.');
  const parts = [hospital, city && !hospital.split('.').join(' ').includes(city.split('.').join(' ')) ? city : ''].filter(Boolean);
  const suffix = (parts.join('.') || `hospital.${String(client.id).slice(0, 8)}`).slice(0, 35).replace(/\.+$/g, '');
  return `${prefix}.${suffix}`;
}

export async function previewUsername({ base, username, clientId }) {
  if (username !== undefined) {
    const checked = validateNewUsername(username);
    const { rows: [result] } = await query('SELECT EXISTS (SELECT 1 FROM users WHERE LOWER(username)=LOWER($1)) AS taken', [checked]);
    return { username: checked, available: !result.taken };
  }
  let client = null;
  if (clientId) {
    const { rows } = await query('SELECT id,name,city FROM clients WHERE id=$1', [clientId]);
    client = rows[0];
    if (!client) throw Object.assign(new Error('Hospital no encontrado.'), { status: 404 });
  }
  const stem = hospitalUsername(base, client);
  const { rows } = await query(`SELECT username FROM users WHERE LOWER(username)=LOWER($1)
    OR LEFT(LOWER(username), LENGTH($1)+1)=LOWER($1)||'.'`, [stem]);
  const used = new Set(rows.map(row => row.username.toLowerCase()));
  let candidate = stem;
  let suffix = 2;
  while (used.has(candidate)) {
    const number = `.${suffix++}`;
    candidate = `${stem.slice(0, 80 - number.length)}${number}`;
  }
  return { username: candidate, available: true };
}
