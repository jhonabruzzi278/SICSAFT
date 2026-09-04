import { test, expect } from '../fixtures/auth';
import { ORG_ID, SEED_PATRIMONIAL, URLS } from '../test-data.mjs';

// CU-PAT-001 — Registrar activo (casos-de-uso/dominios/CU-PAT-gestion-patrimonial.md).
// MATRIZ-TRAZABILIDAD.md: "core e2e activos · **falta** e2e UI" — este spec cubre ese hueco
// ejerciendo la cadena real del §12.33: ACTOR → AUTH (Keycloak) → CIS → CORE → BPI.
//
// El alta se hace por la API de CIS con el JWT real del Profesional de AFT (obtenido por login de
// navegador en la fixture) — no por el DOM del CCP, que es más frágil. La aparición de la fila en
// la pantalla de Activos se comprueba aparte, como check blando.

test.describe('CU-PAT-001 Registrar activo', () => {
  const sufijo = Date.now().toString(36).toUpperCase();
  const codigoPatrimonial = `E2E-PAT-${sufijo}`;
  const codigoQr = `E2E-QR-${sufijo}`;

  test('el Profesional de AFT da de alta un activo y queda persistido en la BPI', async ({
    aft,
  }) => {
    // Precondición: CIS resuelve la organización del actor (contrato vigente del seed DUOC UC).
    const sesion = await aft.api.post('/auth/session', {
      data: { deviceId: 'cu-pat-001' },
    });
    expect(sesion.ok()).toBeTruthy();
    const { organizaciones } = await sesion.json();
    expect(organizaciones.map((o: { id: string }) => o.id)).toContain(ORG_ID);

    // Flujo principal: alta de activo (POST /admin/activos → CIS → CORE → tabla `activos`).
    const alta = await aft.api.post('/admin/activos', {
      data: {
        organizacionId: ORG_ID,
        codigoPatrimonial,
        codigoQr,
        catalogoId: SEED_PATRIMONIAL.catalogoNotebookId,
        areaId: SEED_PATRIMONIAL.areaId,
        ubicacionId: SEED_PATRIMONIAL.ubicacionId,
      },
    });
    expect(alta.ok(), `POST /admin/activos → ${alta.status()} ${await alta.text()}`).toBeTruthy();
    const activo = await alta.json();
    expect(activo.codigoPatrimonial).toBe(codigoPatrimonial);
    expect(activo.codigoQr).toBe(codigoQr);
    expect(activo.estado).toBeTruthy();

    // Postcondición: el activo es visible en el catálogo que consumen CCP y APP QR.
    const catalogo = await aft.api.get(`/catalogo?organizacionId=${ORG_ID}`);
    expect(catalogo.ok()).toBeTruthy();
    const { activos } = await catalogo.json();
    expect(activos.map((a: { codigoQr: string }) => a.codigoQr)).toContain(codigoQr);

    // Auditoría (§12.35.4) — check blando: hay entradas y alguna referencia al alta.
    const auditoria = await aft.api.get('/admin/auditoria?limit=100');
    expect(auditoria.ok()).toBeTruthy();
    const { entradas } = await auditoria.json();
    expect.soft(Array.isArray(entradas) && entradas.length > 0).toBeTruthy();
    expect
      .soft(
        entradas.some(
          (e: Record<string, unknown>) =>
            JSON.stringify(e).includes(codigoPatrimonial) || /activo/i.test(String(e.operacion)),
        ),
        'esperaba una entrada de auditoría relacionada al alta del activo',
      )
      .toBeTruthy();

    // Presentación — check blando: la fila aparece en la pantalla de Activos del CCP.
    await test.step('la fila aparece en el CCP (check blando)', async () => {
      await aft.page.goto(`${URLS.ccp}/activos?organizacionId=${ORG_ID}`);
      await expect
        .soft(aft.page.getByText(codigoPatrimonial))
        .toBeVisible({ timeout: 15_000 });
    });
  });
});
