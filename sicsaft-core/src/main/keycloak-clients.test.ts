import { describe, expect, test, vi } from "vitest";
import {
  reconfigurarClientAppQr,
  sincronizarOrigenesClientCcp,
} from "./keycloak-clients";

const admin = { usuario: "admin", password: "pw" };

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("reconfigurarClientAppQr (DOC-028 Fase C.1)", () => {
  function mockClientAppQr(redirectViejo: string) {
    return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/realms/master/protocol/openid-connect/token")) {
        return jsonResponse({ access_token: "master-token" });
      }
      if (
        url.includes("/clients?clientId=app-qr-sicsaft") &&
        method === "GET"
      ) {
        return jsonResponse([
          {
            id: "appqr-uuid",
            clientId: "app-qr-sicsaft",
            publicClient: true,
            redirectUris: [`${redirectViejo}/auth/callback`],
            webOrigins: [redirectViejo],
            attributes: {
              "pkce.code.challenge.method": "S256",
              "post.logout.redirect.uris": `${redirectViejo}/`,
            },
          },
        ]);
      }
      if (
        url.endsWith("/admin/realms/sicsaft/clients/appqr-uuid") &&
        method === "PUT"
      ) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Llamada no esperada en el mock: ${method} ${url}`);
    });
  }

  test("reescribe redirectUris/webOrigins/post.logout al origen nuevo, conservando el resto de attributes", async () => {
    const fetchMock = mockClientAppQr("https://192.168.1.11:8765");
    vi.stubGlobal("fetch", fetchMock);

    await reconfigurarClientAppQr(admin, "https://192.168.1.8:8765");

    const put = fetchMock.mock.calls.find(
      ([u, i]) =>
        String(u).endsWith("/admin/realms/sicsaft/clients/appqr-uuid") &&
        (i as RequestInit | undefined)?.method === "PUT",
    );
    const body = JSON.parse(String(put?.[1]?.body)) as {
      redirectUris: string[];
      webOrigins: string[];
      attributes: Record<string, string>;
    };
    expect(body.redirectUris).toEqual([
      "https://192.168.1.8:8765/auth/callback",
    ]);
    expect(body.webOrigins).toEqual(["https://192.168.1.8:8765"]);
    expect(body.attributes["post.logout.redirect.uris"]).toBe(
      "https://192.168.1.8:8765/",
    );
    // no se pisó pkce
    expect(body.attributes["pkce.code.challenge.method"]).toBe("S256");
  });

  test("tira si el client app-qr-sicsaft no existe en el realm", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/realms/master/protocol/openid-connect/token")) {
          return jsonResponse({ access_token: "master-token" });
        }
        if (url.includes("/clients?clientId=app-qr-sicsaft")) {
          return jsonResponse([]);
        }
        throw new Error(`Llamada no esperada: ${init?.method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reconfigurarClientAppQr(admin, "https://192.168.1.8:8765"),
    ).rejects.toThrow(/app-qr-sicsaft/);
  });
});

describe("sincronizarOrigenesClientCcp (DOC-028 Fase G)", () => {
  function mockClientCcp(clienteExistente: Record<string, unknown> | null) {
    return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/realms/master/protocol/openid-connect/token")) {
        return jsonResponse({ access_token: "master-token" });
      }
      if (url.includes("/clients?clientId=ccp") && method === "GET") {
        return jsonResponse(clienteExistente ? [clienteExistente] : []);
      }
      if (
        url.endsWith("/admin/realms/sicsaft/clients/ccp-uuid") &&
        method === "PUT"
      ) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Llamada no esperada en el mock: ${method} ${url}`);
    });
  }

  test("deja loopback + el origen de LAN actual (reemplaza la IP vieja, no la acumula) y conserva el resto", async () => {
    const fetchMock = mockClientCcp({
      id: "ccp-uuid",
      clientId: "ccp",
      publicClient: true,
      redirectUris: [
        "http://127.0.0.1:8766/auth/callback",
        "https://192.168.1.11:8767/auth/callback",
      ],
      webOrigins: ["http://127.0.0.1:8766", "https://192.168.1.11:8767"],
      attributes: {
        "pkce.code.challenge.method": "S256",
        "post.logout.redirect.uris":
          "http://127.0.0.1:8766/##https://192.168.1.11:8767/",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await sincronizarOrigenesClientCcp(admin, "https://192.168.1.8:8767");

    const put = fetchMock.mock.calls.find(
      ([, i]) => (i as RequestInit | undefined)?.method === "PUT",
    );
    const body = JSON.parse(String(put?.[1]?.body)) as {
      publicClient: boolean;
      redirectUris: string[];
      webOrigins: string[];
      attributes: Record<string, string>;
    };
    expect(body.redirectUris).toEqual([
      "http://127.0.0.1:8766/auth/callback",
      "https://192.168.1.8:8767/auth/callback",
    ]);
    expect(body.webOrigins).toEqual([
      "http://127.0.0.1:8766",
      "https://192.168.1.8:8767",
    ]);
    // Keycloak separa varias post-logout redirect URIs con "##"
    expect(body.attributes["post.logout.redirect.uris"]).toBe(
      "http://127.0.0.1:8766/##https://192.168.1.8:8767/",
    );
    expect(body.attributes["pkce.code.challenge.method"]).toBe("S256");
    expect(body.publicClient).toBe(true);
  });

  test("una instalación anterior a la Fase G (client solo con loopback) queda con los dos orígenes", async () => {
    const fetchMock = mockClientCcp({
      id: "ccp-uuid",
      clientId: "ccp",
      redirectUris: ["http://127.0.0.1:8766/auth/callback"],
      webOrigins: ["http://127.0.0.1:8766"],
      attributes: { "post.logout.redirect.uris": "http://127.0.0.1:8766/" },
    });
    vi.stubGlobal("fetch", fetchMock);

    await sincronizarOrigenesClientCcp(admin, "https://10.0.0.5:8767");

    const put = fetchMock.mock.calls.find(
      ([, i]) => (i as RequestInit | undefined)?.method === "PUT",
    );
    const body = JSON.parse(String(put?.[1]?.body)) as {
      webOrigins: string[];
    };
    expect(body.webOrigins).toEqual([
      "http://127.0.0.1:8766",
      "https://10.0.0.5:8767",
    ]);
  });

  test("tira si el client ccp no existe en el realm", async () => {
    vi.stubGlobal("fetch", mockClientCcp(null));

    await expect(
      sincronizarOrigenesClientCcp(admin, "https://192.168.1.8:8767"),
    ).rejects.toThrow(/'ccp'/);
  });
});
