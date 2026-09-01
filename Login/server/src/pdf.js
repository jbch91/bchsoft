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
const PDF_SUCCESS = '#166534';
const PDF_SUCCESS_BG = '#ecfdf5';
const PDF_WARNING = '#92400e';
const PDF_WARNING_BG = '#fffbeb';
const PDF_INFO = '#1e3a5f';
const PDF_INFO_BG = '#eff6ff';
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
    operativo: 'OPERATIVO',
    operativo_observacion: 'OPERATIVO CON OBSERVACIÓN',
    fuera_de_servicio: 'FUERA DE SERVICIO',
    dado_de_baja: 'DADO DE BAJA',
    activo: 'ACTIVO'
  };
  return labels[value] || maintenanceTokenLabel(value);
}

function sparePartStatusLabel(value) {
  const labels = {
    no_aplica: 'NO APLICA',
    pendiente: 'PENDIENTE',
    solicitado: 'REPUESTO SOLICITADO',
    recibido: 'REPUESTO INSTALADO'
  };
  return labels[value] || maintenanceTokenLabel(value);
}

function maintenanceSignerRoleLabel(value) {
  const labels = {
    ingeniero_biomedico: 'INGENIERO BIOMÉDICO',
    responsable_area: 'RESPONSABLE DE ÁREA',
    almacenista: 'ALMACENISTA',
    lector: 'LECTOR AUTORIZADO',
    viewer: 'VISOR AUTORIZADO',
    visor: 'VISOR AUTORIZADO',
    superuser: 'ADMINISTRADOR DE PLATAFORMA'
  };
  return labels[value] || maintenanceTokenLabel(value);
}

function maintenanceSignerDescription(value) {
  const descriptions = {
    ingeniero_biomedico: 'RESPONSABLE TÉCNICO DEL MANTENIMIENTO',
    responsable_area: 'AVAL Y RECEPCIÓN DEL SERVICIO EN EL ÁREA',
    almacenista: 'VALIDACIÓN DE REPUESTOS Y SUMINISTROS',
    lector: 'AVAL OPERATIVO DEL SERVICIO',
    viewer: 'AVAL OPERATIVO DEL SERVICIO',
    visor: 'AVAL OPERATIVO DEL SERVICIO',
    superuser: 'VALIDACIÓN ADMINISTRATIVA DEL DOCUMENTO'
  };
  return descriptions[value] || 'FIRMANTE AUTORIZADO DEL REPORTE';
}

function maintenanceUpperText(value, fallback = 'NO REGISTRA') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text ? text.toLocaleUpperCase('es-CO') : fallback;
}

function maintenanceTokenLabel(value, fallback = 'NO REGISTRA') {
  if (value === null || value === undefined || value === '') return fallback;
  return maintenanceUpperText(String(value).replace(/[_-]+/g, ' '), fallback);
}

function maintenanceTypeLabel(value) {
  const labels = {
    preventivo: 'MANTENIMIENTO PREVENTIVO',
    correctivo: 'MANTENIMIENTO CORRECTIVO'
  };
  return labels[value] || maintenanceTokenLabel(value);
}

function maintenanceSourceLabel(value) {
  const labels = {
    cronograma: 'CRONOGRAMA APROBADO',
    manual: 'SOLICITUD MANUAL',
    qr: 'SOLICITUD DESDE CÓDIGO QR'
  };
  return labels[value] || maintenanceTokenLabel(value);
}

function maintenanceDocumentStatusLabel(report, signatures) {
  const hasEngineer = signatures?.some((signature) => signature.role === 'ingeniero_biomedico');
  const hasAcceptance = signatures?.some((signature) => [
    'responsable_area',
    'almacenista',
    'lector',
    'viewer',
    'visor',
    'superuser'
  ].includes(signature.role));
  if (report.correction_requested || report.request_status === 'correccion') {
    return 'CORRECCIÓN SOLICITADA';
  }
  if (report.request_status === 'espera_repuesto') {
    return hasEngineer && hasAcceptance
      ? 'FIRMADO - EN ESPERA DE REPUESTO'
      : 'EN ESPERA DE REPUESTO Y AVAL';
  }
  if (report.request_status === 'firmado' || (hasEngineer && hasAcceptance)) {
    return 'FINALIZADO Y FIRMADO';
  }
  if (hasEngineer) return 'PENDIENTE DE AVAL';
  return 'PENDIENTE DE FIRMA';
}

