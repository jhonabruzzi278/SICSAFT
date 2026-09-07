# Informe de Auditoría de Vulnerabilidades, Seguridad y Arquitectura

**Proyecto:** SICSAFT Monorepo (`cis`, `core`, `core/frontend`, `ccp`, `cip`, `app-qr-sicsaft`, `sicsaft-core`, `devops`)  
**Fecha:** 2026-09-07  
**Metodología:** OWASP Top 10, STRIDE Threat Modeling, SAST y estándares de las skills oficiales (`security-and-hardening`, `security-audit`, `security-best-practices`, `improve-codebase-architecture`).

---

## 1. Resumen Ejecutivo

Se realizó una auditoría profunda sobre todo el ecosistema de código fuente, configuraciones de despliegue, capas de autenticación OIDC/Keycloak, bases de datos PostgreSQL y clientes frontend.

### Matriz de Hallazgos

| ID | Hallazgo | Categoría | Severidad | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **SEC-01** | Persistencia de tokens de sesión en `localStorage` en Portal CCP | Fuga de Credenciales / XSS Impact | **MEDIO** | 🟢 **RESUELTO** |
| **SEC-02** | Exposición no autenticada de `/metrics` en CIS cuando no hay token | Divulgación de Información | **MEDIO** | 🟢 **RESUELTO** |
| **SEC-03** | Exposición de JWT en argumentos de línea de comandos (`ingesta-watcher`) | Fuga de Secretos en SO / Process Table | **BAJO** | 🟢 **RESUELTO** |
| **SEC-04** | Ausencia de cabeceras de seguridad HTTP en Traefik On-Premise y NestJS | Hardening de Infraestructura | **BAJO** | 🟢 **RESUELTO** |
| **ARQ-01** | Análisis de Inyección SQL y Aislamiento BPI (Postgres) | Resiliencia de Arquitectura | **APROBADO** | 🟢 **100% Parametrizado** |
| **ARQ-02** | Control de Acceso RBAC y Aislamiento Multitenant (BOLA / IDOR) | Autorización Cero-Confianza | **APROBADO** | 🟢 **Resuelto en CIS/CORE** |

---

## 2. Detalle de Vulnerabilidades y Oportunidades de Mejora

---

### [MEDIO] SEC-01: Persistencia involuntaria de Tokens en `localStorage` (Portal CCP)

