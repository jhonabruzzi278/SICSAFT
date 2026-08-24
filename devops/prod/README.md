# Secretos y despliegue de producción

## Decisión revisada (2026-08-20): Coolify, variables nativas en vez de SOPS + age

El despliegue de producción corre como recurso "Docker Compose" en **Coolify**, self-hosted sobre
el mismo VPS propio (no cambia "VPS propio, Docker Compose" de `devops/README.md` — Coolify es
solo el panel/proxy que orquesta ese mismo modelo, nunca un PaaS de terceros). Con Coolify ya
administrando el ciclo de vida del stack, los secretos de `devops/prod/docker-compose.yml` se
cargan directo en su panel ("Environment Variables" del recurso) en vez de cifrarse con SOPS+age
en git — ver `devops/prod/.env.example` para la lista completa de variables a cargar, y
`devops/prod/docker-compose.yml` para dónde entra cada una.

**Por qué el cambio**: con Coolify como orquestador, el flujo SOPS+age original (descifrar en un
paso de GitHub Actions, inyectar al `docker compose up` por SSH) deja de aplicar tal cual —
Coolify no ejecuta ese pipeline, dispara su propio deploy (webhook de git o botón manual) y ya
resuelve las variables desde su propio panel antes de levantar los contenedores. Mantener SOPS+age
en paralelo hubiera significado sincronizar dos fuentes de verdad para los mismos secretos.

**Trade-off aceptado** (mismo tipo que el de SOPS+age, ver sección de abajo para el detalle
original): sin versionado cifrado en git de los secretos — viven solo en la base de datos de
Coolify. Si el equipo crece y hace falta auditar cambios de secretos o rotarlos por fuera del
panel, ahí sí reconsiderar (decisión futura, no bloqueante hoy).

## Despliegue con Coolify

1. Crear el recurso **Docker Compose** en Coolify, apuntando al repo y a
   `devops/prod/docker-compose.yml` como compose file.
2. Cargar las variables de `devops/prod/.env.example` con sus valores reales en la pestaña
   "Environment Variables" del recurso (nunca completar ese archivo `.env.example` con valores
   reales ni commitearlo).
