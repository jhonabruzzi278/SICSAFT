# Prompt para mockups — Launcher SICSAFT

Pegar este prompt completo en la herramienta de diseño/generación que uses (v0, Figma AI, Galileo,
Midjourney + un flujo de UI, o directo a un LLM con capacidad de generar HTML/React). Está escrito
para producir mockups **consistentes con la identidad visual ya usada en los diagramas de
SICSAFT** (ver `aidlc-docs/diagrams/launcher-arquitectura.html` para el diagrama de arquitectura
de referencia).

---

## Prompt

Diseña los mockups de **"Sicsaft"**, un launcher de escritorio para Windows (empaquetado como PWA
instalable, un solo ejecutable con ícono propio — no un navegador con pestañas ni un acceso directo
a una landing de marketing). Es lo primero que ve un empleado del cliente al abrir el sistema desde
su PC: una app liviana que centraliza el acceso a los sistemas SICSAFT que esa organización tiene
contratados, sin exponer nunca la landing comercial (esa es solo para prospectos, no para clientes
ya instalados).

### Contexto de producto (para que las pantallas tengan sentido, no lo muestres como texto plano)

SICSAFT es un sistema de gestión patrimonial. Cada cliente instala un nivel de producto (1, 2 o 3)
que determina qué portales tiene disponibles:

- **Siempre disponible**: Portal Directivo (vista ejecutiva/supervisión). La gestión de
  usuarios/organizaciones/contratos/sedes **no tiene portal** (el Portal Administrador del Sistema
  se eliminó en 2026-09) — es intervención directa del proveedor de SICSAFT (BD / script) + el
  wizard de primer arranque.
- **Nivel 1**: además, acceso de Profesional de AFT vía app móvil QR (y a futuro un portal web
  liviano de consulta).
- **Nivel 2**: el Profesional de AFT pasa a tener CCP (Centro de Control Patrimonial), un portal
  web completo con gestión avanzada, reportes y operación centralizada.
- **Nivel 3**: se suma integración RFID (captura automática, alertas, zonas) — no agrega un portal
  nuevo, potencia los que ya existen.

El launcher **no reemplaza el login de cada portal** — cada uno sigue autenticando por separado
contra el proveedor de identidad (Keycloak, OIDC). El launcher solo decide qué botones mostrar según
lo que el cliente tiene contratado, y abre cada portal en su propia ventana/pestaña del sistema.

### Pantallas a diseñar

1. **Pantalla de inicio (home)** — lo primero que se ve al abrir la app:
   - Header con el nombre del cliente/organización (ej. "Municipalidad de Melipilla") y el logo
     "Sicsaft" pequeño, no protagonista — el protagonista es la organización del cliente, no la
     marca del producto.
   - Una fila o grid de **botones de acceso por rol**, uno por sistema disponible para ESE cliente
     según su nivel contratado. Cada botón: ícono distintivo, nombre del rol (Directivo,
     Profesional de AFT), y un estado visual claro de "disponible" vs
     "no incluido en tu plan" (mostrar los no incluidos atenuados/deshabilitados, no ocultarlos —
     así el cliente ve qué podría contratar, sin ser agresivo con el upsell).
   - Debajo o al costado: estado de conexión (online/offline), versión instalada, último acceso.
2. **Estado "nivel 1"** — variante del home mostrando: Directivo activo, Profesional de AFT
   marcado como "usa la app móvil QR" (con un botón secundario para generar/mostrar el QR de
   descarga de la app móvil), CCP atenuado con un tag "Disponible en Nivel 2".
3. **Estado "nivel 2"** — variante mostrando los 2 botones activos (Directivo, CCP).
4. **Pantalla "acerca de / sistemas"** — una vista secundaria (no la primera que se ve) con el
   detalle técnico para el administrador: qué versión de cada portal está instalada, el dominio
   base de esta instalación (ej. `sicsaft-duoc-melipilla.localhost`), y un botón de soporte.
5. **Estado de transición al hacer clic en un botón** — micro-estado de carga breve mientras abre
   la ventana del portal correspondiente (no un splash largo — esto es un launcher, tiene que
   sentirse instantáneo).

### Dirección visual

- **No genérico.** Nada de dashboard-de-plantilla con sidebar + cards uniformes. Esto es un
  launcher, no un panel de administración — debe sentirse más cercano a un "centro de comando"
  editorial que a un SaaS genérico.
- Paleta: fondo claro cálido (blanco humo, no blanco puro), tinta casi-negra para texto principal,
  un único acento coral/naranja quemado reservado para 1–2 elementos focales por pantalla (el botón
  del rol que más usa ese usuario, o el estado activo), nunca más de dos usos por pantalla.
- Tipografía con carácter: un serif editorial para el nombre de la organización/títulos grandes, un
  sans limpio para los botones y textos de UI, monoespaciada solo para datos técnicos (versión,
  dominio, IDs) — nunca monoespaciada como fuente "de sistema" genérica.
- Jerarquía por escala, no por color: el nombre del cliente y los botones de rol dominan la
  pantalla; el resto (versión, estado de conexión) es pequeño y discreto.
- Sin sombras. Bordes finos (1px), radios de 6–8px máximo, nada de `rounded-2xl` ni tarjetas
  flotando con `box-shadow`.
- Estados hover/focus/disabled diseñados a propósito, no el default del framework — especialmente
  el estado "no incluido en tu plan" (atenuado pero legible, no simplemente `opacity: 0.3`).
- Formato ejecutable de escritorio: diseña para una ventana de app nativa (barra de título propia o
  minimalista, sin cromo de navegador visible), no para una pestaña de navegador con URL bar.

### Qué NO mostrar

- Nada de landing de marketing, precios, o copy de venta — este launcher lo usa gente que YA es
  cliente.
- No inventes módulos o roles que no están en la lista de arriba.
- No muestres RFID como un botón propio — Nivel 3 potencia los portales existentes, no agrega uno.

### Entregable

4–5 pantallas (home en sus 2 variantes de nivel, acerca-de, y el micro-estado de carga), a tamaño
ventana de escritorio (usa 1280×800 o el lienzo que tu herramienta prefiera para "desktop app").
