# DOC-037 — Línea base de las pestañas del CIP

> **Documento de congelamiento.** Las cuatro secciones del CIP descritas acá quedan como línea base
> oficial. **No se modifican salvo que un documento posterior lo formalice** (pedido explícito del
> usuario, 2026-09-17). Un pedido verbal de cambio sobre estas pantallas se responde con este
> documento, no con un commit.

## 0. Origen y alcance

Pedido directo del usuario (2026-09-17), sección por sección del portal del Directivo
(`core/frontend/`). Alcance: presentación, más el **retiro** de la escritura que introdujo
[DOC-036](DOC-036-marcar-sesion-revisada-cip.md). No hay migraciones nuevas ni endpoints nuevos.

Decisiones confirmadas con el usuario (`AskUserQuestion`):

1. **El retiro de "marcar como revisado" llega hasta el endpoint, dejando las columnas.** Las
   columnas `revisado` / `revisado_por` / `revisado_en` de `veredicto_sesion` y su migración
   `1789569859543_notificaciones-revisado-veredicto-sesion.ts` **no se tocan**: el retiro queda
   reversible y no se pierde el registro histórico de quién revisó qué.
2. **Las alarmas muestran solo AFT extraviados, y solo de controles defectuosos.**
3. **La subpágina sigue titulándose `Reportes — {alcance}`**, conviviendo con la sección
   "Reportes": se lee como jerarquía natural.

## 1. Sección Resumen — congelada

| # | Cambio | Dónde |
|---|---|---|
| 1 | `Portal del Directivo` → `Modelo Inteligente de Gestión Patrimonial`, con token `text-accent-strong` | `components/AppShell.tsx` (header), `components/RequireNivel2.tsx` (teaser de Nivel 1), `pages/LoginPage.tsx` |
| 2 | El encabezado del sidebar nombra el nivel instalado: `Nivel 2. QR + Dashboard` o `Nivel 1. QR` | `components/AppShell.tsx` |

Sobre el punto 2: la validación de nivel **ya existía** (`lib/nivel.ts`, `esNivel2()`, alimentado
por `VITE_SICSAFT_NIVEL` que inyecta `sicsaft-core.exe` en runtime). Solo se le dio texto a las dos
ramas — antes Nivel 1 decía "Directivo" y no nombraba el nivel. Cambio visual: no gatea nada.

"Portal del Directivo" sigue siendo el nombre del **sistema** `core/frontend/` en documentación y
arquitectura; lo que cambió es lo que lee el usuario en pantalla.

## 2. Sección Activos — congelada sin cambios

Validada tal como está. Cero modificaciones de código.

## 3. Sección Reportes (ex "Controles de área") — congelada

Se adopta **"Reportes"** como nomenclatura vigente, iniciando la línea de nomenclatura de reportes
del CIP.

| # | Cambio | Detalle |
|---|---|---|
| 1 | Ítem del sidebar → `Reportes` | `components/AppShell.tsx` |
| 2 | Título → `Reportes` | Reemplaza `Controles de Área y Contrastación BPI` en `OrganigramaControlesArea.tsx` |
| 3 | Eliminado el subsistema de notificaciones de color | Ídem |
| 4 | Queda el total de reportes por Dirección, en azul (`bg-accent/12` + `text-accent-strong`) | Ídem |

**La ruta `/dashboard/controles-area` se mantiene** aunque el nombre visible cambie: es parte de
enlaces ya compartidos, y las sub-rutas `/reportes` y `/reporte/:sesionId` cuelgan de ella.

### 3.1. Por qué los colores y "marcar como revisado" caen juntos

No eran dos funcionalidades: eran una. El badge rojo/amarillo del organigrama solo se pintaba si la
sesión **no** estaba revisada —

```ts
const severidad = !s.revisado ? severidadDeVeredicto(s.veredicto) : null;
```

— con `defectuoso` → rojo y `aceptable` → amarillo. "Marcar como revisado" existía precisamente
para apagar ese badge. Al eliminar los indicadores de color, el marcado se queda sin propósito, y
al revés. Por eso se retiran en el mismo cambio y queda únicamente el conteo total por Dirección.

## 4. Sección Alarmas — congelada

### 4.1. Qué cambió

