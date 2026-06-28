# Software Odontologico - Fase 1

## Objetivo
Construir el software odontologico como producto integrado dentro de INBIHOSPITALARIO, con login unico, activacion por cliente, permisos por rol, seguridad clinica, trazabilidad y base lista para venta profesional.

## Alcance Principal
La fase 1 se construira por fases internas, priorizando una base clinica robusta:

- Pacientes.
- Agenda completa.
- Historia clinica odontologica.
- Odontograma grafico interactivo.
- Consentimientos informados.
- Firmas digitales.
- Adjuntos clinicos y administrativos.
- Configuracion odontologica por cliente.
- Tablero odontologico inicial.

## Reglas Generales

- El software odontologico puede venderse independiente del software biomedico.
- Usa el mismo login de INBIHOSPITALARIO.
- El cliente debe tener activado el software odontologico para verlo y usarlo.
- El acceso depende de licencia, cliente, rol y permisos.
- El superusuario puede activar/desactivar el software odontologico por cliente.
- Las sedes son opcionales por cliente.
- La interfaz debe mantener estilo claro INBI.
- El sistema debe funcionar en computador, tablet y movil.

## Roles Iniciales

- Odontologo.
- Auxiliar de odontologia.
- Recepcion / admisiones.
- Administrador odontologico.
- Auditor clinico.

## Seguridad y Bloqueos Clinicos

- Una atencion firmada queda bloqueada definitivamente.
- Las correcciones despues de firma se hacen mediante nota aclaratoria.
- Las notas aclaratorias deben guardar usuario, fecha, motivo y firma si aplica.
- Los permisos temporales aplican para acciones sensibles.
- Se auditan descargas, exportaciones y generacion de documentos importantes.
- La informacion clinica no debe ser visible para recepcion, salvo datos administrativos permitidos.

## Pacientes

### Campos Obligatorios Iniciales

- Tipo de documento.
- Numero de documento.
- Nombre completo.
- Fecha de nacimiento.
- Sexo.
- Telefono.
- Correo.
- Direccion.
- Contacto de emergencia.

### Reglas

- Codigo interno automatico por cliente.
- Validacion de duplicados por tipo y numero de documento dentro del mismo cliente.
- Edad calculada automaticamente.
- Si el paciente es menor de edad, acudiente obligatorio.
- Paciente puede ser particular, EPS, aseguradora, convenio u otro.
- Autorizaciones configurables por cliente/convenio.
- Estado del paciente configurable: activo, inactivo, archivado, fallecido, bloqueado administrativo y otros.
- Bloqueo administrativo puede impedir agenda o atencion segun configuracion.

## Alertas Clinicas

Alertas iniciales:

- Alergias.
- Enfermedades sistemicas.
- Medicamentos actuales.
- Embarazo.
- Riesgo de sangrado.
- Diabetes.
- Hipertension.
- Marcapasos.
- Observacion importante.

Regla: las alertas deben mostrarse antes de iniciar atencion.

## Agenda

### Alcance

- Agenda desde primera version.
- Citas por sede, odontologo y sillon/unidad odontologica.
- Sedes opcionales.
- Unidades/sillones configurables por sede.
- Horario configurable por odontologo.
- Duracion configurable por tipo de procedimiento.

### Bloqueos

- Bloqueo obligatorio de conflictos.
- No permitir doble agenda del odontologo.
- No permitir doble uso de unidad/sillon.
- No permitir citas fuera del horario configurado.
- Integracion con biomedico para bloquear unidad fuera de servicio si el cliente lo activa.

### Estados

- Programada.
- Confirmada.
- En sala / llegada.
- En atencion.
- Atendida.
- Cancelada.
- No asistio.
- Reprogramada.

### Recordatorios

- Correo y WhatsApp.
- Un dia antes.
- El mismo dia.
- Evitar duplicados.
- Registrar envio.

Estado implementado:

- La agenda permite enviar recordatorio por correo desde cada cita con correo registrado.
- Cada intento queda almacenado en `odontology_appointment_reminders` como enviado o fallido.
- La tabla ya incluye canal `email` y `whatsapp`, correo, telefono, asunto, mensaje y estado para conectar WhatsApp despues sin redisenar la trazabilidad.
- El backend ejecuta recordatorios automaticos cada 30 minutos para citas de manana y del mismo dia.
- Los recordatorios automaticos usan `reminder_kind` para evitar duplicados por cita/canal/tipo.
- La agenda muestra un panel de historial del periodo con total, enviados, fallidos, destinatario, tipo y error si aplica.
- En configuracion odontologica se puede preparar WhatsApp por cliente: proveedor, numero empresarial y plantillas de dia anterior/mismo dia. Aun no envia mensajes por WhatsApp hasta conectar proveedor oficial.
- El backend tiene adaptador WhatsApp en modo `dry-run`: si el cliente activa WhatsApp, se registra el recordatorio como canal `whatsapp` y se imprime en consola sin consumir API real. Variable: `ODONTOLOGY_WHATSAPP_MODE=dry-run`.
- La agenda muestra boton manual `Recordar WhatsApp` cuando el cliente tiene WhatsApp preparado y el paciente tiene telefono.
- El historial de recordatorios tiene filtros por canal, estado, tipo y busqueda por paciente/documento/destino.

## Historia Clinica

### Secciones Iniciales

- Motivo de consulta.
- Enfermedad actual.
- Antecedentes medicos.
- Antecedentes odontologicos.
- Antecedentes familiares.
- Medicamentos actuales.
- Alergias.
- Habitos.
- Examen extraoral.
- Examen intraoral.
- Diagnostico con codigos y texto libre.
- Plan de manejo configurable como obligatorio u opcional.

### Firma

- Firma del odontologo con la firma digital del usuario.
- Paciente/acudiente puede firmar en pantalla, subir imagen o firmar desde tableta.
- Atencion firmada se bloquea.
- PDF de atencion configurable: automatico al firmar o bajo demanda.

## Odontograma

- Grafico interactivo desde primera version.
- Denticion permanente, temporal y mixta segun edad.
- Marca por superficie y por diente completo.
- Historial completo por fecha.
- Comparacion futura entre estado anterior y actual.
- Condiciones base editables por cliente.

Condiciones base:

- Sano.
- Caries.
- Restauracion.
- Ausente.
- Extraccion indicada.
- Endodoncia.
- Corona.
- Implante.
- Fractura.
- Sellante.
- Protesis.
- Movilidad.
- Dolor.
- Observacion.

