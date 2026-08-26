# DOC-025 — Niveles de producto (instalación on-premise por cliente)

Documento citable desde otros DOC-XXX del repo, mismo esquema que DOC-002/004/005. Ver
`../requirements/INTENT.md` para el contexto de negocio completo.

> **Revisión 2026-08-25**: redefinición de qué portal entra en cada nivel, a pedido explícito del
> cliente de negocio. Reemplaza la versión anterior de este documento (Nivel 1 sin portal web,
> los 3 portales juntos recién en Nivel 2) — ver historial de git para la versión previa si hace
> falta reconstruir una instalación vieja.

## 1. Los 3 niveles (modelo de precios del usuario)

| Nivel | Qué incluye | Servicios concretos del monorepo |
|---|---|---|
| **Nivel 1** | APP QR SICSAFT (única fuente de captura) + SICSAFT CORE + Base Patrimonial Central + CIS + portal Directivo + portal Administrador del Sistema + CIP (BI/dashboards) | `postgres`, `redis`, `zitadel`, `core` (con `core-migrate`), `cis`, `app-qr-sicsaft`, `core-frontend` (Directivo), `web-admin` (Administrador del Sistema), `cip` (con `cip-migrate`) |
| **Nivel 2** | Nivel 1 + CCP (Centro de Control Patrimonial, portal **completo** de Profesional de AFT) | Nivel 1 + `ccp` |
| **Nivel 3** | Nivel 2 + integración RFID, conectada a CIS preservando la independencia tecnológica de CORE | Nivel 2 + `rfid/` — **🔲 no iniciado, sin código que empaquetar (ver `ROADMAP.md`)** |

Capacidades por nivel (lo que el cliente ve, no la lista de servicios):

- **Nivel 1**: identificación, consulta, inventarios, incidencias, historial, trazabilidad básica.
- **Nivel 2** (suma): administración web, gestión avanzada, supervisión, consultas
  institucionales, reportes, configuración, operación centralizada.
- **Nivel 3** (suma): captura automática, eventos RFID, supervisión, zonas, movimientos, alertas,
  automatización patrimonial.

### Portal de Profesional de AFT: dos piezas distintas, no una

A diferencia de Directivo y Administrador del Sistema (un solo portal cada uno, disponible desde
Nivel 1), el rol Profesional de AFT tiene **dos accesos web distintos en dos niveles distintos**:

- **Nivel 1** — un portal liviano de AFT ("web-aft": identificación, consulta, inventarios,
  incidencias, historial, trazabilidad básica), pensado para complementar la APP QR desde un
  navegador. **🔲 No iniciado — sin código, sin carpeta propia en el monorepo todavía.** No hay
  servicio para él en `devops/onprem/docker-compose.yml` hasta que se construya (mismo criterio de
  honestidad que RFID en Nivel 3, más abajo). Al agregarse, seguirá el mismo patrón de
  `CLAUDE.md` "Al agregar un sistema nuevo" (esqueleto Vite/React, Dockerfile, CI dedicado, login
  OIDC propio).
- **Nivel 2** — `ccp/` (Centro de Control Patrimonial), el portal **completo** ya implementado en
  el monorepo, con las capacidades de gestión avanzada listadas arriba. No es una versión
  "desbloqueada" del portal de Nivel 1 vía feature flag — es una aplicación distinta
  (`ccp/`), gated por el perfil `nivel2` de Compose igual que antes.

Directivo (`core/frontend`) y Administrador del Sistema (`web_admin`) no tienen este problema: es
el mismo portal en todos los niveles donde aparecen, ya implementado, sin versión liviana.

## 2. Dónde vive esta distinción

