# Plantillas UI para modulos y submodulos

Fecha: 2026-06-27
Alcance: todos los modulos, submodulos y softwares de clientes.

## Objetivo

Mantener una misma estructura visual y funcional en INBIHOSPITALARIO: header/footer globales fijos, menu de modulos compacto, contenido claro, acciones importantes en modal y listados tipo Excel con scroll interno.

## Reglas generales

- Cada pagina privada debe vivir dentro de `section.page`.
- El header y footer globales pertenecen al shell de la aplicacion; los modulos no deben duplicar encabezados grandes.
- El menu entre modulos/submodulos debe usar `app-module-tabs` cuando aplique.
- Crear, editar, administrar, confirmar o eliminar debe abrir modal si la accion hace crecer demasiado la pagina.
- Las acciones criticas deben pedir codigo de seguridad cuando correspondan.
- Las tablas amplias deben usar scroll interno, no desbordar la pagina.
- Los textos de ayuda deben ser breves: titulo de tarea, una frase util y controles visibles.

## Plantilla de listado

Usar esta base para Usuarios, Auditoria, Clientes, inventarios, mantenimientos, hojas de vida, calibraciones, odontologia y nuevos modulos.

```html
<section class="page">
  <app-module-tabs></app-module-tabs>

  <section class="module-panel">
    <header class="module-panel-header">
      <div>
        <h2>Listado registros</h2>
        <p>Busca y administra registros por datos principales.</p>
      </div>

      <div class="module-panel-tools">
        <label>
          Buscar
          <input type="text" placeholder="Nombre, documento o detalle..." />
        </label>
        <button type="button" class="ghost">Limpiar</button>
        <button type="button" class="primary">Nuevo registro</button>
      </div>
    </header>

    <p class="module-result-count">0 registros encontrados</p>
    <p class="module-empty">No hay registros con esos filtros.</p>

    <div class="module-table-wrap">
      <table class="module-excel-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Nombre</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2026-06-27</td>
            <td>Registro demo</td>
            <td>Activo</td>
            <td>
              <div class="module-table-actions">
                <button type="button" class="tiny">Editar</button>
                <button type="button" class="tiny">Ver</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</section>
```

## Plantilla de filtros

Usar cuando el modulo necesite filtros avanzados, cliente seleccionado o rangos de fecha.

```html
<div class="module-filter-panel">
  <div class="module-filter-top">
    <div class="module-filter-grid">
      <label>
        Cliente
        <select>
          <option>Todos los clientes</option>
        </select>
      </label>
    </div>

    <div class="module-client-preview">
      <div>
        <strong>Cliente seleccionado</strong>
        <div>NIT, ciudad y direccion</div>
      </div>
    </div>
  </div>

  <div class="module-filter-grid">
    <label>
      Estado
      <select></select>
    </label>
    <label>
      Desde
      <input type="date" />
    </label>
    <label>
      Hasta
      <input type="date" />
    </label>
  </div>
</div>
```

## Uso de modales

- Usar el mismo fondo visual de los modales SaaS.
- El modal debe tener titulo, subtitulo corto, boton cerrar y acciones al final.
- Si el modal tiene mucha informacion del cliente, dejar encabezado fijo con nombre, NIT, ciudad y direccion.
- No pedir contrasena manual para administradores de cliente; enviar enlace/correo para definirla.

## Submenus

- Evitar submenus internos si solo existe una vista principal.
- Crear registros debe ser boton, no pestana.
- Mantener pestanas solo para modos reales: por ejemplo Resumen, Suscripcion, Personalizacion y Administradores.
- El boton Menu principal debe quedar dentro del menu de modulos, al final derecho.

## Referencias ya aplicadas

- `src/app/pages/users/users.component.html`: listado con buscador, acciones y tabla tipo Excel.
- `src/app/pages/audit/audit.component.html`: auditoria con buscador, filtros compactos y tabla tipo Excel.
- `src/styles.scss`: clases globales `module-panel`, `module-panel-header`, `module-panel-tools`, `module-filter-panel`, `module-filter-grid`, `module-table-wrap` y `module-excel-table`.
