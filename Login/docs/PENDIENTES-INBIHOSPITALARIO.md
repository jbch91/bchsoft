# Pendientes INBIHOSPITALARIO

Este archivo es una guia viva para revisar en VS Code lo que falta por hacer. La idea es ir marcando avances por bloques, sin perdernos entre modulos.

Estados sugeridos:

- [ ] Pendiente.
- [~] En proceso.
- [x] Terminado.

---

## 1. Plataforma General

- [x] Revisar roles por software principal: Biomedico, Odontologico y Laboratorio.
- [x] Validar que cada cliente solo vea los softwares contratados.
- [x] Crear pantalla/flujo claro para activar softwares por cliente.
- [x] Revisar permisos temporales y permisos sensibles por usuario.
- [x] Separar superadmin SaaS de datos operativos del cliente.
- [x] Crear rol administrador del cliente para gestionar usuarios propios.
- [ ] Mejorar auditoria global para registrar acciones criticas de todos los softwares.
- [x] Revisar cierre de sesion por inactividad y mensajes al usuario.
- [x] Preparar modo produccion estable para AWS.
- [x] Revisar backups de base de datos y archivos subidos.
- [ ] Definir estrategia de dominio, SSL y correo productivo.
- [~] Optimizar tamanos de estilos y bundles del frontend.
- [x] Convertir rutas principales a carga diferida para bajar el peso inicial.
- [x] Cargar librerias pesadas de exportacion/QR solo cuando se usen.
- [x] Resolver bloqueo local de Angular/esbuild en ng serve/build.
- [x] Fijar Node 20 local con `.nvmrc`, `engines` y script `verify`.

---

## 2. Software Biomedico

### Inventario y Hojas de Vida

- [ ] Pulir PDF final de hoja de vida.
- [ ] Revisar firma del ingeniero en todos los escenarios: creacion, edicion e importacion.
- [ ] Validar movimiento de equipos por almacenista e ingeniero biomedico.
- [ ] Terminar reporte PDF de movimiento de equipos.
- [ ] Definir submodulo o flujo para equipos dados de baja.
- [ ] Revisar historial de equipo para que todos los PDF queden ordenados por fecha.
- [ ] Validar migracion de PDF historicos por permiso temporal.
- [ ] Revisar generacion y descarga de codigos QR por equipo.

### Mantenimiento

- [ ] Pulir flujo completo de mantenimiento preventivo programado.
- [ ] Validar que preventivos solo aparezcan cuando estan dentro de la fecha del cronograma.
- [ ] Evitar correos masivos por equipo en preventivos; solo resumen por mantenimiento.
- [ ] Revisar reportes correctivos con repuestos pendientes.
- [ ] Validar notificacion interna al almacenista cuando se solicita repuesto.
- [ ] Revisar cierre de caso cuando se instala repuesto.
- [ ] Revisar flujo para dar de baja un equipo desde mantenimiento.
- [ ] Separar mejor reportes pendientes de firma e historial.
- [ ] Agregar boton de correccion/rechazo de reporte antes de firmar.
- [ ] Validar que todo reporte firmado pase automaticamente al historial de hoja de vida.

### Cronogramas, Calibracion y Capacitaciones

- [ ] Revisar que cronogramas preventivos se generen por areas y no solo por equipo individual.
- [ ] Validar cronograma de capacitaciones con actas por fecha.
- [ ] Validar cronograma de calibracion con certificados por equipo/modelo.
- [ ] Revisar correos recordatorios de capacitacion/calibracion/preventivo.
- [ ] Revisar PDF de cronogramas para que mantengan formato uniforme INBI.

### Guias Rapidas de Uso

- [ ] Validar flujo de creacion por marca/modelo.
- [ ] Revisar PDF en una sola hoja siempre que sea posible.
- [ ] Validar campos opcionales: encendido, apagado, alarmas, limpieza, emergencia.
- [ ] Agregar control de version y codigo documental por cliente.
- [ ] Revisar permisos de creacion/edicion/eliminacion.

---

## 3. Software Odontologico

### Base y Permisos

- [x] Crear suite odontologica independiente.
- [x] Crear modulo Odontologia.
- [x] Crear roles odontologicos iniciales.
- [x] Crear permisos base odontologicos.
- [ ] Revisar permisos finos por rol real en pantalla de usuarios.
- [ ] Validar acceso por cliente cuando el usuario no es superusuario.
- [ ] Dividir Odontologia en subcomponentes por submodulo para reducir compilacion y mejorar mantenimiento.

