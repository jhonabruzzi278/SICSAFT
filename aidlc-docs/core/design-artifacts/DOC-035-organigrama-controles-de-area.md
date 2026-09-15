# DOC-035 — Controles de área: organigrama como landing + navegación paginada + PDF

> Diseño antes que código (`CLAUDE.md` Metodología AI-DLC). Pedido directo del usuario
> (2026-09-15) con dos capturas de referencia: un organigrama de ejemplo ("Empresa Suchel") y la
> tabla real de "Controles de Área" de su instancia, que el usuario describe como "no se entiende
> nada". Solo toca `core/frontend/` — ningún endpoint nuevo de CIS/CORE/CIP (ver §2.2, todo el dato
> ya existe y ya es legible por el rol `directivo`).

## 1. Qué está mal hoy (relevado en el código, no solo en la captura)

`ControlesAreaTab.tsx` (rediseño de hace unas horas, commit `8d7f4fb`) tiene tres problemas reales
que la captura del usuario confirma:

1. **La tabla muestra IDs crudos, no nombres**: columnas "Área" y "Ubicación" imprimen
   `sesion.areaId`/`sesion.ubicacionId` (UUID) tal cual — `ControlesAreaTab.tsx:161-164`. Con ~23
   sesiones reales ya cargadas, la tabla es una pared de UUIDs y correos repetidos.
2. **El reporte individual tiene el mismo bug**, más grave por estar en el título:
   `PantallaControlArea.tsx:251` — `Reporte de control — Área {resumen.areaId}` — el pop-up que
   se armó recién también muestra el UUID crudo en el header.
3. **"Ubicación"** se pidió eliminar por completo — ya no se usa (confirmado: no aparece en
   ningún flujo de negocio vigente, ver §2.4 sobre qué SÍ sigue necesitando el campo a nivel de
   datos).

A esto se suma el pedido de fondo: reemplazar la tabla plana + pop-up por una jerarquía
Organización→Dirección→Departamento→Área como landing, con conteo de reportes por área, y una
navegación en pantallas completas (no modal) para no depender de un scroll infinito.

## 2. Estado real relevado (por qué esto no necesita backend nuevo)

### 2.1 La jerarquía Organización→Dirección→Departamento→Área ya existe y ya se muestra en CCP

`ccp/src/pages/EstructuraPage.tsx` (`JerarquiaSection`, líneas 194-328) ya arma exactamente esta
jerarquía a partir de `Area.dependencia` (Dirección) y `Area.departamento` (Departamento), ambos
texto libre cargados por Excel (DOC-033). Es la fuente de verdad de "cómo se ve en el CCP" que
pidió el usuario. `core/frontend/` no tiene hoy ningún equivalente — ni el tipo `Area`, ni el
método `getAreas()`.

### 2.2 El endpoint que lo sirve es de lectura abierta — el Directivo ya puede leerlo

`GET /admin/areas` (`cis/src/administrador/administrador.controller.ts:348`) está comentado
explícitamente como **"lectura abierta"** — sin guard de rol más allá de estar autenticado (DOC-023
§3, mismo criterio que `GET /auditoria`). `core/frontend/` ya le habla a CIS con el mismo token
OIDC del Directivo para `/catalogo`, `/inventarios`, etc. — agregar `getAreas(organizacionId)` al
`cis-client.ts` de este portal es portar el método tal cual existe en
`ccp/src/lib/cis-client.ts:446-451`, sin tocar CIS. **No hay endpoint nuevo que crear.**

### 2.3 El conteo de reportes por área no necesita agregación en el backend

`GET /inventarios?organizacionId=` (ya usado por `ControlesAreaTab.tsx`) devuelve la sesión con su
`areaId`. Agrupar por área y contar es un `reduce` sobre el array que el frontend ya trae completo
a memoria — mismo patrón que `agruparAreasPorDireccion` en CCP. El filtro "por día" es el mismo
array filtrado por la fecha de `fechaCierre`. No hay razón para mover esto a CIP/CORE: es el mismo
dato, solo agrupado distinto en el cliente.

### 2.4 "Eliminar Ubicación" — alcance real

`ubicacionId` sigue siendo un campo obligatorio del contrato `POST /inventarios` (APP QR →
CIS→CORE, `InventarioRequest.ubicacionId`, `inventarios.types.ts:33`) y de la tabla real
(`FOREIGN_KEY_VIOLATION` en `inventarios.service.ts:75-85` lo valida contra la BPI). Tocar eso
rompe el contrato con `app-qr-sicsaft/` y tablas ya pobladas — no es lo que el usuario pidió (dijo
"ya no lo usamos", no "rompé la app QR"). Mismo precedente ya sentado en el propio CCP: "La sección
de Ubicaciones que vivía acá se quitó de esta pantalla (2026-09-13) — el backend de Ubicacion sigue
existiendo […] pero ya no tiene ABM propio" (`EstructuraPage.tsx:30-32`).

