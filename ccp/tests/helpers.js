// Mismo patrón que app-qr-sicsaft/tests/helpers.js: siembra sessionStorage con un JWT sin firmar
// (oidcClient no verifica firma client-side, CIS es quien valida server-side) para saltar el
// redirect real a Keycloak en los tests — el login OIDC/PKCE real ya se verifica manualmente
// (ver ccp/README.md "Próximo paso sugerido").
function base64url(json) {
  return Buffer.from(json)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function seedAuth(page, { operator = 'Operador Test' } = {}) {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({ name: operator, sub: 'operator-test' }),
  );
  const fakeJwt = `${header}.${payload}.`;
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

  await page.addInitScript(
    ([token, exp]) => {
      sessionStorage.setItem(
        'web-sicsaft-oidc-tokens',
        JSON.stringify({
          accessToken: token,
          refreshToken: 'mock-refresh-token',
          expiresAt: exp,
        }),
      );
    },
    [fakeJwt, expiresAt],
  );
}
