import fs from 'fs';
import path from 'path';

const PDF_BRAND_50 = '#fff1f2';
const PDF_BRAND_100 = '#ffe4e6';
const PDF_BRAND_200 = '#fecdd3';
const PDF_BRAND_600 = '#a64045';
const PDF_BRAND_700 = '#8f3237';
const PDF_BRAND_800 = '#7f1d1d';
const PDF_INK = '#241416';
const PDF_MUTED = '#6b4b4f';
const PDF_DANGER = '#991b1b';
const PDF_WHITE = '#ffffff';
const PDF_SOFT_BG = '#fff7f7';
const PDF_TABLE_BORDER = '#e7c8cb';
const PDF_TABLE_DIVIDER = '#f0d4d8';
const PDF_TABLE_STRIPE_BG = '#fffafa';
const TABLE_BORDER = PDF_TABLE_BORDER;
const TABLE_HEADER_BG = PDF_BRAND_50;
const TABLE_STRIPE_BG = PDF_TABLE_STRIPE_BG;

function safeText(value) {
  return value || '-';
}

function maintenanceAssetStatusLabel(value) {
  const labels = {
    operativo: 'Operativo',
    operativo_observacion: 'Operativo con observación',
    fuera_de_servicio: 'Fuera de servicio'
  };
  return labels[value] || safeText(value);
}

function sparePartStatusLabel(value) {
  const labels = {
    no_aplica: 'No aplica',
    pendiente: 'Pendiente',
    solicitado: 'Repuesto solicitado',
    recibido: 'Recibido'
  };
  return labels[value] || safeText(value);
}

function listLabels(values, labels) {
  const list = Array.isArray(values) ? values : [];
  if (!list.length) return 'No registrado';
  return list.map((value) => labels[value] || value).join('\n');
}

const MAINTENANCE_CHECK_LABELS = {
  revision_visual: 'Revisión visual externa',
  revision_cables_conexiones: 'Revisión de cables y conexiones',
  revision_accesorios: 'Revisión de accesorios',
  verificacion_alimentacion: 'Verificación de alimentación eléctrica/batería',
  revision_alarmas_errores: 'Revisión de alarmas o códigos de error',
  prueba_funcional_inicial: 'Prueba funcional inicial',
  revision_seguridad_basica: 'Revisión básica de seguridad'
};

const MAINTENANCE_ACTIVITY_LABELS = {
  limpieza_externa: 'Limpieza externa',
  limpieza_interna: 'Limpieza interna',
  ajuste_conexiones: 'Ajuste de conexiones',
  configuracion_parametros: 'Configuración de parámetros',
  reparacion_componente: 'Reparación de componente',
  instalacion_repuesto: 'Instalación/reemplazo de repuesto',
  lubricacion: 'Lubricación',
  actualizacion_software: 'Actualización de software',
  capacitacion_usuario: 'Inducción/capacitación al usuario',
  prueba_funcional_final: 'Prueba funcional final'
};

const MAINTENANCE_TEST_LABELS = {
  encendido_apagado: 'Encendido y apagado',
  prueba_modos_operacion: 'Prueba de modos de operación',
  verificacion_alarmas: 'Verificación de alarmas',
  verificacion_accesorios: 'Verificación de accesorios',
  prueba_con_paciente_simulado: 'Prueba con paciente/simulador',
  verificacion_parametros: 'Verificación de parámetros',
  verificacion_temperatura_presion: 'Verificación de temperatura o presión de operación',
  prueba_carga_operativa: 'Prueba con carga operativa',
  verificacion_consumo_electrico: 'Verificación de consumo y alimentación eléctrica',
  verificacion_fugas_drenajes: 'Verificación de fugas, drenajes y sellos',
  equipo_operativo_entregado: 'Equipo operativo y entregado'
};

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

function paintPageBackground(doc) {
  doc.save();
  doc
    .rect(0, 0, doc.page.width, doc.page.height)
    .fillColor(PDF_WHITE)
    .fill();
  doc.restore();
}

function documentTitle(doc, title) {
  paintPageBackground(doc);
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(PDF_BRAND_700)
    .text(title, { align: 'center' });

  const lineWidth = 96;
  const lineX = (doc.page.width - lineWidth) / 2;
  const lineY = doc.y + 4;
  doc
    .moveTo(lineX, lineY)
    .lineTo(lineX + lineWidth, lineY)
    .strokeColor(PDF_BRAND_200)
    .lineWidth(1.4)
    .stroke();

  doc.moveDown(0.8);
  doc.font('Helvetica').fillColor(PDF_INK);
}

function sectionTitle(doc, title, opts = {}) {
  doc.moveDown(0.8);
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + 48 > bottomLimit) {
    doc.addPage();
    paintPageBackground(doc);
  }
  const startX = safeNumber(opts.x ?? doc.page.margins.left, doc.page.margins.left);
  const width = safeNumber(
    opts.width ?? doc.page.width - doc.page.margins.left - doc.page.margins.right,
    doc.page.width - doc.page.margins.left - doc.page.margins.right
  );
  const barHeight = 18;
  doc.save();
  doc
    .rect(startX, doc.y, width, barHeight)
    .fillColor(PDF_BRAND_700)
    .fill();
  doc
    .fillColor(PDF_WHITE)
    .font('Helvetica-Bold')
    .fontSize(11.5)
    .text(title, startX + 8, doc.y + 4, { width: width - 16, align: 'left' });
  doc.restore();
  doc.moveDown(1.4);
  doc.fillColor(PDF_INK).fontSize(10.5);
}

function ensureSpace(doc, height = 120) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottomLimit) {
    doc.addPage();
    paintPageBackground(doc);
  }
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
      paintPageBackground(doc);
      cursorY = doc.page.margins.top;
    }
    const rowWidth = widths.reduce((a, b) => a + b, 0);
    const isHeaderRow = header && rowIndex === 0;
    if (isHeaderRow) {
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
          .strokeColor(PDF_TABLE_DIVIDER)
          .stroke();
      }
      doc
        .font(isHeaderRow ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(textSize)
        .fillColor(isHeaderRow ? PDF_BRAND_800 : PDF_INK)
        .text(String(cell), cellX + padding, cursorY + 6, { width: width - padding * 2 });
      cellX += width;
    });

    cursorY += height;
  });

  doc.y = cursorY + 6;
  doc.x = doc.page.margins.left;
  return cursorY + 6;
}

