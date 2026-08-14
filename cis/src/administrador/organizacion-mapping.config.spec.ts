import { loadOrganizacionMapping } from './organizacion-mapping.config';

describe('loadOrganizacionMapping', () => {
  it('parsea el JSON de ZITADEL_ORG_ID_MAP', () => {
    const mapping = loadOrganizacionMapping({
      ZITADEL_ORG_ID_MAP: '{"386029528616558597":"duoc-uc"}',
    });
    expect(mapping).toEqual({ '386029528616558597': 'duoc-uc' });
  });

  it('lanza si falta ZITADEL_ORG_ID_MAP', () => {
    expect(() => loadOrganizacionMapping({})).toThrow('ZITADEL_ORG_ID_MAP');
  });

  it('lanza si ZITADEL_ORG_ID_MAP no es JSON valido', () => {
    expect(() =>
      loadOrganizacionMapping({ ZITADEL_ORG_ID_MAP: 'no-es-json' }),
    ).toThrow('JSON válido');
  });

  it('lanza si ZITADEL_ORG_ID_MAP es un array en vez de un objeto', () => {
    expect(() =>
      loadOrganizacionMapping({ ZITADEL_ORG_ID_MAP: '["duoc-uc"]' }),
    ).toThrow('objeto');
  });

  it('lanza si algun valor del mapeo no es string', () => {
    expect(() =>
      loadOrganizacionMapping({ ZITADEL_ORG_ID_MAP: '{"org-1": 123}' }),
    ).toThrow('strings');
  });
});
