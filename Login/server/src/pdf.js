import fs from 'fs';
import path from 'path';

const TABLE_BORDER = '#94a3b8';
const TABLE_HEADER_BG = '#ffffff';
const TABLE_STRIPE_BG = '#f8fafc';

function safeText(value) {
  return value || '-';
}

function safeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function formatDate(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function sectionTitle(doc, title, opts = {}) {
  doc.moveDown(0.8);
  const startX = safeNumber(opts.x ?? doc.page.margins.left, doc.page.margins.left);
  const width = safeNumber(
    opts.width ?? doc.page.width - doc.page.margins.left - doc.page.margins.right,
    doc.page.width - doc.page.margins.left - doc.page.margins.right
  );
  const barHeight = 18;
  doc.save();
  doc
    .rect(startX, doc.y, width, barHeight)
    .fillColor('#0f172a')
    .fill();
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(11.5)
    .text(title, startX + 8, doc.y + 4, { width: width - 16, align: 'left' });
  doc.restore();
  doc.moveDown(1.4);
  doc.fillColor('#0f172a').fontSize(10.5);
}

function drawTable(
  doc,
  rows,
  {
    colWidths,
    x,
    y,
    padding = 6,
    rowHeight = 22,
    header = false,
    autoHeight = true,
    striped = true,
    textSize = 10.5,
  } = {}
) {
  const startX = safeNumber(x ?? doc.x, doc.page.margins.left);
  let cursorY = safeNumber(y ?? doc.y, doc.page.margins.top);
  const widths = colWidths ? [...colWidths] : [160, 330];
  const tableWidth = widths.reduce((a, b) => a + b, 0);
  const maxWidth = doc.page.width - doc.page.margins.right - startX;

  if (tableWidth > maxWidth && tableWidth > 0) {
    const scale = maxWidth / tableWidth;
    for (let i = 0; i < widths.length; i += 1) {
      widths[i] = Math.floor(widths[i] * scale);
    }
  }

  rows.forEach((row, rowIndex) => {
    let height = rowHeight;
    if (autoHeight) {
      let maxCellHeight = rowHeight;
      row.forEach((cell, i) => {
        const width = widths[i] || 100;
        const cellText = String(cell ?? '');
        const h = doc.heightOfString(cellText, { width: width - padding * 2 });
        maxCellHeight = Math.max(maxCellHeight, h + 10);
      });
      height = maxCellHeight;
    }
    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    if (cursorY + height > bottomLimit) {
      doc.addPage();
      cursorY = doc.page.margins.top;
    }
    const rowWidth = widths.reduce((a, b) => a + b, 0);
    if (header && rowIndex === 0) {
      doc
        .rect(startX, cursorY, rowWidth, height)
        .fillColor(TABLE_HEADER_BG)
        .fill();
    } else if (striped && rowIndex % 2 === 1) {
      doc
        .rect(startX, cursorY, rowWidth, height)
        .fillColor(TABLE_STRIPE_BG)
        .fill();
    }

    doc
      .rect(startX, cursorY, rowWidth, height)
      .strokeColor(TABLE_BORDER)
      .lineWidth(0.8)
      .stroke();

    let cellX = startX;
    row.forEach((cell, i) => {
      const width = widths[i] || 100;
      if (i > 0) {
        doc
          .moveTo(cellX, cursorY)
          .lineTo(cellX, cursorY + height)
          .strokeColor('#cbd5f5')
          .stroke();
      }
      doc
        .fontSize(textSize)
        .fillColor('#0f172a')
        .text(String(cell), cellX + padding, cursorY + 6, { width: width - padding * 2 });
      cellX += width;
    });

    cursorY += height;
  });

  doc.y = cursorY + 6;
  doc.x = doc.page.margins.left;
  return cursorY + 6;
}

export function buildAssetPdf(doc, { client, asset }) {
  doc.fontSize(18).fillColor('#0f172a').text('Hoja de Vida - Equipo Biomédico', { align: 'center' });
  doc.moveDown(0.5);

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 78;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor('#94a3b8')
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor('#94a3b8')
    .stroke();

  if (client.logo_path) {
    const logoPath = path.join(process.cwd(), client.logo_path.replace(/^\//, ''));
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, headerLeftX + 10, headerY + 8, { fit: [150, 60] });
    }
  }

  const infoStartX = headerLeftX + logoCellWidth + 8;
  const infoMaxWidth = headerWidth - logoCellWidth - 16;
  const infoLabelWidth = 70;
  const infoValueWidth = Math.max(120, infoMaxWidth - infoLabelWidth);

  // Nombre del cliente más grande, sin etiqueta "Cliente"
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#0f172a')
    .text(safeText(client.name), infoStartX, headerY + 8, { width: infoMaxWidth });

  // Datos del cliente (sin bordes), pegados al nombre
  const infoLines = [
    `NIT: ${safeText(client.nit)}`,
    `Ciudad: ${safeText(client.city)}`,
    `Dirección: ${safeText(client.address)}`,
    `Correo: ${safeText(client.email)}`
  ];
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#334155')
    .text(infoLines.join('\n'), infoStartX, headerY + 26, { width: infoMaxWidth });

  doc.y = headerY + headerHeight + 12;

  let photoBottomY = null;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 16;
  const frameSize = Math.max(140, Math.floor(contentWidth * 0.4) - gap);
  const photoX = doc.page.margins.left;
  if (asset.photo_path) {
    const photoPath = path.join(process.cwd(), asset.photo_path.replace(/^\//, ''));
    if (fs.existsSync(photoPath)) {
      const photoY = doc.y;
      photoBottomY = photoY + frameSize + 18;
      doc
        .rect(photoX - 4, photoY - 4, frameSize + 8, frameSize + 24)
        .fillColor('#f1f5f9')
        .fill();
      doc
        .rect(photoX - 4, photoY - 4, frameSize + 8, frameSize + 8)
        .strokeColor('#94a3b8')
        .lineWidth(0.8)
        .stroke();
      doc.image(photoPath, photoX, photoY, { fit: [frameSize, frameSize] });
      doc
        .fillColor('#334155')
        .fontSize(9)
        .text('Foto del equipo', photoX, photoY + frameSize + 4, { width: frameSize, align: 'center' });
    }
  }

  const equipoRows = [
    ['Nombre', safeText(asset.name)],
    ['Marca', safeText(asset.brand)],
    ['Modelo', safeText(asset.model)],
    ['Serie', safeText(asset.serial)],
    ['Área', safeText(asset.area_name)],
    ['Ubicación', safeText(asset.location_name)],
    ['Código', safeText(asset.code)],
    ['Registro Invima', safeText(asset.invima_reg)],
    ['Riesgo', safeText(asset.risk_class)],
    ['Tipo', asset.is_mobile ? 'Móvil' : 'Fijo'],
    ['Fabricante', safeText(asset.manufacturer)],
    ['Tipo de alimentación', safeText(asset.power_type)],
    ['Voltaje', safeText(asset.voltage)],
    ['Temperatura operación', `${safeText(asset.temp_min)} - ${safeText(asset.temp_max)}`],
    ['Humedad operación', `${safeText(asset.humidity_min)} - ${safeText(asset.humidity_max)}`],
  ];

  if (photoBottomY) {
    const tableX = photoX + frameSize + gap;
    const tableWidth = doc.page.width - doc.page.margins.right - tableX;
    const rightColWidths = [Math.floor(tableWidth * 0.4), Math.floor(tableWidth * 0.6)];
    const sectionStartY = photoBottomY - (frameSize + 18);
    const previousY = doc.y;
    doc.y = sectionStartY;
    sectionTitle(doc, 'DATOS DEL EQUIPO', { x: tableX, width: tableWidth });
    const availableHeight = photoBottomY - doc.y;
    const leftRows = [];
    const remainingRows = [];
    let usedHeight = 0;

    equipoRows.forEach((row) => {
      const h0 = doc.heightOfString(String(row[0] ?? ''), { width: rightColWidths[0] - 12 });
      const h1 = doc.heightOfString(String(row[1] ?? ''), { width: rightColWidths[1] - 12 });
      const rowHeight = Math.max(22, h0 + 10, h1 + 10);
      if (usedHeight + rowHeight <= availableHeight || leftRows.length === 0) {
        leftRows.push(row);
        usedHeight += rowHeight;
      } else {
        remainingRows.push(row);
      }
    });

    drawTable(doc, leftRows, { colWidths: rightColWidths, x: tableX, header: false });
    doc.y = Math.max(doc.y, photoBottomY);
    if (remainingRows.length) {
      drawTable(doc, remainingRows, { colWidths: [160, 260], x: doc.page.margins.left, header: false });
    }
  } else {
    sectionTitle(doc, 'DATOS DEL EQUIPO');
    drawTable(doc, equipoRows, { colWidths: [160, 260], x: doc.page.margins.left, header: false });
  }

  sectionTitle(doc, 'DATOS DE ADQUISICION');
  drawTable(doc, [
    ['Forma de adquisición', safeText(asset.acquisition_type)],
    ['Contrato', safeText(asset.contract_text)],
    ['Fecha de adquisición', formatDate(asset.acquisition_date)],
    ['Vida útil (años)', safeText(asset.useful_life_years)],
    ['Garantía (años)', safeText(asset.warranty_years)],
    ['Proveedor', safeText(asset.supplier_name)],
    ['Teléfono proveedor', safeText(asset.supplier_phone)],
    ['Correo proveedor', safeText(asset.supplier_email)],
  ], { colWidths: [170, 320], header: true });

  sectionTitle(doc, 'COMPONENTES DEL EQUIPO');
  if (asset.accessories?.length) {
    const rows = [
      ['Accesorio', 'Cant.', 'Marca', 'Serial'],
      ...asset.accessories.map((acc) => [
        acc.name || '-',
        acc.quantity || '-',
        acc.brand || '-',
        acc.serial || '-',
      ]),
    ];
    drawTable(doc, rows, { colWidths: [170, 60, 110, 120], header: true });
  } else {
    drawTable(doc, [['Accesorios', 'Sin accesorios.']], { colWidths: [170, 320], header: true });
  }

  sectionTitle(doc, 'DOCUMENTACION TECNICA');
  if (asset.documents?.length) {
    const rows = asset.documents.map((docItem) => ['Documento', docItem.doc_type]);
    drawTable(doc, rows, { colWidths: [170, 320] });
  } else {
    drawTable(doc, [['Documentos', 'Sin documentación adjunta.']], { colWidths: [170, 320], header: true });
  }

  sectionTitle(doc, 'DATOS DE MANTENIMIENTO Y CALIBRACION');
  drawTable(doc, [
    ['Frecuencia mantenimiento', safeText(asset.maintenance_frequency)],
    ['Requiere calibración', asset.requires_calibration ? 'Sí' : 'No'],
    ['Frecuencia calibración', safeText(asset.calibration_frequency)],
  ], { colWidths: [170, 320], header: true });

  sectionTitle(doc, 'GUIA DE LIMPIEZA Y DESINFECCION');
  if (asset.cleaning?.length) {
    const rows = [
      ['Procedimiento', 'Frecuencia', 'Responsable'],
      ...asset.cleaning.map((item) => [
        item.procedure || '-',
        item.frequency || '-',
        item.responsible || '-',
      ]),
    ];
    drawTable(doc, rows, { colWidths: [220, 120, 120], header: true });
  } else {
    drawTable(doc, [['Limpieza', 'Sin instrucciones registradas.']], { colWidths: [170, 320], header: true });
  }

  sectionTitle(doc, 'RECOMENDACIONES DEL FABRICANTE');
  if (asset.recommendations?.length) {
    const rows = [
      ['Recomendación', 'Detalle'],
      ...asset.recommendations.map((rec) => ['Recomendación', rec.text || '-']),
    ];
    drawTable(doc, rows, { colWidths: [170, 320], header: true });
  } else {
    drawTable(doc, [['Recomendaciones', 'Sin recomendaciones registradas.']], { colWidths: [170, 320], header: true });
  }

  return doc;
}

export function buildMaintenanceReportPdf(doc, { client, asset, request, report, signatures }) {
  doc.fontSize(18).fillColor('#0f172a').text('Reporte de Mantenimiento', { align: 'center' });
  doc.moveDown(0.6);

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 72;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor('#94a3b8')
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor('#94a3b8')
    .stroke();

  if (client.logo_path) {
    const logoPath = path.join(process.cwd(), client.logo_path.replace(/^\//, ''));
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, headerLeftX + 10, headerY + 8, { fit: [150, 56] });
    }
  }

  const infoStartX = headerLeftX + logoCellWidth + 8;
  const infoMaxWidth = headerWidth - logoCellWidth - 16;

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#0f172a')
    .text(safeText(client.name), infoStartX, headerY + 8, { width: infoMaxWidth });

  const infoLines = [
    `NIT: ${safeText(client.nit)}`,
    `Ciudad: ${safeText(client.city)}`,
    `Dirección: ${safeText(client.address)}`,
    `Correo: ${safeText(client.email)}`
  ];
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#334155')
    .text(infoLines.join('\n'), infoStartX, headerY + 26, { width: infoMaxWidth });

  doc.y = headerY + headerHeight + 10;

  sectionTitle(doc, 'DATOS DEL EQUIPO');
  const assetRows = [
    ['Código', safeText(asset.code)],
    ['Nombre', safeText(asset.name)],
    ['Marca', safeText(asset.brand)],
    ['Modelo', safeText(asset.model)],
    ['Serie', safeText(asset.serial)],
    ['Área', safeText(asset.area_name)],
    ['Ubicación', safeText(asset.location_name)]
  ];
  drawTable(doc, assetRows, { colWidths: [140, 360] });

  sectionTitle(doc, 'RESUMEN DEL REPORTE');
  const reportRows = [
    ['Tipo', safeText(report.type)],
    ['Fecha reporte', formatDate(report.created_at)],
    ['Solicitud', safeText(request.type)],
    ['Fecha solicitud', formatDate(request.created_at)],
    ['Resumen', safeText(report.summary)],
    ['Hallazgos', safeText(report.findings)],
    ['Acciones realizadas', safeText(report.actions_taken)]
  ];
  drawTable(doc, reportRows, { colWidths: [140, 360], rowHeight: 24 });

  sectionTitle(doc, 'FIRMAS');
  if (!signatures?.length) {
    doc.fontSize(10).fillColor('#475569').text('Sin firmas registradas.');
    return;
  }

  const signatureWidth = 160;
  const signatureHeight = 60;
  const gap = 14;
  let cursorX = doc.page.margins.left;
  let cursorY = doc.y;

  signatures.forEach((sig, index) => {
    if (index > 0 && cursorX + signatureWidth > doc.page.width - doc.page.margins.right) {
      cursorX = doc.page.margins.left;
      cursorY += signatureHeight + 40;
    }

    doc
      .rect(cursorX, cursorY, signatureWidth, signatureHeight)
      .strokeColor('#cbd5f5')
      .lineWidth(0.8)
      .stroke();

    const sigPath = sig.signature_path
      ? path.join(process.cwd(), sig.signature_path.replace(/^\//, ''))
      : null;
    if (sigPath && fs.existsSync(sigPath)) {
      doc.image(sigPath, cursorX + 6, cursorY + 6, { fit: [signatureWidth - 12, signatureHeight - 12] });
    }

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#475569')
      .text('Firmante', cursorX, cursorY + signatureHeight + 2, {
        width: signatureWidth,
        align: 'center'
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#0f172a')
      .text(safeText(sig.display_name), cursorX, cursorY + signatureHeight + 12, {
        width: signatureWidth,
        align: 'center'
      });
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#334155')
      .text(`Rol: ${safeText(sig.role)}`, cursorX, cursorY + signatureHeight + 24, {
        width: signatureWidth,
        align: 'center'
      });
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#334155')
      .text(`Fecha: ${formatDate(sig.signed_at)}`, cursorX, cursorY + signatureHeight + 34, {
        width: signatureWidth,
        align: 'center'
      });

    cursorX += signatureWidth + gap;
  });

  doc.y = cursorY + signatureHeight + 32;
}

export function buildMaintenanceSchedulePdf(doc, { client, schedule, items }) {
  doc.fontSize(18).fillColor('#0f172a').text('Cronograma de Mantenimiento Preventivo', { align: 'center' });
  doc.moveDown(0.6);

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 72;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor('#94a3b8')
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor('#94a3b8')
    .stroke();

  if (client.logo_path) {
    const logoPath = path.join(process.cwd(), client.logo_path.replace(/^\//, ''));
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, headerLeftX + 10, headerY + 8, { fit: [150, 56] });
    }
  }

  const infoStartX = headerLeftX + logoCellWidth + 8;
  const infoMaxWidth = headerWidth - logoCellWidth - 16;

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#0f172a')
    .text(safeText(client.name), infoStartX, headerY + 8, { width: infoMaxWidth });

  const infoLines = [
    `Año: ${safeText(schedule.year)}`,
    `Fecha inicial: ${formatDate(schedule.start_date)}`
  ];
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#334155')
    .text(infoLines.join('\n'), infoStartX, headerY + 28, { width: infoMaxWidth });

  doc.y = headerY + headerHeight + 10;

  sectionTitle(doc, 'DETALLE DEL CRONOGRAMA');

  const subtractBusinessDays = (value, days) => {
    let date = value instanceof Date ? new Date(value) : new Date(value);
    let remaining = days;
    while (remaining > 0) {
      date.setDate(date.getDate() - 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) {
        remaining -= 1;
      }
    }
    return date;
  };

  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.asset_id)) {
      grouped.set(item.asset_id, {
        code: item.code,
        name: item.name,
        brand: item.brand,
        model: item.model,
        serial: item.serial,
        frequency: item.frequency,
        dates: []
      });
    }
    const rangeStart = item.deadline_date ? subtractBusinessDays(item.deadline_date, 10) : item.planned_date;
    grouped
      .get(item.asset_id)
      .dates.push(`${formatDate(rangeStart)}-${formatDate(item.deadline_date)}`);
  }
  const rows = Array.from(grouped.values()).map((item) => [
    safeText(item.code),
    safeText(item.name),
    safeText(item.brand),
    safeText(item.model),
    safeText(item.serial),
    safeText(item.frequency),
    item.dates.join('\n')
  ]);
  const scheduleCols = [54, 110, 75, 55, 75, 65, 136];
  const tableX = doc.page.margins.left;
  drawTable(doc, [['Código', 'Equipo', 'Marca', 'Modelo', 'Serie', 'Frecuencia', 'Fechas']], {
    colWidths: scheduleCols,
    header: true,
    rowHeight: 16,
    padding: 3,
    textSize: 8.5,
    x: tableX
  });
  drawTable(doc, rows, {
    colWidths: scheduleCols,
    rowHeight: 16,
    padding: 3,
    textSize: 8.5,
    autoHeight: true,
    x: tableX
  });
}

export function buildCalibrationSchedulePdf(doc, { client, schedule, items }) {
  doc.fontSize(18).fillColor('#0f172a').text('Cronograma de Calibración', { align: 'center' });
  doc.moveDown(0.6);

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 72;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor('#94a3b8')
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor('#94a3b8')
    .stroke();

  if (client.logo_path) {
    const logoPath = path.join(process.cwd(), client.logo_path.replace(/^\//, ''));
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, headerLeftX + 10, headerY + 8, { fit: [150, 56] });
    }
  }

  const infoStartX = headerLeftX + logoCellWidth + 8;
  const infoMaxWidth = headerWidth - logoCellWidth - 16;

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#0f172a')
    .text(safeText(client.name), infoStartX, headerY + 8, { width: infoMaxWidth });

  const infoLines = [
    `Año: ${safeText(schedule.year)}`,
    `Fecha inicial: ${formatDate(schedule.start_date)}`
  ];
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#334155')
    .text(infoLines.join('\n'), infoStartX, headerY + 28, { width: infoMaxWidth });

  doc.y = headerY + headerHeight + 10;

  sectionTitle(doc, 'DETALLE DEL CRONOGRAMA');

  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.asset_id)) {
      grouped.set(item.asset_id, {
        code: item.code,
        name: item.name,
        brand: item.brand,
        model: item.model,
        serial: item.serial,
        frequency: item.frequency,
        dates: []
      });
    }
    grouped.get(item.asset_id).dates.push(`${formatDate(item.planned_date)}-${formatDate(item.deadline_date)}`);
  }

  const rows = Array.from(grouped.values()).map((item) => [
    safeText(item.code),
    safeText(item.name),
    safeText(item.brand),
    safeText(item.model),
    safeText(item.serial),
    safeText(item.frequency),
    item.dates.join('\n')
  ]);

  const scheduleCols = [54, 110, 75, 55, 75, 65, 136];
  const tableX = doc.page.margins.left;
  drawTable(doc, [['Código', 'Equipo', 'Marca', 'Modelo', 'Serie', 'Frecuencia', 'Fechas']], {
    colWidths: scheduleCols,
    header: true,
    rowHeight: 16,
    padding: 3,
    textSize: 8.5,
    x: tableX
  });
  drawTable(doc, rows, {
    colWidths: scheduleCols,
    rowHeight: 16,
    padding: 3,
    textSize: 8.5,
    autoHeight: true,
    x: tableX
  });
}

export function buildTrainingSchedulePdf(doc, { client, schedule, items }) {
  doc.fontSize(18).fillColor('#0f172a').text('Cronograma de Capacitaciones', { align: 'center' });
  doc.moveDown(0.6);

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 72;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor('#94a3b8')
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor('#94a3b8')
    .stroke();

  if (client.logo_path) {
    const logoPath = path.join(process.cwd(), client.logo_path.replace(/^\//, ''));
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, headerLeftX + 10, headerY + 8, { fit: [150, 56] });
    }
  }

  const infoStartX = headerLeftX + logoCellWidth + 8;
  const infoMaxWidth = headerWidth - logoCellWidth - 16;

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#0f172a')
    .text(safeText(client.name), infoStartX, headerY + 8, { width: infoMaxWidth });

  const infoLines = [
    `Año: ${safeText(schedule.year)}`,
    `Fecha inicial: ${formatDate(schedule.start_date)}`,
    `Periodicidad: ${safeText(schedule.periodicity)}`
  ];
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#334155')
    .text(infoLines.join('\n'), infoStartX, headerY + 26, { width: infoMaxWidth });

  doc.y = headerY + headerHeight + 10;

  sectionTitle(doc, 'DETALLE DEL CRONOGRAMA');

  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.area_id)) {
      grouped.set(item.area_id, {
        area: item.area_name,
        dates: []
      });
    }
    grouped.get(item.area_id).dates.push(formatDate(item.planned_date));
  }

  const rows = Array.from(grouped.values()).map((item) => [
    safeText(item.area),
    item.dates.join('\n')
  ]);

  const scheduleCols = [220, 240];
  const tableX = doc.page.margins.left;
  drawTable(doc, [['Área', 'Fechas']], {
    colWidths: scheduleCols,
    header: true,
    rowHeight: 16,
    padding: 3,
    textSize: 8.5,
    x: tableX
  });
  drawTable(doc, rows, {
    colWidths: scheduleCols,
    rowHeight: 16,
    padding: 3,
    textSize: 8.5,
    autoHeight: true,
    x: tableX
  });
}
