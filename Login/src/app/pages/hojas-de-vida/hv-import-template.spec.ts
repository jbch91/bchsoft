import { Workbook } from 'exceljs';
import { buildHvImportTemplate } from './hv-import-template';

describe('plantilla de importación de hojas de vida', () => {
  it('crea listas de ubicaciones por sede y área y condiciona la calibración', async () => {
    const workbook = new Workbook();
    buildHvImportTemplate(workbook, {
      headers: [
        'Código*', 'Nombre*', 'Marca*', 'Modelo*', 'Serie*', 'Sede*', 'Área*',
        'Ubicación*', 'Registro Invima*', 'Riesgo*', 'Fabricante', 'Tipo equipo',
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
      riskClasses: ['Clase I', 'Clase IIA'],
      frequencies: ['mensual', 'trimestral', 'anual'],
      acquisitionTypes: ['COMPRA DIRECTA', 'DONACION'],
      equipmentTypes: ['Fijo', 'Móvil'],
      warrantyOptions: [1, 2, 3],
      maxRows: 500
    });

    const sheet = workbook.getWorksheet('Hojas de vida')!;
    const catalog = workbook.getWorksheet('Catalogos')!;
    const locationFormula = String(sheet.getCell('H2').dataValidation.formulae[0]);
    const calibrationFormula = String(sheet.getCell('V2').dataValidation.formulae[0]);

    expect(locationFormula).toContain('$F2&"|"&$G2');
    expect(locationFormula).toContain('HV_MAPA_UBICACIONES');
    expect(workbook.definedNames.getRanges('HV_MAPA_UBICACIONES').ranges).toEqual([
      'Catalogos!$J$2:$K$4'
    ]);
    expect(calibrationFormula).toContain('$U2="Sí"');
    expect(String(sheet.getCell('V2').value ?? '')).toBe('');

    const mappingRow = [2, 3, 4].find(
      (rowNumber) => catalog.getCell(rowNumber, 10).value === 'Sede Central|Urgencias'
    )!;
    const locationListName = String(catalog.getCell(mappingRow, 11).value);
    const locationColumn = Array.from({ length: catalog.columnCount - 12 }, (_, index) => index + 13)
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
    expect(reopened.getWorksheet('Instrucciones')?.getCell('B6').value).toContain('NR');
  });
});