**A nivel de despliegue** (qué contenedores se levantan, vía Compose profiles en
`devops/onprem/docker-compose.yml` — ver `ARCHITECTURE.md`), **no a nivel de dato**. No se agrega
ningún campo "nivel" a `Contrato`/`Organización`/`Sede` en `base-patrimonial/` — el nivel
contratado no es un atributo del dominio patrimonial, es una decisión de qué instalar en el PC del
cliente. Si en el futuro se necesita que el propio sistema sepa "en qué nivel corre" (por ejemplo,
para ocultar features de un nivel superior en la UI), eso es una decisión de diseño nueva, fuera
de este documento — hoy el nivel lo decide qué se instaló, no un flag que el software consulte.

## 3. Qué queda explícitamente fuera de los 3 niveles

- **Observabilidad (Prometheus/Loki/Grafana), `k6`, dashboard de Traefik**: herramienta del admin
  del producto, nunca se instala en el PC del cliente, en ningún nivel.

> **`cip/` (Centro de Inteligencia Patrimonial / BI) — cierre de INST-Q-01 (2026-08-25)**: entra en
> Nivel 1 (tabla arriba), no queda fuera de los 3 niveles. `devops/onprem/docker-compose.yml` suma
> `cip`/`cip-migrate` sin perfil (siempre activos), con base propia `cip` separada de `core`
> (RNF-01/RNF-05) — mismo patrón ya usado en `devops/local/`. CIS deja de usar el workaround de
> `CIP_URL`/`CIP_SERVICE_TOKEN` de relleno (ver comentario del servicio `cis` en
> `docker-compose.yml` antes de esta fecha) y pasa a hablarle al `cip` real de esta misma
> instalación.

## 4. Relación con `ADR-002` (Zitadel multi-tenant)

`ADR-002` diseñó Zitadel para multi-tenant **dentro de un mismo VPS** (`ZITADEL_ORG_ID_MAP`,
varias Organizaciones en una sola instancia de Zitadel). El modelo on-premise de este documento es
distinto: **una instancia de Zitadel completa por cliente**, no una Organización más dentro de una
instancia compartida. No contradice `ADR-002` — es un modelo de despliegue paralelo (VPS
compartido vs. instalación aislada), ambos coexisten como opciones de venta distintas, no se
reemplaza uno por otro.

## 5. Justificación de negocio por nivel

> Contenido de negocio aportado directamente por el usuario (2026-08-25), no un tomo oficial —
> registrado acá porque razona **por qué** la tabla de la sección 1 tiene sentido comercial, no
> solo qué contiene. No cambia ninguna definición técnica de las secciones 1-4.

**Nivel 1 — alta prioridad**: tiene una lógica comercial clara y autosuficiente — bajo costo
tecnológico, instalación sencilla, inventario digital, trazabilidad y una Base Patrimonial real
desde el primer día, con camino de crecimiento hacia Nivel 2/3 sin migrar de plataforma. Es el
nivel de entrada natural: no depende de que el cliente compre nada más para justificar su precio.

**Nivel 2 — alta prioridad, viable**: lo que suma la WEB (CCP) es administración, supervisión,
gestión avanzada y acceso institucional — pero ese valor está condicionado a que ya exista CORE y
la Base Patrimonial detrás (Nivel 1). **WEB sola no es ventaja competitiva**: sin un CORE real
gobernando qué operación puede tocar la base y sin una Base Patrimonial con datos reales, un
portal de administración es una interfaz sobre nada. Por eso Nivel 2 nunca se vende suelto — es
Nivel 1 obligatorio más CCP, nunca CCP sin la base debajo (consistente con la tabla de la sección
1: Nivel 2 = Nivel 1 + `ccp`, no un stack alternativo).

**Nivel 3 — viable, mediante integración**: RFID entra como conector adicional sobre lo que ya
existe (Nivel 2), no como una reconstrucción — mismo criterio ya fijado en la sección 1 ("RFID,
conectada a CIS preservando la independencia tecnológica de CORE"). La viabilidad comercial de
Nivel 3 depende de que Nivel 1/2 ya estén sólidos: es una extensión del valor existente, no un
producto aparte.
