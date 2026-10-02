const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

export function spareInstallationDescription({ request, sourceReport, asset }) {
  const equipment = [asset?.code, asset?.name].filter(Boolean).join(' - ') || 'sin identificación registrada';
  const part = clean(sourceReport?.spare_parts_needed) || 'el repuesto pendiente';
  const preventive = (sourceReport?.type || request.type) === 'preventivo';
  const date = request.planned_date instanceof Date && Number.isFinite(request.planned_date.getTime())
    ? request.planned_date.toISOString() : String(request.planned_date || '');
  const match = date.match(/^(\d{4})-(\d{2})/);
  const month = match && months[Number(match[2]) - 1];
  const period = preventive && month ? ` correspondiente a ${month} de ${match[1]}` : ' anterior';
  return `Atención correctiva para instalar ${part} en el equipo ${equipment}. La necesidad del repuesto fue identificada durante el mantenimiento ${preventive ? 'preventivo' : 'correctivo'}${period}.`;
}

export function resolveSpareInstallationDescription({ value, request, correctionReport, sourceReport, asset, lifecycleAction }) {
  const eligible = correctionReport
    ? correctionReport.type === 'correctivo' && (Boolean(correctionReport.request_description) || correctionReport.spare_parts_status === 'recibido')
    : request.status === 'espera_repuesto' && lifecycleAction !== 'retire';
  if (!eligible) {
    if (value !== undefined) throw Object.assign(new Error('La descripción editable solo corresponde al correctivo de instalación de repuesto.'), { status: 400 });
    return null;
  }
  const supplied = value ?? correctionReport?.request_description ?? spareInstallationDescription({ request, sourceReport, asset });
  if ((value !== undefined && typeof value !== 'string') || typeof supplied !== 'string') {
    throw Object.assign(new Error('La descripción de la solicitud debe ser un texto.'), { status: 400 });
  }
  const result = supplied.replace(/\s+/g, ' ').trim();
  if (result.length < 10 || result.length > 2000) {
    throw Object.assign(new Error('La descripción de la solicitud debe tener entre 10 y 2000 caracteres.'), { status: 400 });
  }
  return result;
}