function maintenanceAssetCategoryLabel(value) {
  return value === 'industrial' ? 'EQUIPO INDUSTRIAL' : 'EQUIPO BIOMÉDICO';
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

export function formatMaintenanceDate(value) {
  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }
  const formatted = formatDate(value);
  return formatted === '-' ? 'NO REGISTRA' : formatted;
}

function formatMaintenanceDateTime(value) {
  if (!value) return 'NO REGISTRA';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return maintenanceUpperText(value);
  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}

function maintenanceReportCode(report, isIndustrial) {
  const date = report.created_at ? new Date(report.created_at) : new Date();
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(validDate);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  const dateCode = `${part('year')}${part('month')}${part('day')}`;
  const reportCode = String(report.id || 'SIN-ID').replace(/-/g, '').slice(0, 8).toUpperCase();
  return `RM-${isIndustrial ? 'IND' : 'BIO'}-${dateCode}-${reportCode}`;
}

function maintenanceClientInitials(name) {
  const words = String(name || 'INBIHOSPITALARIO').trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 3).map((word) => word[0]).join('');
  return initials.toUpperCase() || 'IN';
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
    ['Garantía', asset.warranty_years ? `${asset.warranty_years} año(s)` : 'SIN GARANTÍA'],
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

function maintenanceStatusPalette(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('operativo') && !normalized.includes('observ')) {
    return { ink: PDF_SUCCESS, background: PDF_SUCCESS_BG, border: '#86efac' };
  }
  if (
    normalized.includes('observ') ||
    normalized.includes('pendiente') ||
    normalized.includes('espera') ||
    normalized.includes('repuesto')
  ) {
    return { ink: PDF_WARNING, background: PDF_WARNING_BG, border: '#fcd34d' };
  }
  if (normalized.includes('fuera') || normalized.includes('baja') || normalized.includes('corrección')) {
    return { ink: PDF_DANGER, background: PDF_BRAND_50, border: PDF_BRAND_200 };
  }
  return { ink: PDF_INFO, background: PDF_INFO_BG, border: '#bfdbfe' };
}

