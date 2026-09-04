// Hace que `fetch()` de Node resuelva `*.localhost` → 127.0.0.1 igual que Chromium (RFC 6761).
// El resolver de Windows NO lo hace solo (ver devops/onprem/instalar-cliente.ps1
// New-DominioDesdeNombre, "Invoke-RestMethod contra un *.localhost nunca agregado a hosts tira
// 'No se puede resolver el nombre remoto'"). Sin esto, el bootstrap por HTTP contra
// id.sicsaft.localhost del global-setup falla.
//
// Chromium (las specs) y el `request` de Playwright resuelven `*.localhost` solos — este
// dispatcher es sólo para el Node del global-setup / seed.
import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';

let instalado = false;

export function instalarResolucionLocalhost() {
  if (instalado) return;
  instalado = true;
  setGlobalDispatcher(
    new Agent({
      connect: {
        lookup(hostname, options, callback) {
          if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
            if (options && options.all) {
              callback(null, [{ address: '127.0.0.1', family: 4 }]);
            } else {
              callback(null, '127.0.0.1', 4);
            }
            return;
          }
          dns.lookup(hostname, options, callback);
        },
      },
    }),
  );
}
