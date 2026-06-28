# Administracion SaaS - Seguimiento

Fecha: 2026-06-27
Modulo: Administracion SaaS INBIHOSPITALARIO

## Regla principal

El superuser administra la plataforma SaaS, clientes, planes, suscripciones, usuarios SaaS y auditoria administrativa. No debe entrar a datos operativos de los clientes.

## Estado actual

- [x] Este hilo queda dedicado solo a Administracion SaaS.
- [x] Paso 1 realizado: ingreso como superuser y bloqueo de modulos operativos validado.
- [x] Navegacion SaaS alineada con permisos reales de roles SaaS limitados.
- [x] Auditoria SaaS muestra eventos de planes, suscripciones, pagos, personalizacion y administradores con etiquetas legibles.
- [x] Paso 2 realizado: menu principal compactado para ocupar menos espacio en pantalla.
- [x] Backend local revisado y levantado en puerto 5050 para permitir login desde el frontend.
- [x] Paso 3 realizado: Planes SaaS con estado vacio, preview de modulos, validaciones antes de guardar, editor en modal amplio con fondo solido y modulos filtrados por software seleccionado.
- [x] Paso 4 simplificado: Crear cliente ya no es una pestana independiente; queda como boton Nuevo cliente dentro de Clientes / cartera y abre un modal.
- [x] Modales SaaS normalizados con el mismo fondo/overlay visual.
- [x] Seguridad de administradores de cliente ajustada: el superuser no crea, restablece ni ve contrasenas; el administrador recibe correo para definirla.
- [x] Confirmacion por codigo agregada para acciones criticas SaaS y Usuarios/Roles: cliente, plan, suscripcion, pago, personalizacion, usuarios, roles y permisos.
- [x] Usuarios > Editar usuario convertido a modal con el mismo fondo visual de modales SaaS.
- [x] Clientes / cartera ajustado: el listado ya no despliega detalle en la tabla; el boton Informacion abre un modal real fuera del listado con datos, suscripcion, personalizacion, administradores y edicion del cliente.
- [x] Modal de informacion de cliente ajustado con encabezado fijo: nombre, NIT, ciudad y direccion permanecen visibles al hacer scroll.
- [x] Administradores del cliente ahora se gestionan dentro del modal de informacion: editar datos, enviar acceso, activar/bloquear y eliminar con codigo de seguridad.
- [x] Editor de Suscripcion comercial dentro del modal de informacion ajustado: campos separados, grilla estable y sin superposicion.
- [x] Modal de informacion revisado completo con paneles editables abiertos: editar cliente, administradores, suscripcion, pago, software y modulos sin superposicion.
- [x] Personalizacion del cliente corregida: guardar softwares respeta enabled=false, apaga modulos del software desactivado y el editor de modulos se filtra dinamicamente por software activo.
- [x] Paso 5 realizado: Administracion SaaS > Clientes / cartera queda completa y lista para continuar con Detalle cliente > Suscripcion.
- [x] Modal de informacion del cliente organizado con pestanas internas: Resumen, Suscripcion, Personalizacion y Administradores.
- [x] Paso 6 realizado: Detalle cliente > Suscripcion queda visualmente separado en su pestana propia; las pruebas reales de guardado/pago con codigo quedan para cierre funcional.
- [x] Paso 7 realizado: Detalle cliente > Personalizacion revisado en su pestana propia, con software/modulos dinamicos, protecciones contra cero software/cero modulos, logo con codigo de seguridad y auditoria como Personalizacion.
- [x] Administradores del cliente queda integrado dentro de Clientes / cartera > Informacion; no se maneja como pestana independiente de Administracion SaaS.
- [x] Paso 12 realizado: al ingresar como administrador del cliente, el dashboard muestra software y modulos habilitados del cliente sin exponer datos de otros clientes.
- [x] Ajuste visual realizado: dashboard del administrador con header compacto para cliente, informacion, sesion/notificaciones y regreso al menu principal.
- [x] Ajuste visual realizado: marca INBIHOSPITALARIO retirada del header y ubicada en footer final con informacion del entorno/software.
- [x] Shell global refinado: header/footer fijos quedan comunes para paginas privadas, se redujo el espacio superior y Menu principal queda dentro de las subpestanas de modulos.
- [x] Encabezados internos duplicados retirados de los modulos con subpestanas para que el estilo sea comun segun permisos del usuario.
- [x] Menu de subpestanas de modulos compactado: menos altura, contador discreto, boton Menu principal integrado y pestanas horizontales.
- [x] Menu de modulos ajustado: contador ahora dice modulo/modulos, el boton Menu principal queda al extremo derecho y el rotulo visual global cambio de Secciones a Modulos.
- [x] Menu de modulos limpiado: se retiro el contador de cantidad y el rotulo visual del submenu para evitar repetir informacion.
- [x] Usuarios reorganizado: se retiro el submenu interno, Crear usuario abre en modal, Roles y permisos queda como menu propio y el listado queda como tabla compacta tipo Excel.
- [x] Auditoria armonizada con Usuarios: encabezado breve, buscador general, filtros compactos y tabla tipo Excel con scroll interno.
- [x] Plantillas UI globales definidas para todos los modulos, submodulos y softwares de clientes: panel, encabezado, herramientas, filtros, vista de cliente y tabla tipo Excel.
- [x] Auditoria separada del menu operativo: no aparece como modulo de cliente/software; plataforma ve auditoria SaaS y el administrador del cliente ve solo auditoria de su propio cliente.
- [x] Roles y permisos separado como menu de Seguridad junto a Usuarios y Auditoria; client_admin lo consulta para roles operativos del cliente y superuser lo administra.
- [x] Roles y permisos del client_admin convertido a edicion segura por cliente: no toca plantillas globales, filtra roles y permisos segun softwares/modulos habilitados, exige codigo y audita cambios.
- [x] Decision de seguridad: los usuarios se manejan con un rol principal; no se habilita multirol en UI para evitar acumulacion de permisos dificil de auditar.
- [x] Crear usuario ajustado: plataforma y cliente ya no definen contrasena manual; se crea con clave aleatoria interna y se envia correo para que el usuario defina su propia contrasena.
- [x] Crear usuario SaaS limpiado: el modal de Usuarios solo ofrece roles SaaS reales; superuser, admin legado, viewer y client_admin no aparecen ahi. Administradores del cliente se crean desde Clientes/cartera.
- [x] Separacion de usuarios definida: Usuarios principal queda para cuentas de plataforma SaaS; los administradores del cliente se consultan y gestionan desde Clientes / cartera > Informacion.
- [x] Usuarios SaaS locales de prueba creados para validar roles sin depender del correo: administrador, facturacion, gestor de clientes y soporte.
- [x] Tablas armonizadas visualmente: Clientes, Usuarios y Auditoria usan encabezado rojo global, bordes/filas/chips desde variables comunes de tabla.
- [x] Clientes / cartera compactado: KPIs, filtros y textos auxiliares reducidos para que la tabla quede visible mucho antes al entrar.
- [x] Auditoria simplificada: queda un solo buscador general, cliente pasa a filtro tipo select y se retira el bloque informativo de "Todos los clientes".
- [x] Auditoria SaaS restringida: plataforma ve eventos SaaS/administrativos de cartera y usuarios de plataforma, pero no usuarios operativos ni accesos lectores de clientes.
- [x] Roles y permisos SaaS depurado: superuser solo ve/edita roles SaaS actuales; superuser, admin legado, viewer y client_admin quedan fuera de esta pantalla.

