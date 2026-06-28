# Guia operativa AWS / Lightsail - INBIHOSPITALARIO

Esta guia deja un flujo repetible para subir cambios, actualizar el servidor y hacer copias de seguridad antes de pruebas grandes. La idea es evitar improvisar en produccion.

## Datos base

- Proyecto en servidor: `/home/ubuntu/bchsoft/Login`
- Compose produccion: `docker-compose.prod.yml`
- Servicios: `web`, `api`, `db`
- Puerto web publico: `80`
- API interna: `5050`
- Base de datos: PostgreSQL `bchsoft`
- Usuario base de datos: `bchsoft`

## Flujo recomendado de despliegue

Siempre usar este orden:

1. Probar localmente.
2. Hacer commit y push a GitHub.
3. Entrar al servidor por SSH.
4. Crear backup manual.
5. Bajar cambios.
6. Reconstruir contenedores.
7. Validar servicios.

## Comandos locales antes de subir

Desde la carpeta del proyecto en Mac:

```bash
cd "/Users/jhonatanbermeochilito/Documents/New project"
git status
```

Validar build:

```bash
cd "/Users/jhonatanbermeochilito/Documents/New project/Login"
PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH" npm run build -- --configuration production
```

Si el build esta correcto:

```bash
cd "/Users/jhonatanbermeochilito/Documents/New project"
git add Login
git commit -m "Descripcion corta del cambio"
git push origin main
```

## Entrar al servidor

```bash
ssh ubuntu@54.156.160.173
```

Entrar al proyecto:

```bash
cd ~/bchsoft/Login
```

## Backup manual antes de actualizar

Crear carpeta de backups:

```bash
mkdir -p ~/backups/bchsoft
```

Backup de base de datos:

```bash
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U bchsoft -d bchsoft > ~/backups/bchsoft/db-$(date +%F-%H%M).sql
```

Backup de archivos subidos:

```bash
docker run --rm -v login_uploads:/data -v ~/backups/bchsoft:/backup alpine tar czf /backup/uploads-$(date +%F-%H%M).tar.gz -C /data .
```

Ver backups creados:

```bash
ls -lh ~/backups/bchsoft | tail
```

## Actualizar desde GitHub

```bash
git status
git pull origin main
```

Si el servidor tiene cambios locales no esperados, no continuar a ciegas. Revisar primero:

```bash
git status --short
```

## Reconstruir y levantar produccion

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Las migraciones se ejecutan automaticamente al iniciar el contenedor `api`, porque el `CMD` del backend corre:

```bash
node scripts/migrate.js && node src/server.js
```

## Validar despliegue

Ver contenedores:

```bash
docker compose -f docker-compose.prod.yml ps
```

Validar web local dentro del servidor:

```bash
curl -I http://127.0.0.1/ | head -n 5
```

Validar API por proxy:

```bash
curl -I http://127.0.0.1/api/ | head -n 5
```

Ver logs del API:

```bash
docker compose -f docker-compose.prod.yml logs --tail=120 api
```

Ver logs del web/nginx:

```bash
docker compose -f docker-compose.prod.yml logs --tail=80 web
```

## Reinicio rapido

Reiniciar solo API:

```bash
docker compose -f docker-compose.prod.yml restart api
```

Reiniciar todo:

```bash
docker compose -f docker-compose.prod.yml restart
```

## Variables sensibles

El archivo `server/.env` del servidor debe tener, como minimo:

- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `DATABASE_URL` o variables `DB_*`
- Configuracion SMTP/correo si se usa Gmail u otro proveedor
- Cualquier clave de WhatsApp/proveedor externo cuando se active

No subir `.env` a GitHub.

## Restaurar backup de base de datos

Usar solo si es necesario y con el sistema detenido o en ventana de mantenimiento.

```bash
docker compose -f docker-compose.prod.yml stop api web
cat ~/backups/bchsoft/db-YYYY-MM-DD-HHMM.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U bchsoft -d bchsoft
docker compose -f docker-compose.prod.yml start api web
```

## Restaurar archivos subidos

```bash
docker compose -f docker-compose.prod.yml stop api web
docker run --rm -v login_uploads:/data -v ~/backups/bchsoft:/backup alpine sh -c "cd /data && tar xzf /backup/uploads-YYYY-MM-DD-HHMM.tar.gz"
docker compose -f docker-compose.prod.yml start api web
```

## Checklist despues de actualizar

- Ingresar con superusuario.
- Validar dashboard.
- Validar un usuario no superusuario.
- Validar que el cliente solo vea softwares contratados.
- Validar un PDF importante.
- Validar carga/descarga de archivo.
- Validar envio de correo si el cambio toca notificaciones.
- Revisar logs del API durante 2 a 5 minutos.

## Pendientes de produccion recomendados

- Configurar dominio.
- Configurar HTTPS/SSL.
- Activar snapshots automaticos de Lightsail.
- Crear politica de backups periodicos fuera del servidor.
- Revisar SMTP/correo productivo.
- Revisar crecimiento del volumen `uploads`.
