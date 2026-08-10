# Landing pública — SICSAFT

## Objetivo
Landing **comercial** dirigida al cliente final. Presenta el producto SICSAFT (Modelo
Inteligente de Gestión Patrimonial) usando el mensaje y la identidad de marca oficiales:
el desafío que resuelve, la propuesta de valor, los 3 niveles de adopción (QR / QR+WEB /
QR+WEB+RFID), funcionalidades, beneficios y sectores a los que aplica.

No expone ninguna información interna de desarrollo (nombres de sistemas técnicos, estado de
avance, arquitectura, repos). Esa información vive en el `README.md` raíz del monorepo, que es
para uso interno del equipo.

## Fuente de contenido
El copy y la identidad visual (paleta azul marino + celeste, logotipo, mensajes clave) están
tomados de la presentación oficial de marketing del cliente
(`Presentación1. OFICIAL. PUBLICIDAD.ppt`, 7 diapositivas).

## Estado
🟢 Construida — Vite + TypeScript, sin framework de UI, contenido estático.

## Correr localmente
```bash
npm install
npm run dev
```

## Build de producción
```bash
npm run build
```
Genera `dist/` listo para deploy estático (Vercel, Netlify, GitHub Pages, etc.).

## Estructura
```
landing/
├── index.html       # contenido y secciones
├── src/style.css     # tokens de diseño, layout, animaciones
├── src/icons.ts       # sprite de iconos SVG inline (sin dependencias externas)
└── src/main.ts        # inyecta el sprite + scroll reveal + estado del nav
```

## Notas de diseño
Paleta azul marino + celeste eléctrico, tomada directamente de la marca SICSAFT. Motivo visual:
red de nodos conectados (representa activos monitoreados) e íconos circulares de línea. No usa
modo claro — es la identidad de marca, no un default sin decidir.

## Pendiente antes de publicar
- El botón "Solicitar una demo" usa `mailto:contacto@sicsaft.com` como **placeholder** — reemplazar
  por el correo, teléfono o formulario real de contacto antes de publicar.
- Reemplazar el logotipo CSS (wordmark + marca triangular) por el archivo de marca oficial
  (SVG/PNG) si el cliente lo provee, para fidelidad exacta.