function drawMaintenanceReportHeader(doc, { client, report, signatures, isIndustrial }) {
  paintPageBackground(doc);
  const x = doc.page.margins.left;
  const y = doc.page.margins.top;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const headerHeight = 104;
  const logoWidth = 112;
  const controlWidth = 144;
  const titleWidth = width - logoWidth - controlWidth;
  const code = maintenanceReportCode(report, isIndustrial);
  const documentStatus = maintenanceDocumentStatusLabel(report, signatures);

  doc
    .roundedRect(x, y, width, headerHeight, 5)
    .fillColor(PDF_WHITE)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.9)
    .fillAndStroke();
  doc.rect(x, y, width, 6).fillColor(PDF_BRAND_700).fill();
  doc
    .moveTo(x + logoWidth, y + 6)
    .lineTo(x + logoWidth, y + headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .stroke();
  doc
    .moveTo(x + logoWidth + titleWidth, y + 6)
    .lineTo(x + logoWidth + titleWidth, y + headerHeight)
    .strokeColor(PDF_TABLE_BORDER)
    .stroke();

  const logoPath = client.logo_path
    ? path.join(process.cwd(), String(client.logo_path).replace(/^\//, ''))
    : null;
  let logoDrawn = false;
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, x + 11, y + 17, {
        fit: [logoWidth - 22, 58],
        align: 'center',
        valign: 'center'
      });
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }
  if (!logoDrawn) {
    doc
      .font('Helvetica-Bold')
      .fontSize(25)
      .fillColor(PDF_BRAND_700)
      .text(maintenanceClientInitials(client.name), x + 10, y + 27, {
        width: logoWidth - 20,
        align: 'center'
      });
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(6.3)
    .fillColor(PDF_MUTED)
    .text('IDENTIDAD INSTITUCIONAL', x + 8, y + 84, {
      width: logoWidth - 16,
      align: 'center'
    });

  const titleX = x + logoWidth;
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(PDF_MUTED)
    .text('INBIHOSPITALARIO', titleX + 12, y + 17, {
      width: titleWidth - 24,
      align: 'center'
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(13.5)
    .fillColor(PDF_BRAND_700)
    .text(
      isIndustrial
        ? 'REPORTE TÉCNICO DE\nMANTENIMIENTO INDUSTRIAL'
        : 'REPORTE TÉCNICO DE\nMANTENIMIENTO BIOMÉDICO',
      titleX + 12,
      y + 33,
      {
        width: titleWidth - 24,
        height: 36,
        align: 'center',
        lineGap: 2
      }
    );
  doc
    .font('Helvetica-Bold')
    .fontSize(7.4)
    .fillColor(PDF_INK)
    .text(maintenanceUpperText(client.name), titleX + 10, y + 80, {
      width: titleWidth - 20,
      height: 17,
      align: 'center',
      ellipsis: true
    });

  const controlX = titleX + titleWidth;
  const controlRows = [
    ['CÓDIGO', code],
    ['VERSIÓN', '04'],
    ['ESTADO', documentStatus],
    ['EMISIÓN', formatMaintenanceDate(new Date())]
  ];
  const controlRowHeight = (headerHeight - 6) / controlRows.length;
  controlRows.forEach(([label, value], index) => {
    const rowY = y + 6 + index * controlRowHeight;
    if (index > 0) {
      doc
        .moveTo(controlX, rowY)
        .lineTo(x + width, rowY)
        .strokeColor(PDF_TABLE_BORDER)
        .lineWidth(0.6)
        .stroke();
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(5.8)
      .fillColor(PDF_MUTED)
      .text(label, controlX + 7, rowY + 4, { width: controlWidth - 14 });
    doc
      .font('Helvetica-Bold')
      .fontSize(index === 2 ? 7.2 : 7.8)
      .fillColor(index === 2 ? maintenanceStatusPalette(value).ink : PDF_INK)
      .text(maintenanceUpperText(value), controlX + 7, rowY + 12, {
        width: controlWidth - 14,
        height: 10,
        ellipsis: true
      });
  });

  const bandY = y + headerHeight + 8;
  const bandHeight = 48;
  const contact = [client.email, client.phone].filter((value) => value).join(' / ');
  const institutionItems = [
    { label: 'NIT', value: client.nit },
    {
      label: 'CIUDAD Y DIRECCIÓN',
      value: [client.city, client.address].filter((value) => value).join(' - ')
    },
    { label: 'CONTACTO INSTITUCIONAL', value: contact }
  ];
  const bandCellWidth = width / institutionItems.length;
  doc
    .roundedRect(x, bandY, width, bandHeight, 4)
    .fillColor(PDF_SOFT_BG)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .fillAndStroke();
  institutionItems.forEach((item, index) => {
    const cellX = x + index * bandCellWidth;
    if (index > 0) {
      doc
        .moveTo(cellX, bandY)
        .lineTo(cellX, bandY + bandHeight)
        .strokeColor(PDF_TABLE_BORDER)
        .stroke();
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(PDF_BRAND_700)
      .text(item.label, cellX + 8, bandY + 7, { width: bandCellWidth - 16 });
    doc
      .font('Helvetica-Bold')
      .fontSize(index === 2 ? 7.2 : 8.1)
      .fillColor(PDF_INK)
      .text(maintenanceUpperText(item.value), cellX + 8, bandY + 19, {
        width: bandCellWidth - 16,
        height: 22,
        lineGap: 1,
        ellipsis: true
      });
  });

  doc.y = bandY + bandHeight + 9;
  return { code, documentStatus };
}

function maintenanceGridHeight(itemCount, columns, cellHeight, gap = 6) {
  const rows = Math.ceil(itemCount / columns);
  return rows ? rows * cellHeight + Math.max(0, rows - 1) * gap : 0;
}

function drawMaintenanceSectionTitle(doc, number, title, requiredHeight = 0) {
  ensureSpace(doc, 38 + requiredHeight);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y + 5;
  const numberWidth = 36;
  const height = 23;
  doc
    .roundedRect(x, y, width, height, 4)
    .fillColor(PDF_BRAND_50)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .fillAndStroke();
  doc
    .roundedRect(x, y, numberWidth, height, 4)
    .fillColor(PDF_BRAND_700)
    .fill();
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(PDF_WHITE)
    .text(String(number).padStart(2, '0'), x, y + 6, {
      width: numberWidth,
      align: 'center'
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(10.2)
    .fillColor(PDF_BRAND_700)
    .text(maintenanceUpperText(title), x + numberWidth + 9, y + 6, {
      width: width - numberWidth - 18,
      height: 12,
      ellipsis: true
    });
  doc.y = y + height + 7;
}

function drawMaintenanceInfoGrid(
  doc,
  items,
  { x = doc.page.margins.left, width, columns = 3, cellHeight = 42, gap = 6 } = {}
) {
  const availableWidth = width ?? (doc.page.width - doc.page.margins.left - doc.page.margins.right);
  const cellWidth = (availableWidth - gap * (columns - 1)) / columns;
  const startY = doc.y;
  items.forEach((item, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const cellX = x + column * (cellWidth + gap);
    const cellY = startY + row * (cellHeight + gap);
    doc
      .roundedRect(cellX, cellY, cellWidth, cellHeight, 4)
      .fillColor(row % 2 === 0 ? PDF_WHITE : PDF_TABLE_STRIPE_BG)
      .strokeColor(PDF_TABLE_BORDER)
      .lineWidth(0.65)
      .fillAndStroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(6.4)
      .fillColor(PDF_BRAND_700)
      .text(maintenanceUpperText(item.label), cellX + 7, cellY + 6, {
        width: cellWidth - 14,
        height: 8,
        ellipsis: true
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(item.compact ? 7.7 : 8.8)
      .fillColor(item.ink || PDF_INK)
      .text(maintenanceUpperText(item.value), cellX + 7, cellY + 17, {
        width: cellWidth - 14,
        height: cellHeight - 22,
        lineGap: 1,
        ellipsis: true
      });
  });
  doc.y = startY + maintenanceGridHeight(items.length, columns, cellHeight, gap);
}

function drawMaintenanceAssetIdentification(doc, asset) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 9;
  const photoWidth = 116;
  const identityHeight = 183;
  const infoWidth = width - photoWidth - gap;
  const startY = doc.y;

  doc
    .roundedRect(x, startY, photoWidth, identityHeight, 4)
    .fillColor(PDF_SOFT_BG)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .fillAndStroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .fillColor(PDF_BRAND_700)
    .text('FOTOGRAFÍA DEL EQUIPO', x + 6, startY + 7, {
      width: photoWidth - 12,
      align: 'center'
    });
  const photoPath = asset.photo_path
    ? path.join(process.cwd(), String(asset.photo_path).replace(/^\//, ''))
    : null;
  let photoDrawn = false;
  if (photoPath && fs.existsSync(photoPath)) {
    try {
      doc.image(photoPath, x + 8, startY + 25, {
        fit: [photoWidth - 16, identityHeight - 34],
        align: 'center',
        valign: 'center'
      });
      photoDrawn = true;
    } catch {
      photoDrawn = false;
    }
  }
  if (!photoDrawn) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(PDF_MUTED)
      .text('FOTOGRAFÍA\nNO REGISTRADA', x + 10, startY + 77, {
        width: photoWidth - 20,
        align: 'center',
        lineGap: 2
      });
  }

  doc.y = startY;
  drawMaintenanceInfoGrid(
    doc,
    [
      { label: 'CÓDIGO INTERNO', value: asset.code },
      { label: 'NOMBRE DEL EQUIPO', value: asset.name, compact: true },
      { label: 'MARCA', value: asset.brand },
      { label: 'MODELO', value: asset.model },
      { label: 'NÚMERO DE SERIE', value: asset.serial },
      { label: 'FABRICANTE', value: asset.manufacturer, compact: true },
      { label: 'CATEGORÍA', value: maintenanceAssetCategoryLabel(asset.asset_category) },
      { label: 'ESTADO EN INVENTARIO', value: maintenanceAssetStatusLabel(asset.status) }
    ],
    {
      x: x + photoWidth + gap,
      width: infoWidth,
      columns: 2,
      cellHeight: 42,
      gap: 5
    }
  );

  doc.y = startY + identityHeight + 7;
  drawMaintenanceInfoGrid(
    doc,
    [
      { label: 'SEDE', value: asset.site_name },
      { label: 'ÁREA', value: asset.area_name },
      { label: 'UBICACIÓN', value: asset.location_name || asset.location }
    ],
    { x, width, columns: 3, cellHeight: 43, gap: 6 }
  );
}

function maintenanceChecklistGroupHeight(doc, group, width) {
  let height = 31;
  doc.font('Helvetica').fontSize(7.6);
  Object.values(group.labels).forEach((label) => {
    const textHeight = doc.heightOfString(maintenanceUpperText(label), {
      width: width - 34,
      lineGap: 1
    });
    height += Math.max(16, textHeight + 5);
  });
  return height + 7;
}

function drawMaintenanceChecklistColumns(doc, groups) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 7;
  const columnWidth = (width - gap * (groups.length - 1)) / groups.length;
  const columnHeight = Math.max(
    ...groups.map((group) => maintenanceChecklistGroupHeight(doc, group, columnWidth))
  );
  const startY = doc.y;

  groups.forEach((group, groupIndex) => {
    const columnX = x + groupIndex * (columnWidth + gap);
    const selected = new Set(Array.isArray(group.selected) ? group.selected : []);
    doc
      .roundedRect(columnX, startY, columnWidth, columnHeight, 4)
      .fillColor(PDF_WHITE)
      .strokeColor(PDF_TABLE_BORDER)
      .lineWidth(0.7)
      .fillAndStroke();
    doc
      .rect(columnX + 1, startY + 1, columnWidth - 2, 25)
      .fillColor(PDF_BRAND_50)
      .fill();
    doc
      .font('Helvetica-Bold')
      .fontSize(8.1)
      .fillColor(PDF_BRAND_700)
      .text(maintenanceUpperText(group.title), columnX + 7, startY + 8, {
        width: columnWidth - 14,
        align: 'center'
      });

    let itemY = startY + 31;
    Object.entries(group.labels).forEach(([key, label], itemIndex) => {
      const labelText = maintenanceUpperText(label);
      doc.font('Helvetica').fontSize(7.6);
      const textHeight = doc.heightOfString(labelText, {
        width: columnWidth - 34,
        lineGap: 1
      });
      const rowHeight = Math.max(16, textHeight + 5);
      if (itemIndex % 2 === 1) {
        doc.rect(columnX + 1, itemY - 2, columnWidth - 2, rowHeight).fillColor(PDF_TABLE_STRIPE_BG).fill();
      }
      const markerX = columnX + 8;
      const markerY = itemY + 1;
      if (selected.has(key)) {
        doc.rect(markerX, markerY, 9, 9).fillColor(PDF_BRAND_700).fill();
        doc
          .font('Helvetica-Bold')
          .fontSize(6.7)
          .fillColor(PDF_WHITE)
          .text('X', markerX, markerY + 1, { width: 9, align: 'center' });
      } else {
        doc.rect(markerX, markerY, 9, 9).strokeColor(PDF_TABLE_BORDER).lineWidth(0.7).stroke();
      }
      doc
        .font(selected.has(key) ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(7.6)
        .fillColor(selected.has(key) ? PDF_INK : PDF_MUTED)
        .text(labelText, columnX + 23, itemY, {
          width: columnWidth - 31,
          height: rowHeight - 2,
          lineGap: 1,
          ellipsis: true
        });
      itemY += rowHeight;
    });
  });

  doc.y = startY + columnHeight + 2;
  return columnHeight;
}

function maintenanceNarrativeHeight(doc, value, width) {
  doc.font('Helvetica').fontSize(8.8);
  const textHeight = doc.heightOfString(maintenanceUpperText(value), {
    width: width - 18,
    lineGap: 2
  });
  return Math.max(58, textHeight + 35);
}

function drawMaintenanceNarrativeBox(doc, label, value, { ink = PDF_INK } = {}) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = maintenanceNarrativeHeight(doc, value, width);
  ensureSpace(doc, height + 8);
  const y = doc.y;
  doc
    .roundedRect(x, y, width, height, 4)
    .fillColor(PDF_WHITE)
    .strokeColor(PDF_TABLE_BORDER)
    .lineWidth(0.7)
    .fillAndStroke();
  doc
    .rect(x + 1, y + 1, width - 2, 21)
    .fillColor(PDF_BRAND_50)
    .fill();
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(PDF_BRAND_700)
    .text(maintenanceUpperText(label), x + 8, y + 7, { width: width - 16 });
  doc
    .font('Helvetica')
    .fontSize(8.8)
    .fillColor(ink)
    .text(maintenanceUpperText(value), x + 9, y + 29, {
      width: width - 18,
      height: height - 35,
      lineGap: 2,
      ellipsis: true
    });
  doc.y = y + height + 6;
}

function drawMaintenanceStatusSummary(doc, report) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 7;
  const cardWidth = (width - gap * 2) / 3;
  const y = doc.y;
  const cardHeight = 59;
  const status = maintenanceAssetStatusLabel(report.asset_status_after);
  const statusPalette = maintenanceStatusPalette(status);
  const spareRequired = report.requires_spare_parts ? 'SÍ REQUIERE' : 'NO REQUIERE';
  const sparePalette = maintenanceStatusPalette(report.requires_spare_parts ? 'REPUESTO PENDIENTE' : 'OPERATIVO');
  const cards = [
    { label: 'ESTADO FINAL DEL EQUIPO', value: status, palette: statusPalette },
    { label: 'REQUERIMIENTO DE REPUESTO', value: spareRequired, palette: sparePalette },
    {
      label: 'ESTADO DEL REPUESTO',
      value: report.requires_spare_parts ? sparePartStatusLabel(report.spare_parts_status) : 'NO APLICA',
      palette: maintenanceStatusPalette(report.requires_spare_parts ? report.spare_parts_status : 'OPERATIVO')
    }
  ];
  cards.forEach((card, index) => {
    const cardX = x + index * (cardWidth + gap);
    doc
      .roundedRect(cardX, y, cardWidth, cardHeight, 4)
      .fillColor(card.palette.background)
      .strokeColor(card.palette.border)
      .lineWidth(0.75)
      .fillAndStroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(6.3)
      .fillColor(card.palette.ink)
      .text(card.label, cardX + 7, y + 8, {
        width: cardWidth - 14,
        align: 'center'
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(9.2)
      .fillColor(card.palette.ink)
      .text(card.value, cardX + 7, y + 27, {
        width: cardWidth - 14,
        height: 24,
        align: 'center',
        lineGap: 1,
        ellipsis: true
      });
  });
  doc.y = y + cardHeight + 7;
}

function maintenanceSignerCredential(signature) {
  if (signature.role === 'ingeniero_biomedico' && signature.invima_registration) {
    return `REGISTRO PROFESIONAL / INVIMA: ${signature.invima_registration}`;
  }
  return 'USUARIO AUTORIZADO DEL CLIENTE';
}

function drawMaintenanceSignatures(doc, signatures) {
  if (!signatures?.length) {
    drawMaintenanceNarrativeBox(doc, 'ESTADO DE FIRMAS', 'SIN FIRMAS REGISTRADAS');
    return;
  }
  const signaturesPerRow = 2;
  const gap = 24;
  const rowGap = 18;
  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const signatureWidth = (availableWidth - gap) / signaturesPerRow;
  const signatureHeight = 171;
  const left = doc.page.margins.left;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  let cursorY = doc.y;

  signatures.forEach((signature, index) => {
    const column = index % signaturesPerRow;
    if (index > 0 && column === 0) {
      cursorY += signatureHeight + rowGap;
      if (cursorY + signatureHeight > bottomLimit) {
        doc.addPage();
        paintPageBackground(doc);
        drawMaintenanceSectionTitle(doc, 6, 'FIRMAS Y AVALES - CONTINUACIÓN', signatureHeight);
        cursorY = doc.y;
      }
    }
    const cursorX = left + column * (signatureWidth + gap);
    doc
      .roundedRect(cursorX, cursorY, signatureWidth, signatureHeight, 5)
      .fillColor(PDF_WHITE)
      .strokeColor(PDF_TABLE_BORDER)
      .lineWidth(0.8)
      .fillAndStroke();
    doc
      .rect(cursorX + 1, cursorY + 1, signatureWidth - 2, 38)
      .fillColor(PDF_BRAND_50)
      .fill();
    doc
      .font('Helvetica-Bold')
      .fontSize(10.6)
      .fillColor(PDF_BRAND_700)
      .text(maintenanceSignerRoleLabel(signature.role), cursorX + 10, cursorY + 7, {
        width: signatureWidth - 20,
        height: 13,
        align: 'center',
        ellipsis: true
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(PDF_MUTED)
      .text(maintenanceSignerDescription(signature.role), cursorX + 10, cursorY + 23, {
        width: signatureWidth - 20,
        height: 12,
        align: 'center',
        ellipsis: true
      });

    const signatureBoxX = cursorX + 18;
    const signatureBoxY = cursorY + 45;
    const signatureBoxWidth = signatureWidth - 36;
    const signatureBoxHeight = 43;
    doc
      .roundedRect(signatureBoxX, signatureBoxY, signatureBoxWidth, signatureBoxHeight, 4)
      .strokeColor(PDF_TABLE_DIVIDER)
      .lineWidth(0.7)
      .stroke();
    const signaturePath = signature.signature_path
      ? path.join(process.cwd(), String(signature.signature_path).replace(/^\//, ''))
      : null;
    if (signaturePath && fs.existsSync(signaturePath)) {
      doc.image(signaturePath, signatureBoxX + 6, signatureBoxY + 4, {
        fit: [signatureBoxWidth - 12, signatureBoxHeight - 8],
        align: 'center',
        valign: 'center'
      });
    } else {
      doc
        .font('Helvetica')
        .fontSize(8.1)
        .fillColor(PDF_MUTED)
        .text('FIRMA DIGITAL NO DISPONIBLE', signatureBoxX + 6, signatureBoxY + 19, {
          width: signatureBoxWidth - 12,
          align: 'center'
        });
    }
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(PDF_MUTED)
      .text('NOMBRE DEL FIRMANTE', cursorX + 10, cursorY + 96, {
        width: signatureWidth - 20,
        align: 'center'
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(PDF_INK)
      .text(maintenanceUpperText(signature.display_name), cursorX + 10, cursorY + 108, {
        width: signatureWidth - 20,
        height: 26,
        lineGap: 1,
        align: 'center',
        ellipsis: true
      });
    doc
      .font('Helvetica')
      .fontSize(7.8)
      .fillColor(PDF_MUTED)
      .text(maintenanceUpperText(maintenanceSignerCredential(signature)), cursorX + 9, cursorY + 137, {
        width: signatureWidth - 18,
        height: 12,
        align: 'center',
        ellipsis: true
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(PDF_MUTED)
      .text(`FIRMADO EL ${formatMaintenanceDateTime(signature.signed_at)}`, cursorX + 9, cursorY + 154, {
        width: signatureWidth - 18,
        align: 'center'
      });
  });
  doc.y = cursorY + signatureHeight + 8;
}

function addMaintenanceReportPageChrome(doc, { client, code }) {
  if (typeof doc.bufferedPageRange !== 'function') return;
  const range = doc.bufferedPageRange();
  if (!range.count) return;
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.save();
    doc
      .font('Helvetica-Bold')
      .fontSize(6.2)
      .fillColor(PDF_MUTED)
      .text('INBIHOSPITALARIO', left, 24, { width: 120, lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(6.2)
      .fillColor(PDF_MUTED)
      .text(maintenanceUpperText(client.name), left + 125, 24, {
        width: right - left - 250,
        align: 'center',
        ellipsis: true,
        lineBreak: false
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(6.2)
      .fillColor(PDF_MUTED)
      .text(code, right - 120, 24, { width: 120, align: 'right', lineBreak: false });
    doc
      .moveTo(left, 39)
      .lineTo(right, 39)
      .strokeColor(PDF_TABLE_DIVIDER)
      .lineWidth(0.6)
      .stroke();

    const footerLineY = doc.page.height - 39;
    const footerTextY = doc.page.height - 31;
    doc
      .moveTo(left, footerLineY)
      .lineTo(right, footerLineY)
      .strokeColor(PDF_TABLE_DIVIDER)
      .lineWidth(0.6)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(6.1)
      .fillColor(PDF_MUTED)
      .text('DOCUMENTO TÉCNICO GENERADO POR INBIHOSPITALARIO', left, footerTextY, {
        width: 245,
        lineBreak: false
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(6.3)
      .fillColor(PDF_MUTED)
      .text(`PÁGINA ${pageIndex - range.start + 1} DE ${range.count}`, right - 100, footerTextY, {
        width: 100,
        align: 'right',
        lineBreak: false
      });
    doc.restore();
    doc.page.margins.bottom = bottomMargin;
  }
  doc.switchToPage(range.start + range.count - 1);
}

export function buildMaintenanceReportPdf(doc, { client, asset, request, report, signatures }) {
  const isIndustrial = asset.asset_category === 'industrial';
  const signatureList = Array.isArray(signatures) ? signatures : [];
  const header = drawMaintenanceReportHeader(doc, {
    client,
    report,
    signatures: signatureList,
    isIndustrial
  });
  const pageContentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const identificationHeight = 183 + 7 + 43;
  drawMaintenanceSectionTitle(
    doc,
    1,
    'IDENTIFICACIÓN Y LOCALIZACIÓN DEL EQUIPO',
    identificationHeight
  );
  drawMaintenanceAssetIdentification(doc, asset);

  const engineerSignature = signatureList.find(
    (signature) => signature.role === 'ingeniero_biomedico'
  );
  const interventionItems = [
    { label: 'TIPO DE INTERVENCIÓN', value: maintenanceTypeLabel(report.type) },
    { label: 'ORIGEN DE LA SOLICITUD', value: maintenanceSourceLabel(request.source) },
    { label: 'ESTADO DOCUMENTAL', value: header.documentStatus, compact: true },
    { label: 'FECHA DE SOLICITUD', value: formatMaintenanceDateTime(request.created_at) },
    { label: 'FECHA PROGRAMADA', value: formatMaintenanceDate(request.planned_date) },
    { label: 'FECHA LÍMITE', value: formatMaintenanceDate(request.deadline_date) },
    { label: 'SOLICITADO POR', value: request.requester_name },
    {
      label: 'RESPONSABLE TÉCNICO',
      value: engineerSignature?.display_name || request.assigned_name
    },
    { label: 'FECHA DE INTERVENCIÓN', value: formatMaintenanceDateTime(report.created_at) },
    ...(request.late_execution_authorized_at
      ? [
          { label: 'CONDICIÓN', value: 'EJECUCIÓN EXTEMPORÁNEA AUTORIZADA' },
          {
            label: 'AUTORIZACIÓN',
            value: `${safeText(request.late_execution_authorized_by_name)} · ${formatMaintenanceDateTime(request.late_execution_authorized_at)}`
          }
        ]
      : [])
  ];
  const interventionHeight = maintenanceGridHeight(interventionItems.length, 3, 48, 6);
  drawMaintenanceSectionTitle(
    doc,
    2,
    'DATOS DE LA INTERVENCIÓN',
    interventionHeight
  );
  drawMaintenanceInfoGrid(doc, interventionItems, { columns: 3, cellHeight: 48, gap: 6 });
  doc.y += 7;
  drawMaintenanceNarrativeBox(
    doc,
    'SOLICITUD, NECESIDAD O FALLA REPORTADA',
    request.description
  );
  if (request.late_execution_authorized_at) {
    drawMaintenanceNarrativeBox(
      doc,
      'JUSTIFICACIÓN DE EJECUCIÓN EXTEMPORÁNEA',
      request.late_execution_reason
    );
  }

  const checklistGroups = [
    {
      title: 'REVISIONES',
      labels: MAINTENANCE_CHECK_LABELS,
      selected: report.maintenance_checks
    },
    {
      title: 'ACTIVIDADES TÉCNICAS',
      labels: MAINTENANCE_ACTIVITY_LABELS,
      selected: report.maintenance_activities
    },
    {
      title: 'PRUEBAS Y VERIFICACIONES',
      labels: MAINTENANCE_TEST_LABELS,
      selected: report.maintenance_tests
    }
  ];
  const checklistColumnWidth = (pageContentWidth - 14) / 3;
  const checklistHeight = Math.max(
    ...checklistGroups.map((group) =>
      maintenanceChecklistGroupHeight(doc, group, checklistColumnWidth)
    )
  );
  drawMaintenanceSectionTitle(
    doc,
    3,
    'PROTOCOLO TÉCNICO EJECUTADO',
    checklistHeight
  );
  drawMaintenanceChecklistColumns(doc, checklistGroups);

  const firstResultHeight = maintenanceNarrativeHeight(doc, report.summary, pageContentWidth);
  drawMaintenanceSectionTitle(
    doc,
    4,
    'RESULTADO TÉCNICO DE LA INTERVENCIÓN',
    firstResultHeight
  );
  drawMaintenanceNarrativeBox(doc, 'RESUMEN TÉCNICO', report.summary);
  drawMaintenanceNarrativeBox(doc, 'HALLAZGOS Y DIAGNÓSTICO', report.findings);
  if (report.failure_cause) {
    drawMaintenanceNarrativeBox(doc, 'CAUSA DE FALLA IDENTIFICADA', report.failure_cause);
  }
  drawMaintenanceNarrativeBox(
    doc,
    'ACCIONES REALIZADAS Y RECOMENDACIONES',
    report.actions_taken
  );

  drawMaintenanceSectionTitle(doc, 5, 'ESTADO TÉCNICO DE CIERRE Y REPUESTOS', 66);
  drawMaintenanceStatusSummary(doc, report);
  drawMaintenanceNarrativeBox(
    doc,
    'OBSERVACIONES DEL ESTADO FINAL',
    report.asset_status_after === 'operativo'
      ? 'NO APLICA'
      : report.asset_status_observations
  );
  if (report.requires_spare_parts) {
    drawMaintenanceNarrativeBox(
      doc,
      'REPUESTO REQUERIDO O INSTALADO',
      report.spare_parts_needed,
      { ink: PDF_WARNING }
    );
  }

  drawMaintenanceSectionTitle(doc, 6, 'FIRMAS Y AVALES', 171);
  drawMaintenanceSignatures(doc, signatureList);

  addMaintenanceReportPageChrome(doc, { client, code: header.code });
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
    let resolution = '';
    if (item.status === 'warranty') {
      resolution = item.warranty_release_date
        ? ` · EN GARANTÍA HASTA ${formatDate(item.warranty_release_date)}`
        : ' · EN GARANTÍA';
    } else if (item.historical_resolution === 'not_performed') {
      resolution = ` · NO REALIZADO: ${safeText(item.non_execution_reason)}`;
    } else if (item.historical_resolution === 'pending_evidence') {
      resolution = ' · PDF HISTÓRICO PENDIENTE';
    } else if (item.historical_resolution === 'evidence_uploaded') {
      resolution = ' · PDF HISTÓRICO CONCILIADO';
    }
    grouped
      .get(item.asset_id)
      .dates.push(`${formatDate(item.planned_date)}-${formatDate(item.deadline_date)}${resolution}`);
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
