# Architecture — Portal WEB SICSAFT (Fase 5)

## Stack (ADR-001, mismo patrón validado en `app-qr-sicsaft/`)

| Capa | Tecnología | Por qué |
|---|---|---|
| Framework | Vite + React 19 + TypeScript, sin SSR | Todo detrás de login, sin necesidad de SEO (ADR-001) |
| UI | Tailwind CSS v4 + shadcn/ui (preset Sera) | Mismo preset que `app-qr-sicsaft`, colores reemplazados por `BRAND.md` |
| Formularios | react-hook-form + zod | Mismo patrón que `ProductFormDialog.tsx` de APP QR (RNF-04) |
| Ruteo | react-router | Rutas reales por módulo, deep-linking (ej. `/activos?areaId=...`) |
| Auth | OIDC authorization code + PKCE contra Zitadel | Mismo flujo probado end-to-end en Fase 0 — requiere una Aplicación OIDC propia en Zitadel (ver "Decisión abierta" abajo) |
| Cliente HTTP | `fetch` + capa fina de tipos compartidos con el contrato de DOC-006 | Sin cliente autogenerado todavía — los tipos de `cis/src/qr-connector/qr-connector.types.ts` son la referencia |

## Mapa de rutas

```
/                     → hub (módulos habilitados por contrato vigente)
/activos              → consulta + alta (RF-03)
/inventarios          → estado y detalle de sesiones (RF-04)
/estructura/areas      → ABM Áreas
/estructura/ubicaciones → ABM Ubicaciones
/estructura/responsables → ABM Responsables
/auditoria            → consulta filtrable, solo lectura (RF-06)
/contratos             → ABM (RF-07)
```

`/estructura/*` agrupa Áreas/Ubicaciones/Responsables bajo un mismo módulo de navegación (mismo
"módulo" a efectos de `modulosContratados`, tres pantallas) — evita que el hub muestre 8 tarjetas
cuando el contrato solo habilita 6 conceptos.

## A quién le habla

WEB no le habla a CORE directo — mismo principio que APP QR (`CLAUDE.md`, regla no negociable):
todo pasa por CIS. Reusa exactamente los mismos endpoints que DOC-006 ya define para APP QR
(`GET /catalogo`, `POST /inventarios`, `GET /inventarios/:id/estado`) más los que el ABM de
Áreas/Ubicaciones/Responsables/Contratos necesita — **esos todavía no existen en DOC-006** (que
solo cubre el flujo de escaneo) y quedan como extensión pendiente de ese documento cuando se
implemente Fase 4/5, no una reinvención de contrato.

## Decisión abierta: tipo de Aplicación OIDC en Zitadel

`app-qr-sicsaft` usa una app **User Agent** (SPA pública, PKCE, sin secreto — ver
`devops/local/README.md` "Cliente OIDC real"). WEB maneja permisos de escritura amplios
(ABM de Contratos, alta de Activos) — vale la pena evaluar en la implementación si conviene un
backend-for-frontend liviano (sesión server-side, cookie httpOnly) en vez de repetir el patrón
100%-cliente de APP QR, dado el mayor blast radius de una sesión comprometida. **No se decide en
este documento** — es una decisión de seguridad que merece su propio análisis al implementar
Fase 5, no una elegida por defecto solo por consistencia con APP QR.

## Qué reutiliza tal cual de `app-qr-sicsaft/`

- El preset shadcn/ui **Sera** y la estructura de `src/components/ui/`.
- El patrón de `AppShell.tsx` (sidebar persistente, colapsa a Sheet en mobile) — WEB es un panel
  de administración, encaja mejor que el layout de escaneo de APP QR.
- `next-themes` para el toggle claro/oscuro (`BRAND.md` "Cómo extender a modo claro" ya
  documenta el mapeo completo).
