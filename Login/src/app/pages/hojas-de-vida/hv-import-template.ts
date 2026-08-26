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

export interface HvTemplateEquipmentCatalogModel {
  id: string;
  name: string;
}

export interface HvTemplateEquipmentCatalogBrand {
  id: string;
  name: string;
  models: readonly HvTemplateEquipmentCatalogModel[];
}

export interface HvTemplateEquipmentCatalogItem {
  id: string;
  name: string;
  brands: readonly HvTemplateEquipmentCatalogBrand[];
}

interface HvImportTemplateOptions {
  assetCategory?: 'biomedical' | 'industrial';
  headers: readonly string[];
  sites: readonly HvTemplateSite[];
  areas: readonly HvTemplateArea[];
  locations: readonly HvTemplateLocation[];
  equipmentCatalog: readonly HvTemplateEquipmentCatalogItem[];
  sanitaryRiskClasses: readonly string[];
  electricalProtectionClasses: readonly string[];
  appliedPartTypes: readonly string[];
  frequencies: readonly string[];
  acquisitionTypes: readonly string[];
  equipmentTypes: readonly string[];
  warrantyOptions: readonly number[];
  maxRows: number;
}

const CATALOG_SHEET_NAME = 'Catalogos';
const EQUIPMENT_CATALOG_SHEET_NAME = 'CatalogoEquipos';
const EMPTY_LIST_NAME = 'HV_LISTA_VACIA';
const LOCATION_MAP_NAME = 'HV_MAPA_UBICACIONES';
const EQUIPMENT_BRAND_MAP_NAME = 'HV_MAPA_MARCAS';
const EQUIPMENT_MODEL_MAP_NAME = 'HV_MAPA_MODELOS';
const LOCATION_COLUMNS_START = 15;

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }));
}

function catalogStorageValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-CO');
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
  const isIndustrial = options.assetCategory === 'industrial';
  workbook.creator = 'INBIHOSPITALARIO';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(isIndustrial ? 'Hojas industriales' : 'Hojas de vida', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const catalogSheet = workbook.addWorksheet(CATALOG_SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const equipmentCatalogSheet = workbook.addWorksheet(EQUIPMENT_CATALOG_SHEET_NAME, {
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
  const equipmentCatalog = options.equipmentCatalog
    .map((item) => ({
      ...item,
      name: catalogStorageValue(item.name),
      brands: item.brands.map((brand) => ({
        ...brand,
        name: catalogStorageValue(brand.name),
        models: brand.models.map((model) => ({
          ...model,
          name: catalogStorageValue(model.name)
        }))
      }))
    }))
    .filter((item) => item.name)
    .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }));

  worksheet.columns = options.headers.map((header) => ({
    header,
    key: header,
    width: Math.min(Math.max(header.length + 4, 15), 28)
  }));
  styleHeaderRow(worksheet.getRow(1), 'FFA64045');
  const columnNumber = (...headers: string[]): number => {
    const normalized = headers.map((header) => header.trim().toLocaleLowerCase('es'));
    const index = options.headers.findIndex((header) =>
      normalized.includes(header.trim().toLocaleLowerCase('es'))
    );
    return index >= 0 ? index + 1 : 0;
  };
  const columnRef = (column: number): string => excelColumnLetter(column);

  const exampleArea = options.areas.find((area) =>
    Boolean(area.siteId) && options.locations.some((location) => location.areaId === area.id)
  ) ?? options.areas.find((area) => Boolean(area.siteId));
  const exampleSite = options.sites.find((site) => site.id === exampleArea?.siteId) ?? options.sites[0];
  const exampleLocation = options.locations.find((location) => location.areaId === exampleArea?.id);
  const exampleEquipment = equipmentCatalog.find((item) =>
    item.brands.some((brand) => brand.models.length > 0)
  ) ?? equipmentCatalog[0];
  const exampleBrand = exampleEquipment?.brands.find((brand) => brand.models.length > 0)
    ?? exampleEquipment?.brands[0];
  const exampleModel = exampleBrand?.models[0];

  worksheet.addRow({
    'Código*': 'EQ-001',
    'Nombre*': exampleEquipment?.name ?? (isIndustrial ? 'AIRE ACONDICIONADO' : 'MONITOR DE SIGNOS VITALES'),
    'Marca*': exampleBrand?.name ?? 'MARCA EJEMPLO',
    'Modelo*': exampleModel?.name ?? 'MODELO EJEMPLO',
    'Serie*': 'SER-001',
    'Sede*': exampleSite?.name ?? 'Sede principal',
    'Área*': exampleArea?.name ?? 'Urgencias',
    'Ubicación*': exampleLocation?.name ?? 'Consultorio 1',
    'Registro Invima*': 'INVIMA-000',
    'Requiere riesgo sanitario*': 'Sí',
    'Clasificación riesgo sanitario': 'Clase IIA',
    'Requiere riesgo eléctrico*': 'Sí',
    'Clase protección eléctrica': 'Clase I',
    'Tipo parte aplicada': 'Tipo BF',
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
  worksheet.autoFilter = { from: 'A1', to: `${columnRef(options.headers.length)}1` };
  const acquisitionDateColumn = columnNumber('Fecha adquisición');
  const usefulLifeColumn = columnNumber('Vida útil años');
  const warrantyColumn = columnNumber('Garantía años');
  if (acquisitionDateColumn) worksheet.getColumn(acquisitionDateColumn).numFmt = 'yyyy-mm-dd';
  if (usefulLifeColumn) worksheet.getColumn(usefulLifeColumn).numFmt = '0';
  if (warrantyColumn) worksheet.getColumn(warrantyColumn).numFmt = '0';

  catalogSheet.columns = [
    { header: 'Sedes', key: 'sites', width: 28 },
    { header: 'Áreas', key: 'areas', width: 28 },
    { header: 'Ubicaciones', key: 'locations', width: 28 },
    { header: 'Riesgo sanitario', key: 'sanitaryRisk', width: 22 },
    { header: 'Clase eléctrica', key: 'electricalClass', width: 26 },
    { header: 'Parte aplicada', key: 'appliedPart', width: 20 },
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
    [...options.sanitaryRiskClasses],
    [...options.electricalProtectionClasses],
    [...options.appliedPartTypes],
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

  workbook.definedNames.add(`${CATALOG_SHEET_NAME}!$N$2:$N$2`, EMPTY_LIST_NAME);
  const addNamedCatalogList = (name: string, columnNumber: number, values: readonly string[]): void => {
    workbook.definedNames.add(
      values.length ? catalogRange(columnNumber, values.length) : `${CATALOG_SHEET_NAME}!$N$2:$N$2`,
      name
    );
  };
  addNamedCatalogList('HV_SEDES', 1, siteNames);
  addNamedCatalogList('HV_AREAS', 2, areaNames);
  addNamedCatalogList('HV_RIESGOS_SANITARIOS', 4, options.sanitaryRiskClasses);
  addNamedCatalogList('HV_CLASES_ELECTRICAS', 5, options.electricalProtectionClasses);
  addNamedCatalogList('HV_TIPOS_PARTE_APLICADA', 6, options.appliedPartTypes);
  addNamedCatalogList('HV_FRECUENCIAS', 7, options.frequencies);
  addNamedCatalogList('HV_ADQUISICION', 8, options.acquisitionTypes);
  addNamedCatalogList('HV_TIPO_EQUIPO', 9, options.equipmentTypes);
  addNamedCatalogList('HV_GARANTIA', 10, warrantyOptions);
  addNamedCatalogList('HV_SI_NO', 11, yesNoOptions);

  equipmentCatalogSheet.columns = [
    { header: 'Equipos', key: 'equipment', width: 34 },
    { header: 'Clave equipo', key: 'equipmentKey', width: 34 },
    { header: 'Lista de marcas', key: 'brandList', width: 24 },
    { header: 'Clave equipo-marca', key: 'equipmentBrandKey', width: 56 },
    { header: 'Lista de modelos', key: 'modelList', width: 24 },
    { header: 'Lista vacía', key: 'emptyList', width: 14 }
  ];

  const equipmentNames = equipmentCatalog.map((item) => item.name);
  equipmentNames.forEach((equipmentName, index) => {
    equipmentCatalogSheet.getCell(index + 2, 1).value = equipmentName;
  });
  workbook.definedNames.add(
    equipmentNames.length
      ? `${EQUIPMENT_CATALOG_SHEET_NAME}!$A$2:$A$${equipmentNames.length + 1}`
      : `${CATALOG_SHEET_NAME}!$N$2:$N$2`,
    'HV_EQUIPOS'
  );

  let equipmentMappingRow = 2;
  let modelMappingRow = 2;
  let dynamicCatalogColumn = 7;
  equipmentCatalog.forEach((equipment, equipmentIndex) => {
    const brands = [...equipment.brands]
      .filter((brand) => brand.name.trim())
      .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }));
    const brandNames = uniqueSorted(brands.map((brand) => brand.name));
    const brandListName = brandNames.length ? `HV_MARCAS_${equipmentIndex + 1}` : EMPTY_LIST_NAME;

    if (brandNames.length) {
      const columnNumber = dynamicCatalogColumn;
      const columnLetter = excelColumnLetter(columnNumber);
      dynamicCatalogColumn += 1;
      equipmentCatalogSheet.getColumn(columnNumber).width = 28;
      equipmentCatalogSheet.getCell(1, columnNumber).value = brandListName;
      brandNames.forEach((brandName, brandIndex) => {
        equipmentCatalogSheet.getCell(brandIndex + 2, columnNumber).value = brandName;
      });
      workbook.definedNames.add(
        `${EQUIPMENT_CATALOG_SHEET_NAME}!$${columnLetter}$2:$${columnLetter}$${brandNames.length + 1}`,
        brandListName
      );
    }

    equipmentCatalogSheet.getCell(equipmentMappingRow, 2).value = equipment.name;
    equipmentCatalogSheet.getCell(equipmentMappingRow, 3).value = brandListName;
    equipmentMappingRow += 1;

    brands.forEach((brand, brandIndex) => {
      const modelNames = uniqueSorted(brand.models.map((model) => model.name));
      const modelListName = modelNames.length
        ? `HV_MODELOS_${equipmentIndex + 1}_${brandIndex + 1}`
        : EMPTY_LIST_NAME;

      if (modelNames.length) {
        const columnNumber = dynamicCatalogColumn;
        const columnLetter = excelColumnLetter(columnNumber);
        dynamicCatalogColumn += 1;
        equipmentCatalogSheet.getColumn(columnNumber).width = 28;
        equipmentCatalogSheet.getCell(1, columnNumber).value = modelListName;
        modelNames.forEach((modelName, modelIndex) => {
          equipmentCatalogSheet.getCell(modelIndex + 2, columnNumber).value = modelName;
        });
        workbook.definedNames.add(
          `${EQUIPMENT_CATALOG_SHEET_NAME}!$${columnLetter}$2:$${columnLetter}$${modelNames.length + 1}`,
          modelListName
        );
      }

      equipmentCatalogSheet.getCell(modelMappingRow, 4).value = `${equipment.name}|${brand.name}`;
      equipmentCatalogSheet.getCell(modelMappingRow, 5).value = modelListName;
      modelMappingRow += 1;
    });
  });

  workbook.definedNames.add(
    `${EQUIPMENT_CATALOG_SHEET_NAME}!$B$2:$C$${Math.max(equipmentMappingRow - 1, 2)}`,
    EQUIPMENT_BRAND_MAP_NAME
  );
  workbook.definedNames.add(
    `${EQUIPMENT_CATALOG_SHEET_NAME}!$D$2:$E$${Math.max(modelMappingRow - 1, 2)}`,
    EQUIPMENT_MODEL_MAP_NAME
  );
  styleHeaderRow(equipmentCatalogSheet.getRow(1), 'FF5F1F25');
  equipmentCatalogSheet.state = 'hidden';

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

    catalogSheet.getCell(mappingRow, 12).value = siteAreaKey;
    catalogSheet.getCell(mappingRow, 13).value = listName;
    mappingRow += 1;
  });
  styleHeaderRow(catalogSheet.getRow(1), 'FF5F1F25');

  guideSheet.columns = [{ width: 34 }, { width: 96 }];
  guideSheet.addRows([
    ['Regla', 'Indicaciones'],
    ['Cómo usar la plantilla', 'Selecciona valores desde las listas desplegables cuando el campo lo permita.'],
    ['Orden correcto', 'Primero crea las sedes, áreas y ubicaciones en el sistema; después descarga una plantilla nueva.'],
    ['Campos obligatorios', 'Todos los encabezados con * son obligatorios.'],
    ['Equipo, marca y modelo', 'Selecciona en ese orden para ver únicamente las marcas y modelos relacionados. Si falta un valor, puedes escribirlo; al importar se guardará en MAYÚSCULAS y quedará disponible en el catálogo compartido.'],
    ['Sede, área y ubicación', 'Selecciona primero la sede y el área. La ubicación mostrará únicamente los registros asociados a esa combinación.'],
    ['Fecha de adquisición', 'Usa yyyy-mm-dd. Si el dato no existe, deja la celda vacía o escribe NR (No registra).'],
    ['Garantía', 'Déjala vacía cuando el equipo no tenga garantía. Si eliges 1, 2 o 3 años, la fecha de adquisición es obligatoria y el mantenimiento se programará únicamente después de finalizar la garantía.'],
    ['Correo del proveedor', 'Ingresa un correo válido. Si el dato no existe, deja la celda vacía o escribe NR; se guardará como sin dato.'],
    ...(!isIndustrial ? [
      ['Riesgo sanitario', 'Selecciona Sí cuando aplique y elige Clase I, Clase IIA, Clase IIB o Clase III. Si seleccionas No, deja la clasificación vacía.'],
      ['Riesgo eléctrico', 'Selecciona Sí cuando aplique y completa tanto la clase de protección como el tipo de parte aplicada. Usa No aplica cuando el equipo no tenga parte aplicada.'],
      ['Calibración', 'Si seleccionas No, Frecuencia calibración debe quedar vacía. Si seleccionas Sí, debes elegir una frecuencia.']
    ] : [[
      'Categoría industrial',
      'Esta plantilla registra únicamente equipos industriales. INVIMA y las clasificaciones clínicas no aplican.'
    ]]),
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

  const addListValidation = (
    columnNumber: number,
    formula: string,
    prompt: string,
    allowCustomValue = false
  ): void => {
    if (!columnNumber) return;
    for (let rowNumber = 2; rowNumber <= options.maxRows + 1; rowNumber += 1) {
      worksheet.getCell(rowNumber, columnNumber).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: !allowCustomValue,
        errorStyle: 'error',
        errorTitle: 'Valor no permitido',
        error: 'Selecciona un valor de la lista desplegable.',
        showInputMessage: true,
        promptTitle: 'Selecciona de la lista',
        prompt
      };
    }
  };

  const equipmentColumn = columnNumber('Nombre*');
  const brandColumn = columnNumber('Marca*');
  const modelColumn = columnNumber('Modelo*');
  const siteColumn = columnNumber('Sede*');
  const areaColumn = columnNumber('Área*');
  const locationColumn = columnNumber('Ubicación*');
  const sanitaryRequiredColumn = columnNumber('Requiere riesgo sanitario*');
  const sanitaryRiskColumn = columnNumber('Clasificación riesgo sanitario');
  const electricalRequiredColumn = columnNumber('Requiere riesgo eléctrico*');
  const electricalClassColumn = columnNumber('Clase protección eléctrica');
  const appliedPartColumn = columnNumber('Tipo parte aplicada');
  const equipmentTypeColumn = columnNumber('Tipo equipo');
  const acquisitionTypeColumn = columnNumber('Forma adquisición');
  const maintenanceFrequencyColumn = columnNumber('Frecuencia mantenimiento');
  const requiresCalibrationColumn = columnNumber('Requiere calibración');
  const calibrationFrequencyColumn = columnNumber('Frecuencia calibración');

  addListValidation(equipmentColumn, 'HV_EQUIPOS', 'Selecciona un equipo o escribe uno nuevo.', true);
  addListValidation(siteColumn, 'HV_SEDES', 'Selecciona la sede creada para este cliente.');
  addListValidation(areaColumn, 'HV_AREAS', 'Selecciona el área que pertenece a la sede elegida.');
  addListValidation(sanitaryRequiredColumn, 'HV_SI_NO', 'Indica si el equipo requiere clasificación de riesgo sanitario.');
  addListValidation(electricalRequiredColumn, 'HV_SI_NO', 'Indica si el equipo requiere clasificación de riesgo eléctrico.');
  addListValidation(equipmentTypeColumn, 'HV_TIPO_EQUIPO', 'Selecciona si el equipo es fijo o móvil.');
  addListValidation(acquisitionTypeColumn, 'HV_ADQUISICION', 'Selecciona la forma de adquisición.');
  addListValidation(warrantyColumn, 'HV_GARANTIA', 'Selecciona los años de garantía si aplica.');
  addListValidation(maintenanceFrequencyColumn, 'HV_FRECUENCIAS', 'Selecciona la frecuencia de mantenimiento.');
  addListValidation(requiresCalibrationColumn, 'HV_SI_NO', 'Indica si el equipo requiere calibración.');

  const mappingEndRow = Math.max(mappingRow - 1, 2);
  workbook.definedNames.add(
    `${CATALOG_SHEET_NAME}!$L$2:$M$${mappingEndRow}`,
    LOCATION_MAP_NAME
  );
  for (let rowNumber = 2; rowNumber <= options.maxRows + 1; rowNumber += 1) {
    worksheet.getCell(rowNumber, brandColumn).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `INDIRECT(IFERROR(VLOOKUP($${columnRef(equipmentColumn)}${rowNumber},${EQUIPMENT_BRAND_MAP_NAME},2,FALSE),"${EMPTY_LIST_NAME}"))`
      ],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: 'Marcas del equipo',
      prompt: 'Selecciona una marca relacionada o escribe una nueva.'
    };

    worksheet.getCell(rowNumber, modelColumn).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `INDIRECT(IFERROR(VLOOKUP($${columnRef(equipmentColumn)}${rowNumber}&"|"&$${columnRef(brandColumn)}${rowNumber},${EQUIPMENT_MODEL_MAP_NAME},2,FALSE),"${EMPTY_LIST_NAME}"))`
      ],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: 'Modelos de la marca',
      prompt: 'Selecciona un modelo relacionado o escribe uno nuevo.'
    };

    worksheet.getCell(rowNumber, locationColumn).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `INDIRECT(IFERROR(VLOOKUP($${columnRef(siteColumn)}${rowNumber}&"|"&$${columnRef(areaColumn)}${rowNumber},${LOCATION_MAP_NAME},2,FALSE),"${EMPTY_LIST_NAME}"))`
      ],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Ubicación no permitida',
      error: 'Selecciona una ubicación asociada a la sede y al área de esta fila.',
      showInputMessage: true,
      promptTitle: 'Ubicaciones del área',
      prompt: 'La lista depende de la sede y del área seleccionadas.'
    };

    if (sanitaryRiskColumn && sanitaryRequiredColumn) worksheet.getCell(rowNumber, sanitaryRiskColumn).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `INDIRECT(IF($${columnRef(sanitaryRequiredColumn)}${rowNumber}="Sí","HV_RIESGOS_SANITARIOS","${EMPTY_LIST_NAME}"))`
      ],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Riesgo sanitario no aplicable',
      error: 'Solo puedes elegir una clasificación cuando Requiere riesgo sanitario sea Sí.',
      showInputMessage: true,
      promptTitle: 'Riesgo sanitario',
      prompt: 'Selecciona una clase únicamente si el equipo requiere clasificación sanitaria.'
    };

    if (electricalClassColumn && electricalRequiredColumn) worksheet.getCell(rowNumber, electricalClassColumn).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `INDIRECT(IF($${columnRef(electricalRequiredColumn)}${rowNumber}="Sí","HV_CLASES_ELECTRICAS","${EMPTY_LIST_NAME}"))`
      ],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Clase eléctrica no aplicable',
      error: 'Solo puedes elegir una clase cuando Requiere riesgo eléctrico sea Sí.',
      showInputMessage: true,
      promptTitle: 'Clase de protección eléctrica',
      prompt: 'Selecciona la clase de protección indicada por el fabricante.'
    };

    if (appliedPartColumn && electricalRequiredColumn) worksheet.getCell(rowNumber, appliedPartColumn).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `INDIRECT(IF($${columnRef(electricalRequiredColumn)}${rowNumber}="Sí","HV_TIPOS_PARTE_APLICADA","${EMPTY_LIST_NAME}"))`
      ],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Parte aplicada no aplicable',
      error: 'Solo puedes elegir un tipo cuando Requiere riesgo eléctrico sea Sí.',
      showInputMessage: true,
      promptTitle: 'Tipo de parte aplicada',
      prompt: 'Selecciona B, BF, CF o No aplica según la documentación del equipo.'
    };

    if (usefulLifeColumn) worksheet.getCell(rowNumber, usefulLifeColumn).dataValidation = {
      type: 'whole',
      operator: 'between',
      allowBlank: true,
      formulae: [0, 50],
      showErrorMessage: true,
      errorTitle: 'Vida útil no válida',
      error: 'Ingresa un número entre 0 y 50.'
    };

    if (calibrationFrequencyColumn && requiresCalibrationColumn) worksheet.getCell(rowNumber, calibrationFrequencyColumn).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `INDIRECT(IF($${columnRef(requiresCalibrationColumn)}${rowNumber}="Sí","HV_FRECUENCIAS","${EMPTY_LIST_NAME}"))`
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

  if (sanitaryRiskColumn && sanitaryRequiredColumn) worksheet.addConditionalFormatting({
    ref: `${columnRef(sanitaryRiskColumn)}2:${columnRef(sanitaryRiskColumn)}${options.maxRows + 1}`,
    rules: [{
      type: 'expression',
      priority: 1,
      formulae: [`$${columnRef(sanitaryRequiredColumn)}2<>"Sí"`],
      style: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } },
        font: { color: { argb: 'FF6B7280' } }
      }
    }]
  });

  if (electricalClassColumn && appliedPartColumn && electricalRequiredColumn) worksheet.addConditionalFormatting({
    ref: `${columnRef(electricalClassColumn)}2:${columnRef(appliedPartColumn)}${options.maxRows + 1}`,
    rules: [{
      type: 'expression',
      priority: 1,
      formulae: [`$${columnRef(electricalRequiredColumn)}2<>"Sí"`],
      style: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } },
        font: { color: { argb: 'FF6B7280' } }
      }
    }]
  });

  if (calibrationFrequencyColumn && requiresCalibrationColumn) worksheet.addConditionalFormatting({
    ref: `${columnRef(calibrationFrequencyColumn)}2:${columnRef(calibrationFrequencyColumn)}${options.maxRows + 1}`,
    rules: [{
      type: 'expression',
      priority: 1,
      formulae: [`$${columnRef(requiresCalibrationColumn)}2<>"Sí"`],
      style: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } },
        font: { color: { argb: 'FF6B7280' } }
      }
    }]
  });
}
