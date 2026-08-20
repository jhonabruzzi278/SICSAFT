import { describe, expect, it } from 'vitest';
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from './pkce';

describe('generateCodeChallenge', () => {
  // Vector de prueba oficial de RFC 7636 Apéndice B — verifica el cómputo real (SHA-256 +
  // base64url) contra un resultado conocido, no solo "no explota".
  it('calcula el code_challenge S256 correcto para el vector de RFC 7636 Apéndice B', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

    await expect(generateCodeChallenge(verifier)).resolves.toBe(expected);
  });

  it('el challenge nunca lleva padding "=" ni caracteres base64 estándar (+/)', async () => {
    const challenge = await generateCodeChallenge('cualquier-verifier');
    expect(challenge).not.toMatch(/[+/=]/);
  });
});

describe('generateCodeVerifier', () => {
  it('genera un verifier base64url sin padding, de longitud fija para 32 bytes', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).not.toMatch(/[+/=]/);
    // 32 bytes -> 43 caracteres en base64url sin padding.
    expect(verifier).toHaveLength(43);
  });

  it('genera valores distintos en llamadas sucesivas (no determinístico)', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('generateState', () => {
  it('genera un state base64url sin padding, de longitud fija para 16 bytes', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
    // 16 bytes -> 22 caracteres en base64url sin padding.
    expect(state).toHaveLength(22);
  });

  it('genera valores distintos en llamadas sucesivas (protección CSRF real)', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});
