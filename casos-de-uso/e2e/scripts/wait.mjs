// Poll HTTP genérico — usado por global-setup para esperar a Keycloak y al ingress de Traefik
// (que un contenedor esté "healthy" no prueba que Traefik ya rutea hacia él).

/**
 * @param {string} url
 * @param {{ intentos?: number, intervaloMs?: number, nombre?: string, aceptar?: (status: number) => boolean }} [opts]
 */
export async function esperarHttp(url, opts = {}) {
  const {
    intentos = 60,
    intervaloMs = 2000,
    nombre = url,
    aceptar = (status) => status >= 200 && status < 500,
  } = opts;

  let ultimo = '';
  for (let i = 1; i <= intentos; i += 1) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (aceptar(res.status)) {
        console.log(`  [OK] ${nombre} → HTTP ${res.status}`);
        return;
      }
      ultimo = `HTTP ${res.status}`;
    } catch (err) {
      ultimo = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  throw new Error(
    `Timeout esperando ${nombre} (${url}) tras ${(intentos * intervaloMs) / 1000}s. Último: ${ultimo}`,
  );
}
