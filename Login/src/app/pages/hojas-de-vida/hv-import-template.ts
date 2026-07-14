import type { Row, Workbook } from 'exceljs';

export interface HvTemplateSite {
  id: string;
  name: string;
}

export interface HvTemplateArea {
  id: string;
  name: string;
  siteId: string | null;
}

export interface HvTemplateLocation {
  id: string;
  name: string;
  areaId: string | null;
}

interface HvImportTemplateOptions {
  headers: readonly string[];
  sites: readonly HvTemplateSite[];
  areas: readonly HvTemplateArea[];
  locations: readonly HvTemplateLocation[];
  riskClasses: readonly string[];
  frequencies: readonly string[];
  acquisitionTypes: readonly string[];
  equipmentTypes: readonly string[];
  warrantyOptions: readonly number[];
  maxRows: number;
}

const CATALOG_SHEET_NAME = 'Catalogos';
const EMPTY_LIST_NAME = 'HV_LISTA_VACIA';
const LOCATION_MAP_NAME = 'HV_MAPA_UBICACIONES';
const LOCATION_COLUMNS_START = 13;

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }));
}

function excelColumnLetter(columnNumber: number): string {
  let value = columnNumber;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function catalogRange(columnNumber: number, valueCount: number): string {
  const letter = excelColumnLetter(columnNumber);
  const endRow = Math.max(valueCount + 1, 2);
  return `${CATALOG_SHEET_NAME}!$${letter}$2:$${letter}$${endRow}`;
}

function styleHeaderRow(row: Row, color: string): void {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF8F343A' } },
      left: { style: 'thin', color: { argb: 'FF8F343A' } },
      bottom: { style: 'thin', color: { argb: 'FF8F343A' } },
      right: { style: 'thin', color: { argb: 'FF8F343A' } }
    };
  });
}

