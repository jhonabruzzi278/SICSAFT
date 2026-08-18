/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { EscrituraDocumentoActivoService } from './escritura-documento-activo.service';
import { DocumentoActivoRepository } from './documento-activo.repository';
import type {
  DocumentoActivo,
  NuevoDocumentoActivoInput,
} from './documento-activo.types';

const DOCUMENTO: DocumentoActivo = {
  id: 'documento-1',
  activoId: 'activo-1',
  organizacionId: 'duoc-uc',
  tipo: 'documento',
  url: 'https://example.com/doc.pdf',
  descripcion: 'Factura de compra',
  creadoEn: '2026-01-01T00:00:00.000Z',
  creadoPor: 'op-admin',
};

describe('EscrituraDocumentoActivoService', () => {
  describe('crear', () => {
    it('delega en DocumentoActivoRepository.crear con el input', async () => {
      const documentoActivoRepository = {
        crear: jest.fn(),
        eliminar: jest.fn(),
      } as unknown as jest.Mocked<DocumentoActivoRepository>;
      const service = new EscrituraDocumentoActivoService(
        documentoActivoRepository,
      );
      const input: NuevoDocumentoActivoInput = {
        activoId: 'activo-1',
        organizacionId: 'duoc-uc',
        tipo: 'documento',
        url: 'https://example.com/doc.pdf',
        descripcion: 'Factura de compra',
        creadoPor: 'op-admin',
      };
      documentoActivoRepository.crear.mockResolvedValue(DOCUMENTO);

      await expect(service.crear(input)).resolves.toBe(DOCUMENTO);
      expect(documentoActivoRepository.crear).toHaveBeenCalledWith(input);
    });
  });

  describe('eliminar', () => {
    it('delega en DocumentoActivoRepository.eliminar con los ids', async () => {
      const documentoActivoRepository = {
        crear: jest.fn(),
        eliminar: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<DocumentoActivoRepository>;
      const service = new EscrituraDocumentoActivoService(
        documentoActivoRepository,
      );

      await expect(
        service.eliminar('documento-1', 'activo-1', 'duoc-uc'),
      ).resolves.toBeUndefined();
      expect(documentoActivoRepository.eliminar).toHaveBeenCalledWith(
        'documento-1',
        'activo-1',
        'duoc-uc',
      );
    });
  });
});