### Pacientes

- [x] Crear pacientes.
- [x] Editar pacientes.
- [x] Buscar y filtrar pacientes.
- [x] Importacion masiva inicial desde Excel/CSV.
- [ ] Probar importacion con archivo real.
- [ ] Mejorar archivo de errores si queremos resaltar celdas exactas.
- [x] Agregar busqueda global de paciente dentro del software odontologico.
- [x] Crear linea de tiempo del paciente.
- [x] Activar automaticamente "requiere acudiente o responsable" cuando el paciente sea menor de edad.
- [ ] Definir bloqueo administrativo por configuracion.

### Agenda

- [x] Crear agenda basica.
- [x] Validar cruces de odontologo.
- [x] Validar cruces de unidad/sillon.
- [x] Crear horario configurable por odontologo.
- [x] Bloquear citas fuera del horario.
- [x] Mejorar vista calendario diaria/semanal.
- [x] Agregar confirmacion/reprogramacion de cita.
- [x] Crear recordatorios por correo.
- [x] Preparar estructura para WhatsApp.
- [x] Registrar log de recordatorios enviados.

### Historia Clinica

- [x] Crear historia clinica.
- [x] Editar borrador.
- [x] Firmar y bloquear historia.
- [x] Generar PDF de historia clinica con firma del odontologo.
- [x] Firma del paciente/acudiente en pantalla o tableta.
- [x] Crear nota aclaratoria posterior a firma.
- [x] Mostrar alertas clinicas antes de iniciar atencion.
- [x] Asociar historia clinica automaticamente a cita atendida.

### Odontograma

- [x] Crear odontograma basico por diente.
- [x] Historial por fecha.
- [ ] Mejorar odontograma por superficies.
- [ ] Comparar estados anteriores vs actuales.
- [ ] Mejorar visual del odontograma para tablet.
- [x] PDF o resumen imprimible de odontograma.

### Periodontograma

- [x] Crear periodontograma con seis puntos por diente.
- [x] Crear detalle de periodontograma.
- [ ] Mejorar visual grafico periodontal.
- [x] Generar PDF de periodontograma.
- [x] Asociar periodontograma a historia clinica y linea de tiempo.

### Consentimientos

- [x] Plantillas configurables.
- [x] Consentimientos por paciente.
- [x] Firma y PDF inicial.
- [x] Firma del paciente/acudiente en pantalla o tableta para consentimientos.
- [x] Firma del odontologo en consentimiento con firma digital.
- [x] Consentimiento de tratamiento de datos personales.
- [x] Asociar consentimiento al procedimiento/cita de forma mas automatica.
- [x] Mejorar PDF con estilo INBI y logo cliente.

### Planes de Tratamiento

- [x] Crear planes de tratamiento.
- [x] Procedimientos con valor y sesiones.
- [x] Estados del plan.
- [x] PDF de presupuesto/plan de tratamiento.
- [x] Firma de aceptacion del paciente cuando el cliente lo active.
- [x] Convertir plan aceptado en citas/agenda sugerida.
- [x] Actualizar avance del plan automaticamente al marcar citas vinculadas como atendidas.
- [x] Mejorar saldos y pagos asociados.

### Pagos

- [x] Crear pagos y abonos.
- [x] Anular pagos.
- [x] Asociar pago a plan de tratamiento.
- [x] Generar recibo PDF.
- [x] Reporte por cajero/usuario.
- [x] Cierre de caja si el cliente lo requiere.
- [x] Permisos finos para ver valores economicos.

### Recetas y Documentos Clinicos

- [x] Recetas odontologicas con PDF.
- [x] Medicamentos base configurables.
- [x] Certificados, incapacidades, constancias y remisiones.
- [ ] Mejorar PDFs con firma digital del odontologo.
- [ ] Agregar consecutivos/codigos documentales si se requieren.
- [x] Guardar documentos en linea de tiempo del paciente.

### Adjuntos

- [x] Cargar PDF e imagenes por paciente.
- [x] Asociar a historia o plan.
- [ ] Vista previa avanzada de imagenes con zoom.
- [ ] Clasificacion configurable por cliente.
- [x] Adjuntos visibles en linea de tiempo.

### Inventario Odontologico

