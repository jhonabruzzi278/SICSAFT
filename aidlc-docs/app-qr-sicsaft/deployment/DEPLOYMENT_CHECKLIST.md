# Deployment Checklist

⚠️ Pendiente — el proyecto aún no llega a fase de despliegue/Operations. Este checklist queda como referencia para cuando se decida desplegar.

## Pre-Deployment
- [ ] Tests automatizados pasando (estado actual: sin suite automatizada — ver `testing/TEST_STRATEGY.md`)
- [ ] CI/CD configurado (detectado: ninguno — no hay `.github/workflows` ni equivalente)
- [ ] Secrets no commiteados (verificado: no hay `.env` ni credenciales en el proyecto — la app no usa ningún secreto, es 100% cliente estático)
- [ ] HTTPS habilitado en el hosting elegido (obligatorio: la Camera API (`getUserMedia`) y los Service Workers requieren un contexto seguro — no funcionarán en HTTP plano salvo `localhost`)
- [ ] Verificar manifest.json e íconos en un dispositivo Android real (instalación "Add to Home Screen")

## Infraestructura Detectada
Ninguna — no hay Dockerfile, docker-compose, terraform, ni manifiestos k8s. Es un sitio 100% estático (`index.html`, `products.html`, `css/`, `js/`, `vendor/`, `icons/`, `manifest.json`, `service-worker.js`).

## Opciones de despliegue recomendadas (no implementadas aún)
Cualquier hosting de archivos estáticos con HTTPS: GitHub Pages, Netlify, Vercel (estático), Cloudflare Pages. No requieren build step — se puede desplegar la carpeta tal cual.
