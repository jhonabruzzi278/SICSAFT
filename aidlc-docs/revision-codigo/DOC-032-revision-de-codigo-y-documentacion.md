# DOC-032 — Revisión de código y documentación

> **Estado**: Fase 0 completa (instrumentación). Fases 1-5 pendientes de arranque.
> **Alcance**: repo completo — 40.0k líneas de código fuente, 31.1k de test, 126 documentos.
> **Instrumentación**: `herramientas/revision-codigo/inventario.mjs` ·
> [grafo interactivo](../diagrams/grafo-revision-codigo.html)

## Por qué acá y no bajo un sistema

La convención AI-DLC de [CLAUDE.md](../../CLAUDE.md) es `aidlc-docs/<sistema>/`, y una fase que
toca varias capas se documenta bajo el sistema donde nace la decisión. Esta revisión no nace en
ninguno: cruza los 12 a la vez y su producto es un criterio común. Se sigue el precedente de
`aidlc-docs/diagrams/`, que ya es una carpeta por tema y no por sistema.

## Qué se pidió y qué NO es esta fase

**Se pidió**: buscar documentación desactualizada, código repetitivo y comentarios innecesarios;
dejar sólo lo que aporte valor; hacerlo paso a paso y con un grafo que mantenga fresco el contexto
del proyecto.

**No es**: una refactorización de arquitectura, un cambio de comportamiento, ni una campaña para
bajar un porcentaje de comentarios. Ningún lote de esta revisión debe cambiar lo que el sistema
hace. Si al revisar aparece un cambio de diseño que valga la pena, se anota como hallazgo y se
trata aparte — no se cuela en un PR de limpieza.

---

## 1. Cómo se mide

`node herramientas/revision-codigo/inventario.mjs --tabla` recalcula todo. Existe porque una
revisión de 40k líneas repartidas en 12 sistemas no se sostiene de memoria entre sesiones, y porque
"esto quedó más limpio" tiene que poder demostrarse con el mismo número medido dos veces.

Lo que calcula, y por qué ese número y no otro:

| Métrica | Para qué sirve |
|---|---|
| `loc`, `pctComentario` | Ordenar por dónde empezar. No es una meta: un archivo con 40% de comentario puede ser el mejor del repo. |
| `ratioTest` | Un sistema con poco test se revisa distinto — no hay red que avise si el "limpiar" rompió algo. |
| `huerfanos` | Comentarios que citan un archivo que ya no existe. **El hallazgo más objetivo de la revisión**: no depende de gusto. |
| `docsDesactualizados` | Documentos que nombran algo que el repo ya reemplazó (Zitadel → Keycloak, Base Patrimonial Central → BPI). |

El detector de huérfanos se validó a mano contra su primera corrida y se le sacaron cuatro
familias de falso positivo: globs (`*.schemas.ts`), salidas de build (`dist/main.js`), `.d.ts` de
dependencias, y nombres partidos por el salto de línea (`service-` + `orchestrator.ts`, que sí
existe). Pasó de 33 candidatos a **15 hallazgos verificados**. El estado en que quedó el repo es
CRLF: sin normalizarlo, el `\r` invisible rompía el empalme de líneas en silencio.

El estado de avance y los hallazgos viven aparte, en `estado-revision.json`, editado a mano: volver
a correr el script recalcula las métricas **sin pisar el criterio ya aplicado**.

### Punto de partida (commit `01c839a`)

| sistema | loc | coment% | test/loc | docs | huérf | docs✗ |
|---|---:|---:|---:|---:|---:|---:|
| CORE | 7.934 | 11,6% | 1,40 | 1 | 5 | 0 |
| APP QR (PWA) | 7.888 | 5,9% | 0,14 | 2 | 0 | 4 |
| CCP (portal AFT) | 7.368 | 5,5% | 0,16 | 1 | 1 | 1 |
| CIS | 5.898 | 10,2% | 1,49 | 1 | 7 | 2 |
| SICSAFT CORE (.exe) | 5.806 | 22,1% | 0,87 | 4 | 0 | 1 |
| CORE frontend | 2.049 | 6,0% | 0,29 | 1 | 0 | 1 |
| CIP | 1.906 | 6,9% | 1,11 | 1 | 1 | 1 |
| DevOps | 728 | 24,5% | 0 | 6 | 1 | 6 |
| Herramientas (ETL) | 262 | 3,8% | 0,98 | 1 | 0 | 0 |
| Landing | 148 | 0% | 0 | 1 | 0 | 0 |
| Casos de uso (e2e) | — | — | — | 16 | 0 | 3 |
| Documentación | — | — | — | 91 | 0 | 32 |
| **TOTAL** | **39.987** | | | **126** | **15** | **51** |