- [x] Crear insumos.
- [x] Movimientos de entrada/salida/ajuste.
- [x] Stock bajo.
- [x] Kits por procedimiento.
- [x] Descuento automatico al marcar cita como atendida.
- [x] Ordenes de compra o solicitudes de compra.
- [x] Proveedores odontologicos.
- [x] Reporte de consumo por procedimiento/odontologo.
- [x] Alertas internas por stock bajo.

### Esterilizacion

- [x] Crear instrumental.
- [x] Crear ciclos de esterilizacion.
- [x] Asociar instrumental procesado por ciclo.
- [x] Generar PDF o certificado interno de ciclo.
- [x] Etiquetas/lotes imprimibles para instrumental.
- [x] Asociar ciclo de esterilizacion a procedimiento/cita de forma mas fuerte.
- [x] Reporte de ciclos por fecha/responsable/resultado.

### Reportes Odontologicos

- [x] Reporte inicial por rango de fechas.
- [x] Exportacion CSV.
- [x] Exportacion Excel.
- [x] Exportacion Excel detallado de agenda, pacientes, pagos y recordatorios.
- [x] Exportacion PDF con logo cliente.
- [x] Reporte de produccion por odontologo.
- [x] Reporte de tratamientos aceptados/cancelados.
- [x] Reporte de planes por estado financiero.
- [x] Reporte de ingresos por periodo.
- [x] Reporte de inasistencias y cancelaciones.

### Configuracion Odontologica

- [x] Sedes.
- [x] Unidades/sillones.
- [x] Catalogos iniciales.
- [x] Horarios de odontologos.
- [x] Campos obligatorios configurables por cliente.
- [x] Configuracion de firmas, PDFs y recordatorios.
- [~] Configuracion de WhatsApp/correo por cliente.

---

## 4. Software Laboratorio

- [ ] Definir alcance funcional completo.
- [ ] Definir roles de laboratorio.
- [ ] Crear suite Laboratorio.
- [ ] Crear modulos principales.
- [ ] Integrar ordenes desde odontologia si el cliente tiene ambos softwares.
- [ ] Crear trazabilidad de muestras.
- [ ] Crear resultados y PDFs.
- [ ] Crear entrega de resultados.
- [ ] Crear reportes administrativos.

---

## 5. Seguridad, Auditoria y Cumplimiento

- [ ] Auditoria completa por paciente, historia, consentimiento, pagos, inventario y documentos.
- [ ] Auditoria de descargas de PDF importantes.
- [ ] Auditoria de exportaciones.
- [ ] Auditoria de cambios de permisos.
- [x] Politica de backups.
- [ ] Control de archivos subidos.
- [ ] Validar tamanos maximos por tipo de archivo.
- [ ] Revisar privacidad de informacion clinica por rol.
- [ ] Revisar logs del servidor para produccion.

---

## 6. Apariencia y Experiencia de Usuario

- [ ] Uniformar todos los encabezados de modulos con estilo INBI.
- [ ] Uniformar botones por accion: crear, guardar, ver, editar, eliminar, peligro.
- [ ] Revisar responsive en celular y tablet.
- [ ] Reducir altura de tarjetas resumen donde ocupe demasiado espacio.
- [ ] Mejorar estados vacios: sin datos, sin permisos, cargando.
- [ ] Mejorar mensajes de exito/error para que sean claros y visibles.
- [ ] Revisar tablas largas con filtros, busqueda y paginacion.

---

## 7. Despliegue AWS

- [ ] Subir cambios actuales al servidor cuando se apruebe.
- [ ] Ejecutar migraciones en servidor.
- [ ] Validar permisos y roles en produccion.
- [ ] Validar login con diferentes usuarios.
- [ ] Validar carga y descarga de archivos.
- [x] Crear backup manual antes de pruebas grandes.
- [ ] Configurar dominio.
- [ ] Configurar HTTPS/SSL.
- [ ] Revisar correos en produccion.
- [x] Documentar comandos de despliegue.

---

## Prioridad Recomendada Inmediata

1. Probar importacion masiva de pacientes odontologicos con archivo real.
2. Mejorar PDF de historia clinica odontologica con firma del odontologo.
3. Crear firma de paciente/acudiente en consentimientos e historia.
4. Crear horario configurable por odontologo y bloqueo fuera de horario.
5. Crear linea de tiempo del paciente.
6. Revisar permisos odontologicos por rol en usuarios.
7. Subir bloque estable al servidor.
