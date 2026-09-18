import { describe, expect, test, vi } from "vitest";
import { obtenerTokenClientCredentials } from "./keycloak-admin-api";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("obtenerTokenClientCredentials (DOC-029 RF-B.6.2)", () => {
  test("pide un token client_credentials al realm sicsaft y devuelve el access_token", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        expect(url).toContain("/realms/sicsaft/protocol/openid-connect/token");
        const body = String(init?.body);
        expect(body).toContain("grant_type=client_credentials");
        expect(body).toContain("client_id=sicsaft-ingesta");
        expect(body).toContain("client_secret=sec-1");
        return jsonResponse({ access_token: "svc-token" });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      obtenerTokenClientCredentials("sicsaft-ingesta", "sec-1"),
    ).resolves.toBe("svc-token");
  });

  test("tira si Keycloak responde no-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );
    await expect(
      obtenerTokenClientCredentials("sicsaft-ingesta", "mala"),
    ).rejects.toThrow(/sicsaft-ingesta/);
  });
});