**Alcance de este incremento: se deja de _mostrar_ Ubicación en toda la UI de Controles de área**
(la columna de la tabla vieja desaparece junto con la tabla misma; el reporte nunca la mostraba).
El dato sigue viajando y persistiendo igual que hoy — cero cambios en `app-qr-sicsaft/`,
`cis/`, `core/` backend o migraciones.

## 3. Diseño

### 3.1 Nueva arquitectura de navegación (reemplaza tabla-plana + modal)

```
/dashboard/controles-area
  → Organigrama (landing nueva)
    Organización
      └─ Dirección (area.dependencia, "Sin dirección" si no tiene)
          └─ Departamento (area.departamento, se omite el nivel si nadie de esa Dirección lo usa —
             mismo criterio ya usado en CCP JerarquiaSection)
              └─ Área — con badge de "N reportes" (contados sobre GET /inventarios en memoria)
    + botón "Ver historial" (arriba, fuera del árbol — ver §3.4)

/dashboard/controles-area/reportes?areaId=…|direccion=…|departamento=…&fecha=YYYY-MM-DD&pagina=N
  → Lista de reportes del alcance elegido (clic en una Área filtra por esa área; clic en el
    encabezado de una Dirección/Departamento filtra por todas las áreas debajo — mismo dato, sin
    endpoint nuevo). Filtro de fecha (<input type="date">) + paginación real (10 por página,
    Anterior/Siguiente) en vez de una tabla que crece sin límite — así ninguna pantalla depende de
    scroll de página completa para caber.

/dashboard/controles-area/reporte/:sesionId
  → Pantalla completa (ya no modal) del informe de una sesión. Mismo contrato de datos que hoy
    (`GET /inventarios/:id/control`), header corregido para mostrar el nombre del área (no el
    UUID), organizado para caber sin scroll de documento en un viewport estándar (ver §3.3).
```

`AlertasTab.tsx:175` cambia su link de
`/dashboard/controles-area?...&sesionId=...` (que hoy abre el modal) a
`/dashboard/controles-area/reporte/:sesionId?organizacionId=...` directo.

`AppShell.tsx` — el chequeo de "activo" del ítem de sidebar (`matches.includes(location.pathname)`,
línea 97) es comparación exacta; con sub-rutas nuevas bajo `/dashboard/controles-area/*` pasa a
`location.pathname === m || location.pathname.startsWith(m + '/')` — cambio de una línea, sin
afectar a los demás ítems (ninguno tiene hijos hoy).

### 3.2 Organigrama — adaptado de CCP, no reusado tal cual

`ccp/EstructuraPage.tsx` y `core/frontend/` son SPAs independientes que **no comparten código**
(regla ya establecida del proyecto). Se construye un componente nuevo en `core/frontend/` con la
misma agrupación por Dirección/Departamento, pero:
- cada Área es un botón (no texto plano) con un badge de conteo, navega a `/reportes?areaId=`;
- cada encabezado de Dirección/Departamento también es clickeable (navega con `?direccion=`/
  `?departamento=`, suma los conteos de sus áreas);
- una Dirección con 0 reportes en cualquiera de sus áreas igual se muestra (visibilidad de la
  estructura completa), con el badge en `0` en vez de ocultarse.

Fuente de datos: `cisClient.getAreas(organizacionId)` (nuevo) + `cisClient.getInventarios(organizacionId)`
(ya existe) — un solo `useMemo` cruza ambos por `areaId`.

### 3.3 Reporte de sesión — qué cambia en `PantallaControlArea.tsx`

- Header: agrega resolución `areaId → area.nombre` (mismo `getAreas()` de arriba, cacheado una vez
  por organización) — corrige el bug del UUID en el título.
- Dependencia de página completa: dejar de asumir que vive dentro de un `Modal` con
  `overflow-y-auto` (`ControlesAreaTab.tsx:191`) — pasa a ser el contenido de su propia ruta,
  con su propio `<h1>`/breadcrumb ("← Volver a Área X") en vez del botón "Cerrar ✕" del modal.
- Las 3 listas simultáneas (Escaneados / Fuera de área / No se escanearon, líneas 346-367) son lo
  que más spacio vertical consume con datos reales — pasan a un selector de 3 pestañas (mismo
  patrón que ya existe hoy para Control BPI/Escaneos/Historial) mostrando una lista a la vez,
  cada una en un panel de altura fija con scroll interno acotado (no scroll de documento completo
  — un panel con scroll propio para una lista que puede tener decenas de ítems es estándar, no lo
  que el usuario está señalando como problema).