## Consentimientos

- Consentimientos por procedimiento.
- Plantillas editables por administrador odontologico.
- Variables automaticas: paciente, documento, procedimiento, odontologo, fecha, acudiente, cliente y sede.
- Firma paciente/acudiente y odontologo.
- PDF firmado guardado en historia.
- Consentimientos ya firmados no cambian si la plantilla se edita.
- Consentimiento de tratamiento de datos personales desde fase 1.
- Formatos en blanco solo para consentimientos.

## Adjuntos

- Adjuntos por paciente y por atencion.
- Soporta PDF e imagenes.
- Radiografias, fotos intraorales, cedula, autorizaciones y documentos clinicos.
- Debe guardar fecha, usuario, tipo y origen.
- Visor de imagenes con vista previa y zoom.
- Categorias fotograficas configurables por cliente.

## Planes de Tratamiento y Pagos

- Planes de tratamiento con costos desde primera version.
- Estados: propuesto, aceptado, en proceso, terminado, suspendido, rechazado por paciente.
- Aceptacion con firma configurable por cliente.
- Presupuesto en PDF.
- Pagos y abonos por plan de tratamiento.
- Control interno de pagos y recibos, sin facturacion electronica inicial.
- Pagos visibles solo para administracion/recepcion segun permisos.

## Periodontograma

- Completo desde primera version.
- Seis puntos por diente.
- Historial por fecha.
- Datos como sondaje, sangrado, movilidad, placa/calculo y recesion/nivel de insercion si aplica.

## Recetas, Certificados e Incapacidades

- Recetas con medicamento, dosis, frecuencia, duracion, indicaciones y PDF.
- Catalogo base de medicamentos editable por cliente.
- Certificados e incapacidades odontologicas en PDF.
- Documentos guardados en historial del paciente.

## Inventario Odontologico

- Inventario desde primera version.
- Insumos y materiales.
- Entradas, salidas y stock bajo.
- Descuento automatico por procedimiento usando kits/insumos configurados.
- Ajuste manual permitido.
- Proveedores y ordenes de compra configurables.

## Esterilizacion

- Trazabilidad completa de esterilizacion.
- Instrumental, ciclos, lotes, responsable, fecha/hora.
- Asociacion a atencion/procedimiento si aplica.

## Reportes y Exportacion

Reportes iniciales configurables:

- Pacientes creados.
- Citas por fecha/sede/odontologo.
- Citas canceladas/no asistidas.
- Atenciones realizadas.
- Historias firmadas y pendientes de firma.
- Procedimientos realizados.
- Planes de tratamiento por estado.
- Consentimientos firmados.
- Produccion por odontologo.

Exportacion:

- Excel.
- PDF.
- Respetando permisos.
- Con logo y datos del cliente.

## Importaciones

- Importacion masiva de pacientes desde Excel.
- Plantilla validada.
- Errores claros y archivo de errores.
- Importacion de procedimientos, medicamentos y catalogos desde Excel.

## Tablero y Navegacion

- Tablero odontologico completo.
- Indicadores por rol.
- Busqueda global.
- Linea de tiempo completa del paciente.
- Pantalla inicial configurable por usuario.

## Integraciones

- Biomedico: bloqueo configurable de unidad fuera de servicio.
- Laboratorio: odontologo puede generar orden de laboratorio si ambos softwares estan activos.
- Portal paciente configurable, sin firma de consentimientos desde portal en fase inicial.
- Teleconsulta configurable.

## Fase 1 Tecnica Recomendada

Orden de programacion:

1. Base de datos y permisos.
2. Configuracion odontologica por cliente.
3. Pantalla principal odontologica con submodulos.
4. Pacientes.
5. Agenda.
6. Historia clinica.
7. Odontograma.
8. Consentimientos.
9. Adjuntos.
10. Firmas y PDFs.

## Avance Implementado

### Base Plataforma

- Se creo el documento funcional de fase 1 dentro del proyecto.
- Se agrego el software odontologico como suite independiente dentro de INBIHOSPITALARIO.
- Se agrego el modulo `odontologia` ligado a la suite odontologica.
- Se agregaron permisos base para acceder, configurar, importar pacientes, manejar agenda, odontograma, consentimientos, adjuntos, planes de tratamiento, pagos y reportes.
- Se agregaron roles odontologicos iniciales: odontologo, auxiliar de odontologia, recepcion odontologica, administrador odontologico y auditor odontologico.

### Base Tecnica Odontologica

- Se creo migracion `odontology_base.sql` con configuracion odontologica por cliente.
- Se crearon tablas para sedes odontologicas, unidades/sillones, tipos de procedimiento y catalogos configurables.
- Se sembraron procedimientos iniciales y estados base para pacientes, citas y odontograma.
- Se creo servicio backend odontologico con validacion de licencia, cliente, rol y permisos.
- Se expuso API inicial para tablero, configuracion, sedes, unidades, procedimientos y catalogos.
- Se creo pantalla inicial del modulo Odontologia con tablero, pestañas y resumen de configuracion.

### Siguiente Paso

- Crear submodulo de pacientes con validaciones, acudiente para menores, alertas clinicas y busqueda.

### Pacientes - Primer Bloque Funcional

- Se creo tabla de pacientes odontologicos por cliente.
- Se agrego codigo interno automatico por cliente con consecutivo `ODO-00001`.
- Se agrego validacion de duplicados por cliente, tipo y numero de documento.
- Se agregaron campos obligatorios administrativos: documento, nombre, nacimiento, sexo, telefono, correo, direccion y contacto de emergencia.
- Se agrego validacion de acudiente obligatorio para menores de edad.
- Se agregaron campos de EPS/convenio/aseguradora, autorizacion y estado configurable.
- Se agregaron alertas clinicas iniciales: alergias, antecedentes, medicamentos, embarazo, riesgo de sangrado, diabetes, hipertension, marcapasos y observacion importante.
- Se agrego API para listar, crear, consultar y editar pacientes.
- Se agrego auditoria automatica para creacion y edicion de pacientes.
- Se agrego interfaz inicial en el submodulo Pacientes con buscador, filtro por estado, tabla responsive y formulario de creacion/edicion.

### Agenda Odontologica - Primer Bloque Funcional