export function buildHvImportTemplate(
  workbook: Workbook,
  options: HvImportTemplateOptions
): void {
  workbook.creator = 'INBIHOSPITALARIO';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Hojas de vida', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const catalogSheet = workbook.addWorksheet(CATALOG_SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const guideSheet = workbook.addWorksheet('Instrucciones', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const siteNames = uniqueSorted(options.sites.map((site) => site.name));
  const areaNames = uniqueSorted(options.areas.map((area) => area.name));
  const locationNames = uniqueSorted(options.locations.map((location) => location.name));
  const warrantyOptions = options.warrantyOptions.map(String);
  const yesNoOptions = ['Sí', 'No'];

  worksheet.columns = options.headers.map((header) => ({
    header,
    key: header,
    width: Math.min(Math.max(header.length + 4, 15), 28)
  }));
  styleHeaderRow(worksheet.getRow(1), 'FFA64045');

  const exampleArea = options.areas.find((area) =>
    Boolean(area.siteId) && options.locations.some((location) => location.areaId === area.id)
  ) ?? options.areas.find((area) => Boolean(area.siteId));
  const exampleSite = options.sites.find((site) => site.id === exampleArea?.siteId) ?? options.sites[0];
  const exampleLocation = options.locations.find((location) => location.areaId === exampleArea?.id);

  worksheet.addRow({
    'Código*': 'EQ-001',
    'Nombre*': 'Monitor de signos vitales',
    'Marca*': 'Marca ejemplo',
    'Modelo*': 'Modelo ejemplo',
    'Serie*': 'SER-001',
    'Sede*': exampleSite?.name ?? 'Sede principal',
    'Área*': exampleArea?.name ?? 'Urgencias',
    'Ubicación*': exampleLocation?.name ?? 'Consultorio 1',
    'Registro Invima*': 'INVIMA-000',
    'Riesgo*': 'Clase IIA',
    Fabricante: 'Fabricante ejemplo',
    'Tipo equipo': 'Fijo',
    'Forma adquisición': 'COMPRA DIRECTA',
    'Fecha adquisición': '2026-01-15',
    'Vida útil años': 10,
    'Garantía años': 1,
    Proveedor: 'Proveedor ejemplo',
    'Teléfono proveedor': '3000000000',
    'Correo proveedor': 'proveedor@correo.com',
    'Frecuencia mantenimiento': 'trimestral',
    'Requiere calibración': 'No',
    'Frecuencia calibración': ''
  });
  const exampleRow = worksheet.getRow(2);
  exampleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
  exampleRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
    };
  });
  worksheet.autoFilter = { from: 'A1', to: 'V1' };
  worksheet.getColumn(14).numFmt = 'yyyy-mm-dd';
  worksheet.getColumn(15).numFmt = '0';
  worksheet.getColumn(16).numFmt = '0';

  catalogSheet.columns = [
    { header: 'Sedes', key: 'sites', width: 28 },
    { header: 'Áreas', key: 'areas', width: 28 },
    { header: 'Ubicaciones', key: 'locations', width: 28 },
    { header: 'Riesgos', key: 'risks', width: 18 },
    { header: 'Frecuencias', key: 'frequencies', width: 20 },
    { header: 'Adquisición', key: 'acquisition', width: 22 },
    { header: 'Tipo equipo', key: 'equipmentType', width: 16 },
    { header: 'Garantía', key: 'warranty', width: 14 },
    { header: 'Sí/No', key: 'yesNo', width: 12 },
    { header: 'Clave sede-área', key: 'siteAreaKey', width: 42 },
    { header: 'Lista de ubicaciones', key: 'locationList', width: 28 },
    { header: 'Lista vacía', key: 'emptyList', width: 14 }
  ];

  const catalogColumns = [
    siteNames,
    areaNames,
    locationNames,
    [...options.riskClasses],
    [...options.frequencies],
    [...options.acquisitionTypes],
    [...options.equipmentTypes],
    warrantyOptions,
    yesNoOptions
  ];
  const maxCatalogRows = Math.max(...catalogColumns.map((items) => items.length), 1);
  for (let rowIndex = 0; rowIndex < maxCatalogRows; rowIndex += 1) {
    catalogSheet.addRow(catalogColumns.map((items) => items[rowIndex] ?? ''));
  }

  workbook.definedNames.add(`${CATALOG_SHEET_NAME}!$L$2:$L$2`, EMPTY_LIST_NAME);
  const addNamedCatalogList = (name: string, columnNumber: number, values: readonly string[]): void => {
    workbook.definedNames.add(
      values.length ? catalogRange(columnNumber, values.length) : `${CATALOG_SHEET_NAME}!$L$2:$L$2`,
      name
    );
  };
  addNamedCatalogList('HV_SEDES', 1, siteNames);
  addNamedCatalogList('HV_AREAS', 2, areaNames);
  addNamedCatalogList('HV_RIESGOS', 4, options.riskClasses);
  addNamedCatalogList('HV_FRECUENCIAS', 5, options.frequencies);
  addNamedCatalogList('HV_ADQUISICION', 6, options.acquisitionTypes);
  addNamedCatalogList('HV_TIPO_EQUIPO', 7, options.equipmentTypes);
  addNamedCatalogList('HV_GARANTIA', 8, warrantyOptions);
  addNamedCatalogList('HV_SI_NO', 9, yesNoOptions);

  const sitesById = new Map(options.sites.map((site) => [site.id, site]));
  const usedSiteAreaKeys = new Set<string>();
  const mappedAreas = options.areas
    .filter((area) => area.siteId && sitesById.has(area.siteId))
    .sort((left, right) => {
      const leftSite = sitesById.get(left.siteId!)?.name ?? '';
      const rightSite = sitesById.get(right.siteId!)?.name ?? '';
      return `${leftSite}|${left.name}`.localeCompare(`${rightSite}|${right.name}`, 'es', { sensitivity: 'base' });
    });

  let mappingRow = 2;
  mappedAreas.forEach((area, index) => {
    const site = sitesById.get(area.siteId!);
    if (!site) return;
    const siteAreaKey = `${site.name}|${area.name}`;
    if (usedSiteAreaKeys.has(siteAreaKey)) return;
    usedSiteAreaKeys.add(siteAreaKey);

    const areaLocations = uniqueSorted(
      options.locations
        .filter((location) => location.areaId === area.id)
        .map((location) => location.name)
    );
    const listName = areaLocations.length ? `HV_UBICACIONES_${index + 1}` : EMPTY_LIST_NAME;
    if (areaLocations.length) {
      const columnNumber = LOCATION_COLUMNS_START + index;
      const columnLetter = excelColumnLetter(columnNumber);
      catalogSheet.getColumn(columnNumber).width = 28;
      catalogSheet.getCell(1, columnNumber).value = listName;
      areaLocations.forEach((locationName, locationIndex) => {
        catalogSheet.getCell(locationIndex + 2, columnNumber).value = locationName;
      });
      workbook.definedNames.add(
        `${CATALOG_SHEET_NAME}!$${columnLetter}$2:$${columnLetter}$${areaLocations.length + 1}`,
        listName
      );
    }

    catalogSheet.getCell(mappingRow, 10).value = siteAreaKey;
    catalogSheet.getCell(mappingRow, 11).value = listName;
    mappingRow += 1;
  });
  styleHeaderRow(catalogSheet.getRow(1), 'FF5F1F25');

  guideSheet.columns = [{ width: 34 }, { width: 96 }];
  guideSheet.addRows([
    ['Regla', 'Indicaciones'],
    ['Cómo usar la plantilla', 'Selecciona valores desde las listas desplegables cuando el campo lo permita.'],
    ['Orden correcto', 'Primero crea las sedes, áreas y ubicaciones en el sistema; después descarga una plantilla nueva.'],
    ['Campos obligatorios', 'Todos los encabezados con * son obligatorios.'],
    ['Sede, área y ubicación', 'Selecciona primero la sede y el área. La ubicación mostrará únicamente los registros asociados a esa combinación.'],
    ['Fecha de adquisición', 'Usa yyyy-mm-dd. Si el dato no existe, deja la celda vacía o escribe NR (No registra).'],
    ['Correo del proveedor', 'Ingresa un correo válido. Si el dato no existe, deja la celda vacía o escribe NR; se guardará como sin dato.'],
    ['Calibración', 'Si seleccionas No, Frecuencia calibración debe quedar vacía. Si seleccionas Sí, debes elegir una frecuencia.'],
    ['Validación final', 'El software vuelve a validar relaciones y formatos antes de guardar la importación.']
  ]);
  styleHeaderRow(guideSheet.getRow(1), 'FF5F1F25');
  guideSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.height = 34;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    });
  });

  const addListValidation = (columnNumber: number, formula: string, prompt: string): void => {
    for (let rowNumber = 2; rowNumber <= options.maxRows + 1; rowNumber += 1) {
      worksheet.getCell(rowNumber, columnNumber).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Valor no permitido',
        error: 'Selecciona un valor de la lista desplegable.',
        showInputMessage: true,
        promptTitle: 'Selecciona de la lista',
        prompt
      };
    }
  };

  addListValidation(6, 'HV_SEDES', 'Selecciona la sede creada para este cliente.');
  addListValidation(7, 'HV_AREAS', 'Selecciona el área que pertenece a la sede elegida.');
  addListValidation(10, 'HV_RIESGOS', 'Selecciona la clase de riesgo del equipo.');
  addListValidation(12, 'HV_TIPO_EQUIPO', 'Selecciona si el equipo es fijo o móvil.');
  addListValidation(13, 'HV_ADQUISICION', 'Selecciona la forma de adquisición.');
  addListValidation(16, 'HV_GARANTIA', 'Selecciona los años de garantía si aplica.');
  addListValidation(20, 'HV_FRECUENCIAS', 'Selecciona la frecuencia de mantenimiento.');
  addListValidation(21, 'HV_SI_NO', 'Indica si el equipo requiere calibración.');

  const mappingEndRow = Math.max(mappingRow - 1, 2);
  workbook.definedNames.add(
    `${CATALOG_SHEET_NAME}!$J$2:$K$${mappingEndRow}`,
    LOCATION_MAP_NAME
  );
  for (let rowNumber = 2; rowNumber <= options.maxRows + 1; rowNumber += 1) {
    worksheet.getCell(rowNumber, 8).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `INDIRECT(IFERROR(VLOOKUP($F${rowNumber}&"|"&$G${rowNumber},${LOCATION_MAP_NAME},2,FALSE),"${EMPTY_LIST_NAME}"))`
      ],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Ubicación no permitida',
      error: 'Selecciona una ubicación asociada a la sede y al área de esta fila.',
      showInputMessage: true,
      promptTitle: 'Ubicaciones del área',
      prompt: 'La lista depende de la sede y del área seleccionadas.'
    };

    worksheet.getCell(rowNumber, 15).dataValidation = {
      type: 'whole',
      operator: 'between',
      allowBlank: true,
      formulae: [0, 50],
      showErrorMessage: true,
      errorTitle: 'Vida útil no válida',
      error: 'Ingresa un número entre 0 y 50.'
    };

    worksheet.getCell(rowNumber, 22).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `INDIRECT(IF($U${rowNumber}="Sí","HV_FRECUENCIAS","${EMPTY_LIST_NAME}"))`
      ],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Frecuencia no aplicable',
      error: 'Solo puedes elegir una frecuencia cuando Requiere calibración sea Sí.',
      showInputMessage: true,
      promptTitle: 'Frecuencia de calibración',
      prompt: 'Selecciona una frecuencia únicamente si el equipo requiere calibración.'
    };
  }

  worksheet.addConditionalFormatting({
    ref: `V2:V${options.maxRows + 1}`,
    rules: [{
      type: 'expression',
      priority: 1,
      formulae: ['$U2<>"Sí"'],
      style: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } },
        font: { color: { argb: 'FF6B7280' } }
      }
    }]
  });
}