- Botón "Descargar PDF" en el header (ver §3.5).

### 3.4 ¿Dónde queda "Historial" (DOC-034 Parte B)?

Hoy vive como una 3ra pestaña dentro del modal de una sesión puntual — pero el corte diario
(`resumen_diario`) es **por organización, no por sesión**: no encaja en la navegación nueva
(Organigrama → Área → Sesión). Pasa a ser un botón "Ver historial" en el propio landing del
Organigrama (junto al título, mismo nivel que "Organización"), que muestra `HistorialSesiones.tsx`
tal cual ya existe hoy, sin cambios — solo se reubica desde adentro del modal de sesión hacia el
landing. **Marco esto como la decisión menos obvia de este documento — si el usuario la quiere en
otro lugar, es un ajuste de una línea de routing, no de diseño.**

### 3.5 Botón "Descargar PDF" — módulo nuevo, cliente puro

No hay ninguna librería de PDF en el repo hoy (`jspdf`/`pdfmake`/`react-pdf`/`html2canvas` — cero
resultados en todo el monorepo). Se agrega **`jspdf`** (única dependencia nueva, ~200KB, sin
dependencias nativas, ya probada en Vite) en `core/frontend/package.json`.

Nuevo módulo `core/frontend/src/lib/pdf-informe-control.ts`, una sola función exportada
`generarPdfInformeControl(datos: InformeControlPdfInput): void` — recibe el mismo view-model ya
calculado en pantalla (KPIs, hallazgos, segmentos de categoría, estado declarado, veredicto,
nombre de área/dirección/departamento, operador, fechas) y dibuja texto/tablas vectoriales
directamente con la API de `jspdf` (no captura de pantalla vía `html2canvas` — un PDF de texto real
es más liviano, nítido en cualquier zoom, y no depende de que el layout on-screen quepa en una
imagen). `PantallaControlArea.tsx` solo arma el input y llama a la función — la generación vive en
su propio archivo, mismo criterio de "un archivo, una responsabilidad" que ya usan
`DonutChart.tsx`/`KpiCard.tsx`/`colores.ts`.

## 4. Plan de implementación (orden)

1. `cis-client.ts` (core/frontend): agregar `interface Area` + `getAreas(organizacionId)` (copia
   adaptada de `ccp/src/lib/cis-client.ts:185-195,446-451`).
2. Componente nuevo `OrganigramaControlesArea.tsx` (landing): jerarquía + badges de conteo + botón
   "Ver historial" + navegación a `/reportes`.
3. Componente nuevo `ReportesDeAreaPage.tsx`: lista paginada + filtro de fecha, según el `scope`
   recibido por query params.
4. `PantallaControlArea.tsx`: resolver nombre de área en el header, sacar de layout de modal a
   layout de página completa, listas en pestañas, agregar botón "Descargar PDF".
5. `lib/pdf-informe-control.ts` (nuevo) + dependencia `jspdf`.
6. `ControlesAreaTab.tsx`: se reduce a un simple *router* de las 3 sub-vistas de arriba (o se
   elimina y las 3 rutas nuevas reemplazan directo su única ruta actual en `App.tsx` — a definir en
   la implementación, es un detalle interno).
7. `App.tsx` + `AppShell.tsx`: rutas nuevas + fix del chequeo de "activo" del sidebar.
8. `AlertasTab.tsx`: actualizar el link "Ver reporte completo" a la ruta nueva.
9. `README.md` de `core/frontend/`: reflejar la IA nueva (reemplaza la descripción actual del
   pop-up de hace unas horas).
10. Tests (`vitest`) de lo nuevo: agrupación por Dirección/Departamento con conteos, filtro de
    fecha, paginación, y el módulo de PDF (se testea que arma las secciones esperadas, no el
    render binario). Mantener `test:cov` en el umbral vigente.

## 5. Fuera de alcance (explícito)

- Cambios a `app-qr-sicsaft/`, `cis/`, `core/` backend, `cip/`, o migraciones — cero endpoints
  nuevos, cero columnas nuevas.
- Eliminar `ubicacionId` del contrato o del esquema — sigue existiendo, solo deja de mostrarse.
- Push/tiempo real para el conteo de reportes — se recalcula al cargar/refrescar la pantalla, mismo
  criterio de "refresco manual" que ya usa `AlertasTab.tsx`.
- Editar áreas/direcciones desde este portal — sigue siendo de solo lectura, la escritura sigue
  siendo exclusiva de `administrador-patrimonial` en CCP (DOC-023).
