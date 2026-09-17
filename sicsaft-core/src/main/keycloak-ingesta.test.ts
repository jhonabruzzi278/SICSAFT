import { describe, expect, test, vi } from "vitest";
import { resolverCredencialesClienteIngesta } from "./keycloak-ingesta";

const admin = { usuario: "admin", password: "pw" };

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("resolverCredencialesClienteIngesta (DOC-029 RF-B.6.2)", () => {
  test("recupera el client_secret del service account ya creado", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/realms/master/protocol/openid-connect/token")) {
          return jsonResponse({ access_token: "master-token" });
        }
        if (
          url.includes("/clients?clientId=sicsaft-ingesta") &&
          method === "GET"
        ) {
          return jsonResponse([{ id: "ingesta-uuid" }]);
        }
        if (
          url.endsWith("/clients/ingesta-uuid/client-secret") &&
          method === "GET"
        ) {
          return jsonResponse({ value: "sec-recuperado" });
        }
        throw new Error(`Llamada no esperada: ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolverCredencialesClienteIngesta(admin)).resolves.toEqual({
      clientId: "sicsaft-ingesta",
      secret: "sec-recuperado",
    });
  });

  test("tira si el client sicsaft-ingesta no existe en el realm", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/realms/master/protocol/openid-connect/token")) {
          return jsonResponse({ access_token: "master-token" });
        }
        if (url.includes("/clients?clientId=sicsaft-ingesta")) {
          return jsonResponse([]);
        }
        throw new Error(`Llamada no esperada: ${url}`);
      }),
    );
    await expect(resolverCredencialesClienteIngesta(admin)).rejects.toThrow(
      /sicsaft-ingesta/,
    );
  });
});
