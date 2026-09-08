import { describe, expect, it } from "vitest";
import { createSocket } from "node:dgram";
import pkg from "../../../package.json";
import {
  armarRespuestaDiscovery,
  COMANDO_PING,
  iniciarDiscoveryService,
} from "./discovery-service";

describe("discovery-service", () => {
  it("arma respuesta de descubrimiento con URL https y datos correctos", () => {
    const res = armarRespuestaDiscovery(
      "192.168.1.50",
      8765,
      "DUOC UC Melipilla",
    );
    expect(res).toMatchObject({
      app: "SICSAFT",
      tipo: "DISCOVERY_PONG",
      url: "https://192.168.1.50:8765",
      ip: "192.168.1.50",
      puerto: 8765,
      nombre: "DUOC UC Melipilla",
      version: pkg.version,
    });
  });

  it("responde a un ping UDP con la URL correcta del servidor", async () => {
    const puertoTest = 58999;
    const servicio = await iniciarDiscoveryService(puertoTest, "Test Org");

    try {
      const cliente = createSocket("udp4");
      const respuestaPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cliente.close();
          reject(new Error("Timeout esperando respuesta UDP"));
        }, 3000);

        cliente.on("message", (msg) => {
          clearTimeout(timeout);
          cliente.close();
          resolve(msg.toString("utf8"));
        });
      });

      cliente.bind(0, () => {
        const ping = Buffer.from(COMANDO_PING, "utf8");
        cliente.send(ping, 0, ping.length, puertoTest, "127.0.0.1");
      });

      const respuestaCruda = await respuestaPromise;
      const datos = JSON.parse(respuestaCruda);
      expect(datos.app).toBe("SICSAFT");
      expect(datos.tipo).toBe("DISCOVERY_PONG");
      expect(datos.url).toMatch(/^https:\/\//);
      expect(datos.puerto).toBe(8765);
    } finally {
      await servicio.detener();
    }
  });
});
