export interface CorrectiveNarrativeOption {
  id: string;
  label: string;
  text: string;
  exclusive?: boolean;
}

export const CORRECTIVE_SUMMARY_OPTIONS: readonly CorrectiveNarrativeOption[] = [
  { id: 'revision_falla', label: 'Revisión por falla', text: 'Se realizó una revisión técnica por la falla reportada.' },
  { id: 'diagnostico', label: 'Diagnóstico técnico', text: 'Se evaluó el funcionamiento del equipo para identificar la condición reportada.' },
  { id: 'reparacion', label: 'Intervención correctiva', text: 'Se realizó una intervención correctiva sobre el equipo.' },
  { id: 'verificacion', label: 'Verificación posterior', text: 'Se verificó la respuesta del equipo después de la intervención.' }
];

export const CORRECTIVE_FINDING_OPTIONS: readonly CorrectiveNarrativeOption[] = [
  { id: 'no_reproducida', label: 'Falla no reproducida', text: 'La falla informada no se reprodujo durante la revisión realizada.', exclusive: true },
  { id: 'alimentacion', label: 'Alimentación o conexión', text: 'Se identificó una anomalía en la alimentación o en las conexiones del equipo.' },
  { id: 'accesorio', label: 'Accesorio deteriorado', text: 'Se encontró un accesorio deteriorado o sin funcionamiento.' },
  { id: 'bateria', label: 'Batería con bajo desempeño', text: 'La batería presentó autonomía reducida o desempeño irregular.' },
  { id: 'componente', label: 'Componente defectuoso', text: 'Se identificó un componente defectuoso que requiere intervención.' },
  { id: 'intermitente', label: 'Falla intermitente', text: 'Se observó un comportamiento intermitente durante la revisión.' },
  { id: 'configuracion', label: 'Configuración alterada', text: 'Se identificó una configuración que afectaba el funcionamiento esperado.' },
  { id: 'dano_fisico', label: 'Daño físico o mecánico', text: 'Se observó daño físico o mecánico en el equipo.' }
];

export const CORRECTIVE_ACTION_OPTIONS: readonly CorrectiveNarrativeOption[] = [
  { id: 'conexiones', label: 'Ajuste de conexiones', text: 'Se ajustaron las conexiones y los elementos de fijación intervenidos.' },
  { id: 'componente', label: 'Reparación de componente', text: 'Se realizó la reparación del componente afectado.' },
  { id: 'configuracion', label: 'Ajuste de configuración', text: 'Se corrigió la configuración relacionada con la falla reportada.' },
  { id: 'pruebas', label: 'Pruebas posteriores', text: 'Se realizaron las pruebas funcionales seleccionadas en este reporte.' },
  { id: 'informar', label: 'Resultado informado al área', text: 'Se informó al responsable del área el resultado de la intervención.' },
  { id: 'recomendaciones', label: 'Recomendaciones de uso', text: 'Se comunicaron recomendaciones de uso y cuidado del equipo.' },
  { id: 'especializado', label: 'Revisión especializada', text: 'Se recomendó una revisión especializada para continuar el diagnóstico.' },
  { id: 'retiro', label: 'Retiro temporal del servicio', text: 'El equipo quedó identificado y retirado temporalmente del servicio.' }
];

export const CORRECTIVE_OBSERVATION_OPTIONS: readonly CorrectiveNarrativeOption[] = [
  { id: 'seguimiento', label: 'Seguimiento de la intervención', text: 'Se requiere seguimiento técnico de la condición intervenida.' },
  { id: 'intermitente', label: 'Vigilar falla intermitente', text: 'Se debe vigilar la posible recurrencia de la falla reportada.' },
  { id: 'restriccion', label: 'Restricción informada', text: 'El equipo presenta una restricción de uso que fue informada al responsable del área.' },
  { id: 'complementaria', label: 'Intervención complementaria', text: 'Se requiere una intervención complementaria para resolver la condición pendiente.' }
];

export const CORRECTIVE_NARRATIVE_FIELDS = [
  { key: 'summary', title: 'Resumen de la atención', options: CORRECTIVE_SUMMARY_OPTIONS, section: 'attention' },
  { key: 'findings', title: 'Hallazgos y diagnóstico', options: CORRECTIVE_FINDING_OPTIONS, section: 'attention' },
  { key: 'actions', title: 'Trabajo realizado y recomendaciones', options: CORRECTIVE_ACTION_OPTIONS, section: 'intervention' }
] as const;