Sólo hay **5 TODO/FIXME reales** en todo el código fuente. (Un `git grep -i todo` da 221 archivos:
"todo" es una palabra española y aparece en prosa por todos lados. La deuda marcada explícitamente
es mínima; la que hay está en otro lado.)

---

## 2. El criterio: qué comentario se queda

Es lo que hace repetible la revisión. Sin esto, "innecesario" es opinión y el resultado depende de
quién revisó.

**Se queda el comentario que responde algo que el código no puede responder solo:**

- **El porqué de una decisión**, sobre todo si la obvia era otra.
  `managed-process.ts`: *"El orden importa: hay que matar el árbol ANTES que al hijo directo.
  Cuando el padre muere, el nieto queda reparentado y `taskkill /T` ya no lo alcanza."*
- **Un bug real, con su fecha y su síntoma.**
  `managed-process.ts`: *"Bug real encontrado instalando el .exe en la ruta por defecto
  (2026-09-03): con `shell:true` Node corre `cmd /d /s /c` y NO quotea el command…"*
- **La cita a la fuente de verdad** — tomo, ADR o DOC-XXX, con sección.
  `inventarios.service.ts`: *"ver DOC-006 5: una organización/área/ubicación inexistente es 400, no
  un 500 crudo de Postgres."*
- **Un invariante del dominio** que el tipo no expresa (Tomo III 4.10: nunca `DELETE` real).
- **Una trampa de plataforma** que costó horas y volvería a costarlas.
- **Por qué algo NO se hizo**, cuando la ausencia parece un olvido.

**Se va:**

- **El que reformula el código en prosa.** `// incrementa el contador` sobre `contador += 1`.
- **El que compara contra algo que ya no existe.** Los 15 huérfanos. Pedirle al lector que compare
  con `zitadel-admin.service.ts` es pedirle que abra un archivo borrado.
- **El andamiaje de una migración ya consumada.** Cuando el 100% del código es Keycloak, "reemplaza
  a ZitadelAuthModule" ya no orienta a nadie: orientaba durante la transición.
- **El encabezado decorativo** que sólo repite el nombre del símbolo que sigue.
- **El comentario de import.**

**Regla de desempate**: ante la duda, se queda. Un comentario de más cuesta unos segundos de
lectura; uno de menos puede costar el mismo bug dos veces. Esta revisión borra lo que **estorba o
miente**, no lo que sobra por poco.

**Sobre el 22,1% de `sicsaft-core`**: es el doble del resto y es el código más nuevo. No es una
meta a bajar. Ahí viven los gotchas de Windows/Electron que ya costaron bugs reales y que ningún
lector deduce del código. Se revisa con el criterio de arriba, uno por uno, sin número objetivo.

### Y qué documento se corrige

Distinguir esto evita reescribir la historia del proyecto:

| Tipo | Qué es | Qué se hace |
|---|---|---|
| `README.md` de un sistema | Estado **actual** — CLAUDE.md lo declara fuente de verdad y exige sincronizarlo en cada commit relevante | **Se corrige siempre.** |
| `CLAUDE.md`, `NOMENCLATURA.md`, `ARQUITECTURA-WAF.md`, `ROADMAP.md` | Normativos: dicen qué hacer hoy | **Se corrigen siempre.** |
| `DOC-XXX`, `ADR-XXX` | Decisión **fechada**. Un DOC anterior a ADR-004 que diga "Zitadel" es un snapshot correcto de su momento | **No se reescribe.** Si quedó superado, se agrega una nota al encabezado apuntando al que lo reemplaza. |

