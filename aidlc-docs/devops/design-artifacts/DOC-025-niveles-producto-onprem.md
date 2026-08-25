# DOC-025 — Niveles de producto (instalación on-premise por cliente)

Documento citable desde otros DOC-XXX del repo, mismo esquema que DOC-002/004/005. Ver
`../requirements/INTENT.md` para el contexto de negocio completo.

## 1. Los 3 niveles (modelo de precios del usuario)

| Nivel | Qué incluye | Servicios concretos del monorepo |
|---|---|---|
| **Nivel 1** | APP QR SICSAFT + SICSAFT (captura vía QR, sin portal web) | `postgres`, `redis`, `zitadel`, `core` (con `core-migrate`), `cis`, `app-qr-sicsaft` |
| **Nivel 2** | Nivel 1 + portal(es) web | Nivel 1 + `ccp` (Profesional de AFT) + `web_admin` (Administrador del Sistema) + `core/frontend` (Directivo) |
| **Nivel 3** | Nivel 2 + RFID | Nivel 2 + `rfid/` — **🔲 no iniciado, sin código que empaquetar (ver `ROADMAP.md`)** |

Los 3 portales de Nivel 2 se instalan juntos, no por separado — una organización real usa los 3
roles (Profesional de AFT, Administrador del Sistema, Directivo), no tiene sentido vender
"medio Nivel 2".

## 2. Dónde vive esta distinción

**A nivel de despliegue** (qué contenedores se levantan, vía Compose profiles en
`devops/onprem/docker-compose.yml` — ver `ARCHITECTURE.md`), **no a nivel de dato**. No se agrega
ningún campo "nivel" a `Contrato`/`Organización`/`Sede` en `base-patrimonial/` — el nivel
contratado no es un atributo del dominio patrimonial, es una decisión de qué instalar en el PC del
cliente. Si en el futuro se necesita que el propio sistema sepa "en qué nivel corre" (por ejemplo,
para ocultar features de un nivel superior en la UI), eso es una decisión de diseño nueva, fuera
de este documento — hoy el nivel lo decide qué se instaló, no un flag que el software consulte.

## 3. Qué queda explícitamente fuera de los 3 niveles

- **`cip/` (Centro de Inteligencia Patrimonial / BI)**: el usuario no lo mencionó en ningún nivel
  de precios — pregunta abierta (`REQUIREMENTS.md` INST-Q-01), no se instala en ninguna
  instalación de cliente hasta que se decida explícitamente en qué nivel entraría o si es un
  add-on separado.
- **Observabilidad (Prometheus/Loki/Grafana), `k6`, dashboard de Traefik**: herramienta del admin
  del producto, nunca se instala en el PC del cliente, en ningún nivel.

## 4. Relación con `ADR-002` (Zitadel multi-tenant)

`ADR-002` diseñó Zitadel para multi-tenant **dentro de un mismo VPS** (`ZITADEL_ORG_ID_MAP`,
varias Organizaciones en una sola instancia de Zitadel). El modelo on-premise de este documento es
distinto: **una instancia de Zitadel completa por cliente**, no una Organización más dentro de una
instancia compartida. No contradice `ADR-002` — es un modelo de despliegue paralelo (VPS
compartido vs. instalación aislada), ambos coexisten como opciones de venta distintas, no se
reemplaza uno por otro.
