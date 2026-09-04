# Harness de casos de uso — Playwright contra el stack real

Corre casos de uso de [`../`](..) como pruebas automatizadas de punta a punta: **un stack real
levantado por el propio test** (docker compose: Postgres + Keycloak + `cis` + `core` + `cip` +
`ccp` + `core-frontend`), sembrado con el caso **DUOC UC / Melipilla**, y specs de Playwright que
autentican de verdad contra Keycloak y ejercen la cadena completa del §12.33
(`ACTOR → AUTH → CIS → CORE → BPI`).

No reemplaza a los unit/e2e de cada sistema (`cis/`, `core/`, `ccp/`…), que siguen corriendo
aislados y mockeados en su propio CI. Esto es la capa de arriba: **los CU end-to-end que
[`../MATRIZ-TRAZABILIDAD.md`](../MATRIZ-TRAZABILIDAD.md) marcaba como "falta e2e"**.

## Qué cubre hoy

| Spec | CU | Qué valida | PLAN-QA |
|---|---|---|---|
| `cu-seg-001-autenticar.spec.ts` | CU-SEG-001 | Login OIDC/PKCE real de Directivo y Profesional de AFT; `aud`/`organization`/roles del JWT; credenciales inválidas rechazadas; ruta protegida sin sesión → login | QA-0.4/0.5, QA-6.1, QA-6.6 |
| `cu-pat-001-alta-activo.spec.ts` | CU-PAT-001 | Alta de activo por CIS con JWT real → persistido en CORE → visible en `/catalogo`; auditoría; fila en el CCP (blando) | — |
| `cu-adm-002-designar-aft.spec.ts` | CU-ADM-002 | El Directivo designa un Profesional de AFT desde `core/frontend`; contraseña inicial única; rol `administrador-patrimonial` asignado; un AFT recibe **403 en CIS** al intentarlo (gate real, no de UI) | QA-6.3 |

Agregar más: un archivo `cu-<dominio>-<nnn>-*.spec.ts` por CU, usando las fixtures `directivo` /
`aft` de [`fixtures/auth.ts`](fixtures/auth.ts). Para CU de APP QR / inventario, descomentar el
servicio `app-qr-sicsaft` en [`docker-compose.yml`](docker-compose.yml).

## Requisitos

- **Docker Desktop corriendo** (Linux containers). El stack son ~8 servicios; reservá ~6 GB de RAM
  para el engine.
- **Puerto 80 libre** en el host (Traefik lo publica para servir `*.sicsaft.localhost`).
- **Node 20+** y **Chromium de Playwright**.
- No hace falta tocar `/etc/hosts`: Chromium resuelve `*.localhost` → loopback solo, y el
  bootstrap por HTTP del `global-setup` usa un dispatcher de `undici`
  ([`scripts/localhost-agent.mjs`](scripts/localhost-agent.mjs)).

## Correr

```bash
cd casos-de-uso/e2e
npm ci
npx playwright install chromium
npm test
```

La **primera** corrida construye 5 imágenes (3 NestJS + 2 Vite) + la de Postgres con `pgaudit`:
**~15–25 min**. Las siguientes reusan la cache de capas y sólo reconstruyen lo que cambió
(~1–2 min de arranque).

`global-setup` hace: (1) `.env` desde `.env.example`, (2) `up` de postgres/keycloak/traefik,
(3) bootstrap de Keycloak (realm `sicsaft`, Organization `duoc-uc`, clientes OIDC, usuarios
Director + AFT con contraseñas fijas), (4) escribe `KEYCLOAK_ADMIN_CLIENT_SECRET` en `.env`,
(5) `up` del resto — `core-migrate` corre con `SICSAFT_SEED_DEV=1` y siembra la BPI —, (6) espera
al ingress. `global-teardown` hace `docker compose down -v`.

### Depuración

```bash
KEEP_STACK=1 npx playwright test cu-seg-001    # deja el stack arriba al terminar
npm run stack:logs                              # docker compose logs -f
npm run stack:ps
npm run stack:down                              # bajar y borrar volúmenes
npx playwright test --headed --project=casos-de-uso
npm run report                                  # abrir el último HTML report
```

Usuarios de laboratorio (en [`test-data.mjs`](test-data.mjs)):

| Rol | Email | Password | Portal |
|---|---|---|---|
| Directivo | `directivo@duoc-uc.e2e` | `Directivo-e2e-2026` | `http://directivo.sicsaft.localhost` |
| Profesional de AFT | `aft@duoc-uc.e2e` | `ProfesionalAft-e2e-2026` | `http://ccp.sicsaft.localhost` |

No son secretos: el stack es efímero y sólo existe en la máquina que corre los tests. **Nunca**
reusar estos valores en `devops/onprem` ni `devops/prod`.

## Diseño

- **`docker-compose.yml`** — derivado de [`devops/onprem/docker-compose.yml`](../../devops/onprem/docker-compose.yml)
  (mismo diseño verificado call-by-call contra Keycloak 26.0). Diferencias: `name` propio,
  `SICSAFT_SEED_DEV=1`, sin `restart`, Postgres publicado en `55432`, `VITE_KEYCLOAK_ISSUER` con
  el sufijo `/realms/sicsaft` correcto (ver `ccp/.env.example`).
- **`scripts/keycloak-seed.mjs`** — port a Node de `devops/onprem/lib/Bootstrap-Keycloak.psm1` +
  `sicsaft-core/src/main/keycloak-bootstrap.ts` (creación de usuarios). Mismas llamadas a la Admin
  REST API. Idempotente ante `KEEP_STACK=1`.
- **`fixtures/auth.ts`** — login real por el formulario de Keycloak, en un browser context por
  rol. Los tokens viven en `sessionStorage` (no `storageState`), así que no se cachean entre
  tests. Expone `{ page, token, api }` — `api` es un `APIRequestContext` con `Bearer` hacia CIS.
- **Asserts blandos** (`expect.soft`) para lo periférico (fila en el DOM, texto de la auditoría):
  el harness es útil desde ya y esos checks informan sin romper la corrida.

## CI

[`.github/workflows/casos-de-uso-e2e-ci.yml`](../../.github/workflows/casos-de-uso-e2e-ci.yml):
`workflow_dispatch` + nightly (`schedule`). No corre en cada push por lo pesado del build — un
equipo que quiera gate por PR agrega un trigger `pull_request` con `paths` a los sistemas
involucrados.

## Troubleshooting

| Síntoma | Causa / arreglo |
|---|---|
| `bind: address already in use` en `:80` | Otro servicio usa el 80 (IIS, otro Traefik, Skype). Liberarlo o cambiar el mapeo en `docker-compose.yml` + `test-data.mjs`. |
| `Timeout esperando Keycloak` | `docker compose -p sicsaft-cu-e2e logs keycloak`. Casi siempre es Postgres sin healthy o el puerto 80 ocupado. |
| Login queda en el form de Keycloak | Realm/cliente a medio sembrar de una corrida previa: `npm run stack:down` y reintentar. |
| `net::ERR_CLEARTEXT_NOT_PERMITTED` / `crypto.subtle is undefined` | El portal se abrió por una URL que **no** termina en `.localhost`. Usar siempre los hosts de `test-data.mjs`. |
| `.env` quedó con un secret tras una corrida interrumpida | Inofensivo — es git-ignored; la próxima corrida lo regenera. Borrarlo si molesta. |