Excepción explícita del repo: "Base Patrimonial Central" **se corrige siempre**, esté donde esté —
CLAUDE.md lo instruye textualmente ("se corrige, no se cita").

---

## 3. Los cuatro ejes

- **Eje A — Documentación que afirma algo falso.** El más caro: manda a la gente en la dirección
  equivocada.
- **Eje B — Comentarios sin valor.** Huérfanos (mecánico), luego criterio.
- **Eje C — Código repetido.** Con una distinción que no se puede saltear: hay duplicación
  **deliberada y documentada** en este repo, y de-duplicarla sería el error.
- **Eje D — Código muerto.** Exports sin consumidor, páginas de módulos retirados, boilerplate.

---

## 4. Hallazgos de la exploración inicial

Los 8 están en `estado-revision.json` con su evidencia completa y se ven en el grafo.

| # | Sev | Eje | Hallazgo |
|---|---|---|---|
| **H-01** | **Crítica** | A | **`devops/local` y `devops/prod` levantan Zitadel, pero CIS es Keycloak-only: no arrancan.** |
| H-02 | Alta | A | `CLAUDE.md` y `README.md` presentan Zitadel como el stack de identidad vigente. |
| H-03 | Alta | A | READMEs de sistema describen identidad Zitadel (`devops/local` 61 menciones, `cis` 46, `seguridad` 12…). |
| H-04 | Media | B | 15 comentarios citan archivos que ya no existen. |
| H-05 | Media | A | 12 menciones de "Base Patrimonial Central", nombre depreciado. |
| H-06 | Baja | C | `pkce.ts` byte-idéntico entre `ccp/` y `core/frontend/`. Decisión, no defecto asumido. |
| H-07 | Info | C | `calcularVeredicto` ×3 — **duplicación deliberada y documentada, no es un defecto.** |
| H-08 | Baja | B | `sicsaft-core` con 22,1% de comentario, el doble del resto. |

### H-01 en detalle — el que cambia el orden del plan

`devops/local/docker-compose.yml:93` y `devops/prod/docker-compose.yml:112` corren
`ghcr.io/zitadel/zitadel:v2.65.0` y le pasan a CIS `ZITADEL_ISSUER` / `ZITADEL_AUDIENCE`.

`cis/src/common/auth/keycloak-auth.config.ts:13-15` exige `KEYCLOAK_URL`, `KEYCLOAK_REALM` y
`KEYCLOAK_AUDIENCE` con `z.string().min(1, 'es requerido')`, **y valida al arrancar**. No existe
ningún `zitadel-auth.config.ts` en `cis/src`.

`devops/onprem` sí migró (`quay.io/keycloak/keycloak:26.0`) — es el camino del `.exe`, el
entregable del cliente. Los tres compose se tocaron el 2026-09-03, el mismo día que ADR-004: la
migración cubrió onprem y dejó local y prod atrás.

Consecuencia: `cd devops/local && docker compose up -d` — el comando que CLAUDE.md documenta como
la forma de levantar el stack completo — no puede bootear CIS. Y `devops/prod` es lo que Coolify
redespliega en el VPS.

**Esto no se arregla sin decidir primero**, y la decisión es del usuario: migrar los dos stacks a
Keycloak, o retirarlos formalmente si el `.exe` los reemplazó como camino de despliegue. Por eso
abre el plan en vez de ir con el resto de la limpieza.

### H-07 en detalle — por qué NO se toca

`calcularVeredicto` está tres veces: `app-qr-sicsaft/src/lib/verdict.ts`,
`cip/src/agregacion/veredicto.ts` y `core/src/inventarios/veredicto.ts`. El de CIP lo declara en su
encabezado: *"Puerto de app-qr-sicsaft/src/lib/verdict.ts — misma regla, implementación
independiente (DOC-018 5, ARCHITECTURE.md 5: no importar código entre desplegables)"*.

