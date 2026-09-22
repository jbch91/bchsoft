const upper = value => String(value || 'NO REGISTRA').toLocaleUpperCase('es-CO');
const date = value => {
  if (!value) return 'NO REGISTRA';
  const iso = value instanceof Date ? value.toISOString() : String(value);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'NO REGISTRA';
};

// A separate certificate leaves the original protocol and signature files intact.
export function buildWarrantyVoidPdf(doc, { client, asset, report }) {
  const notLocated = report.void_details?.destination === 'not_located';
  const width = doc.page.width - 100;
  const line = (label, value) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#50636b').text(upper(label), { width });
    doc.moveDown(0.3).font('Helvetica').fontSize(11).fillColor('#202b32').text(upper(value), { width, lineGap: 3 });
    doc.moveDown(0.8);
  };
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#263c43').text(upper(client.name), { width });
  doc.moveDown(0.4).font('Helvetica').fontSize(9).text(`NIT: ${upper(client.nit)}`);
  doc.moveDown(1.4).font('Helvetica-Bold').fontSize(20).text('ANULACIÓN DE PROTOCOLO', { width });
  doc.moveDown(0.5).fontSize(10).fillColor('#256b60').text(notLocated
    ? 'SIN EJECUCIÓN DE MANTENIMIENTO - EQUIPO NO LOCALIZADO'
    : 'SIN EJECUCIÓN DE MANTENIMIENTO - CUBIERTO POR GARANTÍA', { width });
  doc.moveDown(1.5);
  line('Equipo', `${report.void_details?.assetCode || asset.code} - ${report.void_details?.assetName || asset.name}`);
  line('Identificación', `${asset.brand || 'NR'} / ${asset.model || 'NR'} / SERIE: ${asset.serial || 'NR'}`);
  if (notLocated) line('Actividad programada', date(report.void_details?.plannedDate));
  else line('Actividad programada / Fin de garantía', `${date(report.void_details?.plannedDate)} / ${date(report.void_details?.warrantyReleaseDate)}`);
  line('Anulación registrada', `${date(report.voided_at)} - ${report.void_details?.actorLabel || 'USUARIO REGISTRADO'}`);
  line('Motivo de anulación', report.void_reason);
  line('Trazabilidad', notLocated
    ? 'Se confirmó que no hubo intervención. El protocolo y las firmas originales se conservan como evidencia del registro erróneo. La actividad se cierra mediante una constancia de equipo no localizado, sin contabilizarse como mantenimiento ejecutado. No se verificó el estado operativo del equipo.'
    : 'Se confirmó que no hubo intervención. El protocolo y las firmas originales se conservan como evidencia del registro erróneo. La actividad pasa a garantía, sin contabilizarse como mantenimiento ejecutado. Esta constancia no acredita una intervención técnica.');
  if (notLocated) line('Constancia de reemplazo', report.void_details?.replacementReportId);
  doc.fontSize(8).fillColor('#50636b').text(`REPORTE ORIGINAL: ${report.id}`, { width });
  doc.moveDown(2).fontSize(7).text('SOFTWARE BIOMÉDICO INBIHOSPITALARIO | CONSTANCIA DE ANULACIÓN', { width, align: 'center' });
}
