import { randomBytes } from 'crypto';
import PDFDocument from 'pdfkit';
import { buildBlankMaintenanceProtocolPdf } from './pdf.js';

export const BLANK_MAINTENANCE_PROTOCOL_PERMISSION = 'maintenance:protocol:print_blank';
export const MAX_BLANK_MAINTENANCE_PROTOCOLS_PER_BATCH = 500;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeBlankMaintenanceProtocolRequest(payload = {}) {
  const scope = payload.scope === 'all_active'
    ? 'all_active'
    : payload.scope === 'selected'
      ? 'selected'
      : null;
  if (!scope) {
    return { error: 'Selecciona si deseas generar todos los equipos vigentes o solo algunos.' };
  }

  const reason = String(payload.reason || '').replace(/\s+/g, ' ').trim();
  if (reason.length < 10) {
    return { error: 'Registra un motivo de al menos 10 caracteres para dejar trazabilidad.' };
  }
  if (reason.length > 300) {
    return { error: 'El motivo no puede superar 300 caracteres.' };
  }

  const assetIds = Array.from(
    new Set((Array.isArray(payload.assetIds) ? payload.assetIds : []).map((value) => String(value).trim()))
  ).filter(Boolean);
  if (scope === 'selected' && !assetIds.length) {
    return { error: 'Selecciona al menos un equipo.' };
  }
  if (assetIds.length > MAX_BLANK_MAINTENANCE_PROTOCOLS_PER_BATCH) {
    return { error: `Cada lote admite máximo ${MAX_BLANK_MAINTENANCE_PROTOCOLS_PER_BATCH} equipos.` };
  }
  if (assetIds.some((assetId) => !UUID_PATTERN.test(assetId))) {
    return { error: 'La selección contiene identificadores de equipo inválidos.' };
  }

  return {
    value: {
      scope,
      reason,
      assetIds: scope === 'selected' ? assetIds : []
    }
  };
}

export function createBlankMaintenanceProtocolBatchCode() {
  return `PMF-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export function buildBlankMaintenanceProtocolBatchPdf({ client, assets, engineer, batchCode }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 26,
      info: {
        Title: `Protocolos físicos de mantenimiento - ${batchCode}`,
        Subject: 'Formatos físicos en blanco para mantenimiento biomédico'
      }
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    assets.forEach((asset, index) => {
      if (index > 0) doc.addPage();
      buildBlankMaintenanceProtocolPdf(doc, {
        client,
        asset,
        engineer,
        batchCode,
        pageNumber: index + 1,
        totalPages: assets.length
      });
    });
    doc.end();
  });
}
