import { createSocket, type RemoteInfo, type Socket } from "node:dgram";
import { registrar } from "./logger";
import { obtenerIpLan, PUERTO_APP_QR } from "./lan-ip";

// Mejora 1 / RF-01 — Servicio de auto-descubrimiento en red local Wi-Fi / LAN vía broadcast UDP.
// Permite que la app móvil Android (apk-aft) detecte automáticamente la URL del servidor
// sicsaft-core.exe en la misma red sin tener que escanear el QR ni tipear la IP a mano.

export const PUERTO_DISCOVERY_UDP = 58765;
export const COMANDO_PING = "SICSAFT_DISCOVERY_PING";

export interface InfoRespuestaDiscovery {
  app: string;
  tipo: string;
  url: string;
  ip: string;
  hostname: string;
  puerto: number;
  nombre: string;
  version: string;
}

export interface ServicioDiscovery {
  socket: Socket;
  mdnsSocket?: Socket;
  detener: () => Promise<void>;
}

export function armarRespuestaDiscovery(
  ipLan: string = obtenerIpLan(),
  puertoApp: number = PUERTO_APP_QR,
  nombreOrg: string = "SICSAFT Core",
): InfoRespuestaDiscovery {
  return {
    app: "SICSAFT",
    tipo: "DISCOVERY_PONG",
    url: `https://${ipLan}:${puertoApp}`,
    ip: ipLan,
    hostname: "sicsaft.local",
    puerto: puertoApp,
    nombre: nombreOrg,
    version: "1.0.0",
  };
}

export function iniciarDiscoveryService(
  puerto: number = PUERTO_DISCOVERY_UDP,
  nombreOrg: string = "SICSAFT Core",
): Promise<ServicioDiscovery> {
  return new Promise((resolve) => {
    const socket = createSocket({ type: "udp4", reuseAddr: true });

    socket.on("message", (msg: Buffer, rinfo: RemoteInfo) => {
      const texto = msg.toString("utf8").trim();
      const esPing =
        texto === COMANDO_PING ||
        texto.includes("DISCOVER_SICSAFT") ||
        texto.includes("SICSAFT_PING");

      if (esPing) {
        registrar(
          "discovery",
          `Recibido ping de descubrimiento desde ${rinfo.address}:${rinfo.port}`,
        );

        const respuesta = JSON.stringify(
          armarRespuestaDiscovery(obtenerIpLan(), PUERTO_APP_QR, nombreOrg),
        );
        const buffer = Buffer.from(respuesta, "utf8");

        socket.send(
          buffer,
          0,
          buffer.length,
          rinfo.port,
          rinfo.address,
          (err) => {
            if (err) {
              registrar(
                "discovery",
                `Error al responder descubrimiento a ${rinfo.address}: ${err.message}`,
              );
            } else {
              registrar(
                "discovery",
                `Respuesta de descubrimiento enviada exitosamente a ${rinfo.address}:${rinfo.port}`,
              );
            }
          },
        );
      }
    });

    socket.on("error", (err) => {
      registrar(
        "discovery",
        `Error en socket UDP de descubrimiento: ${err.message}`,
      );
      // No re-lanzamos para evitar que un fallo en UDP tire el .exe completo
    });

    socket.bind(puerto, "0.0.0.0", () => {
      try {
        socket.setBroadcast(true);
      } catch {
        // En algunas plataformas puede fallar setBroadcast antes del primer send
      }
      registrar(
        "discovery",
        `Servicio de auto-descubrimiento Wi-Fi activo en UDP 0.0.0.0:${puerto}`,
      );

      resolve({
        socket,
        detener: () =>
          new Promise<void>((res) => {
            socket.close(() => {
              registrar(
                "discovery",
                "Servicio de auto-descubrimiento UDP detenido",
              );
              res();
            });
          }),
      });
    });
  });
}
