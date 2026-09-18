# SICSAFT — Sistema de Diseño (bundle local para Claude Design)

Espejo local del proyecto de `claude.ai/design` para el ecosistema SICSAFT. Vive acá, fuera de
`ccp/`, `core/frontend/`, `app-qr-sicsaft/` y `sicsaft-core/`, porque **no es código de producto**
— es la carpeta que `/design-sync` sincroniza contra el proyecto de diseño, y esos cuatro sistemas
siguen siendo la fuente de verdad de lo que corre de verdad. Un cambio acá no se propaga solo al
código; y un cambio en el código (`index.css` de cada portal) tiene que reflejarse acá a mano en el
siguiente sync.

## Alcance (decidido 2026-09-09)

- **Base de color**: los tokens OKLCH de [`BRAND.md`](../BRAND.md), que son los que ya usan
  `ccp/`, `core/frontend/`, `app-qr-sicsaft/` y `sicsaft-core/` — no la paleta Tailwind
  slate/sky que quedó en `landing/` tras su rediseño (`49165e5`), que se desvió del documento y
  queda **fuera de este sistema de diseño** hasta que se decida reunificarla.
- **Tipografía**: **desactualizado** — este README todavía dice `Noto Sans` (texto) +
  `Playfair Display` (headings/display), pero `BRAND.md` (rediseño "Control sereno", 2026-09-12,
  posterior a esta carpeta) reemplazó ese par por **`Manrope Variable`** como tipografía única, y
  marca Noto Sans/Playfair como **depreciado, no reintroducir**. `ccp/src/design.css` ya usa
  Manrope; `app-qr-sicsaft/src/index.css` sigue con el par viejo, sin migrar todavía. `tokens/
  tipografia.html` de acá necesita actualizarse a Manrope en el próximo sync para dejar de
  contradecir a `BRAND.md`, que es la fuente canónica (ver [CLAUDE.md](../CLAUDE.md)).

## Estructura y orden de envío a Claude Design

Cada tanda es su propio `finalize_plan` — nunca un volcado de todo junto (ver DesignSync).

| Tanda | Carpeta | Contenido | Estado |
|---|---|---|---|
| 1 — Tokens | `tokens/` | Paleta (`colores.html`), tipografía (`tipografia.html`) | ✅ armado, pendiente de subir |
| 2 — Primitivos | `componentes/` | Button, Badge, Alert, Card — consolidando `ccp/src/components/ui.tsx` y `core/frontend/src/components/ui.tsx` en una sola referencia | pendiente |
| 3 — Patrones | `patrones/` | AppShell (sidebar + header), estados de nav | pendiente |
| 4 — Pantallas | `pantallas/` | El CIP (`core/frontend/src/pages/DashboardPage.tsx`) como caso de composición completo | pendiente |

## Por qué todavía no se subió nada

`DesignSync` necesita autorización de diseño, y `/design-login` no puede correr en esta sesión (no
interactiva). Para destrabarlo: correr `/design-login` una vez desde una sesión interactiva de
Claude Code en esta máquina — queda autorizado también para sesiones headless/SDK después. Una vez
logueado, retomar desde acá: `list_projects` para ver si ya existe un proyecto ("SICSAFT Design
System" o el nombre que se elija), si no, `create_project`, y después `finalize_plan` +
`write_files` de la Tanda 1 (`tokens/`).

## Convención de los archivos de preview

Cada HTML de este bundle arranca con un marcador que agrupa la tarjeta en el panel de Claude
Design:

```html
<!-- @dsCard group="Tokens" -->
```

Sin esto hay que registrar la tarjeta a mano (`register_assets`) — mejor evitarlo.
