import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { query, pool } from '../src/db.js';

dotenv.config();

// Ordered list: ensures dependencies (tables/columns) exist before referencing them.
const MIGRATIONS = [
  'schema.sql',
  'add_email.sql',
  'refresh_tokens.sql',
  'password_reset.sql',
  'clients.sql',
  'clients_add_address.sql',
  'users_add_client.sql',
  'users_add_signature.sql',
  'users_add_biomed_credentials.sql',
  'modules.sql',
  'audit_logs.sql',
  'maintenance.sql',
  'maintenance_add_pdf.sql',
  'maintenance_add_schedule_fields.sql',
  'maintenance_add_reminders.sql',
  'schedules.sql',
  'schedules_add_pdf.sql',
  'training_schedules.sql',
  'training_add_pdf.sql',
  'calibration_schedules.sql',
  'calibration_add_pdf.sql',
  'permissions_hv.sql',
  'roles_hv_view_fix.sql',
  'roles_maintenance.sql',
  'seed.sql',
  'seed_users_permission.sql',
  'admin_clients_permission.sql',
  'superuser_all_permissions.sql',
  'tenant_hv_migration.sql',
  'tenant_hv_part2.sql',
  'history_indexes.sql'
];

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function hasMigration(id) {
  const { rows } = await query('SELECT 1 FROM migrations WHERE id = $1 LIMIT 1', [id]);
  return rows.length > 0;
}

async function applyMigration(id) {
  const filePath = path.join(process.cwd(), 'sql', id);
  const sql = await fs.readFile(filePath, 'utf8');
  await query('BEGIN');
  try {
    await query(sql);
    await query('INSERT INTO migrations (id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
    await query('COMMIT');
    // eslint-disable-next-line no-console
    console.log(`OK ${id}`);
  } catch (err) {
    await query('ROLLBACK');
    // eslint-disable-next-line no-console
    console.error(`ERROR ${id}`);
    throw err;
  }
}

async function run() {
  try {
    await ensureMigrationsTable();

    for (const id of MIGRATIONS) {
      // Guard against missing files (e.g., if a file was removed in future).
      try {
        await fs.access(path.join(process.cwd(), 'sql', id));
      } catch {
        // eslint-disable-next-line no-console
        console.warn(`SKIP (missing) ${id}`);
        continue;
      }

      if (await hasMigration(id)) continue;
      await applyMigration(id);
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
