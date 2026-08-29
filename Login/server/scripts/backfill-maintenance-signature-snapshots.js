import dotenv from 'dotenv';
import { pool, query } from '../src/db.js';
import { updateMaintenanceReportSignatureSnapshot } from '../src/maintenance.js';
import {
  createMaintenanceSignatureSnapshot,
  isMaintenanceSignatureSnapshotPath,
  removeMaintenanceSignatureSnapshot
} from '../src/maintenance-signature-snapshots.js';

dotenv.config();

async function run() {
  const { rows } = await query(
    `SELECT signature.id,
            signature.report_id,
            signature.signature_path,
            signature.signer_name,
            signature.signer_invima_registration,
            report.client_id
     FROM report_signatures signature
     JOIN maintenance_reports report ON report.id = signature.report_id
     ORDER BY signature.signed_at, signature.id`
  );

  let migrated = 0;
  let alreadyProtected = 0;
  let missing = 0;

  for (const signature of rows) {
    if (isMaintenanceSignatureSnapshotPath(signature.signature_path, signature.report_id)) {
      alreadyProtected += 1;
      continue;
    }

    let snapshot;
    try {
      snapshot = await createMaintenanceSignatureSnapshot({
        clientId: signature.client_id,
        reportId: signature.report_id,
        sourceSignaturePath: signature.signature_path
      });
      const updated = await updateMaintenanceReportSignatureSnapshot({
        signatureId: signature.id,
        previousSignaturePath: signature.signature_path,
        signaturePath: snapshot.publicPath,
        signatureSha256: snapshot.sha256,
        signerName: signature.signer_name,
        signerInvimaRegistration: signature.signer_invima_registration
      });
      if (!updated) {
        await removeMaintenanceSignatureSnapshot(snapshot.fullPath);
        continue;
      }
      migrated += 1;
    } catch (error) {
      if (snapshot?.fullPath) {
        await removeMaintenanceSignatureSnapshot(snapshot.fullPath).catch(() => {});
      }
      missing += 1;
      console.warn(
        `No se pudo conservar la firma ${signature.id} del reporte ${signature.report_id}: ${error.message}`
      );
    }
  }

  console.log(
    `Firmas revisadas: ${rows.length}. Protegidas: ${alreadyProtected}. Migradas: ${migrated}. No disponibles: ${missing}.`
  );
}

try {
  await run();
} finally {
  await pool.end();
}