- Se creo tabla de citas odontologicas por cliente.
- Cada cita queda ligada a paciente, odontologo, procedimiento, fecha, hora, duracion, estado, sede y unidad/sillon si aplica.
- Se agrego API para listar odontologos activos del cliente con rol odontologico.
- Se agrego API para listar, crear y editar citas.
- Se agrego bloqueo de cruces de horario para el odontologo.
- Se agrego bloqueo de cruces de horario para la unidad odontologica cuando se selecciona una.
- Se agrego filtro de agenda por fecha, estado, odontologo y busqueda por paciente/procedimiento.
- Se agrego interfaz inicial en el submodulo Agenda para crear y editar citas.
- El tablero odontologico ahora cuenta las citas activas del dia.
- Se agrego auditoria automatica para creacion y edicion de citas.

### Configuracion Odontologica - Sedes y Unidades

- Se agrego administracion de sedes odontologicas desde el submodulo Configuracion.
- Se agrego administracion de unidades/sillones odontologicos desde el submodulo Configuracion.
- Las unidades pueden quedar asociadas a una sede o manejarse sin sede cuando el cliente no lo requiere.
- Las sedes y unidades pueden activarse o desactivarse sin eliminar historial.
- La agenda utiliza estas unidades para evitar cruces de horario.
- Se agrego auditoria automatica para creacion y edicion de sedes y unidades.

### Historia Clinica Odontologica - Primer Bloque Funcional

- Se creo tabla de historias clinicas odontologicas por cliente y paciente.
- La historia puede asociarse opcionalmente a una cita odontologica.
- Se agregaron campos iniciales: motivo de consulta, enfermedad actual, antecedentes medicos, odontologicos, familiares, medicamentos, alergias, habitos, examen extraoral, examen intraoral, diagnostico, plan de manejo y notas clinicas.
- Las historias se crean y editan como borrador.
- Se agrego firma/bloqueo: al firmar, la historia queda en estado firmada y ya no puede editarse.
- Se valida diagnostico y plan antes de firmar segun la configuracion odontologica del cliente.
- Se agrego listado con filtros por paciente, estado y busqueda.
- Se agrego auditoria automatica para creacion, edicion y firma de historia clinica.
- El tablero odontologico ahora cuenta historias pendientes de firma.

### Odontograma - Primer Bloque Funcional

- Se creo tabla de entradas de odontograma por cliente y paciente.
- Se soporta denticion permanente, temporal y mixta.
- Se agrego seleccion inicial por diente completo con condicion, fecha y nota.
- El odontograma muestra el ultimo estado guardado para cada diente.
- Se conserva historial por fecha y usuario para trazabilidad.
- Las condiciones se toman del catalogo configurable de odontograma.
- Se agrego interfaz inicial dentro de Historia y odontograma con subpestanas: Historias clinicas y Odontograma.
- Se agrego auditoria automatica al registrar condiciones del odontograma.

### Consentimientos Odontologicos - Primer Bloque Funcional

- Se creo migracion `odontology_consents.sql` para plantillas de consentimiento y consentimientos firmados por paciente.
- Se agrego plantilla inicial general por cliente con variables automaticas.
- Se soportan variables en plantillas: `{{patient_name}}`, `{{patient_document}}`, `{{signer_name}}`, `{{signer_document}}`, `{{procedure_name}}` y `{{date}}`.
- Se agrego API para listar, crear y editar plantillas de consentimiento.
- Se agrego API para crear consentimientos de pacientes, firmarlos y generar PDF automaticamente.
- Los consentimientos se manejan como borrador hasta que se firman; al firmar quedan bloqueados y con archivo PDF almacenado.
- Se agrego interfaz de consentimiento con dos subpestanas: consentimientos de pacientes y plantillas.
- Se agregaron filtros por paciente, estado y busqueda.
- Se agrego auditoria automatica para crear/editar plantillas, crear consentimientos y firmarlos.

### Planes de Tratamiento - Primer Bloque Funcional

- Se creo migracion `odontology_treatment_plans.sql` para planes de tratamiento y procedimientos asociados.
- Cada plan queda ligado a cliente, paciente y opcionalmente a una historia clinica.
- Se agregaron estados del plan: borrador, propuesto, aceptado, en tratamiento, completado y cancelado.
- Cada plan puede tener multiples procedimientos con diente/zona, descripcion, cantidad, valor unitario, sesiones estimadas y estado del item.
- El total del plan se calcula automaticamente desde los procedimientos.
- Se agrego API para listar, consultar, crear y editar planes de tratamiento.
- Se agrego auditoria automatica para creacion y edicion de planes.
- El tablero odontologico ahora cuenta planes activos no completados/cancelados.
- Se agrego pestaña principal `Planes de tratamiento` en el modulo odontologico con buscador, filtros y formulario responsive.

### Adjuntos Odontologicos - Primer Bloque Funcional

- Se creo migracion `odontology_attachments.sql` para almacenar adjuntos por paciente.
- Los adjuntos pueden asociarse opcionalmente a historia clinica o plan de tratamiento.
- Se soportan categorias: radiografia, autorizacion, remision, laboratorio, formula, foto clinica, documento externo y otro.
- Se permite cargar PDF, JPG, PNG y WEBP con limite inicial de 15 MB.
- Se agrego API para listar, subir y eliminar adjuntos odontologicos.
- Se agrego auditoria automatica para carga y eliminacion de adjuntos.
- Se agrego pestaña principal `Adjuntos` en odontologia con filtros por paciente, categoria y busqueda.
- Se habilito vista directa del archivo cargado desde el listado.

### Pagos Odontologicos - Primer Bloque Funcional

- Se creo migracion `odontology_payments.sql` para registrar pagos y abonos odontologicos.
- Cada pago queda ligado a cliente y paciente, y opcionalmente a un plan de tratamiento.
- Se soportan metodos iniciales: efectivo, transferencia, tarjeta credito, tarjeta debito, Nequi, Daviplata, cheque y otro.
- Se agrego estado de pago registrado/anulado con motivo de anulacion y usuario responsable.
- Los planes de tratamiento ahora exponen valor pagado y saldo pendiente calculado desde pagos registrados.
- Se agrego API para listar pagos, registrar pagos y anular pagos.
- Se agrego auditoria automatica al registrar y anular pagos.
- Se agrego pestana principal `Pagos` en odontologia con filtros por paciente, estado y busqueda.
- El tablero odontologico muestra pagos registrados del dia.
- Se agrego recibo PDF de pago con logo del cliente, datos del paciente, concepto, metodo, referencia, valor, estado y detalle de anulacion cuando aplique.
- Se agrego reporte PDF de pagos por cajero/usuario con filtros de fecha, paciente, estado, busqueda y usuario, incluyendo resumen por cajero y detalle de pagos.

