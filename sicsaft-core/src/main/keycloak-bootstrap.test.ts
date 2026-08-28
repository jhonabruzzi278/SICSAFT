import { describe, expect, test, vi, beforeEach } from "vitest";
import { crearUsuarioDirector } from "./keycloak-bootstrap";

const admin = { usuario: "admin", password: "pw" };
const KC_URL = "http://127.0.0.1:58080";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("crearUsuarioDirector", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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
              Location: `${KC_URL}/admin/realms/sicsaft/users/user-123`,
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
        if (url.includes("/groups?search=") && method === "GET") {
          return jsonResponse([]); // grupo todavía no existe
        }
        if (url.endsWith("/admin/realms/sicsaft/groups") && method === "POST") {
          return new Response(null, {
            status: 201,
            headers: {
              Location: `${KC_URL}/admin/realms/sicsaft/groups/grupo-123`,
            },
          });
        }
        if (url.endsWith("/roles/directivo") && method === "GET") {
          return jsonResponse({ id: "rol-directivo-uuid", name: "directivo" });
        }
        if (
          url.endsWith("/groups/grupo-123/role-mappings/realm") &&
          method === "POST"
        ) {
          return new Response(null, { status: 204 });
        }
        if (
          url.endsWith("/users/user-123/groups/grupo-123") &&
          method === "PUT"
        ) {
          return new Response(null, { status: 204 });
        }
        throw new Error(`Llamada no esperada en el mock: ${method} ${url}`);
      },
    );
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
  });

  test("reusa el grupo si ya existe (no crea uno duplicado)", async () => {
    // Reemplaza el mock del beforeEach entero (no solo un handler) para simular que el grupo ya
    // existe -- más simple que parchear un solo caso sin depender del orden de llamadas.
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
        if (url.includes("/groups?search=") && method === "GET") {
          return jsonResponse([
            { id: "grupo-existente", name: "municipalidad-x::directivo" },
          ]);
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
    // No se llamó a crear un grupo nuevo (POST /groups) -- solo se reusó grupo-existente.
    expect(
      fetchMock.mock.calls.some(
        ([u, i]) =>
          String(u).endsWith("/admin/realms/sicsaft/groups") &&
          (i as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
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
