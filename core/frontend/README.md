# core/frontend — Portal del Directivo SICSAFT (SYS-10)

## Objetivo
Portal WEB exclusivo del rol **Directivo** (`directivo`), orientado a directores y tomadores de decisiones.
Provee visualización del dashboard gerencial ejecutivo (RF-09 / CIP) y la funcionalidad de designación del
**Profesional de AFT** (`administrador-patrimonial`) de su propia organización.

Físicamente reside bajo `core/frontend/`, pero **le habla a CIS mediante OIDC/HTTP, nunca a CORE directamente** ([ADR-003](../../adr/ADR-003-frontend-de-core-para-directivo.md)).

## Estado
🟢 **Completamente funcional y verificado**:
- **Autenticación OIDC + PKCE con Keycloak 26** ([ADR-004](../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md)).
- **Dashboard Ejecutivo / CIP**: En instalaciones **Nivel 2** el CIP — Centro de Inteligencia Patrimonial vive bajo `/dashboard/*`. Desde 2026-09-09 este portal es el **único** lugar donde se accede al CIP — el CCP dejó de enlazarlo y de hospedarlo (ver [`ccp/README.md`](../../ccp/README.md)).
- **CIP con navegación directa en el sidebar** (2026-09-14, reemplaza la Fase 2/3 anterior de sub-pestañas internas — `CipPage.tsx` eliminado): cada sección es su propia ruta bajo `/dashboard/*`, elegible directo desde la sidebar (`AppShell.tsx`), en vez de vivir como tabs dentro de una página única. La sidebar muestra estas 4 entradas solo si `esNivel2()` (`lib/nivel.ts`, RF-A: si el cliente tiene el CIP contratado/instalado) — un Nivel 1 sigue viendo un único "Resumen ejecutivo" con el teaser (`RequireNivel2.tsx`):
  - **Resumen** (`/dashboard`, `ResumenTab.tsx`): 5 KPI (Total AFT, En Servicio, En Mantenimiento, Inactivos, Valor AFT CLP), Control Día/Acumulado por veredicto (Excelente/Aceptable/Deficiente, vía `GET /dashboard/veredictos` nuevo en CIS→CIP) y Distribución por Categorías.
  - **Activos** (`/dashboard/activos`, `ActivosTab.tsx`): catálogo analítico de Activos Fijos — tabla en desktop/tablet y tarjetas apiladas en mobile (`<sm`), filtro de texto libre + selects por Dirección/Área/Categoría/Estado, ficha en un modal (`Modal` en `components/ui.tsx`) con toda la información incluida Marca/Modelo (la tabla ya no las muestra, solo la ficha) y Dirección (`activo.areaDependencia`, "Sin asignar" si no tiene). El CIP no ofrece altas, bajas, reincorporaciones, ediciones ni adjuntos; las escrituras siguen restringidas a `administrador-patrimonial`.
  - **Controles de área** (`/dashboard/controles-area`, `ControlesAreaTab.tsx`): tabla a todo el ancho de las sesiones de control enviadas desde la App QR, con un botón "Ver reporte" por fila (rediseño 2026-09-15, pedido del usuario con referencia visual — antes era un panel fijo al costado de la tabla). Ese botón abre un **popup** (`Modal` de `components/ui.tsx`, ancho `max-w-5xl`) con el mismo toggle de 3 vistas de siempre: **Control BPI** (Pantalla 8 rediseñada — tarjetas KPI, panel de Hallazgos por severidad, donut "AFT por categoría" cruzando el catálogo, barra de "Estado declarado"; vía `PantallaControlArea.tsx`/`lib/pantalla-8.ts`), **Escaneos** (estado declarado, baja sugerida, observaciones) e **Historial** (`HistorialSesiones.tsx`, DOC-034 Parte B, 2026-09-15) — corte diario por veredicto generado a medianoche por `ResumenDiarioScheduler` en CIP (`GET /dashboard/historico`), no calculado al vuelo. La URL acepta `?sesionId=` para abrir el popup directo en esa sesión (usado por el link de Alertas). Portado de `ccp/src/pages/InventariosPage.tsx`; pantalla de solo lectura, sin cambios de guard. `DonutChart.tsx`/`KpiCard.tsx` (nuevos, `components/`) se extrajeron de `ResumenTab.tsx` para reusarlos acá.
  - **Alertas** (`/dashboard/alertas`, `AlertasTab.tsx`, 2026-09-14, entrelazada a su reporte desde DOC-034 Parte A 2026-09-15): primer consumidor real de `GET /dashboard/fuera-de-area` (CIS→CIP) — el dato y el cliente ya existían desde DOC-019 pero nada en la UI lo mostraba. Por cada AFT que apareció fuera de su área durante un control, muestra dónde se lo encontró (`areaRealId`) y dónde debería estar según `GET /catalogo` (registro que administra el Profesional de AFT), resolviendo ambos IDs a nombre con el mismo catálogo que ya usan Resumen/Activos. Cada alerta trae además el `sesionId`/`veredicto` de la sesión que la generó (calculados una sola vez en CIP, nunca recalculados acá): un badge con el veredicto y un link "Ver reporte completo" que abre esa sesión exacta en Controles de área. Solo lectura, refresco manual.
- **Designación de Profesional de AFT**: `GET/POST /directivo/usuarios` en CIS, protegido por `DirectivoGuard` que asegura el aislamiento multi-tenant basándose en el JWT.
- **Empaquetado en `.exe`**: Embebido dentro de `sicsaft-core` sirviendo en `directivo.sicsaft.localhost` o en ventana nativa tras login por rol.

## Desarrollo y Ejecución Local

```bash
cd core/frontend
cp .env.example .env
npm install
npm run dev             # Servidor Vite en http://localhost:5177
npm run build           # Compilación TypeScript + Vite
```

### Variables de Entorno (`.env`)
```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=sicsaft
VITE_KEYCLOAK_CLIENT_ID=core-frontend
VITE_CIS_URL=http://localhost:3000
```

## Depende de
- **CIS (`cis/`)**: Gateway para resolver el dashboard ejecutivo y la gestión del Profesional de AFT.
- **Keycloak 26**: Proveedor de identidad OIDC.

## Bloquea
- Ningún subsistema depende de `core/frontend/` (es un cliente final).

## Documentos Relacionados
- [ADR-003](../../adr/ADR-003-frontend-de-core-para-directivo.md) — Despliegue de frontend de Directivo en `core/` comunicándose vía CIS.
- [ADR-004](../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — Autenticación oficial Keycloak 26.
- [DOC-022](../../aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md) — Reestructuración y separación de portales por rol.
- [DOC-027](../../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md) — Bitácora de gotchas y pruebas reales.

## Próximo Paso Sugerido
- Mantener sincronizadas las métricas del dashboard ejecutivo a medida que se incorporen nuevos indicadores en CIP.