### Reportes Odontologicos - Primer Bloque Funcional

- Se agrego API de reportes odontologicos por cliente y rango de fechas.
- El reporte consolida pacientes nuevos, citas, citas atendidas, citas canceladas/no asistio, historias clinicas, consentimientos, adjuntos, planes de tratamiento y pagos.
- Se agregaron agrupaciones por estado de cita, estado de historia clinica, estado de consentimiento, estado de plan de tratamiento, procedimientos principales y pagos por metodo.
- Se agrego permiso de visualizacion de reportes odontologicos con acceso tambien para superusuario y roles clinicos/financieros autorizados.
- Se agrego pestana `Reportes` en el modulo Odontologia con filtros de fecha, tarjetas resumidas y listados compactos.
- Se agrego exportacion CSV del reporte para analisis externo en Excel.

### Recetas Odontologicas - Primer Bloque Funcional

- Se creo migracion `odontology_prescriptions.sql` para medicamentos base, recetas y medicamentos formulados por receta.
- Se agrego permiso `odontology:prescriptions:manage` para controlar quien puede crear y ver recetas odontologicas.
- Se agrego catalogo inicial de medicamentos frecuentes, editable por cliente desde el flujo de recetas.
- Cada receta queda ligada a cliente, paciente, usuario emisor y opcionalmente a una historia clinica o cita.
- Cada receta puede incluir multiples medicamentos con dosis, frecuencia, duracion, cantidad e indicaciones.
- Al guardar una receta se genera automaticamente un PDF con datos del paciente, medicamentos, indicaciones y responsable.
- Se agrego API para listar medicamentos, crear medicamentos, listar recetas y crear recetas con PDF.
- Se agrego pestana `Recetas` en Odontologia con filtros, formulario responsive, catalogo de medicamentos y visor PDF.
- Se agrego auditoria automatica al crear medicamentos y recetas.

### Documentos Clinicos Odontologicos - Primer Bloque Funcional

- Se creo migracion `odontology_clinical_documents.sql` para certificados, incapacidades, constancias, remisiones y otros documentos clinicos.
- Se agrego permiso `odontology:documents:manage` para controlar quien puede generar documentos clinicos odontologicos.
- Cada documento queda ligado a cliente, paciente, usuario emisor y opcionalmente a historia clinica o cita.
- Los documentos soportan tipo, titulo, fecha, contenido, recomendaciones y campos especiales para incapacidad: fecha inicial, fecha final y dias.
- Al guardar un documento se genera automaticamente un PDF con datos del paciente, contenido, periodo si aplica y responsable.
- Se agrego API para listar y crear documentos clinicos con PDF.
- Se agrego pestana `Documentos` en Odontologia con filtros, formulario responsive y visor PDF.
- Se agrego auditoria automatica al crear documentos clinicos.

### Periodontograma - Primer Bloque Funcional

- Se creo migracion `odontology_periodontograms.sql` para periodontogramas y mediciones periodontales por diente.
- Se agrego permiso `odontology:periodontogram:manage` para controlar quien puede crear y consultar periodontogramas.
- Cada periodontograma queda ligado a cliente, paciente, usuario responsable y opcionalmente a historia clinica.
- Se soporta denticion permanente, temporal y mixta con generacion automatica de los dientes a diligenciar.
- Cada diente permite registrar sondaje y recesion en seis puntos: MB, B, DB, ML, L y DL.
- Se agregan hallazgos de sangrado por punto, placa, calculo, movilidad, furca y notas por diente.
- Se agrego API para listar, consultar detalle y crear periodontogramas.
- Se agrego subpestana `Periodontograma` dentro de Historia y odontograma con filtros, listado, detalle y formulario responsive.
- Se agrego auditoria automatica al crear periodontogramas.

### Inventario Odontologico - Primer Bloque Funcional

- Se creo migracion `odontology_inventory.sql` para insumos odontologicos y movimientos de inventario.
- Se agrego permiso `odontology:inventory:manage` para controlar acceso al inventario odontologico.
- Cada insumo queda ligado a cliente y maneja codigo, nombre, categoria, presentacion, unidad, marca, proveedor, stock minimo, stock actual, costo unitario, estado y notas.
- Se agregaron movimientos de inventario por entrada, salida y ajuste fisico con fecha, cantidad, referencia, motivo, costo unitario y stock posterior.
- Las salidas validan stock suficiente antes de guardar.
- El tablero odontologico ahora muestra conteo de insumos en stock bajo.
- Cuando un insumo activo queda en stock bajo se genera una notificacion interna para usuarios con permiso de inventario odontologico; si el insumo vuelve a stock suficiente, las alertas pendientes se resuelven automaticamente.
- La pestana `Inventario` muestra una tarjeta de alerta con los insumos en stock bajo para facilitar reposicion.
- Se agrego API para listar, crear y editar insumos, listar movimientos y registrar movimientos.
- Se agrego pestana `Inventario` en Odontologia con filtros, tarjetas resumen, formulario de insumos, formulario de movimientos y listado responsive.
- Se agrego auditoria automatica al crear/editar insumos y registrar movimientos.
- Se agregaron solicitudes de compra de inventario odontologico con estados `Solicitada`, `Cotizada`, `Ordenada`, `Recibida` y `Cancelada`.
- Las solicitudes de compra quedan ligadas al insumo, cantidad, proveedor sugerido, fecha requerida y motivo; desde una solicitud recibida se puede preparar la entrada de inventario.
- Se agrego base de proveedores odontologicos por cliente con datos de contacto, categoria, estado, busqueda y edicion; los proveedores se pueden sugerir desde insumos y solicitudes de compra.
- Se agrego reporte de consumo de inventario por procedimiento y odontologo, basado en los descuentos automaticos por citas atendidas; se muestra en pantalla y se exporta en Excel, CSV y PDF.

### Kits de Inventario por Procedimiento - Primer Bloque Funcional

