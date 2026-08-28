import { describe, expect, test, vi } from "vitest";

const { networkInterfacesMock } = vi.hoisted(() => ({
  networkInterfacesMock: vi.fn(),
}));
vi.mock("node:os", () => ({ networkInterfaces: networkInterfacesMock }));

import { obtenerIpLan, obtenerOrigenAppQr } from "./lan-ip";

function iface(address: string, family: "IPv4" | "IPv6", internal: boolean) {
  return { address, family, internal } as never;
}

describe("obtenerIpLan", () => {
  test("prefiere una IPv4 real de LAN por sobre un adaptador virtual 172.x", () => {
    networkInterfacesMock.mockReturnValue({
      "vEthernet (WSL)": [iface("172.20.0.1", "IPv4", false)],
      "Wi-Fi": [iface("10.31.89.92", "IPv4", false)],
      Loopback: [iface("127.0.0.1", "IPv4", true)],
    });
    expect(obtenerIpLan()).toBe("10.31.89.92");
  });

  test("ignora interfaces internas (loopback) y IPv6", () => {
    networkInterfacesMock.mockReturnValue({
      Loopback: [iface("127.0.0.1", "IPv4", true)],
      "Wi-Fi": [
        iface("fe80::1", "IPv6", false),
        iface("192.168.1.50", "IPv4", false),
      ],
    });
    expect(obtenerIpLan()).toBe("192.168.1.50");
  });

  test("si solo hay adaptadores 172.x, usa esa como último recurso", () => {
    networkInterfacesMock.mockReturnValue({
      "vEthernet (WSL)": [iface("172.20.0.1", "IPv4", false)],
    });
    expect(obtenerIpLan()).toBe("172.20.0.1");
  });

  test("sin ninguna interfaz real, cae a 127.0.0.1", () => {
    networkInterfacesMock.mockReturnValue({
      Loopback: [iface("127.0.0.1", "IPv4", true)],
    });
    expect(obtenerIpLan()).toBe("127.0.0.1");
  });
});

describe("obtenerOrigenAppQr", () => {
  test("arma el origen con esquema https (contexto seguro para crypto.subtle/randomUUID)", () => {
    networkInterfacesMock.mockReturnValue({
      "Wi-Fi": [iface("10.31.89.92", "IPv4", false)],
    });
    expect(obtenerOrigenAppQr()).toBe("https://10.31.89.92:8765");
  });
});
