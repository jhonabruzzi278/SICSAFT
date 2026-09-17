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
  - **Controles de área** (DOC-035, 2026-09-15 — reemplaza el rediseño de pop-up de esa misma mañana): 3 pantallas completas en vez de una tabla plana + modal.
    - `/dashboard/controles-area` (`OrganigramaControlesArea.tsx`) es el landing: organigrama Organización→Dirección→Departamento→Área (mismos `area.dependencia`/`area.departamento` que ya arma `ccp/EstructuraPage.tsx` — `cisClient.getAreas()`, `GET /admin/areas` de CIS, lectura abierta) con un contador de reportes por Área/Dirección/Departamento (cruce en memoria contra `GET /inventarios`, sin agregación nueva de backend). Un botón "Ver historial" muestra/oculta `HistorialSesiones.tsx` (DOC-034 Parte B, corte diario por veredicto vía `GET /dashboard/historico`) — es un dato por organización, no por sesión, así que ya no vive dentro del reporte de una sesión puntual.
    - `/dashboard/controles-area/reportes?areaId=|direccion=|departamento=&fecha=&pagina=` (`ReportesDeAreaPage.tsx`): lista de sesiones del alcance elegido, filtro por día y paginación real (10 por página) en vez de una tabla sin límite.
    - `/dashboard/controles-area/reporte/:sesionId` (`ReporteControlPage.tsx` + `PantallaControlArea.tsx`): el informe de una sesión ("Pantalla 8" — tarjetas KPI, Hallazgos por severidad, donut "AFT por categoría", barra de "Estado declarado", 3 listas de detalle ahora en pestañas para caber sin scroll de página completa) con botón "Descargar PDF" (`lib/pdf-informe-control.ts`, `jspdf`, texto vectorial armado a mano — sin `html2canvas`). El header resuelve el nombre real del área (bug corregido: antes mostraba el UUID crudo). El link "Ver reporte completo" de Alertas navega acá directo.
    - "Ubicación" dejó de mostrarse en toda esta sección (el usuario confirmó que ya no se usa) — el campo sigue existiendo en el contrato con `app-qr-sicsaft/` y en la BPI, solo se dejó de renderizar.
    - Portado originalmente de `ccp/src/pages/InventariosPage.tsx`; sigue siendo de solo lectura, sin cambios de guard. `PieChart.tsx`/`KpiCard.tsx` (`components/`) se extrajeron de `ResumenTab.tsx` para reusarlos acá (`PieChart.tsx` reemplazó a `DonutChart.tsx` el 2026-09-16, a pedido del usuario).
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