Las tres coinciden hoy. La separación entre desplegables es la regla del ecosistema, así que
unificarlas sería romper la arquitectura para ganar prolijidad. Lo único que queda por verificar es
si existe un **test de contrato** que garantice que no diverjan con el tiempo; si no existe, el
entregable de esta revisión ahí es agregarlo, no borrar código.

Es el ejemplo de por qué el eje C se revisa con la arquitectura en la mano: un detector de
duplicación lo habría marcado como deuda y habría estado equivocado.

---

## 5. Fases

Cada fase es una rama y un PR con CI en verde (`main` protegida). Orden por daño que evita, no por
tamaño.

### Fase 0 — Instrumentación ✅

`inventario.mjs`, `estado-revision.json`, el grafo y este documento.

### Fase 1 — Resolver la contradicción Zitadel/Keycloak (H-01) ✅

**Resuelto (2026-09)**: Decisión tomada de retirar formalmente `devops/local` y `devops/prod`, consolidando
el 100% de la infraestructura en el modelo on-premise / `.exe` (`devops/onprem` con Keycloak 26 y `sicsaft-core`).
Directorios eliminados y documentación sincronizada en `CLAUDE.md`, `README.md`, `ROADMAP.md` y `devops/README.md`.

### Fase 2 — La verdad del repo (H-02, H-03, H-05)

Documentos normativos y READMEs de sistema. Sin tocar los `DOC-XXX`/`ADR-XXX`, que son snapshots.
Depende del resultado de la Fase 1: qué dice `CLAUDE.md` sobre `devops/local` cambia según lo que
se decida ahí.
Verificación: `inventario.mjs` reporta 0 `docsDesactualizados` fuera de DOC/ADR históricos.

### Fase 3 — Comentarios huérfanos (H-04)

Los 15, uno por uno: corregir la referencia si el destino existe con otro nombre, o borrar la
comparación si el destino murió. Mecánico y verificable.
Verificación: `huerfanos: 0`.

### Fase 4 — Revisión por sistema (ejes B, C, D)

Un lote por sistema, en este orden:

| Lote | Sistema | Por qué en ese lugar | Riesgo |
|---|---|---|---|
| 4.1 | `sicsaft-core` | Es el `.exe` que recibe el cliente. 22,1% de comentario. | test/loc 0,87 — hay red. |
| 4.2 | `cis` + `core` | El corazón; 13,8k líneas y la mayoría de los huérfanos. | test/loc ~1,4 y cobertura exigida al 100%: la red es fuerte. |
| 4.3 | `ccp` + `core/frontend` | Los dos portales. Incluye decidir H-06. | **test/loc 0,16 y 0,29 — poca red. Ir con cuidado.** |
| 4.4 | `app-qr` + `cip` | PWA (revisar `ui/sidebar.tsx`, 718 líneas de boilerplate) y CIP (verificar el test de contrato de H-07). | app-qr 0,14 en unit, pero tiene 7 suites Playwright. |
| 4.5 | `herramientas`, `devops`, `casos-de-uso`, `landing` | Volumen chico. | ETL con `pytest` + `ruff`. |

Verificación por lote: la suite del sistema en verde y **sin bajar el umbral de cobertura
vigente**. En `cis`/`core`/`cip` el umbral es 100% de líneas y funciones — cualquier borrado de
código tiene que dejarlo intacto.

### Fase 5 — `aidlc-docs` (91 documentos)

El grueso del eje A. Se aplica la tabla de la sección 2: los `DOC-XXX` no se reescriben; a los
superados se les agrega una nota de encabezado apuntando al vigente.

---

## 6. Reglas de la revisión

1. **Nada cambia de comportamiento.** Un PR de esta revisión que altere lo que el sistema hace está
   mal armado.
2. **Los tests no se tocan para que pase la limpieza.** Si un test rompe, el borrado estaba mal.
3. **Verificar antes de afirmar.** Ya evitó dos errores: `calcularVeredicto` parecía deuda y era
   arquitectura, y 18 de los 33 huérfanos iniciales eran falsos positivos.
4. **Un lote, un PR, un tema.** Sonar en verde antes de mergear.
5. **`estado-revision.json` se actualiza al cerrar cada lote**, para que el grafo refleje el repo y
   no la intención.
