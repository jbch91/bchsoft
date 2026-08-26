# Auditoría del catálogo biomédico en producción

Fecha de corte: 2026-08-10
Alcance: nombres de equipo, marcas y modelos agregados de los clientes existentes.
Metodo: consultas de solo lectura. No se modificaron registros ni se extrajeron codigos, seriales, ubicaciones, usuarios o documentos.

## Estado actual

| Concepto | Cantidad |
| --- | ---: |
| Clientes con inventario revisado | 4 |
| Equipos registrados | 248 |
| Nombres de equipo escritos de forma distinta | 99 |
| Marcas escritas de forma distinta | 101 |
| Modelos escritos de forma distinta | 152 |
| Rutas Equipo / Marca distintas | 146 |
| Rutas Equipo / Marca / Modelo distintas | 178 |
| Guias rapidas existentes | 0 |

El catalogo global nuevo aun no existe en produccion. Esto permite definir las equivalencias antes de instalarlo y evita crear duplicados desde el primer cargue.

Con normalizacion basica de mayusculas, tildes y espacios, las 99 formas de nombre se convierten en 81 equipos. Al aplicar tambien los grupos recomendados de esta auditoria, el resultado estimado es de 64 tipos de equipo, 119 rutas Equipo / Marca y 163 rutas Equipo / Marca / Modelo.

## Nivel 1: unificacion automatica

Estas equivalencias no cambian el significado y se pueden aplicar automaticamente.

### Equipos por mayusculas y tildes

| Nombre canonico propuesto | Formas encontradas | Equipos afectados |
| --- | --- | ---: |
| Fonendoscopio | `FONENDOSCOPIO`, `Fonendoscopio` | 14 |
| Tensiometro adulto | `TENSIOMETRO ADULTO`, `Tensiometro Adulto` | 12 |
| Monitor de signos vitales | `MONITOR DE SIGNOS VITALES`, `Monitor de signos vitales` | 11 |
| Bomba de infusion | `BOMBA DE INFUSION`, `Bomba de infusion`, `Bomba de infusión` | 9 |
| Tensiometro pediatrico | tres combinaciones de mayusculas | 9 |
| Lampara de fotocurado | dos combinaciones de mayusculas | 7 |
| Pulsioximetro | `PULSIOXIMETRO`, `Pulsioximetro` | 7 |
| Equipo de organos de pared | dos combinaciones de mayusculas | 6 |
| Cavitron | `CAVITRON`, `Cavitron` | 5 |
| Desfibrilador | `DESFIBRILADOR`, `Desfibrilador` | 5 |
| Unidad odontologica | dos combinaciones de mayusculas | 4 |
| Autoclave | `AUTOCLAVE`, `Autoclave` | 3 |
| Balanza pesa bebe | dos combinaciones, una con tilde | 2 |
| Compresor odontologico | dos combinaciones de mayusculas | 2 |
| Equipo de quimica | dos combinaciones, una con tilde | 2 |
| Monitor fetal | `MONITOR FETAL`, `Monitor fetal` | 2 |

Los nombres de presentación deben guardar ortografía profesional: `Báscula`, `Lámpara`, `Tensiómetro` y `Pulsioxímetro` deben conservar sus tildes en la interfaz y los documentos.

### Marcas por formato

Se pueden consolidar directamente:

- `WELCH ALLYN`, `Welch Allyn`, `Welch allyn` -> `Welch Allyn` (31 equipos).
- `HEALTH O METER`, `Health o meter` -> `Health o meter` (24 equipos).
- `EDAN`, `Edan` -> `EDAN` (19 equipos).
- `MED CAPTAIN`, `MEDCAPTAIN`, `Medcaptain` -> `Medcaptain` (8 equipos).
- `WOODPECKER`, `Woodpecker` -> `Woodpecker` (5 equipos).
- `MINDRAY`, `Mindray` -> `Mindray` (4 equipos).
- `EBER`, `Eber` -> `Eber` (2 equipos).
- `UNIVERSAL`, `Universal` -> `Universal` (2 equipos).

