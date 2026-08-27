# Requisitos — Instalador on-premise por cliente

Ver `../requirements/INTENT.md` para el contexto completo. IDs nuevos, prefijo `INST-` para no
colisionar con los RF/RNF ya numerados de otros sistemas (ver `REQUISITOS.md` raíz).

## Funcionales

- **INST-RF-01**: El stack debe poder levantarse en modo Nivel 1 (Postgres, Keycloak — ADR-004
  Fase 3, reemplaza a Zitadel —, CIS, CORE, CIP, APP QR SICSAFT, portal Directivo y portal
  Administrador del Sistema; sin Redis desde ADR-005; DOC-025 §1 rev. 2026-08-25) sin `ccp`
  (Profesional de AFT completo,
  exclusivo de Nivel 2).
- **INST-RF-02**: El stack debe poder levantarse en modo Nivel 2 (Nivel 1 + `ccp` + `web-admin` +
  `core-frontend`) desde el mismo `docker-compose.yml`, vía Compose profiles — sin mantener
  archivos compose separados por nivel.
- **INST-RF-03**: Un script (`bootstrap-keycloak.ps1`, ADR-004 Fase 3 — reemplaza a
  `bootstrap-zitadel.ps1`) debe crear, contra un Keycloak recién levantado y vacío, el realm
  `sicsaft` (Organizations habilitado), la Organization del cliente, los 3 realm roles de negocio
  (`profesional-aft`, `directivo`, `administrador-sistema` — los 3 sin gating por nivel desde
  DOC-025 §1 rev. 2026-08-25, a diferencia del diseño original de esta línea), un client
  confidencial con service account para la integración de `cis/` con la Admin REST API, y las apps
  OIDC públicas con PKCE (`app-qr-sicsaft`/`web-admin`/`core-frontend` siempre; `ccp` solo si Nivel
  2) — sin pasos manuales en la Console de Keycloak.
- **INST-RF-04**: El script de bootstrap debe ser idempotente o fallar de forma clara si se corre
  dos veces contra la misma organización (no debe crear duplicados silenciosos).
- **INST-RF-05**: `app-qr-sicsaft` necesita su propio `Dockerfile` (no existe hoy — hoy se
  despliega en Vercel) para poder servirse dentro del stack onprem, mismo patrón que
  `ccp/Dockerfile` (build Vite + nginx unprivileged).
- **INST-RF-06**: El `.env.example` de `devops/onprem/` debe incluir solo las variables que
  aplican a una instalación de cliente (sin `GRAFANA_*`, `METRICS_TOKEN`, ni nada de
  observabilidad/k6 — eso es herramienta del admin, no del cliente).
- **INST-RF-07**: El bootstrap no debe requerir que el admin cree nada a mano en la Console de
  Keycloak para cada cliente nuevo — ver `ARCHITECTURE.md` "Automatización end-to-end". A
  diferencia del diseño original (un PAT de Zitadel auto-provisionado en el primer arranque,
  `ZITADEL_FIRSTINSTANCE_ORG_MACHINE_*`/`PATPATH`), Keycloak cierra este requisito de forma más
  simple: `bootstrap-keycloak.ps1` se autentica directo con `KEYCLOAK_ADMIN_USERNAME`/`PASSWORD`
  (las credenciales que ya arrancaron el propio contenedor), sin ningún archivo de secretos
  intermedio que auto-provisionar ni esperar.
- **INST-RF-08**: Debe existir un orquestador (`devops/onprem/instalar-cliente.ps1`) que encadene
  todo el flujo de instalación (prerrequisitos, `.env`, levantar servicios, bootstrap, build,
  verificación) en un solo comando, y un instalador `.exe` (Inno Setup) que lo envuelva con una UI
  simple — ver `devops/onprem/installer/`.
- **INST-RF-09**: `.env` (contraseñas + `KEYCLOAK_ADMIN_CLIENT_SECRET`) debe quedar con permisos
  NTFS restringidos a Administradores + SYSTEM apenas termina de usarse en la instalación — una
  sesión sin privilegios de administrador en el PC del cliente no debe poder abrirlo. A diferencia
  del diseño original (Zitadel también dejaba un `.bootstrap/` con el PAT auto-provisionado que
  proteger aparte), Keycloak no genera ningún archivo de secretos runtime adicional — no hay
  segundo directorio que este requisito deba cubrir. El instalador debe además dejar un log
  detallado en archivo
  (`instalacion.log`, mismos permisos restringidos) para que el admin pueda diagnosticar fallas
  sin depender de la ventana en pantalla — confirmado con el usuario: es el requisito previo para
  poder ocultar la ventana de PowerShell más adelante sin perder capacidad de diagnóstico
  (INST-Q-04).

