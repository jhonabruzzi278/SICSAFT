import { createSocket } from "node:dgram";

export const PUERTO_DISCOVERY_UDP = 58765;
export const COMANDO_PING = "SICSAFT_DISCOVERY_PING";
export const PUERTO_CCP_LAN_DEFAULT = 8767;

export interface InfoRespuestaDiscovery {
  app: string;
  tipo: string;
  url: string;
  ip: string;
  hostname: string;
  puerto: number;
  puertoCcp: number;
  fingerprint: string;
  nombre: string;
  version: string;
}

function esRespuestaValida(valor: unknown): valor is InfoRespuestaDiscovery {
  if (typeof valor !== "object" || valor === null) return false;
  const r = valor as Record<string, unknown>;
  return (
    r.app === "SICSAFT" &&
    r.tipo === "DISCOVERY_PONG" &&
    typeof r.ip === "string" &&
    typeof r.puertoCcp === "number" &&
    typeof r.fingerprint === "string"
  );
}

export function buscarPcMadre(
  timeoutMs = 3000,
  puertoDestino = PUERTO_DISCOVERY_UDP,
): Promise<InfoRespuestaDiscovery | null> {
  return new Promise((resolve) => {
    const socket = createSocket({ type: "udp4", reuseAddr: true });
    let resuelto = false;
    const finalizar = (valor: InfoRespuestaDiscovery | null): void => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(temporizador);
      socket.close();
      resolve(valor);
    };
    const temporizador = setTimeout(() => finalizar(null), timeoutMs);
    socket.on("error", () => finalizar(null));
    socket.on("message", (msg) => {
      try {
        const datos: unknown = JSON.parse(msg.toString("utf8"));
        if (esRespuestaValida(datos)) finalizar(datos);
      } catch {
        /* Ignora ruido UDP ajeno. */
      }
    });
    socket.bind(0, () => {
      try {
        socket.setBroadcast(true);
      } catch {
        /* El send puede funcionar igual. */
      }
      const ping = Buffer.from(COMANDO_PING, "utf8");
      socket.send(ping, 0, ping.length, puertoDestino, "255.255.255.255");
    });
  });
}
