# User Stories — CIP: primer dashboard (Fase 6)

Perspectiva: Administrador Patrimonial (mismo rol de Fase 4, `seguridad/DOC-012-administrador-patrimonial.md`)
y, en general, cualquier operador con visibilidad de organización — el dashboard es de consulta,
no de escritura (RNF-01), así que no reabre la matriz de permisos de DOC-012.

## US-01 — Ver cobertura de inventario de mi organización
**Como** Administrador Patrimonial
**Quiero** ver cuántos activos están registrados, cuántos fueron escaneados y el % de cobertura
**Para** saber si el último ciclo de inventario cubrió lo esperado sin tener que sumar sesiones a mano

**Criterios de aceptación**
- Muestra activos registrados, activos escaneados al menos una vez, y % de cobertura, por
  organización (RF-01).
- Si no hay ninguna sesión de inventario todavía, muestra 0% de cobertura, no un error.

## US-02 — Ver qué áreas están controladas y cuáles no
**Como** Administrador Patrimonial
**Quiero** ver qué áreas ya tuvieron una sesión de inventario en el período vigente y cuáles no
**Para** priorizar dónde falta control

**Criterios de aceptación**
- Lista de áreas con estado "controlada"/"pendiente" (RF-02).
- El período vigente es configurable (por defecto: mes calendario en curso) — no hardcoded a "hoy".

## US-03 — Ver el veredicto de las sesiones de inventario
**Como** Administrador Patrimonial
**Quiero** ver cuántas sesiones fueron exitosas, aceptables o defectuosas
**Para** identificar qué áreas necesitan una revisión más de cerca

**Criterios de aceptación**
- Conteo por veredicto (exitoso/aceptable/defectuoso), calculado por CIP a partir de los escaneos
  reales de cada sesión — no depende de que APP QR lo haya enviado (ver
  `design-artifacts/ARCHITECTURE.md` § "Veredicto: recalculado, no reenviado") (RF-03).

## US-04 — Ver activos fuera de área
**Como** Administrador Patrimonial
**Quiero** ver qué activos aparecieron en un área/ubicación distinta a la registrada
**Para** decidir si corresponde un traslado formal

**Criterios de aceptación**
- Lista agrupada por el área real donde apareció el activo, con su área esperada (RF-04) — mismo
  criterio que ya construyó APP QR en Fase 3.1 (`ScannedList`/reporte de sesión), ahora agregado a
  nivel organización en vez de una sola sesión.

## US-05 — Ver activos no localizados
**Como** Administrador Patrimonial
**Quiero** ver los activos marcados `extraviado`
**Para** iniciar el proceso de investigación o baja

**Criterios de aceptación**
- Lista de activos en estado `extraviado`, con la fecha del último evento registrado (RF-05).

## US-06 — Ver incidencias reportadas
**Como** Administrador Patrimonial
**Quiero** ver las incidencias registradas durante los inventarios
**Para** darles seguimiento sin tener que abrir sesión por sesión en APP QR/WEB

**Criterios de aceptación**
- Lista de escaneos con `resultado = 'con_incidencia'` y su observación (RF-06).

## US-07 — Ver distribución de activos por estado operativo
**Como** Administrador Patrimonial
**Quiero** ver cuántos activos están en servicio, mantenimiento, inactivos o dados de baja
**Para** tener una foto general del estado del patrimonio

**Criterios de aceptación**
- Conteo por `activos.estado`, incluye los estados nuevos de Fase 3.1 (`mantenimiento`,
  `inactivo`) (RF-07).

## US-08 — Navegar con drill-down
**Como** Administrador Patrimonial
**Quiero** poder bajar de Organización a Sede, Área, Ubicación, Categoría y Activo
**Para** pasar de la foto general a un caso puntual sin cambiar de herramienta

**Criterios de aceptación**
- Cada nivel de RF-01 a RF-07 acepta filtros opcionales por sede/área/ubicación (RF-08).
- Todo listado en cualquier nivel de drill-down está paginado (RNF-02).

## US-09 — Ver distribución por categoría de catálogo
**Como** Administrador Patrimonial
**Quiero** un gráfico circular de activos por categoría (informática, mobiliario, equipos varios,
enseres de cocina, etc.), filtrable por área
**Para** entender la composición del patrimonio de un vistazo, como pide el flujo oficial del
programa

**Criterios de aceptación**
- Agrupa por `catalogo_activos.familia`, filtrable por área (RF-09).

## US-10 — Ver datos "últimos conocidos" si la fuente está caída
**Como** Administrador Patrimonial
**Quiero** que el dashboard siga mostrando datos (aunque no sean el segundo a segundo) si CORE o
la cola de eventos están caídos
**Para** no perder visibilidad completa por una falla temporal de otro sistema

**Criterios de aceptación**
- El dashboard muestra un timestamp de "última actualización" visible siempre.
- Si la ingesta está atrasada o caída, el dashboard sigue respondiendo con los últimos datos
  agregados, marcados como posiblemente desactualizados — nunca un error 5xx al usuario por esta
  causa (RF-10).

## Fuera de alcance de este incremento (identificadas, no diseñadas — ver `requirements/INTENT.md`)

- **US-11 (futura)** — Como Administrador Patrimonial, quiero recibir un informe diario automático
  a hora fija con el resumen de mi organización, para no tener que entrar al dashboard todos los
  días. Requiere scheduler + canal de entrega, fuera de alcance (spec pptx).
- **US-12 (futura)** — Como Administrador Patrimonial, quiero recibir una alerta cuando un activo
  crítico quede `extraviado`. Requiere Motor de Alertas, sin consumidor real todavía (YAGNI).
