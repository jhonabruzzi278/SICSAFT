# DOC-036: Marcar sesión revisada (primera escritura de CIP)

## Qué es

El Directivo, desde el organigrama de controles de área (DOC-035), marca una sesión de inventario
como "revisada" para bajar el contador de notificaciones pendientes de su Área/Dirección/
Departamento. Es la **primera operación de escritura de CIP** — hasta ahora todo el módulo era
solo lectura (DOC-014/DOC-018/DOC-034).

## Contrato

```
PATCH /dashboard/sesiones/:sesionId/revisar   (CIS → CIP)
Guard: DirectivoGuard (organización derivada del JWT, nunca de la ruta/body)
```

Persiste `revisado`/`revisado_por`/`revisado_en` en `veredicto_sesion`
(migración `1789569859543_notificaciones-revisado-veredicto-sesion.ts`).

## Dónde vive

| Capa | Archivo |
|---|---|
| CIP | `cip/src/dashboard/dashboard.controller.ts`, `dashboard.repository.ts` |
| CIS (puente) | `cis/src/cip-client/cip-client.service.ts`, `cis/src/dashboard-connector/` |
| Frontend | `core/frontend/src/pages/cip/OrganigramaControlesArea.tsx` |
| Permisos | `aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md` (fila "Dashboard") |

## Por qué importa

Cambia el invariante "CIP nunca escribe" que asumían DOC-014/DOC-018 — cualquier trabajo futuro
sobre CIP debe saber que ya no es 100% solo-lectura.

## Estado

🟢 Implementado y funcionando de punta a punta (2026-09-16). Sin tests e2e dedicados todavía —
cubierto solo por unit tests de CIP/CIS.