function drawAssetEngineerSignature(doc, asset) {
  const isIndustrial = asset.asset_category === 'industrial';
  sectionTitle(doc, 'QUIEN ELABORO / ACTUALIZO LA HOJA DE VIDA');
  ensureSpace(doc, 125);

  const startX = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.y;
  const boxHeight = 130;
  const signatureWidth = 205;
  const signatureBoxX = startX + 16;
  const signatureBoxY = startY + 34;
  const signatureBoxHeight = 60;

  doc
    .roundedRect(startX, startY, width, boxHeight, 8)
    .fillColor(PDF_SOFT_BG)
    .fill()
    .strokeColor(PDF_BRAND_200)
    .lineWidth(0.8)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(PDF_BRAND_800)
    .text(
      isIndustrial
        ? 'Firma del responsable técnico que elaboró o actualizó la hoja de vida'
        : 'Firma del ingeniero biomédico que elaboró o actualizó técnicamente',
      startX + 14,
      startY + 12,
      { width: width - 28 }
    );

  const signaturePath = asset.hv_engineer_signature_path
    ? path.join(process.cwd(), asset.hv_engineer_signature_path.replace(/^\//, ''))
    : null;

  if (signaturePath && fs.existsSync(signaturePath)) {
    doc
      .roundedRect(signatureBoxX, signatureBoxY, signatureWidth, signatureBoxHeight, 6)
      .fillColor(PDF_WHITE)
      .fill()
      .strokeColor(PDF_BRAND_200)
      .stroke();
    doc.image(signaturePath, signatureBoxX + 10, signatureBoxY + 7, {
      fit: [signatureWidth - 20, signatureBoxHeight - 14],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(PDF_DANGER)
      .text('Firma digital pendiente.', signatureBoxX, startY + 58, { width: signatureWidth, align: 'center' });
  }

  const infoX = signatureBoxX + signatureWidth + 24;
  const infoWidth = width - signatureWidth - 56;
  const engineerLines = [
    `Nombre completo: ${safeText(asset.hv_engineer_name)}`,
    ...(!isIndustrial
      ? [`Registro INVIMA: ${safeText(asset.hv_engineer_invima_registration)}`]
      : []),
    `Documento: ${safeText(asset.hv_engineer_document_number)}`,
    `Fecha de elaboración/actualización: ${formatDate(asset.hv_engineer_signed_at)}`
  ];
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(PDF_INK)
    .text(engineerLines.join('\n'), infoX, startY + 36, { width: infoWidth, lineGap: 4 });

  doc
    .fontSize(8)
    .fillColor(PDF_MUTED)
    .text(isIndustrial
      ? 'Esta firma queda fija y solo se actualiza cuando el responsable técnico crea o modifica la hoja de vida.'
      : 'Esta firma queda fija y solo se actualiza cuando un ingeniero biomédico crea o modifica técnicamente la hoja de vida.', startX + 14, startY + 108, {
      width: width - 28
    });

  doc.y = startY + boxHeight + 8;
}

export function buildAssetPdf(doc, { client, asset }) {
  const isIndustrial = asset.asset_category === 'industrial';
  documentTitle(doc, isIndustrial ? 'Hoja de Vida - Equipo Industrial' : 'Hoja de Vida - Equipo Biomédico');

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 78;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
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
    .fillColor(PDF_INK)
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
    .fillColor(PDF_MUTED)
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
        .fillColor(PDF_BRAND_50)
        .fill();
      doc
        .rect(photoX - 4, photoY - 4, frameSize + 8, frameSize + 8)
        .strokeColor(PDF_TABLE_BORDER)
        .lineWidth(0.8)
        .stroke();
      doc.image(photoPath, photoX, photoY, { fit: [frameSize, frameSize] });
      doc
        .fillColor(PDF_MUTED)
        .fontSize(9)
        .text('Foto del equipo', photoX, photoY + frameSize + 4, { width: frameSize, align: 'center' });
    }
  }

  const requiresSanitaryClassification = asset.requires_sanitary_classification == null
    ? Boolean(asset.risk_class)
    : Boolean(asset.requires_sanitary_classification);
  const requiresElectricalClassification = Boolean(asset.requires_electrical_classification);
  const equipoRows = [
    ['Nombre', safeText(asset.name)],
    ['Marca', safeText(asset.brand)],
    ['Modelo', safeText(asset.model)],
    ['Serie', safeText(asset.serial)],
    ['Sede', safeText(asset.site_name)],
    ['Área', safeText(asset.area_name)],
    ['Ubicación', safeText(asset.location_name)],
    ['Código', safeText(asset.code)],
    ...(!isIndustrial ? [
      ['Registro Invima', safeText(asset.invima_reg)],
      ['Requiere riesgo sanitario', requiresSanitaryClassification ? 'Sí' : 'No'],
      ['Riesgo sanitario', requiresSanitaryClassification ? safeText(asset.risk_class) : 'No aplica'],
      ['Requiere riesgo eléctrico', requiresElectricalClassification ? 'Sí' : 'No'],
      ['Clase protección eléctrica', requiresElectricalClassification
        ? safeText(asset.electrical_protection_class)
        : 'No aplica'],
      ['Tipo parte aplicada', requiresElectricalClassification ? safeText(asset.applied_part_type) : 'No aplica']
    ] : []),
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

  sectionTitle(doc, isIndustrial ? 'DATOS DE MANTENIMIENTO' : 'DATOS DE MANTENIMIENTO Y CALIBRACION');
  drawTable(doc, [
    ['Frecuencia mantenimiento', safeText(asset.maintenance_frequency)],
    ...(!isIndustrial ? [
      ['Requiere calibración', asset.requires_calibration ? 'Sí' : 'No'],
      ['Frecuencia calibración', safeText(asset.calibration_frequency)]
    ] : [])
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

  drawAssetEngineerSignature(doc, asset);

  return doc;
}

function guideStatusLabel(value) {
  const labels = {
    borrador: 'Borrador',
    aprobada: 'Aprobada',
    obsoleta: 'Obsoleta'
  };
  return labels[value] || safeText(value);
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function optionalRow(label, value) {
  return hasText(value) ? [[label, String(value).trim()]] : [];
}

function drawClientHeader(doc, client, extraLines = []) {
  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 78;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .stroke();

  if (client.logo_path) {
    const logoPath = path.join(process.cwd(), client.logo_path.replace(/^\//, ''));
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, headerLeftX + 10, headerY + 8, { fit: [150, 60] });
    }
  }

  const infoStartX = headerLeftX + logoCellWidth + 8;
  const infoMaxWidth = headerWidth - logoCellWidth - 16;
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(PDF_INK)
    .text(safeText(client.name), infoStartX, headerY + 8, { width: infoMaxWidth });

  const infoLines = [
    `NIT: ${safeText(client.nit)}`,
    `Ciudad: ${safeText(client.city)}`,
    `Dirección: ${safeText(client.address)}`,
    `Correo: ${safeText(client.email)}`,
    ...extraLines
  ];
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(PDF_MUTED)
    .text(infoLines.join('\n'), infoStartX, headerY + 26, { width: infoMaxWidth });

  doc.y = headerY + headerHeight + 12;
}

function drawGuideSignature(doc, guide) {
  sectionTitle(doc, 'RESPONSABLE DE ELABORACION / ACTUALIZACION');
  ensureSpace(doc, 120);

  const startX = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.y;
  const boxHeight = 122;
  const signatureWidth = 190;
  const signatureBoxX = startX + 16;
  const signatureBoxY = startY + 34;
  const signatureBoxHeight = 56;

  doc
    .roundedRect(startX, startY, width, boxHeight, 8)
    .fillColor(PDF_SOFT_BG)
    .fill()
    .strokeColor(PDF_BRAND_200)
    .lineWidth(0.8)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(PDF_BRAND_800)
    .text('Firma y datos del responsable técnico de la guía rápida', startX + 14, startY + 12, { width: width - 28 });

  const signaturePath = guide.updated_by_signature_path
    ? path.join(process.cwd(), guide.updated_by_signature_path.replace(/^\//, ''))
    : null;

  if (signaturePath && fs.existsSync(signaturePath)) {
    doc
      .roundedRect(signatureBoxX, signatureBoxY, signatureWidth, signatureBoxHeight, 6)
      .fillColor(PDF_WHITE)
      .fill()
      .strokeColor(PDF_BRAND_200)
      .stroke();
    doc.image(signaturePath, signatureBoxX + 10, signatureBoxY + 6, {
      fit: [signatureWidth - 20, signatureBoxHeight - 12],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(PDF_DANGER)
      .text('Firma digital pendiente.', signatureBoxX, startY + 58, { width: signatureWidth, align: 'center' });
  }

  const infoX = signatureBoxX + signatureWidth + 24;
  const infoWidth = width - signatureWidth - 56;
  doc
    .font('Helvetica')
    .fontSize(9.4)
    .fillColor(PDF_INK)
    .text(`Nombre completo: ${safeText(guide.updated_by_name || guide.created_by_name)}`, infoX, startY + 34, { width: infoWidth })
    .text(`Documento: ${safeText(guide.updated_by_document_number)}`, infoX, startY + 50, { width: infoWidth })
    .text(`Registro INVIMA: ${safeText(guide.updated_by_invima_registration)}`, infoX, startY + 66, { width: infoWidth })
    .text(`Fecha de actualización: ${formatDate(guide.updated_at)}`, infoX, startY + 82, { width: infoWidth });

  doc
    .fontSize(8)
    .fillColor(PDF_MUTED)
    .text('La guía rápida debe permanecer visible y accesible en el sitio de trabajo del equipo.', startX + 14, startY + 102, {
      width: width - 28
    });

  doc.y = startY + boxHeight + 8;
}

function drawQuickGuideCompactHeader(doc, client, guide) {
  paintPageBackground(doc);
  doc.page.margins = { top: 24, bottom: 24, left: 28, right: 28 };
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;

  const x = doc.page.margins.left;
  const y = doc.y;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 58;
  const logoWidth = 112;

  doc
    .roundedRect(x, y, width, height, 8)
    .fillColor(PDF_SOFT_BG)
    .fill()
    .strokeColor(PDF_BRAND_200)
    .lineWidth(0.8)
    .stroke();

  if (client.logo_path) {
    const logoPath = path.join(process.cwd(), client.logo_path.replace(/^\//, ''));
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, x + 8, y + 7, { fit: [logoWidth - 16, height - 14] });
    }
  }

  const infoX = x + logoWidth;
  const infoWidth = width - logoWidth - 130;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(PDF_BRAND_800)
    .text('GUIA RAPIDA DE USO', infoX, y + 8, { width: infoWidth });
  doc
    .font('Helvetica-Bold')
    .fontSize(9.2)
    .fillColor(PDF_INK)
    .text(safeText(client.name), infoX, y + 24, { width: infoWidth, height: 12, ellipsis: true });
  doc
    .font('Helvetica')
    .fontSize(7.2)
    .fillColor(PDF_MUTED)
    .text(
      [`NIT: ${safeText(client.nit)}`, `Ciudad: ${safeText(client.city)}`, `Correo: ${safeText(client.email)}`].join('  |  '),
      infoX,
      y + 39,
      { width: infoWidth, height: 10, ellipsis: true }
    );

  const codeX = x + width - 122;
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(PDF_BRAND_800)
    .text(`Código: ${safeText(guide.document_code)}`, codeX, y + 12, { width: 112, height: 12, ellipsis: true })
    .text(`Versión: ${safeText(guide.version)}`, codeX, y + 27, { width: 112, height: 12, ellipsis: true })
    .font('Helvetica')
    .fontSize(7)
    .fillColor(PDF_MUTED)
    .text(`Fecha: ${formatDate(guide.updated_at || guide.created_at)}`, codeX, y + 42, { width: 112, height: 10, ellipsis: true });

  doc.y = y + height + 7;
}

function drawQuickGuideSection(doc, title) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc
    .roundedRect(x, doc.y, width, 13, 4)
    .fillColor(PDF_BRAND_700)
    .fill();
  doc
    .font('Helvetica-Bold')
    .fontSize(7.7)
    .fillColor(PDF_WHITE)
    .text(title, x + 6, doc.y + 3.2, { width: width - 12, height: 8, ellipsis: true });
  doc.y += 16;
}

function drawQuickGuideRows(doc, rows, { labelWidth = 124, textSize = 7.4, rowMin = 16, rowMax = 38 } = {}) {
  if (!rows.length) return;
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const valueWidth = width - labelWidth;
  const padding = 4;

  rows.forEach(([label, value], rowIndex) => {
    const text = String(value ?? '-');
    const labelHeight = doc.heightOfString(String(label), { width: labelWidth - padding * 2 });
    const valueHeight = doc.heightOfString(text, { width: valueWidth - padding * 2 });
    const height = Math.min(Math.max(rowMin, labelHeight + padding * 2, valueHeight + padding * 2), rowMax);
    const y = doc.y;

    if (rowIndex % 2 === 1) {
      doc.rect(x, y, width, height).fillColor(PDF_TABLE_STRIPE_BG).fill();
    }
    doc
      .rect(x, y, width, height)
      .strokeColor(PDF_TABLE_BORDER)
      .lineWidth(0.55)
      .stroke();
    doc
      .moveTo(x + labelWidth, y)
      .lineTo(x + labelWidth, y + height)
      .strokeColor(PDF_TABLE_DIVIDER)
      .lineWidth(0.45)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(textSize)
      .fillColor(PDF_BRAND_800)
      .text(String(label), x + padding, y + padding, {
        width: labelWidth - padding * 2,
        height: height - padding * 2,
        ellipsis: true
      });
    doc
      .font('Helvetica')
      .fontSize(textSize)
      .fillColor(PDF_INK)
      .text(text, x + labelWidth + padding, y + padding, {
        width: valueWidth - padding * 2,
        height: height - padding * 2,
        ellipsis: true
      });

    doc.y = y + height;
  });
  doc.y += 5;
}

function drawQuickGuideVisual(doc, guide) {
  const visualPath = guide.visual_path
    ? path.join(process.cwd(), guide.visual_path.replace(/^\//, ''))
    : null;
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (visualPath && fs.existsSync(visualPath)) {
    drawQuickGuideSection(doc, 'REFERENCIA VISUAL / PICTOGRAMA');
    const y = doc.y;
    const boxHeight = hasText(guide.visual_notes) ? 102 : 84;
    doc
      .roundedRect(x, y, width, boxHeight, 7)
      .fillColor(PDF_WHITE)
      .fill()
      .strokeColor(PDF_BRAND_200)
      .lineWidth(0.7)
      .stroke();
    doc.image(visualPath, x + 8, y + 6, {
      fit: [width - 16, boxHeight - (hasText(guide.visual_notes) ? 28 : 12)],
      align: 'center',
      valign: 'center'
    });
    if (hasText(guide.visual_notes)) {
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(PDF_MUTED)
        .text(String(guide.visual_notes).trim(), x + 8, y + boxHeight - 20, {
          width: width - 16,
          height: 14,
          align: 'center',
          ellipsis: true
        });
    }
    doc.y = y + boxHeight + 5;
  } else if (hasText(guide.visual_notes)) {
    drawQuickGuideSection(doc, 'REFERENCIA VISUAL / PICTOGRAMA');
    drawQuickGuideRows(doc, [['Nota visual', String(guide.visual_notes).trim()]], { rowMax: 28 });
  }
}

function drawQuickGuideCompactSignature(doc, guide) {
  drawQuickGuideSection(doc, 'RESPONSABLE DE ELABORACION / ACTUALIZACION');
  const x = doc.page.margins.left;
  const y = doc.y;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 66;
  const signatureWidth = 142;
  const signaturePath = guide.updated_by_signature_path
    ? path.join(process.cwd(), guide.updated_by_signature_path.replace(/^\//, ''))
    : null;

  doc
    .roundedRect(x, y, width, height, 7)
    .fillColor(PDF_SOFT_BG)
    .fill()
    .strokeColor(PDF_BRAND_200)
    .lineWidth(0.7)
    .stroke();

  doc
    .roundedRect(x + 8, y + 8, signatureWidth, 38, 5)
    .fillColor(PDF_WHITE)
    .fill()
    .strokeColor(PDF_BRAND_200)
    .stroke();

  if (signaturePath && fs.existsSync(signaturePath)) {
    doc.image(signaturePath, x + 14, y + 11, {
      fit: [signatureWidth - 12, 32],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(PDF_DANGER)
      .text('Firma pendiente', x + 8, y + 22, { width: signatureWidth, align: 'center' });
  }

  doc
    .font('Helvetica')
    .fontSize(6.8)
    .fillColor(PDF_MUTED)
    .text('La guía debe permanecer visible y accesible en el sitio de trabajo.', x + 8, y + 50, {
      width: signatureWidth,
      height: 9,
      align: 'center',
      ellipsis: true
    });

  const infoX = x + signatureWidth + 20;
  const infoWidth = width - signatureWidth - 28;
  const infoLines = [
    `Responsable: ${safeText(guide.updated_by_name || guide.created_by_name)}`,
    `Documento: ${safeText(guide.updated_by_document_number)}   Registro INVIMA: ${safeText(guide.updated_by_invima_registration)}`,
    `Actualización: ${formatDate(guide.updated_at)}   Aprobación: ${formatDate(guide.approved_at)}`
  ];
  doc
    .font('Helvetica')
    .fontSize(7.4)
    .fillColor(PDF_INK)
    .text(infoLines.join('\n'), infoX, y + 12, {
      width: infoWidth,
      height: 42,
      lineGap: 2,
      ellipsis: true
    });

  doc.y = y + height + 4;
}

export function buildQuickGuidePdf(doc, { client, guide }) {
  drawQuickGuideCompactHeader(doc, client, guide);

  const metaRows = [
    ['Equipo', safeText(guide.equipment_name)],
    ...optionalRow('Tipo de equipo', guide.equipment_type),
    ['Marca', safeText(guide.brand)],
    ['Modelo', safeText(guide.model)],
    ...optionalRow('Responsable del uso', guide.responsible_use)
  ];
  drawQuickGuideSection(doc, 'IDENTIFICACION DE LA GUIA');
  drawQuickGuideRows(doc, metaRows, { rowMax: 21 });
  drawQuickGuideVisual(doc, guide);

  const startupRows = [
    ...optionalRow('Antes de encender', guide.prerequisites),
    ...optionalRow('Encendido seguro', guide.startup_steps),
    ...optionalRow('Apagado seguro', guide.shutdown_steps)
  ];
  if (startupRows.length) {
    drawQuickGuideSection(doc, 'PASOS PARA ENCENDIDO Y APAGADO SEGURO');
    drawQuickGuideRows(doc, startupRows, { rowMax: 30 });
  }

  if (hasText(guide.basic_operation)) {
    drawQuickGuideSection(doc, 'OPERACION BASICA');
    drawQuickGuideRows(doc, [
      ['Ajustes / parámetros comunes', String(guide.basic_operation).trim()]
    ], { rowMax: 42 });
  }

  const safetyRows = [
    ...optionalRow('Alertas y alarmas principales', guide.alarms),
    ...optionalRow('Limpieza y desinfección rápida', guide.cleaning_disinfection),
    ...optionalRow('Emergencia o falla', guide.emergency_actions),
    ...optionalRow('Contacto / reporte', guide.support_contact)
  ];
  if (safetyRows.length) {
    drawQuickGuideSection(doc, 'ALERTAS, LIMPIEZA Y EMERGENCIAS');
    drawQuickGuideRows(doc, safetyRows, { rowMax: 38 });
  }

  drawQuickGuideCompactSignature(doc, guide);
  return doc;
}

export function buildAssetMovementPdf(doc, { client, asset, movement }) {
  documentTitle(doc, 'Reporte de Movimiento de Equipo');

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 72;
  const logoCellWidth = 160;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .stroke();

  if (client.logo_path) {
    const logoPath = path.join(process.cwd(), client.logo_path.replace(/^\//, ''));
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, headerLeftX + 10, headerY + 8, { fit: [140, 54] });
    }
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(PDF_INK)
    .text(safeText(client.name), headerLeftX + logoCellWidth + 10, headerY + 10, {
      width: headerWidth - logoCellWidth - 20
    });
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(PDF_MUTED)
    .text(
      [
        `NIT: ${safeText(client.nit)}`,
        `Ciudad: ${safeText(client.city)}`,
        `Dirección: ${safeText(client.address)}`,
        `Correo: ${safeText(client.email)}`
      ].join('\n'),
      headerLeftX + logoCellWidth + 10,
      headerY + 28,
      { width: headerWidth - logoCellWidth - 20 }
    );

  doc.y = headerY + headerHeight + 14;

  sectionTitle(doc, 'DATOS DEL EQUIPO');
  drawTable(doc, [
    ['Código', safeText(asset.code)],
    ['Equipo', safeText(asset.name)],
    ['Marca', safeText(asset.brand)],
    ['Modelo', safeText(asset.model)],
    ['Serie', safeText(asset.serial)]
  ], { colWidths: [170, 320], header: true });

  sectionTitle(doc, 'MOVIMIENTO REALIZADO');
  drawTable(doc, [
    ['Fecha', formatDate(movement.created_at)],
    ['Realizado por', safeText(movement.moved_by_name)],
    ['Rol', safeText(movement.moved_by_role)],
    ['Observación', safeText(movement.notes)]
  ], { colWidths: [170, 320], header: true });

  sectionTitle(doc, 'CAMBIOS DE UBICACION');
  drawTable(doc, [
    ['Campo', 'Antes', 'Después'],
    ['Código', safeText(movement.from_code), safeText(movement.to_code)],
    ['Sede', safeText(movement.from_site_name), safeText(movement.to_site_name)],
    ['Área', safeText(movement.from_area_name), safeText(movement.to_area_name)],
    ['Ubicación', safeText(movement.from_location_name), safeText(movement.to_location_name)]
  ], { colWidths: [110, 185, 185], header: true });

  doc.moveDown(1);
  doc
    .fontSize(8.5)
    .fillColor(PDF_MUTED)
    .text('Este reporte se genera automáticamente al mover el equipo y queda almacenado en el historial de la hoja de vida.', {
      align: 'center'
    });

  return doc;
}

function drawBlankProtocolCell(doc, { x, y, width, height, label, value }) {
  const text = safeText(value);
  const textWidth = width - 10;
  let valueFontSize = 8.4;

  doc.font('Helvetica').fontSize(valueFontSize);
  while (valueFontSize > 5.8 && doc.widthOfString(text) > textWidth) {
    valueFontSize = Math.max(5.8, valueFontSize - 0.2);
    doc.fontSize(valueFontSize);
  }

  doc
    .rect(x, y, width, height)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(6.4)
    .fillColor(PDF_BRAND_700)
    .text(label, x + 5, y + 4, { width: width - 10, height: 8, ellipsis: true });
  doc
    .font('Helvetica')
    .fontSize(valueFontSize)
    .fillColor(PDF_INK)
    .text(text, x + 5, y + 13, {
      width: textWidth,
      height: Math.max(8, height - 15),
      ellipsis: true
    });
}

function drawBlankProtocolSection(doc, title, x, y, width) {
  doc
    .rect(x, y, width, 17)
    .fillColor(PDF_BRAND_700)
    .fill();
  doc
    .font('Helvetica-Bold')
    .fontSize(8.4)
    .fillColor(PDF_WHITE)
    .text(title, x + 7, y + 4.5, { width: width - 14 });
  return y + 17;
}

function drawBlankProtocolCheckbox(doc, x, y, label, width) {
  doc
    .rect(x, y + 1, 7, 7)
    .strokeColor(PDF_MUTED)
    .lineWidth(0.65)
    .stroke();
  doc
    .font('Helvetica')
    .fontSize(7.1)
    .fillColor(PDF_INK)
    .text(label, x + 11, y, { width: width - 11, height: 10, ellipsis: true });
}

function drawBlankProtocolChecklist(doc, { x, y, width, height, title, items }) {
  doc
    .rect(x, y, width, height)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .stroke();
  doc
    .rect(x, y, width, 18)
    .fillColor(PDF_BRAND_50)
    .fill();
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(PDF_BRAND_800)
    .text(title, x + 6, y + 5, { width: width - 12, align: 'center' });

  let itemY = y + 23;
  for (const item of items) {
    drawBlankProtocolCheckbox(doc, x + 7, itemY, item, width - 14);
    itemY += 10.8;
  }
  doc
    .font('Helvetica')
    .fontSize(6.8)
    .fillColor(PDF_MUTED)
    .text('Otro: __________________________', x + 7, y + height - 15, {
      width: width - 14,
      height: 9,
      ellipsis: true
    });
}

function drawBlankProtocolWritingBox(doc, { x, y, width, height, label }) {
  doc
    .rect(x, y, width, height)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(7.2)
    .fillColor(PDF_BRAND_700)
    .text(label, x + 6, y + 5, { width: width - 12 });
  const lineStartY = y + 22;
  for (let lineY = lineStartY; lineY < y + height - 7; lineY += 14) {
    doc
      .moveTo(x + 7, lineY)
      .lineTo(x + width - 7, lineY)
      .strokeColor(PDF_TABLE_DIVIDER)
      .lineWidth(0.45)
      .stroke();
  }
}

export function buildBlankMaintenanceProtocolPdf(
  doc,
  { client, asset, engineer, batchCode, pageNumber = 1, totalPages = 1 }
) {
  const isIndustrial = asset.asset_category === 'industrial';
  paintPageBackground(doc);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  let y = doc.page.margins.top;

  const headerHeight = 58;
  const logoWidth = 118;
  doc
    .rect(left, y, width, headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.9)
    .stroke();
  doc
    .moveTo(left + logoWidth, y)
    .lineTo(left + logoWidth, y + headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .stroke();

  if (client.logo_path) {
    const logoPath = path.join(process.cwd(), client.logo_path.replace(/^\//, ''));
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, left + 8, y + 7, { fit: [logoWidth - 16, headerHeight - 14] });
    }
  }

  const titleX = left + logoWidth + 10;
  const titleWidth = width - logoWidth - 20;
  doc
    .font('Helvetica-Bold')
    .fontSize(12.5)
    .fillColor(PDF_INK)
    .text(isIndustrial ? 'PROTOCOLO DE MANTENIMIENTO INDUSTRIAL' : 'PROTOCOLO DE MANTENIMIENTO', titleX, y + 8, {
      width: titleWidth,
      align: 'center'
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(PDF_BRAND_700)
    .text(safeText(client.name), titleX, y + 27, {
      width: titleWidth,
      align: 'center',
      height: 11,
      ellipsis: true
    });
  doc
    .font('Helvetica')
    .fontSize(6.8)
    .fillColor(PDF_MUTED)
    .text(`NIT: ${safeText(client.nit)}  |  Lote: ${batchCode}`, titleX, y + 43, {
      width: titleWidth,
      align: 'center',
      height: 9,
      ellipsis: true
    });
  y += headerHeight + 5;

  y = drawBlankProtocolSection(doc, '1. IDENTIFICACIÓN DEL EQUIPO', left, y, width);
  drawBlankProtocolCell(doc, {
    x: left,
    y,
    width: 112,
    height: 21,
    label: 'CÓDIGO',
    value: asset.code
  });
  drawBlankProtocolCell(doc, {
    x: left + 112,
    y,
    width: width - 112,
    height: 21,
    label: 'EQUIPO',
    value: asset.name
  });
  y += 21;
  const third = width / 3;
  drawBlankProtocolCell(doc, { x: left, y, width: third, height: 21, label: 'MARCA', value: asset.brand });
  drawBlankProtocolCell(doc, { x: left + third, y, width: third, height: 21, label: 'MODELO', value: asset.model });
  drawBlankProtocolCell(doc, { x: left + third * 2, y, width: width - third * 2, height: 21, label: 'SERIE', value: asset.serial });
  y += 21;
  drawBlankProtocolCell(doc, { x: left, y, width: third, height: 21, label: 'SEDE', value: asset.site_name });
  drawBlankProtocolCell(doc, { x: left + third, y, width: third, height: 21, label: 'ÁREA', value: asset.area_name });
  drawBlankProtocolCell(doc, { x: left + third * 2, y, width: width - third * 2, height: 21, label: 'UBICACIÓN', value: asset.location_name });
  y += 26;

  y = drawBlankProtocolSection(doc, '2. DATOS DEL SERVICIO', left, y, width);
  const serviceHeight = 40;
  const maintenanceTypeWidth = 205;
  const serviceDateWidth = 175;
  const serviceDateX = left + maintenanceTypeWidth;
  const workOrderX = serviceDateX + serviceDateWidth;
  doc
    .rect(left, y, width, serviceHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .stroke();
  doc
    .moveTo(serviceDateX, y)
    .lineTo(serviceDateX, y + serviceHeight)
    .moveTo(workOrderX, y)
    .lineTo(workOrderX, y + serviceHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(PDF_BRAND_700)
    .text('TIPO DE MANTENIMIENTO', left + 8, y + 5, {
      width: maintenanceTypeWidth - 16,
      align: 'center'
    });
  drawBlankProtocolCheckbox(doc, left + 10, y + 22, 'Preventivo', 88);
  drawBlankProtocolCheckbox(doc, left + 106, y + 22, 'Correctivo', 88);
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(PDF_BRAND_700)
    .text('FECHA MANTENIMIENTO', serviceDateX + 6, y + 5, {
      width: serviceDateWidth - 12,
      align: 'center'
    });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(PDF_INK)
    .text('____ / ____ / ________', serviceDateX + 6, y + 21, {
      width: serviceDateWidth - 12,
      align: 'center'
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(PDF_BRAND_700)
    .text('SOLICITUD / OT', workOrderX + 6, y + 5, {
      width: width - maintenanceTypeWidth - serviceDateWidth - 12,
      align: 'center'
    });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(PDF_INK)
    .text('____________________', workOrderX + 6, y + 21, {
      width: width - maintenanceTypeWidth - serviceDateWidth - 12,
      align: 'center'
    });
  y += serviceHeight + 5;

  y = drawBlankProtocolSection(doc, '3. PROTOCOLO EJECUTADO - MARQUE LAS ACTIVIDADES REALIZADAS', left, y, width);
  const checklistGap = 5;
  const checklistWidth = (width - checklistGap * 2) / 3;
  const checklistHeight = 150;
  drawBlankProtocolChecklist(doc, {
    x: left,
    y,
    width: checklistWidth,
    height: checklistHeight,
    title: 'REVISIONES',
    items: Object.values(MAINTENANCE_CHECK_LABELS)
  });
  drawBlankProtocolChecklist(doc, {
    x: left + checklistWidth + checklistGap,
    y,
    width: checklistWidth,
    height: checklistHeight,
    title: 'ACTIVIDADES TÉCNICAS',
    items: Object.values(MAINTENANCE_ACTIVITY_LABELS)
  });
  drawBlankProtocolChecklist(doc, {
    x: left + (checklistWidth + checklistGap) * 2,
    y,
    width: checklistWidth,
    height: checklistHeight,
    title: 'PRUEBAS Y VERIFICACIONES',
    items: Object.values(MAINTENANCE_TEST_LABELS)
  });
  y += checklistHeight + 5;

  drawBlankProtocolWritingBox(doc, { x: left, y, width, height: 55, label: '4. HALLAZGOS / DIAGNÓSTICO' });
  y += 60;
  drawBlankProtocolWritingBox(doc, { x: left, y, width, height: 55, label: '5. ACCIONES REALIZADAS / RECOMENDACIONES' });
  y += 60;

  const half = width / 2;
  doc
    .rect(left, y, width, 52)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .stroke();
  doc
    .moveTo(left + half, y)
    .lineTo(left + half, y + 52)
    .strokeColor(PDF_TABLE_BORDER)
    .stroke();
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(PDF_BRAND_700).text('6. ESTADO FINAL DEL EQUIPO', left + 6, y + 5);
  drawBlankProtocolCheckbox(doc, left + 7, y + 19, 'Operativo', 88);
  drawBlankProtocolCheckbox(doc, left + 98, y + 19, 'Operativo con observación', half - 105);
  drawBlankProtocolCheckbox(doc, left + 7, y + 35, 'Fuera de servicio', 130);
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(PDF_BRAND_700).text('7. REPUESTOS', left + half + 6, y + 5);
  drawBlankProtocolCheckbox(doc, left + half + 7, y + 19, 'No requiere', 90);
  drawBlankProtocolCheckbox(doc, left + half + 101, y + 19, 'Requiere', 75);
  doc.font('Helvetica').fontSize(7).fillColor(PDF_INK).text('Detalle: ____________________________________', left + half + 7, y + 35, { width: half - 14 });
  y += 57;

  y = drawBlankProtocolSection(doc, '8. FIRMAS DE LA INTERVENCIÓN', left, y, width);
  const signatureGap = 8;
  const signatureWidth = (width - signatureGap) / 2;
  const signatureHeight = 78;
  const engineerX = left;
  const responsibleX = left + signatureWidth + signatureGap;
  const engineerSignaturePath = engineer?.signature_path
    ? path.join(process.cwd(), String(engineer.signature_path).replace(/^\//, ''))
    : null;
  const engineerDocument = [engineer?.document_type, engineer?.document_number]
    .filter(hasText)
    .map((value) => String(value).trim())
    .join(' ');
  const engineerIdentifiers = [
    engineerDocument ? `Documento: ${engineerDocument}` : null,
    !isIndustrial && hasText(engineer?.invima_registration)
      ? `Registro: ${String(engineer.invima_registration).trim()}`
      : null
  ].filter(Boolean).join('  |  ') || 'Documento / registro: -';

  doc
    .rect(engineerX, y, signatureWidth, signatureHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(7.2)
    .fillColor(PDF_BRAND_700)
    .text('INGENIERO BIOMÉDICO', engineerX + 6, y + 5, {
      width: signatureWidth - 12,
      align: 'center'
    });
  if (engineerSignaturePath && fs.existsSync(engineerSignaturePath)) {
    doc.image(engineerSignaturePath, engineerX + 10, y + 16, {
      fit: [signatureWidth - 20, 31],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(PDF_DANGER)
      .text('Firma digital no disponible', engineerX + 8, y + 28, {
        width: signatureWidth - 16,
        align: 'center'
      });
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(7.3)
    .fillColor(PDF_INK)
    .text(safeText(engineer?.display_name || engineer?.username), engineerX + 8, y + 50, {
      width: signatureWidth - 16,
      height: 9,
      align: 'center',
      ellipsis: true
    });
  doc
    .font('Helvetica')
    .fontSize(6.2)
    .fillColor(PDF_MUTED)
    .text(engineerIdentifiers, engineerX + 8, y + 63, {
      width: signatureWidth - 16,
      height: 8,
      align: 'center',
      ellipsis: true
    });

  doc
    .rect(responsibleX, y, signatureWidth, signatureHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(7.2)
    .fillColor(PDF_BRAND_700)
    .text('RESPONSABLE / USUARIO DEL EQUIPO', responsibleX + 6, y + 5, {
      width: signatureWidth - 12,
      align: 'center'
    });
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(PDF_INK)
    .text('Firma: ___________________________________', responsibleX + 8, y + 26, { width: signatureWidth - 16 });
  doc.text('Nombre: _________________________________', responsibleX + 8, y + 45, { width: signatureWidth - 16 });
  doc.text('Cargo: __________________________________', responsibleX + 8, y + 62, { width: signatureWidth - 16 });
  y += signatureHeight + 5;

  doc
    .font('Helvetica')
    .fontSize(6.3)
    .fillColor(PDF_MUTED)
    .text(
      'Formato físico en blanco. No constituye un mantenimiento registrado hasta que el original diligenciado sea incorporado al historial del equipo.',
      left,
      y,
      { width: width - 115, height: 18 }
    );
  doc
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .fillColor(PDF_BRAND_700)
    .text(`${batchCode}  |  Equipo ${pageNumber} de ${totalPages}`, right - 112, y, {
      width: 112,
      align: 'right'
    });
}

export function buildMaintenanceReportPdf(doc, { client, asset, request, report, signatures }) {
  const isIndustrial = asset.asset_category === 'industrial';
  documentTitle(doc, isIndustrial ? 'Reporte de Mantenimiento Industrial' : 'Reporte de Mantenimiento Biomédico');

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 72;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
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
    .fillColor(PDF_INK)
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
    .fillColor(PDF_MUTED)
    .text(infoLines.join('\n'), infoStartX, headerY + 26, { width: infoMaxWidth });

  doc.y = headerY + headerHeight + 10;

  sectionTitle(doc, 'DATOS DEL EQUIPO');
  const assetRows = [
    ['Categoría', isIndustrial ? 'Equipo industrial' : 'Equipo biomédico'],
    ['Código', safeText(asset.code)],
    ['Nombre', safeText(asset.name)],
    ['Marca', safeText(asset.brand)],
    ['Modelo', safeText(asset.model)],
    ['Serie', safeText(asset.serial)],
    ['Sede', safeText(asset.site_name)],
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
    ['Acciones realizadas', safeText(report.actions_taken)],
    ['Revisiones realizadas', listLabels(report.maintenance_checks, MAINTENANCE_CHECK_LABELS)],
    ['Actividades técnicas', listLabels(report.maintenance_activities, MAINTENANCE_ACTIVITY_LABELS)],
    ['Pruebas y verificaciones', listLabels(report.maintenance_tests, MAINTENANCE_TEST_LABELS)],
    ['Estado final del equipo', maintenanceAssetStatusLabel(report.asset_status_after)],
    ['Requiere repuesto', report.requires_spare_parts ? 'Sí' : 'No'],
    ['Repuesto requerido', report.requires_spare_parts ? safeText(report.spare_parts_needed) : 'No aplica'],
    ['Estado del repuesto', report.requires_spare_parts ? sparePartStatusLabel(report.spare_parts_status) : 'No aplica']
  ];
  drawTable(doc, reportRows, { colWidths: [140, 360], rowHeight: 24 });

  sectionTitle(doc, 'FIRMAS');
  if (!signatures?.length) {
    doc.fontSize(10).fillColor(PDF_MUTED).text('Sin firmas registradas.');
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
      .strokeColor(PDF_TABLE_DIVIDER)
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
      .fillColor(PDF_MUTED)
      .text('Firmante', cursorX, cursorY + signatureHeight + 2, {
        width: signatureWidth,
        align: 'center'
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(PDF_INK)
      .text(safeText(sig.display_name), cursorX, cursorY + signatureHeight + 12, {
        width: signatureWidth,
        align: 'center'
      });
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(PDF_MUTED)
      .text(`Rol: ${safeText(sig.role)}`, cursorX, cursorY + signatureHeight + 24, {
        width: signatureWidth,
        align: 'center'
      });
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(PDF_MUTED)
      .text(`Fecha: ${formatDate(sig.signed_at)}`, cursorX, cursorY + signatureHeight + 34, {
        width: signatureWidth,
        align: 'center'
      });

    cursorX += signatureWidth + gap;
  });

  doc.y = cursorY + signatureHeight + 32;
}

export function buildMaintenanceSchedulePdf(doc, { client, schedule, items }) {
  const isIndustrial = schedule.asset_category === 'industrial';
  documentTitle(
    doc,
    isIndustrial
      ? 'Cronograma de Mantenimiento Preventivo Industrial'
      : 'Cronograma de Mantenimiento Preventivo Biomédico'
  );

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 72;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
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
    .fillColor(PDF_INK)
    .text(safeText(client.name), infoStartX, headerY + 8, { width: infoMaxWidth });

  const infoLines = [
    `Categoría: ${isIndustrial ? 'Equipos industriales' : 'Equipos biomédicos'}`,
    `Año: ${safeText(schedule.year)}`,
    `Fecha inicial: ${formatDate(schedule.start_date)}`
  ];
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(PDF_MUTED)
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
    grouped
      .get(item.asset_id)
      .dates.push(`${formatDate(item.planned_date)}-${formatDate(item.deadline_date)}`);
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
  documentTitle(doc, 'Cronograma de Calibración');

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 72;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
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
    .fillColor(PDF_INK)
    .text(safeText(client.name), infoStartX, headerY + 8, { width: infoMaxWidth });

  const infoLines = [
    `Año: ${safeText(schedule.year)}`,
    `Fecha inicial: ${formatDate(schedule.start_date)}`
  ];
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(PDF_MUTED)
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
  documentTitle(doc, 'Cronograma de Capacitaciones');

  const headerY = doc.y;
  const headerLeftX = doc.page.margins.left;
  const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 72;
  const logoCellWidth = 170;

  doc
    .rect(headerLeftX, headerY, headerWidth, headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(1)
    .stroke();
  doc
    .moveTo(headerLeftX + logoCellWidth, headerY)
    .lineTo(headerLeftX + logoCellWidth, headerY + headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
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
    .fillColor(PDF_INK)
    .text(safeText(client.name), infoStartX, headerY + 8, { width: infoMaxWidth });

  const infoLines = [
    `Año: ${safeText(schedule.year)}`,
    `Fecha inicial: ${formatDate(schedule.start_date)}`,
    `Periodicidad: ${safeText(schedule.periodicity)}`
  ];
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(PDF_MUTED)
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