- Se creo migracion `odontology_inventory_kits.sql` para asociar insumos del inventario a procedimientos odontologicos.
- Cada procedimiento puede tener un kit configurable con insumo, cantidad, estado activo y nota.
- Se agrego API para consultar y reemplazar el kit completo de un procedimiento.
- Se agrego configuracion visual de kits dentro de la pestana `Inventario`.
- Cuando una cita cambia por primera vez a estado `Atendida`, el sistema descuenta automaticamente los insumos activos del kit del procedimiento.
- El descuento automatico genera movimientos de salida en inventario y registra la relacion con la cita atendida para evitar duplicados.
- Si no hay stock suficiente, la cita no se marca como atendida y se muestra el error de stock insuficiente.
- Se agrego auditoria automatica al actualizar kits y se extendio la auditoria de citas con el conteo de consumos de inventario.

### Esterilizacion Odontologica - Primer Bloque Funcional

- Se creo migracion `odontology_sterilization.sql` para instrumental odontologico, ciclos de esterilizacion e instrumental procesado por ciclo.
- Se agrego permiso `odontology:sterilization:manage` para controlar acceso a este submodulo.
- Cada instrumental queda ligado a cliente y maneja codigo, nombre, categoria, cantidad total, estado activo y notas.
- Cada ciclo registra metodo, fecha, hora de inicio y fin, temperatura, presion, responsable, cita asociada, indicadores biologico/quimico, resultado y observaciones.
- Cada ciclo puede incluir multiples instrumentales con cantidad y nota individual.
- Se agrego API para listar, crear y editar instrumental, y para listar/crear ciclos de esterilizacion.
- Se agrego pestana `Esterilizacion` en Odontologia con resumen, filtros, formularios responsive y listados de instrumental/ciclos.
- El tablero odontologico ahora muestra los ciclos de esterilizacion registrados en el dia.
- Se agrego auditoria automatica al crear/editar instrumental y registrar ciclos de esterilizacion.
- Se agrego PDF/certificado interno del ciclo de esterilizacion con logo del cliente, parametros, indicadores, instrumental procesado, responsable y trazabilidad clinica cuando aplica.
- Se agrego PDF de etiquetas imprimibles por ciclo/lote para identificar el instrumental procesado, con fecha, metodo, resultado y consecutivo por cantidad.
- Se agrego reporte PDF de ciclos de esterilizacion por rango de fechas, responsable, metodo, resultado y busqueda, con resumen y detalle de instrumental procesado.
- Se reforzo la asociacion ciclo-cita-historia clinica: las historias ahora muestran ciclos de esterilizacion asociados a su cita, permiten abrir el PDF del ciclo y agregan esta trazabilidad en el PDF de historia clinica.
- Se agrego busqueda global de pacientes en el modulo odontologico con acciones rapidas para historial, cita, historia clinica y plan de tratamiento segun permisos.

### Importacion Masiva de Pacientes Odontologicos - Primer Bloque Funcional

- Se agrego importacion masiva de pacientes odontologicos desde Excel o CSV.
- Se agrego endpoint `POST /odontology/:clientId/patients/import` protegido por el permiso `odontology:patients:import`.
- La importacion valida datos obligatorios, tipos de documento, sexo, tipo de paciente, correo, fecha de nacimiento, acudiente para menores de edad y duplicados.
- Se valida que no existan documentos repetidos dentro del archivo ni pacientes ya creados con el mismo documento en el cliente.
- Se agrego descarga de plantilla Excel con catalogos y listas desplegables para documento, sexo, tipo de paciente, estado y campos Si/No.
- Se agrego vista previa antes de guardar, conteo de filas listas/con errores y bloqueo de importacion si hay errores.
- Se agrego descarga de archivo Excel de correccion con las filas erroneas y una columna de errores encontrados.
- Se agrego auditoria automatica `ODONTOLOGY_PATIENT_IMPORT` con conteo e ids importados.

### PDF de Historia Clinica Odontologica - Primer Bloque Funcional

- Se agrego migracion `odontology_clinical_records_pdf.sql` para almacenar el PDF firmado de cada historia clinica.
- Al firmar una historia clinica se genera automaticamente un PDF con datos del paciente, atencion, anamnesis, examen, diagnostico, plan y notas clinicas.
- El PDF incluye firma digital del odontologo, nombre, documento, registro profesional/INVIMA y fecha de firma.
- Se agrego endpoint `GET /odontology/:clientId/clinical-records/:recordId/pdf` para regenerar o abrir el PDF de historias ya firmadas.
- En el listado de historias clinicas se agrego boton `PDF` para visualizar la historia firmada.

### Historial del Paciente Odontologico - Primer Bloque Funcional

- Se agrego boton `Historial` en el listado de pacientes odontologicos.
- El historial consolida citas, historias clinicas, planes de tratamiento, consentimientos, recetas, documentos clinicos, adjuntos, odontograma, periodontogramas y pagos del paciente.
- Se agrego resumen superior con conteos de historias, citas, adjuntos y pagos registrados.
- Se muestran alertas clinicas del paciente para que el profesional las vea antes de revisar documentos.
- Se habilitaron accesos directos a PDF de historias firmadas, recetas, documentos clinicos, consentimientos y adjuntos.
- La agenda ahora permite filtrar por paciente desde la API para cargar correctamente el historial individual.

### Auditoria Odontologica - Mejoras de Lectura y Trazabilidad

- Se confirmo que las acciones principales del modulo odontologico ya registran auditoria automatica: pacientes, importaciones, citas, historias clinicas, firmas, planes, pagos, recetas, documentos, adjuntos, inventario, esterilizacion, consentimientos, odontograma y periodontograma.
- Se agregaron nombres legibles para las acciones odontologicas dentro del modulo de Auditoria.
- Se agrego clasificacion por software para diferenciar eventos `Odontologico`, `Biomedico`, `Administracion` y `Sistema`.
- Se agrego filtro de software en la pantalla de auditoria.
- Se mejoro la lectura de objetivos y detalles odontologicos mostrando IDs cortos, paciente, historia clinica, cita, plan, receta, consentimiento, pago y valores cuando aplica.

### Permiso de Auditoria Odontologica - Primer Bloque Funcional

