# DOC-013: Portal WEB — módulos MVP (Fase 5)

> Documento ya anticipado por número en `web/README.md` § "Documentos relacionados" y en el
> criterio "Done" de `ROADMAP.md` Fase 5 — este es su contenido real, diseñado adelantado por
> pedido explícito del usuario. **Estado: diseño, sin construir.**

## 1. Alcance

6 módulos + hub, contra el mismo contrato CIS/CORE que ya usa (o va a usar) APP QR
(`ARQUITECTURA-WAF.md` §8). Ver `requirements/REQUIREMENTS.md` para el detalle RF/RNF completo —
este documento se centra en **qué expone cada módulo y contra qué endpoint pega**.

## 2. Hub

Post-login, antes de cualquier módulo. Lee `GET /entitlements` (ya implementado desde Fase 0) y
renderiza una tarjeta por cada entrada de `modulosContratados` de la organización del operador —
nunca las 6 fijas. Un contrato con solo `inventario-qr` habilitado (caso real DUOC UC hoy) vería
Activos + Inventarios, no Contratos ni Auditoría (esos requerirían un módulo contratado propio a
definir — ver §5, nota abierta).

## 3. Módulos y su contrato de datos

| Módulo | Lee de | Escribe en | Endpoint (DOC-006, salvo nota) |
|---|---|---|---|
| Activos ✅ | `activos` + `catalogo_activos` (DOC-005) | `activos` (solo alta) | `GET /catalogo` (CIS, ya existía); alta = `POST /admin/activos` (CIS) → `POST /activos` (CORE, DOC-012 §5) |
| Contratos ✅ | `contratos`/`contrato_sedes` (DOC-004) | ambas | `GET /admin/contratos` (CIS, nuevo, → `GET /contratos` en CORE, también nuevo); alta/estado = `POST /admin/contratos`/`PATCH /admin/contratos/:id` (CIS) → CORE (DOC-012 §7) |
| Inventarios ✅ | `sesiones_inventario` + `inventarios` (DOC-006 §3) | — (solo lectura) | `GET /inventarios` (listado, CIS+CORE, nuevo) + `GET /inventarios/:id` (detalle, nuevo); `GET /inventarios/:id/estado` (ya existía) |
| Áreas/Ubicaciones/Responsables ✅ | `areas`/`ubicaciones`/`responsables` (DOC-005) | las tres tablas | `GET/POST /admin/areas`, `GET/POST /admin/ubicaciones`, `GET/POST /admin/responsables` + `PATCH /admin/responsables/:id/estado` (CIS, todos nuevos, → CORE `src/estructura/`, también nuevo) |
| Auditoría ✅ | `auditoria` (DOC-005) | — (solo lectura, filtrable por usuario/operación/fecha) | `GET /admin/auditoria` (CIS, nuevo, → `GET /auditoria` en CORE, también nuevo) |

**Actualización (2026-08-14)**: Activos (consulta + alta), Contratos (consulta + alta +
transición de estado), Inventarios (consulta de sesiones + detalle de escaneos) y Auditoría
(consulta, solo lectura) ya tienen endpoint real e implementados en `web/`. Contratos necesitó
agregar `GET /contratos` en CORE (no existía) y extender el puente CIS con `PATCH` (CORS solo
permitía `GET`/`POST` hasta ese incremento). Inventarios necesitó agregar el listado
(`GET /inventarios`) en CORE y CIS — el detalle por id ya existía pero exigía conocerlo de
antemano. Auditoría necesitó el primer controller real sobre `AuditoriaRepository` (DOC-011 lo
dejaba sin consumidor); el mismo día se le agregaron filtros por usuario/operación (búsqueda
parcial) y rango de fecha, cerrando el requisito original — sin filtro por organización, porque
`auditoria` no tiene `organizacionId` (gap conocido, distinto del anterior, ver `web/README.md`
§ "Gaps"). Áreas/Ubicaciones/Responsables
(RF-05) es el módulo que más esfuerzo real requirió — módulo nuevo `core/src/estructura/` con
`Ubicacion`/`Responsable` cruzando `sedeId`/`areaId` contra `organizacionId` antes de insertar
(defensa en profundidad, ni `ubicaciones` ni `responsables` tienen columna `organizacionId`
propia). Sin edición de Área/Ubicación ni asignación de `responsable_id`/`ubicacion_principal_id`
a un Área (DOC-005 §2, "sin ciclo estricto de creación"). Los 6 módulos del MVP de Fase 5 quedan
implementados.

## 4. Autorización a nivel de módulo, no solo de ruta

Ocultar un ítem del menú no es autorización — el mismo criterio que ya aplica CIS/CORE (`CLAUDE.md`,
"segregación... validada en el CORE, nunca confiar en un filtro hecho solo en el cliente"). Cada
llamada a un endpoint de escritura debe fallar con `403` si el rol del operador no la habilita,
del lado del servidor — el hub oculta el módulo por UX, no como control de seguridad.

## 5. Nota abierta: ¿un "módulo" WEB es lo mismo que un `moduloContratado`?

DOC-004 §5 define `modulosContratados` con un solo valor real hoy (`inventario-qr`, para APP QR).
Los 6 módulos de WEB no tienen todavía su propio valor en ese vocabulario controlado — ¿se
agregan valores nuevos (`gestion-patrimonial`, `auditoria-web`...) o WEB completo es un único
módulo (`portal-web`) que un contrato habilita en bloque? **No se resuelve en este documento** —
es una decisión de modelo de negocio (¿se vende WEB completo o por módulo?) que le corresponde a
quien defina el contrato comercial, no a este diseño técnico.

## Documentos relacionados

[DOC-006](../../../core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md) — contrato base que
este documento extiende. [DOC-004](../../../base-patrimonial/DOC-004-modelo-contrato.md) §5/§7 —
`modulosContratados` y el punto abierto de quién escribe `Contrato`. [ADR-002](../../../adr/ADR-002-identidad-zitadel-multi-tenant.md)
§ flujo de login — de dónde sale el criterio del hub.
