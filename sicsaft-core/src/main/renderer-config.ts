// Puerto fijo donde va a vivir el servidor HTTP local que sirve el renderer empaquetado en
// producción (electron-vite en dev usa su propio puerto de Vite, irrelevante para esto: el
// redirectUri que registra Keycloak tiene que ser estable independientemente del modo). No
// implementado todavía en este scaffold (ver src/main/index.ts) -- placeholder para que
// keycloak-bootstrap.ts y ipc/handlers.ts no tengan que adivinar el puerto en cada llamada.
export const PUERTO_RENDERER = 58090;