- Se creo migracion `odontology_audit_permission.sql` para agregar el permiso `audit:odontology:view`.
- El rol `auditor_odontologia` recibe el permiso para consultar auditoria odontologica del cliente.
- La ruta `/admin/audit` ahora permite `users:manage` o `audit:odontology:view`.
- Los usuarios con `users:manage` ven toda la auditoria; los usuarios con `audit:odontology:view` ven solo eventos odontologicos `ODONTOLOGY_%` filtrados por su cliente.
- El dashboard y la navegacion muestran acceso a `Auditoria odontologica` cuando el usuario tiene el permiso correspondiente.

### PDF de Odontograma y Periodontograma - Primer Bloque Funcional

- Se agrego PDF dinamico para odontograma del paciente desde `GET /odontology/:clientId/patients/:patientId/odontogram/pdf`.
- Se agrego PDF dinamico para periodontograma desde `GET /odontology/:clientId/periodontograms/:chartId/pdf`.
- El PDF de odontograma muestra datos del paciente, estado actual por diente y el historial de cambios odontologicos.
- El PDF de periodontograma muestra datos del paciente, notas generales y mediciones periodontales compactas por diente.
- El historial del paciente ahora incluye botones `PDF` para odontograma y periodontogramas.
- La pantalla clinica odontologica ahora permite abrir PDF desde el historial del odontograma y desde el listado/detalle de periodontogramas.

### Reportes Odontologicos Exportables - Primer Bloque Funcional

- Se agrego PDF ejecutivo para reportes odontologicos desde `GET /odontology/:clientId/reports/pdf`.
- El PDF consolida rango, cliente, indicadores principales, citas por estado, procedimientos, pagos, planes, historias clinicas y consentimientos.
- El encabezado del PDF usa el logo del cliente cuando existe; si no hay logo disponible, muestra una insignia con iniciales para mantener identidad visual sin romper la generacion.
- En el submodulo `Reportes` se agregaron acciones para `Ver PDF`, `Exportar Excel` y conservar salida `CSV`.
- El Excel genera un libro con hoja de resumen y hojas separadas para citas, procedimientos, pagos, planes, historias clinicas y consentimientos.
- Se agrego endpoint `GET /odontology/:clientId/reports/details` para exportar detalle por rango.
- Se agrego accion `Excel detalle` con hojas separadas para agenda/citas, pacientes nuevos, pagos y recordatorios.
- Se agregaron indicadores gerenciales de produccion por odontologo, inasistencias/cancelaciones, ingresos por periodo y tratamientos por estado/valor en pantalla, Excel, CSV y PDF.
- Los reportes respetan el permiso `odontology:reports:view` y el acceso odontologico del cliente.

### Configuracion Odontologica por Cliente - Primer Bloque Funcional

- Se agrego actualizacion de parametros odontologicos desde `PATCH /odontology/:clientId/settings`.
- La configuracion ahora permite editar pagina inicial, reglas de firma, autorizacion por defecto, portal del paciente, teleconsulta, tareas clinicas/administrativas, ordenes de compra y bloqueo por unidades fuera de servicio.
- El submodulo `Configuracion` ahora muestra un formulario editable para usuarios con permiso `odontology:settings:manage`.
- Al crear pacientes, el campo `Requiere autorizacion` toma por defecto el valor configurado para el cliente.
- La pagina inicial odontologica del cliente se respeta al cargar el modulo si el usuario tiene permiso para entrar a esa seccion.
- Se agrego auditoria `ODONTOLOGY_SETTINGS_UPDATE` al guardar configuraciones.

### Catalogos Odontologicos Configurables - Primer Bloque Funcional

- Se agrego migracion `odontology_catalog_overrides.sql` para personalizar catalogos base por cliente sin afectar otros clientes.
- Los catalogos globales del sistema ahora pueden personalizarse por cliente con nombre, descripcion, color y estado activo/inactivo.
- Se agregaron endpoints `POST /odontology/:clientId/catalog` y `PATCH /odontology/:clientId/catalog/:itemId` protegidos por `odontology:settings:manage`.
- El submodulo `Configuracion` ahora permite seleccionar catalogos, crear elementos propios del cliente y personalizar elementos base.
- Se incluyeron catalogos de estados de cita, estados de paciente, condiciones de odontograma, categorias de foto, alergias, antecedentes, medicamentos y tipos de tarea.
- Se agrego auditoria automatica para creacion y edicion de catalogos odontologicos.

### Procedimientos Odontologicos Configurables - Primer Bloque Funcional

- Se agrego migracion `odontology_procedure_overrides.sql` para personalizar procedimientos base por cliente sin afectar otros clientes.
- Los procedimientos base pueden personalizarse por cliente con nombre, codigo, categoria, duracion, precio, color, consentimiento requerido y estado activo/inactivo.
- Se agregaron endpoints `POST /odontology/:clientId/procedure-types` y `PATCH /odontology/:clientId/procedure-types/:procedureTypeId` protegidos por `odontology:settings:manage`.
- El submodulo `Configuracion` ahora permite crear procedimientos propios del cliente y personalizar procedimientos base.
- Los procedimientos configurados alimentan agenda, planes de tratamiento, consentimientos y kits de inventario.
- Se agrego auditoria automatica para creacion y edicion de procedimientos odontologicos.

### Agenda Odontologica - Filtros y Vista Diaria

- La agenda ahora permite filtrar citas por fecha, estado, odontologo, sede, unidad/sillon y busqueda libre.
- La API de citas acepta filtros `siteId` y `chairId` para evitar cargar informacion innecesaria en clientes con varias sedes o consultorios.
- Se agrego resumen visual de la jornada con total de citas, programadas, en proceso y atendidas.
- El listado de citas se ordena por hora ascendente para trabajar la agenda del dia de forma natural.
- El selector de unidad se ajusta automaticamente cuando se cambia la sede seleccionada.

### Agenda Odontologica - Acciones Rapidas

- Se agrego navegacion de agenda por dia anterior, hoy y dia siguiente.
- Cada cita ahora permite cambio rapido de estado desde el listado: confirmar, llegada, en atencion, finalizar y no asistio.
- Las acciones rapidas reutilizan la validacion actual de agenda, por lo que respetan cruces de odontologo/unidad y consumos automaticos cuando una cita pasa a atendida.
- Se mantiene el boton `Editar` para cambios que requieren mas detalle, como cancelacion con motivo, fecha, unidad o procedimiento.

### Agenda a Historia Clinica - Flujo de Atencion

