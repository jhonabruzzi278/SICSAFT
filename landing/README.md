# Landing pública — Ecosistema SICSAFT

## Objetivo
Página pública de presentación del programa completo (los 8 sistemas + capacidades
transversales), no de un producto puntual. Explica el flujo de datos, el principio de
gobierno ("ninguna fuente escribe directo en la base") y el estado de cada sistema.

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
└── src/main.ts       # scroll reveal + estado del nav al hacer scroll
```

## Notas de diseño
Dirección visual deliberada: dark/técnico ("torre de control patrimonial"), acento cian para
datos/flujo, tipografía display de alto contraste + mono para códigos de sistema (SYS-01, etc.).
No usa modo claro — es una elección de identidad, no un default sin decidir.

## Próximo paso sugerido
Actualizar los estados de cada card (`#sistemas`) a medida que los sistemas avancen, en
paralelo con los README de cada carpeta.