## Checklist de cierre

1. [x] Ingreso como superuser y bloqueo de modulos operativos.
2. [x] Dashboard / menu principal.
3. [x] Administracion SaaS > Planes SaaS.
4. [x] Administracion SaaS > Crear cliente.
5. [x] Administracion SaaS > Clientes / cartera.
6. [x] Detalle cliente > Suscripcion.
7. [x] Detalle cliente > Personalizacion.
8. [x] Usuarios > Crear usuario SaaS.
9. [x] Usuarios > Roles y permisos.
10. [x] Ingreso con usuario SaaS limitado.
11. [x] Ingreso con administrador del cliente.
12. [x] Auditoria SaaS.
13. [ ] Cierre produccion: typecheck, build, permisos backend, estados vacios y responsive basico.

## Pendiente inmediato

- Siguiente bloque: cierre de produccion para Administracion SaaS.
- Revisar/stagear cambios con cuidado antes del commit: no incluir backups locales ni eliminar `bchoperativo` accidentalmente.
- Preparar commit/push y desplegar siguiendo `docs/aws-operacion.md`.
- Antes de actualizar servidor: backup manual de base de datos y volumen uploads.
- Despues de actualizar servidor: validar superuser, usuario SaaS limitado, administrador del cliente, auditoria SaaS, correos y logs del API.