## No funcionales

- **INST-RNF-01**: El stack debe correr sobre **Podman + podman-compose** en Windows 10/11, no
  sobre Docker Desktop — decisión confirmada con el usuario (menor consumo de recursos en reposo,
  sin licenciamiento comercial de Docker Desktop). Los mismos `Dockerfile`s del repo deben
  funcionar sin cambios; el `docker-compose.yml` de `devops/onprem/` se valida específicamente
  contra `podman-compose`, no se asume compatibilidad 1:1 con Docker Compose.
- **INST-RNF-02**: Ningún servicio de observabilidad/desarrollo (Prometheus, Loki, Grafana,
  cAdvisor, node-exporter, k6, dashboard de Traefik) se instala en el PC del cliente.
- **INST-RNF-03**: Las credenciales generadas para un cliente (Postgres, `eventos_outbox`
  (ADR-005), Keycloak admin, `KEYCLOAK_ADMIN_CLIENT_SECRET`) deben ser únicas por instalación —
  nunca reusar valores entre
  clientes distintos.
- **INST-RNF-04**: El README de `devops/onprem/` debe dejar explícito el orden obligatorio
  bootstrap-antes-de-build (los frontends hornean `VITE_KEYCLOAK_CLIENT_ID` en build time) para
  evitar reconstrucciones innecesarias de imágenes.

## Preguntas abiertas (no bloquean este incremento, se documentan)

- **INST-Q-01** (cerrada 2026-08-25): ¿`cip/` (BI) entra en algún nivel de producto? Sí — entra en
  Nivel 1, ver `DOC-025-niveles-producto-onprem.md` 1/3.
- **INST-Q-02**: Gestión de secretos multi-cliente (dónde guarda el admin el
  `KEYCLOAK_ADMIN_CLIENT_SECRET`/`KEYCLOAK_ADMIN_PASSWORD` de cada cliente instalado) — decisión
  operativa del admin, fuera del alcance de este repo, pero se deja registrada como necesidad real.
- **INST-Q-03**: Licenciamiento/activación por nivel — explícitamente fuera de esta fase (ver
  INTENT.md), pero se deja como pregunta para una fase de negocio futura.
- **INST-Q-04**: Ocultar la ventana de PowerShell durante la instalación (confirmado con el
  usuario: "cuando esté listo lo ocultamos") — deliberadamente NO implementado todavía. Mientras
  el flujo sigue en verificación activa (ver historial de fixes reales en los PRs de
  `devops/onprem/`), la ventana visible es lo que permitió diagnosticar cada bug real encontrado
  hasta ahora — ocultarla antes de tener el flujo estable dejaría al admin sin forma de ver por
  qué algo falló en el momento. INST-RF-09 (log en archivo) es el prerrequisito para poder hacerlo
  sin perder esa capacidad de diagnóstico. Ni siquiera con la ventana oculta hay secreto en
  pantalla — ningún `Write-Host` de `instalar-cliente.ps1` imprime un valor real de contraseña
  (confirmado revisando el script), solo referencias a "ver .env"; el riesgo real siempre fue el
  archivo en disco, no la pantalla, y ese ya está cerrado por INST-RF-09 independientemente de
  cuándo se oculte la ventana.
- **INST-Q-05**: "Que ni buscando en el disco encuentre nada legible" (pedido del usuario) — los
  permisos NTFS de INST-RF-09 cierran el caso realista (cliente sin privilegios de administrador
  en su propia PC). No cierran el caso de un cliente que SÍ tiene o consigue acceso de
  administrador — ahí cualquier NTFS ACL es evadible trivialmente, y "compilar" los `.ps1` a un
  `.exe` (ej. `ps2exe`) tampoco es cifrado real, solo sube la vara para alguien casual. Cerrar ese
  caso de verdad (secretos nunca en disco en texto plano, ni siquiera para un admin local)
  necesitaría un diseño distinto — ej. un vault/agente que el admin del negocio controle
  remotamente — que es un cambio de arquitectura mayor, no un ajuste de este script. Se deja
  documentado como pregunta abierta, no se resuelve en este incremento.