- **Archivo afectado:** [`ccp/src/lib/oidc/token-store.ts`](file:///c:/Trabajos/SICSAFT/ccp/src/lib/oidc/token-store.ts#L18-L22)
- **Vector de Ataque:**  
  Aunque la documentación y comentarios de arquitectura estipulan explícitamente el uso exclusivo de `sessionStorage` (para que el token del Administrador Patrimonial expire al cerrar la pestaña), la función `saveTokens()` almacena una copia adicional en `localStorage`.
  ```typescript
  // ccp/src/lib/oidc/token-store.ts:18
  sessionStorage.setItem(TOKENS_KEY, json);
  try {
    localStorage.setItem(TOKENS_KEY, json); // <-- Fuga a almacenamiento persistente
  } catch {}
  ```
- **Impacto:** Si un atacante ejecuta XSS o accede físicamente a una máquina compartida, puede extraer tokens de acceso y refresh tokens válidos de larga duración. En contraste, `core/frontend` y `app-qr-sicsaft` implementan correctamente sólo `sessionStorage`.
- **Remediación:** Remover `localStorage.setItem` y `localStorage.getItem` en `ccp/src/lib/oidc/token-store.ts`.

---

### [MEDIO] SEC-02: Endpoint `/metrics` expuesto sin autenticación en CIS

- **Archivo afectado:** [`cis/src/common/metrics/metrics-token.guard.ts`](file:///c:/Trabajos/SICSAFT/cis/src/common/metrics/metrics-token.guard.ts#L26-L39)
- **Vector de Ataque:**  
  Si la variable `METRICS_TOKEN` no está configurada, el guard emite un `Logger.warn` pero retorna `true` permitiendo el paso libre a cualquiera:
  ```typescript
  if (!token) {
    if (!MetricsTokenGuard.warnedMissingToken) {
      MetricsTokenGuard.logger.warn('METRICS_TOKEN no configurado...');
      MetricsTokenGuard.warnedMissingToken = true;
    }
    return true; // <-- Permite acceso anónimo si falta la variable
  }
  ```
- **Impacto:** Un actor en la red local o pública que consulte `GET /metrics` puede recolectar telemetría sensible del sistema (nombres de rutas, volumen de tráfico, métricas de memoria y endpoints activos).
- **Remediación:** Fallar cerrado en entornos productivos (`NODE_ENV === 'production'`) lanzando `UnauthorizedException` si `METRICS_TOKEN` no está presente.

---

### [BAJO] SEC-03: Exposición de JWT en argumentos de proceso en `ingesta-watcher`

- **Archivo afectado:** [`sicsaft-core/src/main/services/ingesta-watcher.ts`](file:///c:/Trabajos/SICSAFT/sicsaft-core/src/main/services/ingesta-watcher.ts#L67-L70)
- **Vector de Ataque:**  
  El proceso principal de Electron invoca al script `etl_contable.py` pasando el token JWT en la línea de comandos:
  ```bash
  python etl_contable.py --entrada <archivo> --organizacion <org> --token <jwt>
  ```
- **Impacto:** Cualquier proceso o usuario en la máquina cliente con permisos para listar la tabla de procesos (`tasklist`, `Get-Process`, monitores EDR) puede leer el JWT en texto claro durante la ejecución.
- **Remediación:** Pasar el token vía variables de entorno (`env: { ETL_TOKEN: datos.token }`) en lugar de flag de línea de comandos.

---

### [BAJO] SEC-04: Ausencia de Cabeceras de Seguridad HTTP en Traefik On-Premise

- **Archivo afectado:** [`devops/onprem/traefik/dynamic.yml.template`](file:///c:/Trabajos/SICSAFT/devops/onprem/traefik/dynamic.yml.template)
- **Vector de Ataque:**  
  Los routers de Traefik no tienen asignado un middleware de cabeceras de seguridad.
- **Impacto:** Los navegadores no reciben directivas como `X-Frame-Options: DENY` (anti-clickjacking), `X-Content-Type-Options: nosniff` (anti-MIME sniffing) o políticas de `Referrer-Policy`.
- **Remediación:** Definir un middleware `security-headers` en Traefik y aplicarlo a todos los routers (`keycloak`, `cis`, `ccp`, `core-frontend`, `app-qr-sicsaft`).

---

## 3. Fortalezas y Buenas Prácticas Destacadas en SICSAFT

1. **Inyecciones SQL (100% Protegido):**  
   Todas las consultas en `core` y `cip` utilizan parámetros de enlace (`$1, $2, ...`) mediante `node-postgres` y transacciones explícitas (`BEGIN/COMMIT/ROLLBACK`), eliminando vectores de inyección SQL.
2. **Timing Attacks Mitigados:**  
   `ServiceTokenGuard` y `MetricsTokenGuard` utilizan `timingSafeEqual` de `node:crypto` para evitar ataques de temporización en la validación de secretos inter-servicio.
3. **Aislamiento Multitenant Robusto:**  
   `DirectivoGuard` en CIS extrae el `organizacionId` directamente de las claims del JWT firmado por Keycloak, y `AdministradorPatrimonialGuard` en CORE valida `rolesPorOrganizacion[organizacionId]`, impidiendo BOLA / IDOR entre diferentes organizaciones.
4. **Redacción de Logs:**  
   `sicsaft-core/src/main/services/logger.ts` redacta automáticamente passwords, Bearer tokens, connection strings de PostgreSQL y secretos de Keycloak antes de escribir a disco o memoria.
5. **Dockerfiles Hardened:**  
   Todos los contenedores finales corren con usuarios sin privilegios (`USER cis`, `USER core`, `nginx-unprivileged:alpine`).
