# ADR-002: Identidad y SSO — Zitadel self-hosted + modelo Organización → Contrato → Sede

## Status
Aceptado

## Context
`seguridad/README.md` (SEC) define el modelo `Usuario → Rol → Permisos → Organización → Área →
Acción` pero está bloqueado porque el mecanismo real de autenticación depende de SICSAFT CORE —
una de las 4 preguntas abiertas sin responder en `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md` 6.

El modelo de negocio del usuario agrega un requisito que el modelo actual no cubre: el acceso no
se otorga por organización completa, sino por **organización + sede específica, según contrato
vigente**. Ejemplo real: se vende la solución a DUOC UC, pero el contrato solo cubre la sede
Melipilla — un usuario de DUOC en otra sede no debe tener acceso aunque pertenezca a la misma
organización.

Además, el ecosistema se despliega bajo un dominio propio (`sicsaft.cl`, aún no comprado) con
varios subdominios por sistema (`app.`, `qr.`, `api.`, `cip.`) y `app-qr-sicsaft` es una PWA
instalable — no se puede depender de una cookie de sesión compartida entre orígenes distintos para
lograr SSO real.

Se evaluaron dos rutas de identidad: **Zitadel (self-hosted, Docker)** y **WorkOS (SaaS, B2B SSO
gestionado)**. Ambas soportan OIDC/OAuth2 estándar y multi-tenant.

## Decision
**Identidad/SSO: Zitadel, self-hosted, corriendo como servicio propio en el VPS
(`id.sicsaft.cl`).**

- El usuario administra su propio VPS y prioriza autonomía sobre delegar la superficie de
  identidad a un tercero — Zitadel corre en Docker igual que el resto del ecosistema, sin costo
  por usuario activo.
- Zitadel modela **"Organización" como entidad nativa del producto**, coincidiendo casi 1:1 con lo
  que el ecosistema ya necesita (Organización = tenant) sin tener que construir esa noción a mano
  sobre un IdP genérico.
- Es un IdP OIDC/OAuth2 estándar (authorization code + PKCE), por lo que WEB (`app.sicsaft.cl`) y
  APP QR (`qr.sicsaft.cl`, PWA instalable con origen propio) hacen SSO real vía token, no vía
  cookie compartida — resuelve el problema de origen cruzado sin inventar mecanismo propio.

**Modelo de datos: se agrega "Contrato" entre Organización y Sede/Área**, extendiendo el modelo de
`seguridad/README.md`:

```
Organización (tenant, ej. "DUOC UC")
  └─ Contrato (vigencia, módulos contratados, lista de sedes cubiertas)
       └─ Sede/Área (ej. "Melipilla") — ya existía como Área/Ubicación
            └─ Usuario → Rol → Permisos → Acción
```

**Punto de validación: el CIS, no el token.** El JWT emitido por Zitadel lleva solo
`user_id`/`org_id`/`roles[]`, vida corta (~15 min) + refresh — **no** codifica la lista de sedes
habilitadas dentro del token. La cobertura de sede se resuelve en cada request contra un caché de
entitlements en el CIS (invalidado por evento cuando un contrato cambia, no por TTL fijo — mismo
patrón de caché de catálogos que recomienda `ARQUITECTURA-WAF.md` 5). Esto extiende la regla ya
existente en `ARQUITECTURA-WAF.md` 3 ("el CORE nunca confía en un `organizacionId`/`areaId` que no
haya sido validado ya por el CIS") a `sedeId`/vigencia de contrato.

Si un usuario pertenece a una organización sin contrato vigente para su sede, el login funciona
igual — solo no ve ningún módulo habilitado (mejor UX y mejor palanca de upsell que negar el login
directamente).

### Alternativa descartada: WorkOS (SaaS)
Especializado en SSO B2B, capa gratis generosa, y saca la operación del IdP de encima —
técnicamente más rápido de arrancar. Se descarta porque el usuario ya opera su propio VPS y
prefiere no depender de un tercero para el componente más crítico del ecosistema (identidad); si
en el futuro la operación de Zitadel se vuelve una carga desproporcionada para el equipo, migrar a
un IdP SaaS es un cambio acotado porque ambos hablan OIDC estándar.

## Consequences
- Nuevo servicio en `devops/`: Zitadel + su propia base de datos (Postgres dedicada, no compartida
  con la Base Patrimonial) en el `docker-compose` del VPS.
- `seguridad/README.md` deja de estar bloqueado por la pregunta de mecanismo de auth — el
  mecanismo es OIDC vía Zitadel; el modelo de Contrato en el dominio de Base Patrimonial ya está
  documentado, ver
  [`base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md)
  (entidades, estados, invariantes) — lo que sigue abierto es que CORE lo implemente.
- CIS gana una responsabilidad nueva explícita: validar `sedeId`/contrato vigente en cada request,
  no solo `organizacionId` como decía el documento antes de este ADR.
- Login flow: `sicsaft.cl` (landing, público, sin auth) → botón "Iniciar sesión" → redirect a
  `id.sicsaft.cl` (Zitadel) → si el usuario pertenece a más de una organización, paso de selección
  → token → redirect a `app.sicsaft.cl` (o `qr.sicsaft.cl` si venía de la PWA) → el hub post-login
  solo muestra módulos habilitados por el contrato vigente de la sede activa.