- Se agrego accion `Historia` en cada cita de agenda para abrir directamente una nueva historia clinica.
- La historia se precarga con paciente, cita asociada y motivo sugerido desde notas/procedimiento de la cita.
- El flujo cambia automaticamente al submodulo `Clinica > Historias clinicas` y deja el formulario listo para diligenciar.
- Esto reduce pasos en consulta y mantiene la cita ligada al registro clinico firmado.

### Historia Clinica a Plan de Tratamiento - Flujo Clinico

- Se agrego accion `Plan` en el listado de historias clinicas para crear un plan de tratamiento desde una historia existente.
- El plan se precarga con paciente, historia relacionada, diagnostico, objetivo sugerido desde el plan de manejo y notas clinicas.
- El flujo cambia automaticamente al submodulo `Planes de tratamiento` y deja el formulario listo para agregar procedimientos.
- Esto conecta la atencion clinica con la propuesta/procedimientos sin repetir busquedas ni copiar datos manualmente.

### Plan de Tratamiento a Pago - Flujo Administrativo

- Se agrego accion `Pago` en cada plan de tratamiento para registrar abonos sin volver a buscar paciente ni plan.
- El formulario de pago se precarga con paciente, plan, concepto, saldo pendiente y nota asociada.
- El flujo cambia automaticamente al submodulo `Pagos odontologicos` y deja el registro listo para guardar.
- El listado de pagos queda filtrado por el paciente y plan seleccionados para revisar rapidamente los abonos relacionados.
- Se agrego PDF de presupuesto/plan de tratamiento con logo del cliente, datos del paciente, procedimientos, valor total, abonos, saldo y espacio de aceptacion.

### Plan de Tratamiento a Consentimiento - Flujo Legal Clinico

- Se agrego accion `Consentimiento` en cada plan de tratamiento para crear autorizaciones sin volver a buscar paciente.
- El formulario se precarga con paciente y datos del firmante segun la informacion del paciente/acudiente.
- El sistema intenta seleccionar automaticamente una plantilla activa relacionada con los procedimientos del plan; si no encuentra una especifica, usa una plantilla general activa.
- Si no existen plantillas activas, se muestra una alerta para crear primero la plantilla de consentimiento.

### Historia Clinica a Receta - Flujo de Medicacion

- Se agrego accion `Receta` en cada historia clinica para crear una receta odontologica sin volver a buscar paciente.
- La receta se precarga con paciente, historia relacionada, cita asociada, diagnostico/motivo e indicaciones generales cuando existen.
- El flujo cambia automaticamente al submodulo `Recetas odontologicas` y deja el formulario listo para agregar medicamentos y generar el PDF.
- Esto conecta la atencion clinica con la entrega formal de medicacion al paciente.

### Historia Clinica a Documento Clinico - Certificados y Constancias

- Se agrego accion `Documento` en cada historia clinica para crear certificados, constancias, incapacidades o remisiones sin volver a buscar paciente.
- El documento se precarga con paciente, historia relacionada, cita asociada y un texto base generado desde motivo de consulta, diagnostico y plan de manejo.
- El flujo cambia automaticamente al submodulo `Documentos clinicos` y deja el formulario listo para editar contenido y generar el PDF.
- Esto completa otro puente del flujo clinico hacia documentos formales trazados en el historial del paciente.

### Historia Clinica a Odontograma y Periodontograma - Flujo Grafico

- Se agregaron acciones `Odontograma` y `Perio` en cada historia clinica.
- `Odontograma` abre el submodulo grafico con el paciente seleccionado y prepara una nota sugerida desde motivo/diagnostico.
- `Perio` abre un nuevo periodontograma con paciente, historia relacionada y notas sugeridas desde diagnostico, plan y notas clinicas.
- Estos atajos conectan la historia clinica con los registros graficos sin repetir busquedas manuales.

### Historial del Paciente - Centro de Acciones Rapidas

- El panel de historial del paciente ahora incluye acciones rapidas para crear cita, historia clinica, plan, receta, documento clinico, consentimiento y adjunto sin volver a buscar al paciente.
- Cada accion respeta los permisos del usuario y solo muestra los botones disponibles segun el rol/permisos activos.
- Los formularios se precargan con el paciente seleccionado y, cuando aplica, con datos clinicos importantes como alergias, antecedentes, observaciones o datos del acudiente.
- El flujo cambia automaticamente al submodulo correspondiente y desplaza la pantalla al formulario para continuar el registro con menos pasos.

### Historial del Paciente - Linea de Tiempo Consolidada

- Se agrego una linea de tiempo dentro del historial del paciente con citas, historias clinicas, planes, recetas, documentos, consentimientos, adjuntos, periodontogramas, odontograma y pagos.
- Los eventos se ordenan del mas reciente al mas antiguo para revisar rapidamente la trazabilidad completa del paciente.
- Los registros que tienen soporte o PDF muestran accion directa `Ver PDF` o `Ver`, sin entrar a cada submodulo.
- Esta vista deja el historial preparado como centro de consulta clinica y administrativa del paciente.

### Historia Clinica - Alertas Previas a la Atencion

- Al crear o editar una historia clinica se muestra una tarjeta de alertas del paciente antes de diligenciar los antecedentes y el examen.
- La tarjeta presenta alergias, antecedentes, medicamentos actuales, embarazo, riesgo de sangrado, diabetes, hipertension, marcapasos y observaciones importantes.
- Al seleccionar un paciente, el formulario precarga antecedentes medicos, medicamentos y alergias si esos campos aun estan vacios.
- Esto ayuda a que el odontologo revise riesgos clinicos antes de iniciar la atencion y reduce errores por omision.

### Historia Clinica - Firma, PDF y Cita Atendida

- Al firmar una historia clinica vinculada a una cita, la cita pasa automaticamente a estado `Atendida` si aun no estaba cerrada.
- El cambio se realiza en transaccion junto con la firma para mantener consistencia clinica y administrativa.
- Si la cita tiene un procedimiento con kit de inventario configurado, se conserva el consumo automatico de insumos al marcarla como atendida.
- La auditoria de firma ahora registra si se cerro una cita asociada y cuantos consumos de inventario se generaron.
- El PDF firmado de historia clinica ya incluye firma digital del odontologo, documento, registro profesional/INVIMA y fecha de firma.

### Historia Clinica - Nota Aclaratoria Posterior a Firma

