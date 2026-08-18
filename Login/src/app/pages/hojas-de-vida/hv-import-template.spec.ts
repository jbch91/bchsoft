import { Workbook } from 'exceljs';
import { buildHvImportTemplate } from './hv-import-template';

describe('plantilla de importación de hojas de vida', () => {
  it('crea listas dependientes para ubicación, riesgos y calibración', async () => {
    const workbook = new Workbook();
    buildHvImportTemplate(workbook, {
      headers: [
        'Código*', 'Nombre*', 'Marca*', 'Modelo*', 'Serie*', 'Sede*', 'Área*',
        'Ubicación*', 'Registro Invima*', 'Requiere riesgo sanitario*',
        'Clasificación riesgo sanitario', 'Requiere riesgo eléctrico*',
        'Clase protección eléctrica', 'Tipo parte aplicada', 'Fabricante', 'Tipo equipo',
        'Forma adquisición', 'Fecha adquisición', 'Vida útil años', 'Garantía años',
        'Proveedor', 'Teléfono proveedor', 'Correo proveedor', 'Frecuencia mantenimiento',
        'Requiere calibración', 'Frecuencia calibración'
      ],
      sites: [
        { id: 'site-1', name: 'Sede Central' },
        { id: 'site-2', name: 'Sede Norte' }
      ],
      areas: [
        { id: 'area-1', name: 'Urgencias', siteId: 'site-1' },
        { id: 'area-2', name: 'Laboratorio', siteId: 'site-1' },
        { id: 'area-3', name: 'Urgencias', siteId: 'site-2' }
      ],
      locations: [
        { id: 'loc-1', name: 'Sala 1', areaId: 'area-1' },
        { id: 'loc-2', name: 'Sala 2', areaId: 'area-1' },
        { id: 'loc-3', name: 'Toma de muestras', areaId: 'area-2' },
        { id: 'loc-4', name: 'Observación', areaId: 'area-3' }
      ],
      equipmentCatalog: [
        {
          id: 'equipment-1',
          name: 'Monitor de signos vitales',
          brands: [
            {
              id: 'brand-1',
              name: 'Mindray',
              models: [
                { id: 'model-1', name: 'BeneVision N12' },
                { id: 'model-2', name: 'uMEC 12' }
              ]
            }
          ]
        }
      ],
      sanitaryRiskClasses: ['Clase I', 'Clase IIA', 'Clase IIB', 'Clase III'],
      electricalProtectionClasses: ['Clase I', 'Clase II', 'Energizado internamente'],
      appliedPartTypes: ['No aplica', 'Tipo B', 'Tipo BF', 'Tipo CF'],
      frequencies: ['mensual', 'trimestral', 'anual'],
      acquisitionTypes: ['COMPRA DIRECTA', 'DONACION'],
      equipmentTypes: ['Fijo', 'Móvil'],
      warrantyOptions: [1, 2, 3],
      maxRows: 500
    });

    const sheet = workbook.getWorksheet('Hojas de vida')!;
    const catalog = workbook.getWorksheet('Catalogos')!;
    const equipmentCatalog = workbook.getWorksheet('CatalogoEquipos')!;
    const brandFormula = String(sheet.getCell('C2').dataValidation.formulae[0]);
    const modelFormula = String(sheet.getCell('D2').dataValidation.formulae[0]);
    const locationFormula = String(sheet.getCell('H2').dataValidation.formulae[0]);
    const sanitaryRiskFormula = String(sheet.getCell('K2').dataValidation.formulae[0]);
    const electricalClassFormula = String(sheet.getCell('M2').dataValidation.formulae[0]);
    const appliedPartFormula = String(sheet.getCell('N2').dataValidation.formulae[0]);
    const calibrationFormula = String(sheet.getCell('Z2').dataValidation.formulae[0]);

    expect(locationFormula).toContain('$F2&"|"&$G2');
    expect(locationFormula).toContain('HV_MAPA_UBICACIONES');
    expect(workbook.definedNames.getRanges('HV_MAPA_UBICACIONES').ranges).toEqual([
      'Catalogos!$L$2:$M$4'
    ]);
    expect(sanitaryRiskFormula).toContain('$J2="Sí"');
    expect(sanitaryRiskFormula).toContain('HV_RIESGOS_SANITARIOS');
    expect(electricalClassFormula).toContain('$L2="Sí"');
    expect(electricalClassFormula).toContain('HV_CLASES_ELECTRICAS');
    expect(appliedPartFormula).toContain('HV_TIPOS_PARTE_APLICADA');
    expect(calibrationFormula).toContain('$Y2="Sí"');
    expect(String(sheet.getCell('Z2').value ?? '')).toBe('');
    expect(sheet.getCell('J2').value).toBe('Sí');
    expect(sheet.getCell('K2').value).toBe('Clase IIA');
    expect(sheet.getCell('L2').value).toBe('Sí');
    expect(sheet.getCell('M2').value).toBe('Clase I');
    expect(sheet.getCell('N2').value).toBe('Tipo BF');
    expect(sheet.getCell('B2').dataValidation.formulae[0]).toBe('HV_EQUIPOS');
    expect(sheet.getCell('B2').dataValidation.showErrorMessage).toBe(false);
    expect(brandFormula).toContain('$B2');
    expect(brandFormula).toContain('HV_MAPA_MARCAS');
    expect(modelFormula).toContain('$B2&"|"&$C2');
    expect(modelFormula).toContain('HV_MAPA_MODELOS');
    expect(equipmentCatalog.state).toBe('hidden');
    expect(equipmentCatalog.getCell('A2').value).toBe('MONITOR DE SIGNOS VITALES');
    expect(workbook.definedNames.getRanges('HV_MAPA_MARCAS').ranges).toEqual([
      'CatalogoEquipos!$B$2:$C$2'
    ]);
    expect(workbook.definedNames.getRanges('HV_MAPA_MODELOS').ranges).toEqual([
      'CatalogoEquipos!$D$2:$E$2'
    ]);

    const mappingRow = [2, 3, 4].find(
      (rowNumber) => catalog.getCell(rowNumber, 12).value === 'Sede Central|Urgencias'
    )!;
    const locationListName = String(catalog.getCell(mappingRow, 13).value);
    const locationColumn = Array.from({ length: catalog.columnCount - 14 }, (_, index) => index + 15)
      .find((columnNumber) => catalog.getCell(1, columnNumber).value === locationListName)!;

    expect(catalog.getCell(2, locationColumn).value).toBe('Sala 1');
    expect(catalog.getCell(3, locationColumn).value).toBe('Sala 2');
    expect(catalog.getCell(4, locationColumn).value).toBeNull();
    expect(workbook.definedNames.getRanges(locationListName).ranges).toEqual([
      `Catalogos!$${catalog.getColumn(locationColumn).letter}$2:$${catalog.getColumn(locationColumn).letter}$3`
    ]);

    const buffer = await workbook.xlsx.writeBuffer();
    const reopened = new Workbook();
    await reopened.xlsx.load(buffer);
    expect(reopened.getWorksheet('Hojas de vida')?.getCell('H2').dataValidation.type).toBe('list');
    expect(reopened.getWorksheet('Hojas de vida')?.getCell('K2').dataValidation.type).toBe('list');
    expect(reopened.getWorksheet('Hojas de vida')?.getCell('M2').dataValidation.type).toBe('list');
    expect(reopened.getWorksheet('Hojas de vida')?.getCell('N2').dataValidation.type).toBe('list');
    expect(reopened.getWorksheet('Hojas de vida')?.getCell('B2').value).toBe('MONITOR DE SIGNOS VITALES');
    expect(reopened.getWorksheet('Hojas de vida')?.getCell('C2').value).toBe('MINDRAY');
    expect(reopened.getWorksheet('Hojas de vida')?.getCell('D2').value).toBe('BENEVISION N12');
    expect(reopened.getWorksheet('Instrucciones')?.getCell('B5').value).toContain('MAYÚSCULAS');
    expect(reopened.getWorksheet('Instrucciones')?.getCell('B7').value).toContain('NR');
  });
});
