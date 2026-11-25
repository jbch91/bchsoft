import fs from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

export async function mergeAssetHistoryPdf({ basePdf, historyItems, resolveFile }) {
  const merged = await PDFDocument.create({ updateMetadata: false });
  const append = async (bytes) => {
    const source = await PDFDocument.load(bytes, { updateMetadata: false });
    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) merged.addPage(page);
  };
  await append(basePdf);
  const included = new Set();
  for (const item of historyItems) {
    try {
      const file = await resolveFile(item);
      if (!file) throw new Error('Archivo no disponible');
      if (included.has(file)) continue;
      await append(await fs.readFile(file));
      included.add(file);
    } catch (cause) {
      throw Object.assign(new Error(`No se pudo incluir “${item.title || item.id}” en el PDF completo. Revisa su archivo antes de descargarlo.`),
        { code: 'ASSET_HISTORY_PDF_UNAVAILABLE', status: 409, cause });
    }
  }
  return Buffer.from(await merged.save());
}
