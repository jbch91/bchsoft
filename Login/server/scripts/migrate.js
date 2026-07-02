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
  'single_active_sessions.sql',
  'password_reset.sql',
  'admin_action_confirmations.sql',
  'clients.sql',
  'clients_add_address.sql',
  'users_add_client.sql',
  'users_add_signature.sql',
  'users_add_biomed_credentials.sql',
  'modules.sql',
  'modules_normalize_inbi.sql',
  'quick_use_guides.sql',
  'software_suites.sql',
  'client_subscriptions.sql',
  'odontology_base.sql',
  'subscription_plans.sql',
  'subscription_plans_admin_fields.sql',
  'remove_clientes_from_client_modules.sql',
  'odontology_catalog_overrides.sql',
  'odontology_procedure_overrides.sql',
  'odontology_patients.sql',
  'odontology_appointments.sql',
  'odontology_clinical_records.sql',
  'odontology_clinical_records_pdf.sql',
  'odontology_clinical_record_patient_signature.sql',
  'odontology_clinical_record_notes.sql',
  'odontology_odontogram.sql',
  'odontology_periodontograms.sql',
  'odontology_consents.sql',
  'odontology_data_processing_consent.sql',
  'odontology_patient_consent_signatures.sql',
  'odontology_dentist_schedules.sql',
  'odontology_appointment_reminders.sql',
  'odontology_appointment_reminders_dedup.sql',
  'odontology_whatsapp_settings.sql',
  'odontology_required_patient_fields.sql',
  'odontology_treatment_plans.sql',
  'odontology_treatment_plan_acceptance_signature.sql',
  'odontology_appointments_treatment_plan_link.sql',
  'odontology_attachments.sql',
  'odontology_inventory.sql',
  'odontology_inventory_kits.sql',
  'odontology_suppliers.sql',
  'odontology_purchase_requests.sql',
  'odontology_sterilization.sql',
  'odontology_sterilization_cycle_pdf.sql',
  'odontology_payments.sql',
  'odontology_financial_permission.sql',
  'odontology_cash_closures.sql',
  'odontology_prescriptions.sql',
  'odontology_clinical_documents.sql',
  'odontology_audit_permission.sql',
  'audit_logs.sql',
  'maintenance.sql',
  'maintenance_add_pdf.sql',
  'maintenance_add_schedule_fields.sql',
  'maintenance_add_reminders.sql',
  'maintenance_report_tracking.sql',
  'maintenance_report_standard_fields.sql',
  'maintenance_report_corrections.sql',
  'notifications_mobile_ready.sql',
  'maintenance_spare_part_notifications_backfill.sql',
  'schedules.sql',
  'maintenance_requests_schedule_link.sql',
  'schedules_add_pdf.sql',
  'training_schedules.sql',
  'training_add_pdf.sql',
  'calibration_schedules.sql',
  'calibration_add_pdf.sql',
  'permissions_hv.sql',
  'roles_hv_view_fix.sql',
  'roles_maintenance.sql',
  'maintenance_sign_permissions_fix.sql',
  'seed.sql',
  'seed_users_permission.sql',
  'saas_client_admin_role.sql',
  'client_role_permissions.sql',
  'admin_clients_permission.sql',
  'superuser_all_permissions.sql',
  'saas_platform_admin_roles.sql',
  'remove_legacy_unrelated_permissions.sql',
  'hv_import_permission.sql',
  'user_temporary_permissions.sql',
  'high_impact_permissions_role_cleanup.sql',
  'tenant_hv_migration.sql',
  'tenant_hv_part2.sql',
  'tenant_sites.sql',
  'asset_hv_signatures_and_movements.sql',
  'asset_history_files.sql',
  'asset_hv_engineer_backfill.sql',
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
