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
| Activos | `activos` + `catalogo_activos` (DOC-005) | `activos` (solo alta) | `GET /catalogo`; alta = endpoint nuevo de Fase 4, sin definir en DOC-006 todavía |
| Inventarios | `sesiones_inventario` + `inventarios` (DOC-006 §3) | — (solo lectura) | `GET /inventarios/:id/estado` |
| Áreas/Ubicaciones/Responsables | `areas`/`ubicaciones`/`responsables` (DOC-005) | las tres tablas | Sin endpoint todavía — extensión de DOC-006 pendiente (mismo caso que alta de Activos) |
| Auditoría | `auditoria` (DOC-005) | — (solo lectura) | Sin endpoint todavía — `GET /auditoria`, mencionado como pendiente en DOC-011 |
| Contratos | `contratos`/`contrato_sedes` (DOC-004) | ambas | Sin endpoint todavía — DOC-004 §7 ya dejó abierto "quién crea/edita un Contrato" |

**Nota honesta**: de los 6 módulos, solo Activos (consulta) e Inventarios tienen endpoint real
hoy (los de DOC-006, ya diseñados en Fase 2). El resto requiere que Fase 4 (Administrador
Patrimonial) defina sus propios endpoints de escritura — este documento no los inventa
prematuramente, los deja marcados como dependencia explícita en vez de rellenar el hueco con un
contrato adivinado.

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