3. Para cada servicio expuesto públicamente (`zitadel`, `cis`, `ccp`, `web-admin`,
   `core-frontend`, `grafana` — los únicos con `expose:` en el compose), asignar su dominio real
   desde la pestaña "Domains" de ese servicio (ver tabla de dominios en `devops/README.md`) —
   Coolify emite el certificado TLS solo (Let's Encrypt) apenas el dominio resuelve al VPS. No
   hace falta escribir labels de Traefik a mano.
4. Desplegar. `core-migrate`/`cip-migrate` corren una vez y salen (`restart: "no"`) antes de que
   `core`/`cip` arranquen — mismo orden que en local, Coolify solo lo ejecuta.

## Revisión de la implementación (2026-08-20)

Al escribir `devops/prod/docker-compose.yml` se revisó todo `devops/` en busca de problemas reales
antes de darlo por listo. Se encontraron y corrigieron 4:

1. **Promtail descartaba el 100% de los logs de producción.** El filtro de
   `devops/local/observability/promtail-config.yml` (compartido entre local y prod por referencia
   relativa) reconocía contenedores por nombre exacto `sicsaft-local-*` — en prod
   (`sicsaft-prod-*`) ningún contenedor matcheaba, así que Loki quedaba vacío sin ningún error
   visible. Corregido filtrando por el label `com.docker.compose.project` (que Compose pone en
   todo contenedor) en vez de parsear el nombre — funciona igual en ambos ambientes.
2. **`ZITADEL_ORG_ID_MAP` sin comillas rompía el YAML.** Docker Compose interpola `${VAR}` en el
   texto del compose ANTES de parsearlo como YAML — un JSON sin comillas (`{"a":"b"}`) es un
   mapping YAML válido, no el string literal que CIS necesita para hacerle `JSON.parse()`. El
   archivo local ya lo entrecomillaba para su valor hardcodeado; el de prod no, para la variable.
   Corregido.
3. **Retención de Loki sin ajustar para producción.** `devops/local/observability/loki-config.yml`
   decía explícitamente en su propio comentario "ajustar en `devops/prod/` cuando exista el VPS
   real" — se estaba reusando tal cual (7 días). Ahora `devops/prod/observability/loki-config.yml`
   es una copia propia con 30 días.
4. **`depends_on` con `service_started` donde ya había un healthcheck real disponible.**
   `cis`/`core`/`cip` traen `HEALTHCHECK` real contra `GET /health` desde su propio `Dockerfile` —
   los servicios que dependen de ellos (`cip`→`core`, `cis`→`core`/`cip`, los 3 frontends→`cis`)
   ahora esperan `service_healthy` en vez de solo "el proceso arrancó", en local y en prod. Zitadel
   se queda en `service_started` a propósito: su imagen oficial no trae `HEALTHCHECK` ni
   shell/wget utilizables desde un exec-healthcheck — armar uno sin verificarlo contra una
   instancia real hubiera sido peor que no tener ninguno (un healthcheck que siempre falla frena
   el deploy entero).

## Hallazgo real (deploy contra Coolify, 2026-08-24)

La sección anterior se escribió por revisión de código — según `devops/README.md`, sin una
instancia de Coolify corriendo todavía. Un deploy real más reciente falló al montar
`prometheus.yml`:

```
error mounting "/data/coolify/applications/<uuid>./local/observability/prometheus.yml" to
rootfs at "/etc/prometheus/prometheus.yml": ... not a directory: Are you trying to mount a
directory onto a file (or vice-versa)?
```

Coolify no resuelve de forma confiable un bind mount (ni un build context) cuyo origen usa `..`
para salir del directorio del compose file — el path que terminó intentando montar ni siquiera
contenía el segmento `devops/` esperado. `prometheus.yml`, `promtail-config.yml`,
`grafana/provisioning`, `grafana/dashboards` y el build/init de `postgres` compartían config con
`devops/local/` exactamente así (`../local/...`), deliberadamente, para no duplicar — el único que
ya tenía copia propia era `loki-config.yml` (por una razón distinta: su retención debía diferir).

**Corregido dándole a cada uno una copia propia dentro de `devops/prod/`**, mismo patrón que ya
existía para Loki: `observability/prometheus.yml`, `observability/promtail-config.yml`,
`observability/grafana/`, `postgres/Dockerfile` y `postgres/init/`. Contenido idéntico al de
`devops/local/` al momento de copiar — sin sincronización automática; cada archivo copiado dice en
su propio comentario dónde está su par y que hay que replicar los cambios a mano si diverge.

Se evaluó y se descartó un symlink en vez de una copia real: este repo tiene `core.symlinks` en
`false` y, al probarlo, este entorno de desarrollo (Windows) no pudo crear un symlink real —
se hubiera commiteado como un archivo de texto con la ruta como contenido, no como el YAML real,
un error silencioso peor que el que se está corrigiendo.

**Sin verificar**: si el campo "Base Directory" del recurso Docker Compose en el panel de Coolify
se puede fijar a `/devops/prod`, quizás ninguna de estas copias hiciera falta — no se probó
porque el deploy no podía quedar bloqueado esperando esa vuelta. Si se confirma que funciona,
evaluar volver al patrón de referencia relativa antes de duplicar config nueva en el futuro.

**Relacionado, no confirmado**: `../local/postgres/init` usaba el mismo patrón pero era
carpeta→carpeta en vez de archivo→archivo. A diferencia de `prometheus.yml` (que sí crasheó por
choque de tipos), un mount de carpeta a carpeta con origen faltante no necesariamente crashea —
Docker puede haber montado un directorio vacío en su lugar sin ningún error visible, en cuyo caso
los scripts de `postgres/init/` (creación de `ZITADEL_DB_USER`/`CORE_DB_USER`/`CIP_DB_USER`,
`CREATE EXTENSION pgaudit`) nunca habrían corrido. Si este stack ya llegó a levantar Postgres
antes de este fix, verificar a mano que esas bases/usuarios existan antes de asumir que
funcionan.

**Brecha de seguridad relacionada, corregida en el mismo incremento**: `GET /metrics` de CIS
quedaba públicamente alcanzable en este stack (CIS sí tiene router público en Traefik/Coolify, a
diferencia de core/cip) — señalado, sin resolver, en el comentario de `cis/src/app.module.ts`
sobre `PrometheusModule`. Se descartó resolverlo a nivel de Traefik/Coolify (ipAllowList o router
de mayor prioridad): la sintaxis exacta de labels/entrypoints de la instancia de Coolify de este
VPS no se puede verificar desde acá, y una regla mal escrita fallaría en silencio (el router
simplemente no se activa, sin error visible) — el peor resultado posible para un fix de
seguridad. En su lugar, `GET /metrics` ahora exige un Bearer token
(`cis/src/common/metrics/metrics-token.guard.ts`, `MetricsConfig.token` desde `METRICS_TOKEN`) —
verificable de punta a punta sin depender de Coolify. Sin la variable configurada el guard deja
pasar todo (default esperado en `devops/local/`, donde no hay nada que proteger); en
`devops/prod/` hace falta setear `METRICS_TOKEN` en el panel de Coolify (ver `.env.example`) o el
propio guard deja un `WARN` en los logs de CIS avisando que quedó sin autenticar. Prometheus lo
manda vía `bearer_token_file` (`observability/prometheus.yml`), leyendo un Docker secret
(`secrets: metrics_token` en `docker-compose.yml`, con `environment: METRICS_TOKEN` como fuente)
en vez de tenerlo en texto plano en un archivo commiteado — probado en este entorno que
`secrets: <nombre>: environment: VAR` sí lo resuelve Docker Compose v5.1.3 (`docker compose
config` expandiéndolo correctamente a `/run/secrets/metrics_token`); no verificado contra la
versión de Compose que usa Coolify en el VPS real. Si esa versión no soporta ese campo, el modo
de falla es seguro: Prometheus no puede leer el secret y no manda el header, así que el guard
sigue rechazando — nunca queda `/metrics` abierto por accidente, en el peor caso deja de
scrapearse (visible como target caído en Grafana, no como una brecha).

## Lo que sigue documentado abajo (SOPS + age) — histórico, ya no es el flujo activo

Se deja el resto de este documento para quien necesite el detalle de por qué se había elegido
SOPS+age originalmente (aplica igual si en el futuro se decide volver a un flujo sin Coolify, o
un componente puntual necesita secretos cifrados en git por fuera del panel).

Cerraba la decisión que `devops/README.md` "Cyberseguridad del VPS" dejaba abierta ("SOPS + age
... o un gestor de secretos dedicado"): **SOPS + age**, sin infraestructura adicional que correr,
respaldar o mantener disponible — coherente con el resto de este repo (todo versionado en git,
`docker-compose.yml` sobre un único VPS, sin Kubernetes ni PaaS gestionado, ver
`devops/README.md`).

## Por qué SOPS+age y no un gestor dedicado

Un gestor dedicado (Vault, Infisical, AWS Secrets Manager) tiene sentido cuando hace falta
rotación dinámica de credenciales o ACLs finos entre varios equipos. Acá el despliegue es un solo
VPS con Docker Compose y, hoy, un operador — un gestor dedicado sería un servicio más para correr,
sellar/desellar (Vault) y respaldar, con un problema de arranque circular (¿dónde vive el secreto
que abre al gestor de secretos?). SOPS+age no tiene ese problema: el archivo cifrado vive en git
como cualquier otro archivo versionado, y solo la clave privada `age` (que nunca toca el repo)
hace falta para leerlo.

**Trade-off aceptado**: sin rotación automática ni revocación centralizada — la clave privada la
custodia el operador del VPS a mano (gestor de contraseñas u offline). Si el equipo crece y hace
falta acceso diferenciado por persona, ahí sí migrar a un gestor dedicado (decisión futura, no
bloqueante hoy).

## Instalación de las herramientas

- **sops**: https://github.com/getsops/sops — `scoop install sops` (Windows), `brew install sops`
  (macOS), o el binario del release de GitHub en el VPS (Linux).
- **age**: cualquier implementación compatible con el formato estándar sirve — `age` de
  FiloSottile o `rage` (https://github.com/str4d/rage, Rust, mismos binarios `age`/`age-keygen` o
  `rage`/`rage-keygen` según el paquete). SOPS no distingue cuál generó la clave.

## Generar la clave real (una vez, por operador)

```bash
age-keygen -o ~/.config/sops/age/keys.txt   # o rage-keygen, mismo formato
```

Esto imprime la clave pública (`age1...`) — copiarla a `.sops.yaml` (raíz del repo, reemplazar el
placeholder `age1REEMPLAZAR_...`). La clave **privada** (`AGE-SECRET-KEY-1...`, en el archivo
`keys.txt`) **nunca se commitea** — vive solo en la máquina del operador y, en el VPS, en el mismo
path o en `$SOPS_AGE_KEY_FILE`. Perder esta clave sin backup significa perder acceso a todos los
secretos cifrados con ella — guardar una copia offline (gestor de contraseñas, USB cifrado).

Con más de un operador, cada uno genera su propia clave y agrega su pública a `.sops.yaml` — SOPS
cifra para todos los recipients listados, cualquiera puede descifrar con la suya.

## Flujo

```bash
# Primera vez: copiar la plantilla y completar valores reales
cp devops/prod/prod.example.yaml devops/prod/prod.enc.yaml
# editar devops/prod/prod.enc.yaml con los valores reales de producción

# Cifrar in-place (usa la config de .sops.yaml, detecta el archivo por su nombre)
sops -e -i devops/prod/prod.enc.yaml
# ahora sí se commitea — está cifrado
git add devops/prod/prod.enc.yaml

# Editar un secreto ya cifrado (descifra en un editor temporal, vuelve a cifrar al guardar)
sops devops/prod/prod.enc.yaml

# Descifrar a stdout (para inyectar en el deploy, nunca para dejarlo en un archivo plano)
sops -d devops/prod/prod.enc.yaml
```

`.sops.yaml` reconoce el archivo por su nombre (`devops/prod/*.enc.{yaml,yml,json,env}`) — no
hace falta pasar `--config` a mano en cada comando.

**Nota Windows**: el `path_regex` de `.sops.yaml` usa `devops[/\\]prod[/\\]...` (no
`devops/prod/...` a secas) — verificado que SOPS en Windows no matchea una barra `/` literal en
el path_regex contra el separador real del filesystem; con la clase de caracteres `[/\\]` funciona
en Windows y Linux por igual. Si se edita ese regex, volver a probar un roundtrip
cifrar→commitear→descifrar antes de confiar en él.

## Uso en el deploy (cuando exista el VPS real)

El pipeline de `devops/README.md` "Pipeline CI/CD" descifra en el paso de deploy, nunca antes:
la clave privada age vive como secreto de GitHub Actions (`SOPS_AGE_KEY`, el contenido del
`keys.txt`, no un archivo) solo para el job de deploy a producción, no para CI de PRs. Ejemplo del
paso relevante:

```yaml
- name: Descifrar secretos de producción
  env:
    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
  run: sops -d devops/prod/prod.enc.yaml > /tmp/prod.env
```

El archivo descifrado (`/tmp/prod.env` arriba) nunca se commitea ni se loguea — vive solo en el
runner efímero del job, se descarta al terminar.

## Documentos relacionados

`devops/README.md` "Cyberseguridad del VPS" (decisión original, ahora cerrada acá) y "Pipeline
CI/CD" (dónde encaja el paso de descifrado). `devops/local/.env.example` (mismas variables, para
el ambiente local sin cifrar — ese sí puede vivir en texto plano porque nunca se commitea, ver
`.gitignore` raíz).
