# Marca SICSAFT — paleta de colores oficial

Fuente de verdad única para cualquier trabajo visual del ecosistema (`app-qr-sicsaft/`, `ccp/`,
`core/frontend/`, `cip/`, etc.). El origen canónico de estos valores es
[`landing/src/style.css`](landing/src/style.css) — la landing comercial oficial de SICSAFT
(commit `90b816c`). Si la paleta cambia ahí, hay que propagar el cambio acá y a cada consumidor;
no copiar valores a mano sin volver a este archivo.

## Paleta (familia azul-marino, hue ~254–258)

La landing es **solo modo oscuro** — estos son los valores tal cual están definidos hoy:

| Token | Valor OKLCH | Uso |
|---|---|---|
| `--color-bg` | `oklch(15% 0.045 258)` | Fondo de página |
| `--color-bg-raised` | `oklch(19% 0.05 258)` | Superficie elevada (nav, sidebar) |
| `--color-bg-card` | `oklch(21% 0.05 258)` | Tarjetas |
| `--color-border` | `oklch(32% 0.05 258)` | Borde default |
| `--color-border-strong` | `oklch(44% 0.07 258)` | Borde en hover/activo |
| `--color-text` | `oklch(97% 0.006 258)` | Texto principal |
| `--color-text-dim` | `oklch(78% 0.03 258)` | Texto secundario |
| `--color-text-faint` | `oklch(58% 0.03 258)` | Texto terciario |
| `--color-accent` | `oklch(68% 0.19 254)` | Acento primario — CTA, links activos, foco |
| `--color-accent-strong` | `oklch(74% 0.17 240)` | Acento realzado — headings, íconos |
| `--color-accent-dim` | `oklch(40% 0.11 254)` | Acento atenuado — bordes con tinte, fondos sutiles |

El acento (`--color-accent`/`--color-accent-strong`) es la marca en sí — se mantiene **igual en
cualquier modo/tema**, no varía con luz/oscuridad. Los neutros (fondo/borde/texto) sí varían.

## Tipografía

La landing usa `Century Gothic` / `Segoe UI` / `Cascadia Code` — **no son fuentes self-hosteables**
(Segoe UI es fuente de sistema Windows, Century Gothic es comercial), así que no aplican a apps que
necesiten funcionar 100% offline (PWAs instalables, por ejemplo `app-qr-sicsaft`, que usa
`@fontsource-variable` con Noto Sans + Playfair Display). Elegir tipografía self-hosted equivalente
en espíritu (geométrica/display para títulos, neutra para texto) es responsabilidad de cada
consumidor — este documento cubre color, no tipografía.

## Cómo extender a modo claro

Ningún sistema del ecosistema define modo claro todavía (la landing es solo oscura). Si un
consumidor necesita ambos modos (como `app-qr-sicsaft`, que tiene toggle de tema), el criterio es:

1. **El acento no cambia** — mismo `--color-accent`/`--color-accent-strong` en claro y oscuro.
2. **Mismo hue por familia** — 258 para neutros, 254/240 para acento — en ambos modos.
3. **Invertir la escala de luminosidad** de los neutros: fondo casi blanco con tinte frío en vez de
   casi negro, texto oscuro en vez de casi blanco, tarjetas blancas o casi blancas, bordes gris-
   azulados claros en vez de oscuros.
4. Si el acento se usa como **color de texto/ícono** (no de fondo) en modo claro, puede necesitar
   oscurecerse un poco respecto al valor oscuro para mantener contraste sobre fondo claro —
   `--color-accent-strong` a L74% no tiene contraste suficiente como texto sobre blanco.

Implementación de referencia (mapeo completo claro + oscuro contra los tokens de shadcn/Tailwind):
[`app-qr-sicsaft/src/index.css`](app-qr-sicsaft/src/index.css).

## Qué no toca esta paleta

Colores semánticos (éxito, advertencia, error/destructivo) son universales, no de marca — se
mantienen los tonos verde/ámbar/rojo estándar de cada proyecto, ajustados en chroma si hace falta
para convivir con el hue de marca, pero sin adoptar el azul de SICSAFT para "peligro" o "éxito".