Antes listaba **AFT fuera de lugar** (un AFT encontrado en un área que no es la suya), con los dos
veredictos. Ahora lista **AFT extraviados**: los que el control no encontró. Es el término que el
resto del sistema ya usaba para lo mismo (`LISTAS_TABS` de `PantallaControlArea`: "AFT
extraviados" = `faltantes`).

Además, **una alarma por Área**, no por AFT: el Directivo mira dónde falló el control, no el código
puntual de cada activo.

### 4.2. Regla de negocio (la parte importante)

> Por cada Área se toma su control **más reciente**. Si cerró con veredicto `defectuoso` y dejó AFT
> extraviados, hay alarma. La alarma se baja **únicamente** registrando un control posterior en la
> misma Dirección y Área con veredicto `exitoso` ("Proceso Excelente").

**Una alarma no se persiste: se deriva.** No hay tabla de alarmas, no hay campo de descarte, no hay
botón para silenciarla. Esa ausencia es intencional y es la garantía de auditoría: sin estado que
escribir, **nadie puede bajar una alarma sin hacer el control real en terreno**.

Solo `defectuoso` genera alarma. Un control `aceptable` posterior **no** la baja — solo el
`exitoso`. Hay un test unitario dedicado a esa distinción.

### 4.3. Presentación

Título `AFT Extraviado en acción de control` · debajo la Dirección con el Área a su derecha ·
debajo, en rojo, `Detectado el 16-09-2026, 5:02:04 p. m.` · y a la derecha del todo el botón rojo
`Ver reporte completo →`, que abre la Pantalla 8 de esa sesión.

### 4.4. Datos

Sin backend nuevo. Se cruzan endpoints existentes:

- `GET /dashboard/sesiones` (vía `getTodasLasSesiones`) → veredicto, área y fecha de cada control.
- `GET /admin/areas` → Dirección (`areas.dependencia`) y nombre del Área.
- `GET /inventarios/:id/control` → los extraviados (`faltantes`), consultado **solo** por las
  sesiones que ya pasaron el filtro (último control del área + defectuoso), que son pocas.

La lógica vive aislada en `lib/alarmas.ts` (`sesionesConAlarma`, función pura) con 8 tests.

## 5. Retiro de DOC-036

[DOC-036](DOC-036-marcar-sesion-revisada-cip.md) queda **retirado**. Lo eliminado:

| Capa | Qué |
|---|---|
| `core/frontend` | Botón y modal de confirmación en Pantalla 8, `dashboardClient.marcarRevisado`, el helper `authorizedPatch` y el gate `!s.revisado` del organigrama |
| `cis` | Ruta `PATCH /dashboard/sesiones/:id/revisar` con `DirectivoGuard`, `DashboardConnectorService.revisarSesion`, `CipClientService.revisarSesion` y su helper `patch` |
| `cip` | `PATCH /dashboard/sesiones/:sesionId/revisar` y `DashboardRepository.marcarSesionRevisada` |

**Lo que NO se eliminó**: las columnas de `veredicto_sesion` ni su migración. `GET
/dashboard/sesiones` sigue devolviendo `revisado`/`revisadoPor`/`revisadoEn`; simplemente ya nadie
los consume. Con esto CIS vuelve a ser **100% lectura hacia CIP**, como era antes de DOC-036.

## 6. Verificación

`lint:ci`, `test` y `build` en verde en los tres sistemas tocados: `core/frontend` (62 tests),
`cis` (317) y `cip` (116), con cobertura de líneas y funciones al 100% en `cis` y `cip`.
`core/frontend` no tiene suite e2e (ver `CLAUDE.md`), así que la validación visual de las cuatro
secciones se hace sobre el `.exe` en ejecución.

## 7. Cláusula de congelamiento

Las secciones **Resumen**, **Activos**, **Reportes** y **Alarmas** quedan cerradas en este estado.
Todo cambio posterior requiere un DOC nuevo que referencie a este y explicite qué reemplaza. En
particular, requieren documento formal:

- Cambiar la regla de alta/baja de alarmas de §4.2.
- Agregar cualquier forma de descartar o silenciar una alarma sin control en terreno.
- Reintroducir indicadores de color en Reportes, o volver a marcar sesiones como revisadas.
- Cambiar la denominación "Reportes" o "Modelo Inteligente de Gestión Patrimonial".
