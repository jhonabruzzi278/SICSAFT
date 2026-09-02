import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  crearUsuarioDirector,
  crearUsuarioProfesionalAft,
  obtenerTokenClientCredentials,
  reconfigurarClientAppQr,
  resolverCredencialesClienteIngesta,
} from "./keycloak-bootstrap";

const admin = { usuario: "admin", password: "pw" };
const KC_URL = "http://127.0.0.1:58080";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

// Mock genérico de la Admin API para el flujo "crear usuario humano": token del realm master,
// POST /users, GET /organizations, POST /organizations/{id}/members, GET /roles/{rol} (cualquier
// rol), GET /groups?search (grupo nuevo), POST /groups, POST /groups/{id}/role-mappings/realm,
// PUT /users/{id}/groups/{grupoId}.
function mockAdminApi(userId: string, grupoId: string) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/realms/master/protocol/openid-connect/token")) {
      return jsonResponse({ access_token: "master-token" });
    }
    if (url.endsWith("/admin/realms/sicsaft/users") && method === "POST") {
      return new Response(null, {
        status: 201,
        headers: { Location: `${KC_URL}/admin/realms/sicsaft/users/${userId}` },
      });
    }
    if (
      url.endsWith("/admin/realms/sicsaft/organizations") &&
      method === "GET"
    ) {
      return jsonResponse([{ id: "org-uuid", alias: "municipalidad-x" }]);
    }
    if (url.endsWith("/organizations/org-uuid/members") && method === "POST") {
      return new Response(null, { status: 204 });
    }
    const roleMatch = /\/roles\/([^/?]+)$/.exec(url);
    if (roleMatch && method === "GET") {
      const nombre = decodeURIComponent(roleMatch[1]);
      return jsonResponse({ id: `rol-${nombre}-uuid`, name: nombre });
    }
    if (url.includes("/groups?search=") && method === "GET") {
      return jsonResponse([]); // grupo todavía no existe
    }
    if (url.endsWith("/admin/realms/sicsaft/groups") && method === "POST") {
      return new Response(null, {
        status: 201,
        headers: {
          Location: `${KC_URL}/admin/realms/sicsaft/groups/${grupoId}`,
        },
      });
    }
    if (
      url.endsWith(`/groups/${grupoId}/role-mappings/realm`) &&
      method === "POST"
    ) {
      return new Response(null, { status: 204 });
    }
    if (
      url.endsWith(`/users/${userId}/groups/${grupoId}`) &&
      method === "PUT"
    ) {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Llamada no esperada en el mock: ${method} ${url}`);
  });
}

describe("crearUsuarioDirector", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockAdminApi("user-123", "grupo-123");
    vi.stubGlobal("fetch", fetchMock);
  });

  test("crea el usuario, lo agrega a la organización y le asigna el grupo/rol 'directivo' (grupo nuevo)", async () => {
    const resultado = await crearUsuarioDirector(
      admin,
      "municipalidad-x",
      "director@municipalidad-x.cl",
    );

    expect(resultado.userId).toBe("user-123");
    expect(resultado.passwordInicial).toHaveLength(20);

    const llamadaCrearUsuario = fetchMock.mock.calls.find(([u]) =>
      String(u).endsWith("/admin/realms/sicsaft/users"),
    );
    const body = JSON.parse(String(llamadaCrearUsuario?.[1]?.body)) as {
      credentials: Array<{ temporary: boolean }>;
      email: string;
    };
    expect(body.email).toBe("director@municipalidad-x.cl");
    expect(body.credentials[0].temporary).toBe(true);

    // el rol resuelto para el grupo fue "directivo"
    expect(
      fetchMock.mock.calls.some(([u]) =>
        String(u).endsWith("/roles/directivo"),
      ),
    ).toBe(true);
  });

  test("reusa el grupo si ya existe, pero igual (re)asigna el role mapping (cierra el gap silencioso)", async () => {
    fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/realms/master/protocol/openid-connect/token")) {
          return jsonResponse({ access_token: "master-token" });
        }
        if (url.endsWith("/admin/realms/sicsaft/users") && method === "POST") {
          return new Response(null, {
            status: 201,
            headers: {
              Location: `${KC_URL}/admin/realms/sicsaft/users/user-456`,
            },
          });
        }
        if (
          url.endsWith("/admin/realms/sicsaft/organizations") &&
          method === "GET"
        ) {
          return jsonResponse([{ id: "org-uuid", alias: "municipalidad-x" }]);
        }
        if (
          url.endsWith("/organizations/org-uuid/members") &&
          method === "POST"
        ) {
          return new Response(null, { status: 204 });
        }
        if (url.endsWith("/roles/directivo") && method === "GET") {
          return jsonResponse({ id: "rol-directivo-uuid", name: "directivo" });
        }
        if (url.includes("/groups?search=") && method === "GET") {
          return jsonResponse([
            { id: "grupo-existente", name: "municipalidad-x::directivo" },
          ]);
        }
        if (
          url.endsWith("/groups/grupo-existente/role-mappings/realm") &&
          method === "POST"
        ) {
          return new Response(null, { status: 204 });
        }
        if (
          url.endsWith("/users/user-456/groups/grupo-existente") &&
          method === "PUT"
        ) {
          return new Response(null, { status: 204 });
        }
        throw new Error(`Llamada no esperada: ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await crearUsuarioDirector(
      admin,
      "municipalidad-x",
      "director2@municipalidad-x.cl",
    );
    expect(resultado.userId).toBe("user-456");
    // No se creó un grupo nuevo (POST /groups) -- solo se reusó grupo-existente.
    expect(
      fetchMock.mock.calls.some(
        ([u, i]) =>
          String(u).endsWith("/admin/realms/sicsaft/groups") &&
          (i as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
    // Pero el role mapping SÍ se (re)asignó sobre el grupo reusado.
    expect(
      fetchMock.mock.calls.some(
        ([u, i]) =>
          String(u).endsWith("/groups/grupo-existente/role-mappings/realm") &&
          (i as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(true);
  });

  test("propaga el error si la organización no existe en Keycloak", async () => {
    fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/realms/master/protocol/openid-connect/token")) {
          return jsonResponse({ access_token: "master-token" });
        }
        if (url.endsWith("/admin/realms/sicsaft/users") && method === "POST") {
          return new Response(null, {
            status: 201,
            headers: {
              Location: `${KC_URL}/admin/realms/sicsaft/users/user-789`,
            },
          });
        }
        if (
          url.endsWith("/admin/realms/sicsaft/organizations") &&
          method === "GET"
        ) {
          return jsonResponse([]); // ninguna organización existe
        }
        throw new Error(`Llamada no esperada: ${method} ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      crearUsuarioDirector(admin, "org-inexistente", "x@x.cl"),
    ).rejects.toThrow(/org-inexistente/);
  });
});

describe("crearUsuarioProfesionalAft", () => {
  test("mismo flujo que el Director pero con el rol 'administrador-patrimonial'", async () => {
    const fetchMock = mockAdminApi("aft-user-1", "aft-grupo-1");
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await crearUsuarioProfesionalAft(
      admin,
      "municipalidad-x",
      "aft@municipalidad-x.cl",
    );

    expect(resultado.userId).toBe("aft-user-1");
    expect(resultado.passwordInicial).toHaveLength(20);

    // el rol resuelto para el grupo fue "administrador-patrimonial", NO "profesional-aft"
    expect(
      fetchMock.mock.calls.some(([u]) =>
        String(u).endsWith("/roles/administrador-patrimonial"),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(([u]) =>
        String(u).endsWith("/roles/profesional-aft"),
      ),
    ).toBe(false);

    // el grupo creado usa el separador `::` que espera keycloak-auth.guard.ts de cis/
    const llamadaCrearGrupo = fetchMock.mock.calls.find(
      ([u, i]) =>
        String(u).endsWith("/admin/realms/sicsaft/groups") &&
        (i as RequestInit | undefined)?.method === "POST",
    );
    const grupoBody = JSON.parse(String(llamadaCrearGrupo?.[1]?.body)) as {
      name: string;
    };
    expect(grupoBody.name).toBe("municipalidad-x::administrador-patrimonial");
  });
});

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