### Modelos por formato

Los separadores, espacios y mayusculas se pueden ignorar solamente dentro de la misma ruta Equipo / Marca:

- `349 KLX` / `349KLX` -> `349KLX`.
- `EX-203` / `EX203` -> `EX-203`.
- `524 KL` / `524KL` -> `524KL`.
- `GS 300` / `GS-300` -> `GS 300`.
- `GS 777` / `GS777` -> `GS 777`.
- `i-Led Max` / `I-Led Max` -> `i-Led Max`.
- `POCKET LED` / `Pocket led` -> `Pocket LED`.
- `SHOCK RESISTANT` / `Shock Resistant` -> `Shock Resistant`.
- `HOO3-C` -> `H003-C`; la referencia comercial encontrada utiliza cero, no dos letras O.

## Nivel 2: grupos recomendados

Estos grupos tienen respaldo por coincidencia de marca y modelo o por el tipo funcional del equipo. Se recomienda aprobarlos como una sola categoria canonica.

| Nombre canonico propuesto | Formas que agrupa | Equipos afectados | Evidencia principal |
| --- | --- | ---: | --- |
| Bascula de piso | `BASCULA`, `BASCULA DE PISO`, `BASCULA DIGITAL`, `Bascula digital de piso` | 25 | El modelo Health o meter 349KLX aparece en tres formas del nombre. |
| Bascula pediatrica | `BALANZA PESA BEBE`, `Balanza pesa bebe`, `BASCULA PEDIATRICA`, `Bascula pesa bebe`, `PESA BEBES`, `PESA PEDIATRICA` | 10 | Se repiten los modelos Charder MS2400, Seca 354 y Health o meter 524KL. |
| Equipo de organos de los sentidos | nombre generico, portatil, de pared y `organos y sentidos` | 13 | Se repiten Pocket LED y GS 777; el modelo conserva la variante fisica. |
| Pulsioximetro | `PULSIOXIMETRO`, `PULSOXIMETRO` | 12 | Es una diferencia ortografica de un solo caracter. |
| Monitor de signos vitales | nombre normal y nombre con `PROCEDIMIENTOS AMB` | 12 | EDAN X12 aparece en ambos; el area no debe formar parte del nombre del equipo. |
| Aspirador de secreciones | `ASPIRADOR DE SECRECIONES`, `SUCCIONADOR`, `Succionador de flema` | 9 | Son denominaciones funcionales equivalentes; el modelo diferencia cada unidad. |
| Lampara de examen y procedimientos | `LAMPARA`, `Lampara de examen general`, nombre con pedestal y `LAMPARA PIELITICA` | 5 | GS 300, GS 900 y LS200 son luces de examen o procedimientos. No incluye la lampara cielitica. |

Correcciones ortograficas adicionales:

- `CAMILLA HOPITALARIA` -> `Camilla hospitalaria`.
- `LAMPARA CON PEDASTAL PARA EXAMEN` -> `Lampara con pedestal para examen`, antes de agruparla.
- `TEENS PORTATIL` -> `TENS portatil`.
- `AGITADOR DE MANZZINI` -> `Agitador de Mazzini`.

## Correcciones de marca recomendadas

| Valor actual | Valor canonico | Equipos afectados |
| --- | --- | ---: |
| `RIITTER` | `Ritter` | 1 |
| `LITTMAN` | `Littmann` | 3 |
| `MEMMER` | `Memmert` | 1 |
| `SAMSUMG` | `Samsung` | 1 |
| `WHIRPOOL` | `Whirlpool` | 1 |
| `VESFROST` | `Vestfrost` | 2 |
| `SPORFITNES` | `Sportfitness` | 1 |

`RIITTER` no debe unificarse con `Riester`: el registro es una autoclave M11 y esa referencia corresponde a Ritter/Midmark.

## Nivel 3: revision manual

