import { describe, expect, it } from 'vitest';
import { automaticSoftwareSuiteKey } from './software-suite-navigation';

describe('automaticSoftwareSuiteKey', () => {
  it('abre directamente el único software habilitado', () => {
    expect(automaticSoftwareSuiteKey([
      { key: 'biomedico', enabled: true },
      { key: 'odontologico', enabled: false }
    ])).toBe('biomedico');
  });

  it('mantiene el selector cuando hay varios softwares habilitados', () => {
    expect(automaticSoftwareSuiteKey([
      { key: 'biomedico', enabled: true },
      { key: 'odontologico', enabled: true }
    ])).toBeNull();
  });

  it('no selecciona software cuando ninguno está habilitado', () => {
    expect(automaticSoftwareSuiteKey([
      { key: 'biomedico', enabled: false }
    ])).toBeNull();
  });
});
