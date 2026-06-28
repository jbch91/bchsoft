import path from 'path';
import fs from 'fs/promises';
import { query } from './db.js';
import { createSchemaTables, slugify } from './tenants.js';
import { ensureClientSubscription } from './subscriptions.js';

export async function listClients() {
  const { rows } = await query(
    `SELECT c.id,
            c.name,
            c.nit,
            c.city,
            c.address,
            c.habilitation_code,
            c.email,
            c.logo_path,
            c.schema_name,
            c.created_at,
            COALESCE((
              SELECT COUNT(*)::int
              FROM users u
              JOIN user_roles ur ON ur.user_id = u.id
              JOIN roles r ON r.id = ur.role_id
              WHERE u.client_id = c.id
                AND u.is_active = TRUE
                AND r.name = 'client_admin'
            ), 0) AS client_admin_count
     FROM clients
     c
     ORDER BY c.created_at DESC`
  );
  return rows;
}

export async function getClientById(clientId) {
  const { rows } = await query(
    `SELECT id, name, nit, city, address, habilitation_code, email, logo_path, schema_name
     FROM clients
     WHERE id = $1`,
    [clientId]
  );
  return rows[0];
}

async function ensureUniqueSchemaName(baseName) {
  let schemaName = baseName;
  let counter = 2;
  while (true) {
    const { rows } = await query('SELECT 1 FROM clients WHERE schema_name = $1', [schemaName]);
    if (!rows.length) {
      return schemaName;
    }
    schemaName = `${baseName}_${counter}`;
    counter += 1;
  }
}

export async function createClient({ name, nit, city, address, habilitationCode, email }) {
  const slug = slugify(name);
  const baseSchema = `cliente_${slug}`;
  const schemaName = await ensureUniqueSchemaName(baseSchema);

  await createSchemaTables(schemaName);

  const { rows } = await query(
    `INSERT INTO clients (name, nit, city, address, habilitation_code, email, schema_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, schema_name`,
    [name, nit, city, address, habilitationCode, email, schemaName]
  );

  await ensureClientSubscription(rows[0].id);

  return rows[0];
}

export async function updateClientLogo(clientId, filename) {
  const { rows } = await query(
    'UPDATE clients SET logo_path = $1 WHERE id = $2 RETURNING id, logo_path',
    [filename, clientId]
  );
  return rows[0];
}

export async function updateClient(clientId, payload) {
  const { name, nit, city, address, habilitationCode, email } = payload;
  const { rows } = await query(
    `UPDATE clients
     SET name = $1,
         nit = $2,
         city = $3,
         address = $4,
         habilitation_code = $5,
         email = $6
     WHERE id = $7
     RETURNING id`,
    [name, nit, city, address, habilitationCode, email, clientId]
  );
  return rows[0];
}

export async function deleteClient(clientId) {
  await query('DELETE FROM clients WHERE id = $1', [clientId]);
}

export async function ensureClientLogoDir(clientId) {
  const dir = path.join(process.cwd(), 'uploads', 'clients', clientId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
