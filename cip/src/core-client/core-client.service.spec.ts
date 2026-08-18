import { CoreClientService } from './core-client.service';
import type { CoreClientConfig } from './core-client.config';
import type { CatalogoPagina, SesionDetalle } from './core-client.types';

const CONFIG: CoreClientConfig = {
  baseUrl: 'http://core:3001',
  serviceToken: 'secreto-compartido',
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe('CoreClientService', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('obtenerCatalogoCompleto', () => {
    it('devuelve los activos de una sola página cuando el total ya está cubierto', async () => {
      const pagina: CatalogoPagina = {
        activos: [
          {
            codigoQr: 'QR-1',
            nombre: 'Notebook',
            familia: 'Informática',
            organizacionId: 'org-1',
            areaId: 'area-1',
            ubicacionId: 'ubi-1',
            estado: 'activo',
          },
        ],
        total: 1,
      };
      fetchMock.mockResolvedValue(jsonResponse(pagina));

      const service = new CoreClientService(CONFIG);
      const activos = await service.obtenerCatalogoCompleto('org-1');

      expect(activos).toEqual(pagina.activos);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url as string).toContain('/catalogo?organizacionId=org-1');
      expect(
        (init?.headers as Record<string, string>)['x-internal-service-token'],
      ).toBe('secreto-compartido');
    });

    it('itera páginas siguientes hasta cubrir el total', async () => {
      const activoDe = (
        codigoQr: string,
      ): CatalogoPagina['activos'][number] => ({
        codigoQr,
        nombre: codigoQr,
        familia: 'Informática',
        organizacionId: 'org-1',
        areaId: 'area-1',
        ubicacionId: 'ubi-1',
        estado: 'activo',
      });
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ activos: [activoDe('QR-1')], total: 2 }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ activos: [activoDe('QR-2')], total: 2 }),
        );

      const service = new CoreClientService(CONFIG);
      const activos = await service.obtenerCatalogoCompleto('org-1');

      expect(activos.map((a) => a.codigoQr)).toEqual(['QR-1', 'QR-2']);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('corta en CATALOGO_MAX_PAGINAS aunque el total nunca se alcance (defensa en profundidad)', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          jsonResponse({
            activos: [
              {
                codigoQr: 'QR-loop',
                nombre: 'x',
                familia: 'x',
                organizacionId: 'org-1',
                areaId: 'area-1',
                ubicacionId: 'ubi-1',
                estado: 'activo',
              },
            ],
            total: Number.MAX_SAFE_INTEGER,
          }),
        ),
      );

      const service = new CoreClientService(CONFIG);
      const activos = await service.obtenerCatalogoCompleto('org-1');

      expect(activos.length).toBe(1000);
      expect(fetchMock).toHaveBeenCalledTimes(1000);
    });

    it('corta si una página devuelve vacío aunque el total diga otra cosa', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ activos: [], total: 5 }));

      const service = new CoreClientService(CONFIG);
      const activos = await service.obtenerCatalogoCompleto('org-1');

      expect(activos).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('obtenerInventarioDetalle', () => {
    it('pide GET /inventarios/:id y devuelve el detalle', async () => {
      const detalle: SesionDetalle = {
        id: 'ses-1',
        organizacionId: 'org-1',
        areaId: 'area-1',
        ubicacionId: 'ubi-1',
        operadorId: 'op-1',
        fechaInicio: '2026-01-01T00:00:00.000Z',
        fechaCierre: '2026-01-01T01:00:00.000Z',
        estado: 'recibido',
        creadoEn: '2026-01-01T01:00:00.000Z',
        escaneos: [],
      };
      fetchMock.mockResolvedValue(jsonResponse(detalle));

      const service = new CoreClientService(CONFIG);
      const resultado = await service.obtenerInventarioDetalle('ses-1');

      expect(resultado).toEqual(detalle);
      const [url] = fetchMock.mock.calls[0];
      expect(url as string).toBe('http://core:3001/inventarios/ses-1');
    });
  });

  describe('errores', () => {
    it('lanza con el status y el cuerpo cuando CORE responde no-ok', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ message: 'no encontrado' }, false, 404),
      );

      const service = new CoreClientService(CONFIG);

      await expect(service.obtenerInventarioDetalle('ses-x')).rejects.toThrow(
        /CORE respondió 404/,
      );
    });
  });
});