## Notas de verificacion

- Typecheck Angular ejecutado despues del ajuste visual del dashboard: OK.
- Typecheck Angular ejecutado despues de ajustes en Planes SaaS: OK.
- Typecheck Angular ejecutado despues de convertir editor de planes a modal: OK.
- Modal de planes refinado con overlay mas opaco y fondo blanco solido.
- Typecheck Angular ejecutado despues de filtrar modulos por software en Planes SaaS: OK.
- Servidor local disponible en http://127.0.0.1:4200.
- Frontend recuperado en http://127.0.0.1:4200 usando Node 20.20.2; el Node por defecto del sistema es 18 y Angular 21 lo rechaza.
- Backend local disponible en http://127.0.0.1:5050.
- Login backend probado con usuario local bch: responde OK como superuser, con permisos y tokens.
- Typecheck Angular ejecutado despues de fusionar Crear cliente con Clientes / cartera: OK.
- Typecheck Angular ejecutado despues de unificar fondo de modales SaaS: OK.
- Typecheck Angular ejecutado despues de retirar contrasena manual de administradores de cliente: OK.
- Backend reiniciado y health OK despues de agregar invitacion por correo para administradores de cliente.
- Accion Cambiar clave reemplazada por Enviar acceso para administradores de cliente existentes.
- SMTP verificado contra smtp.gmail.com el 2026-06-26: conexion OK sin exponer credenciales.
- Migracion admin_action_confirmations.sql aplicada el 2026-06-26: OK.
- Typecheck Angular ejecutado despues de agregar confirmacion por codigo para acciones criticas: OK.
- Typecheck Angular ejecutado despues de convertir Editar usuario a modal: OK.
- Backend reiniciado y health OK despues de agregar confirmacion por codigo.
- Frontend y backend locales responden 200 despues del cambio de modal para crear cliente.
- Typecheck Angular ejecutado despues de mover la informacion de cliente a modal: OK.
- Typecheck Angular ejecutado despues de sacar la ficha de cliente fuera del tbody y dejarla como modal real: OK.
- Encabezado del modal de informacion de cliente dejado fijo durante scroll.
- Typecheck Angular ejecutado despues de agregar edicion, bloqueo y eliminacion de administradores del cliente: OK.
- Backend revisado con node --check despues de ampliar administradores de cliente: OK.
- Typecheck Angular ejecutado despues de corregir superposicion del editor de suscripcion: OK.
- Revision visual local del editor de suscripcion: sin superposicion entre Plan comercial, Periodo, Estado, Modo de acceso, fechas, Valor y Moneda.
- Revision visual local del modal completo en 1280px y 390px: sin solapamientos ni desborde horizontal despues del ajuste de controles y boton cerrar.
- Revision visual local de Personalizar software/modulos: al desmarcar Odontologico, el modulo Odontologia desaparece inmediatamente del editor de modulos.
- Frontend 4200 y backend 5050/health responden OK despues del modal de informacion de cliente.
- Typecheck Angular ejecutado despues de organizar el modal de informacion por pestanas internas: OK.
- Revision visual local del modal por pestanas en escritorio: Resumen, Suscripcion, Personalizacion y Administradores muestran solo su contenido correspondiente y sin desborde horizontal.
- Revision visual local del editor de suscripcion abierto en escritorio y movil 390px: sin campos superpuestos y sin desborde horizontal.
- Typecheck Angular ejecutado despues de reforzar Personalizacion: OK.
- Backend revisado con node --check despues de agregar codigo de seguridad para logo: OK.
- Personalizacion revisada en navegador: la pestana muestra solo software, modulos y logo; sin desborde horizontal en escritorio y movil 390px.
- Validacion visual de seguridad: cero softwares bloquea Guardar softwares y muestra advertencia.
- Validacion visual de modulos dinamicos: al activar Odontologico aparece Odontologia; al retirarlo desaparece sin guardar cambios.
- Logo del cliente ahora solicita codigo de seguridad, se audita como CLIENT_LOGO_UPDATE y queda categorizado como Personalizacion en Auditoria.
- Ajuste backend en curso: el rol client_admin puede ver los softwares habilitados de su propio cliente en /software-suites/me; los permisos de modulos siguen controlando accesos operativos.
- Dashboard de administrador de cliente ajustado para mostrar un panel de modulos habilitados del cliente dentro del software seleccionado, aunque el rol no tenga permisos operativos directos sobre todos los modulos.
- Dashboard reorganizado: informacion del cliente queda en el header compacto junto a informacion, sesion/notificaciones y regreso al menu principal.
- Revision visual local del dashboard reorganizado en header: sin footer fijo, sin desborde horizontal en escritorio y movil 390px; header movil corregido para no crecer por flex-basis y panel de usuario dentro del viewport.
- Dashboard ajustado: INBIHOSPITALARIO sale del header, se elimina el texto "Selecciona el software con el que quieres trabajar." y se agrega footer final con marca, entorno, estado y modulos.
- Revision visual local del nuevo footer: desktop y movil 390px sin desborde horizontal; header sin marca y sin texto "Selecciona el software"; footer muestra INBIHOSPITALARIO, entorno, estado y modulos.
- Footer del dashboard ajustado para quedar al final de la pantalla cuando hay poco contenido, sin flotar, y con altura reducida.
- Revision visual local del footer compacto: desktop 62px de alto y movil 390px 121px de alto; ambos quedan al fondo de la pantalla y sin desborde horizontal.
- Shell global implementado: header y footer fijos para rutas autenticadas, compartidos por Dashboard, Administracion SaaS, Usuarios y demas paginas privadas; login queda sin shell.
- Revision visual local del shell global: en Usuarios desktop header 66px y footer 55px fijos, sin menu duplicado; movil 390px header 108px y footer 95px, sin desborde horizontal.
- Usuarios ajustado: se retiro el encabezado interno duplicado porque el shell global ya muestra titulo y descripcion del modulo.
- Typecheck Angular ejecutado despues de compactar shell global, mover Menu principal a subpestanas y retirar encabezados duplicados: OK.
- Revision visual local final: Usuarios desktop queda con 8px entre header y subpestanas, footer/header fijos, Menu principal solo en subpestanas y sin desborde horizontal.
- Revision visual local final: Administracion SaaS desktop queda con 8px entre header y subpestanas, sin encabezado interno duplicado y sin desborde horizontal.
- Revision visual local final: Usuarios movil 390px queda con 12px entre header y subpestanas, footer/header fijos, Menu principal en subpestanas y sin desborde horizontal.
- Validacion por codigo: Clientes, Usuarios, Auditoria, Inventario, Mantenimiento, Cronogramas, Hojas de vida, Calibraciones, Guias rapidas y Odontologia usan el mismo componente de subpestanas cuando el usuario tiene permisos para verlos.
- Typecheck Angular ejecutado despues de compactar el menu de subpestanas de modulos: OK.
- Revision visual local del menu de modulos: Usuarios y Administracion SaaS desktop muestran menu de 52px, pestaña activa correcta, 8px desde header y sin desborde horizontal.
- Revision visual local del menu de modulos: Usuarios movil 390px muestra menu de 94px, pestaña activa correcta, 12px desde header y sin desborde horizontal.
- Typecheck Angular ejecutado despues de mover Menu principal al final derecho y cambiar textos de secciones/accesos a modulos: OK.
- Typecheck Angular ejecutado despues de retirar contador y rotulos del menu/submenu: OK.
- Revision visual local final: Usuarios y Administracion SaaS desktop ya no muestran contador ni rotulo automatico, conservan Menu principal a la derecha y no tienen desborde horizontal.
- Revision visual local final: Usuarios movil 390px no muestra contador ni rotulo automatico, conserva Menu principal al final y no tiene desborde horizontal.
- Typecheck Angular ejecutado despues de convertir Crear usuario a modal y listado usuarios a tabla tipo Excel: OK.
- Revision visual local final previa: Usuarios desktop sin submenu interno, tabla Excel visible y Nuevo usuario abre modal por encima del header/footer.
- Revision visual local final: Usuarios movil 390px sin desborde horizontal de pagina; la tabla Excel usa scroll horizontal interno y el modal de Nuevo usuario abre correctamente.
- Typecheck Angular ejecutado despues de armonizar Auditoria con Usuarios: OK.
- Revision visual local final: Auditoria desktop muestra Registros de auditoria, descripcion breve, buscador, boton Limpiar, filtros por cliente/actor/accion/software/fecha y tabla Excel sin desborde.
- Revision visual local final: Auditoria movil 390px conserva buscador y tabla con scroll horizontal interno, sin desborde de pagina.
- Guia creada en docs/plantillas-ui-modulos.md para replicar el patron en todos los modulos/submodulos.
- Usuarios y Auditoria quedaron marcados con las clases globales de plantilla como referencia viva para los siguientes modulos.
- Typecheck Angular ejecutado despues de crear plantillas UI globales para modulos/submodulos: OK.
- Auditoria administrativa ajustada: plataforma muestra solo eventos SaaS/administrativos; client_admin muestra solo eventos con clientId propio y actor perteneciente al mismo cliente.
- Typecheck Angular ejecutado despues de separar Auditoria del menu operativo y limitar /admin/audit: OK.
- Backend revisado con node --check despues de ajustar filtros de Auditoria y modulos de cliente: OK.
- Backend local reiniciado en puerto 5050 despues del ajuste de Auditoria: health OK.
- Typecheck Angular y node --check ejecutados despues de permitir Auditoria propia para client_admin: OK.
- Backend local reiniciado en puerto 5050 con Auditoria propia de cliente: health OK.
- Roles y permisos agregado como ruta /roles-permisos y menu global de Seguridad; client_admin recibe solo permisos visibles de roles operativos.
- Typecheck Angular y node --check ejecutados despues de separar Roles y permisos como menu: OK.
- Backend local reiniciado en puerto 5050 despues de agregar permisos visibles para client_admin: health OK.
- Permisos por cliente implementados con client_role_permission_sets y client_role_permissions; el login usa configuracion propia del cliente cuando existe.
- Migracion client_role_permissions.sql aplicada en local: OK.
- Roles y permisos por cliente guarda con codigo de seguridad CLIENT_ROLE_PERMISSIONS_UPDATE y audita CLIENT_ROLE_PERMISSIONS_UPDATE.
- Typecheck Angular y node --check ejecutados despues de habilitar edicion segura de permisos por cliente: OK.
- Backend local reiniciado en puerto 5050 despues de permisos por cliente: health OK.
- Login/refresh ajustado: usuarios operativos cargan permisos efectivos del cliente y se filtran por modulos/softwares habilitados; client_admin conserva permisos administrativos del cliente.
- Roles y permisos ajustado: /admin/roles entrega al client_admin solo roles compatibles con softwares/modulos habilitados; GET/PUT de permisos y cambio/creacion de usuarios bloquean roles no habilitados por API.
- Typecheck Angular y node --check ejecutados despues de filtrar roles por software/modulos habilitados: OK.
- Backend local reiniciado en puerto 5050 despues de filtrar roles por software/modulos habilitados: health OK.
- Usuarios ajustado: el administrador del cliente solo ve y administra usuarios operativos; los usuarios client_admin quedan fuera del listado operativo y se gestionan desde Administracion SaaS por plataforma.
- Typecheck Angular y node --check ejecutados despues de separar usuarios operativos de administradores de cliente: OK.
- Backend local reiniciado en puerto 5050 despues de separar usuarios operativos de administradores de cliente: health OK.
- Seguridad de contrasenas ajustada: administradores ya no escriben ni cambian contrasenas de usuarios; solo envian correo para que el usuario defina su clave con codigo propio.
- Typecheck Angular y node --check ejecutados despues de cambiar contrasenas por envio de correo: OK.
- Backend local reiniciado en puerto 5050 despues de cambiar contrasenas por envio de correo: health OK.
- Crear usuario ajustado: el modal ya no solicita contrasena y /admin/users siempre genera clave aleatoria interna mas correo de definicion de contrasena.
- Typecheck Angular y node --check ejecutados despues de retirar contrasena del modal Crear usuario: OK.
- Backend local reiniciado en puerto 5050 despues de retirar contrasena del modal Crear usuario: health OK.
- Roles del modal Crear usuario filtrados: Usuarios > Nuevo usuario usa solo roles SaaS en plataforma; /admin/users bloquea roles que no correspondan y Clientes/cartera usa endpoint propio para administradores del cliente.
- Typecheck Angular y node --check ejecutados despues de filtrar roles creables en el modal: OK.
- Backend local reiniciado en puerto 5050 despues de filtrar roles creables en el modal: health OK.
- Usuarios dividido por alcance: /admin/users para plataforma ya no trae usuarios con client_id; administradores del cliente quedan gestionados desde la informacion del cliente.
- Administracion SaaS retira la pestana independiente de Administradores de clientes para evitar duplicidad; el flujo queda centralizado en Clientes / cartera > Informacion > Administradores.
- Typecheck Angular y node --check ejecutados despues de separar usuarios SaaS y usuarios de clientes: OK.
- Backend local reiniciado en puerto 5050 despues de separar usuarios SaaS y usuarios de clientes: health OK.
- Frontend local en puerto 4200 recompilo despues de separar usuarios SaaS y usuarios de clientes: HTTP 200 OK.
- Typecheck Angular y node --check ejecutados despues de limitar la vista a administradores de clientes y gestion por modal: OK.
- Backend local reiniciado en puerto 5050 despues de limitar la vista a administradores de clientes: health OK.
- Frontend local en puerto 4200 recompilo despues de limitar la vista a administradores de clientes: HTTP 200 OK.
- Capas de modales corregidas: .saas-modal-backdrop queda globalmente por encima de header/footer/shell con z-index de modal y overlay mas consistente.
- Usuarios SaaS locales creados/actualizados en base local con client_id nulo y login probado contra /auth/login: saas_admin_local, saas_facturacion_local, saas_clientes_local y saas_soporte_local.
- Modelo global de tablas ajustado: .module-excel-table toma el encabezado rojo de Clientes y Usuarios/Auditoria eliminan el encabezado claro anterior.
- Clientes / cartera reduce altura de indicadores y filtros; en pantallas medianas los filtros usan dos columnas y en movil estrecho una columna.
- Auditoria elimina el buscador duplicado de cliente y el preview de cliente/todos los clientes para mantener la pantalla compacta.
- Backend de Auditoria SaaS endurecido: /admin/audit con usuario SaaS local ya no devuelve USER_* con clientId de cliente ni READER_ACCESS_UPDATE; mantiene CLIENT_* y SUBSCRIPTION_*.
- Roles y permisos SaaS endurecido: /admin/roles, /admin/permissions y /admin/roles/:id/permissions filtran por roles/permisos SaaS actuales para superuser y bloquean acceso directo a roles obsoletos o de cliente.
- Usuarios ajustado: el rol superuser queda como cuenta especial no editable desde el selector normal y el cambio de rol desde plataforma solo permite roles SaaS actuales.
- Typecheck Angular y node --check ejecutados despues de depurar Roles y permisos SaaS: OK.
- Backend local reiniciado en puerto 5050 despues de depurar Roles y permisos SaaS: health OK.
- Prueba API local con token superuser temporal: /admin/roles devuelve solo saas_admin, saas_billing, saas_clients, saas_support y saas_auditor; /admin/permissions no devuelve permisos operativos; /admin/roles/{admin}/permissions devuelve 403.
- Cierre local pre-produccion del 2026-06-28: node --check server/src/server.js OK, npm run typecheck OK, build de produccion OK usando Node 20.20.2.
- Build con Node global 18.18.0 falla por version minima de Angular; usar Node >=20.19 en local/servidor.
- Build de produccion mantiene warnings no bloqueantes por presupuestos SCSS en odontologia/clientes/maintenance/users y dependencias CommonJS existentes.
- Build de produccion previamente fallo por entorno: Node 18 en el script por defecto y luego proceso Angular con codigo 134 sin diagnostico usando Node 20.20.2.