- Se agrego tabla `odontology_clinical_record_notes` para registrar notas aclaratorias sin modificar historias firmadas.
- Se agregaron endpoints para listar notas por paciente/historia y crear notas solo sobre historias clinicas firmadas.
- El listado de historias firmadas ahora permite abrir el formulario `Nota` para registrar motivo y aclaracion.
- Las notas aparecen en el historial del paciente y en la linea de tiempo consolidada.
- La creacion de notas queda auditada con usuario, fecha, historia clinica y paciente relacionado.

### Consentimientos - Tratamiento de Datos Personales

- Se agrego la plantilla base `Autorización tratamiento de datos personales` para todos los clientes odontologicos.
- La plantilla queda disponible tambien para clientes nuevos desde la carga de defaults odontologicos.
- El modulo de consentimientos ahora tiene una accion rapida `Datos personales` para crear este consentimiento sin buscar manualmente la plantilla.
- Desde el historial del paciente tambien se puede generar directamente el consentimiento de tratamiento de datos personales.
- El texto incluye autorizacion para datos personales y datos sensibles en salud, finalidad asistencial, historia clinica, citas, reportes, comunicaciones y derechos del titular.

### Consentimientos - Asociación Automática con Cita y Procedimiento

- La agenda ahora permite crear un consentimiento directamente desde una cita con procedimiento definido.
- Al seleccionar una cita en el formulario de consentimiento, el sistema busca una plantilla activa asociada al procedimiento de la cita.
- Si no existe plantilla específica, usa una plantilla general activa, evitando seleccionar manualmente formatos en la mayoría de casos.
- La plantilla de tratamiento de datos personales queda excluida de la selección automática clínica para evitar confundir autorizaciones legales con consentimientos de procedimiento.
- El formulario muestra una tarjeta con la plantilla seleccionada para que el usuario confirme visualmente qué documento va a generar.

### Consentimientos - Firma en Pantalla del Paciente o Acudiente

- Se agrego el campo `signer_signature_path` para conservar la firma capturada del paciente o acudiente.
- Antes de firmar un consentimiento, el usuario debe abrir el panel de firma y dibujar la firma en pantalla, touchpad, tableta o dispositivo tactil.
- La firma se procesa como PNG con fondo transparente usando el mismo flujo de limpieza de firmas del sistema.
- El PDF del consentimiento ahora incluye la firma real del paciente/acudiente en el bloque final de firmas.
- El PDF tambien incluye la firma digital del odontologo o responsable que firma el consentimiento, junto con documento y registro profesional/INVIMA cuando existan en el usuario.

### Agenda - Horarios Configurables por Odontologo

- Se agrego la tabla `odontology_dentist_schedules` para definir horarios por odontologo, dia de semana y rango horario.
- La configuracion odontologica incluye el parametro `enforce_dentist_schedule` para activar o desactivar el bloqueo de agenda fuera del horario.
- En el submodulo de configuracion se puede seleccionar odontologo, cargar horario base lunes a viernes, agregar franjas, activar/desactivar filas y guardar cambios.
- Al crear o editar citas, si el bloqueo esta activo, el backend valida que la cita quede dentro de una franja activa del odontologo.
- Si la cita queda fuera de horario, el sistema informa los horarios disponibles para ese dia.

### Agenda - Confirmacion, Reprogramacion y Cancelacion

- La agenda ya tenia acciones rapidas para confirmar llegada, iniciar atencion, finalizar y marcar no asistencia.
- Se agrego accion directa `Reprogramar`, que abre la cita en modo reprogramacion y la deja en estado `Reprogramada` al guardar.
- Se agrego accion directa `Cancelar`, solicitando motivo obligatorio antes de cambiar el estado de la cita.
- La reprogramacion conserva paciente, odontologo, procedimiento, sede y unidad para modificar solo lo necesario.

### Agenda - Vista Diaria y Semanal

- Se agrego selector de vista `Dia` / `Semana` en el submodulo de agenda.
- El backend acepta filtros por rango (`dateFrom` y `dateTo`) para cargar semanas completas sin pedir todas las citas historicas.
- La vista semanal muestra tarjetas por dia con conteo de citas y permite cambiar rapidamente el dia base.
- La navegacion anterior/siguiente avanza por dias o semanas segun la vista seleccionada.

## Pagos y Cierre de Caja - Avance Implementado

- Los pagos odontologicos permiten filtrar por paciente, estado, rango de fechas y cajero/usuario.
- El reporte PDF de pagos resume pagos registrados, anulados y totales por cajero.
- El cierre de caja usa el mismo rango filtrado para congelar un resumen operativo con total recibido, total anulado, conteos, cajero/usuario y observaciones.
- Cada cierre genera PDF interno para soporte administrativo y auditoria.

## Permisos Finos de Valores Economicos

- Se agrego el permiso `odontology:financial:view` para separar gestion odontologica de visualizacion de dinero.
- El superusuario, administrador odontologico y recepcion odontologica lo reciben por defecto; puede retirarse o asignarse desde roles/permisos segun el cliente.
- Los usuarios sin este permiso ven los movimientos administrativos, pero los valores, recibos, reportes PDF y cierres de caja quedan restringidos.
- El backend tambien enmascara valores economicos para evitar que se filtren por API cuando el permiso no esta activo.

## Periodontograma - Soporte PDF y Trazabilidad

- El periodontograma ya tiene endpoint PDF por registro: `/odontology/:clientId/periodontograms/:chartId/pdf`.
- El PDF usa encabezado con logo del cliente, datos del paciente, fecha, denticion, notas generales y tabla de mediciones periodontales.
- Los periodontogramas pueden asociarse a una historia clinica mediante `clinical_record_id`.
- La linea de tiempo del paciente ya muestra periodontogramas y permite abrir el PDF desde el historial.

## Cierre de Pendientes de Configuracion Odontologica

- Se confirmo que los horarios configurables por odontologo estan implementados con tabla propia, formulario en configuracion y validacion backend al crear/editar citas cuando el bloqueo esta activo.
- Se confirmo que el odontograma ya tiene PDF imprimible desde el historial del paciente y desde la pantalla clinica.
- La configuracion de firmas, PDFs y recordatorios ya cubre reglas de firma de historia, generacion PDF, recordatorios por correo, historial de recordatorios y plantillas/parametros base.
- La configuracion de WhatsApp queda en estado preparado: existen campos por cliente, plantillas y adaptador `dry-run`; falta conectar proveedor oficial antes de marcarlo como totalmente productivo.