No se deben corregir automaticamente estos casos:

| Caso | Motivo |
| --- | --- |
| `HTC-2`, `HTC-3`, `DIGITAL` y `TEMPERATURE` usados como marca | Parecen modelos o descriptores colocados en la columna de marca. Se debe mover la referencia correcta y usar `NR` como marca cuando no se conozca. |
| `DIGITAL TERMOMETER` y `THERMOMETER` usados como marca | Son descripciones, no fabricantes confirmados. |
| `PORTABLE PHLEGM SUCTION` usado como marca | Es el tipo del equipo. El modelo confirmado es H003-C; falta confirmar el fabricante. |
| `BADECOL INFANT SCALE` usado como marca | Puede mezclar fabricante y descripcion comercial; requiere revisar la placa o documento fuente. |
| `SYMPLY` | Posible error de escritura, pero no hay evidencia suficiente para cambiarlo. |
| `HIDROCOLECTOR` | Posible nombre tecnico incorrecto; debe revisarse contra la placa o manual. |
| `CAVITRON` y `SCALER` | Pueden consolidarse como detartrador ultrasonico, pero es una decision de nomenclatura funcional. |
| `REFRIGERADOR`, `Refrigerador farmaceutico` y `NEVERA` | No conviene mezclar neveras domesticas con refrigeradores farmaceuticos. Los Vestfrost pueden revisarse para pasar a la categoria farmaceutica. |
| `TENSIOMETRO`, adulto, pediatrico, de pared y de carro | El parecido textual no implica que sean la misma configuracion. |
| `UNIDAD ODONTOLOGICA`, fija y portatil | La forma de instalacion puede afectar guias y mantenimiento. |

Tampoco deben unificarse por similitud:

- Marcas `CONTEC` / `GENTEC`, `TAIYU` / `KAIYA` o `Riester` / `Ritter`.
- Modelos `ART-M1(25K)` / `ART-M1(26K)`, `880KL` / `800KL`, `60813` / `60814`.
- Rangos de micropipeta `5-50uL`, `10-100uL`, `20-200uL` y `100-1000uL`.
- Modelos `HTC-1`, `HTC-2` y `HTC-3`.

## Estrategia de aplicacion

1. Crear el catalogo global y una tabla de alias para conservar cada escritura historica.
2. Insertar primero las equivalencias automaticas y las correcciones ortograficas aprobadas.
3. Ejecutar una vista previa que muestre cuantas hojas de vida cambiaria cada regla.
4. Vincular cada activo con el modelo canonico sin eliminar historial, documentos ni datos del cliente.
5. Registrar cada cambio en auditoria y conservar el valor anterior como alias.
6. Habilitar sugerencias al escribir un nombre parecido, pero nunca fusionar automaticamente por distancia textual.
7. Sincronizar las guias rapidas por la ruta canonica Equipo / Marca / Modelo y mantener cada guia aislada por cliente.

## Referencias de validacion

- Welch Allyn GS 300: https://www.hillrom.com/content/dam/hillrom-aem/us/en/sap-documents/LIT/80029/80029176LITPDF.pdf
- Welch Allyn GS 900: https://www.hillrom.com/en/products/green-series-900-procedure-light-veterinary/
- Welch Allyn LS200: https://www.hillrom.com/content/dam/hillrom-aem/us/en/marketing/products/ls200-procedure-lighting/documents/LS200%20Procedure%20Light%2C%20Service%20Manual.pdf
- Welch Allyn GS 777: https://www.hillrom.com/en/products/green-series-777-integrated-wall-system/
- Midmark/Ritter M11: https://www.midmark.com/docs/default-source/about-us/medical-mkt-00524_m11-sterilizer-load-configuration-table-final.pdf
- BOECO OS-20: https://boeco.com/boeco-universal-orbital-shaker-os-20%26sk%3D79
- Sportfitness: https://sportfitness.co/blogs/news/que-es-sport-fitness
