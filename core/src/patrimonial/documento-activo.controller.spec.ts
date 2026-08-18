/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentoActivoController } from './documento-activo.controller';
import { DocumentoActivoRepository } from './documento-activo.repository';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type {
  AltaDocumentoActivoBody,
  EliminarDocumentoActivoBody,
} from './documento-activo.schemas';
import type { DocumentoActivo } from './documento-activo.types';

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

describe('DocumentoActivoController', () => {
  let controller: DocumentoActivoController;
  let orquestadorService: jest.Mocked<OrquestadorService>;
  let repository: jest.Mocked<DocumentoActivoRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentoActivoController],
      providers: [
        {
          provide: OrquestadorService,
          useValue: {
            procesarAltaDocumentoActivo: jest.fn(),
            procesarEliminarDocumentoActivo: jest.fn(),
          },
        },
        {
          provide: DocumentoActivoRepository,
          useValue: { listarPorActivo: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DocumentoActivoController);
    orquestadorService = module.get(OrquestadorService);
    repository = module.get(DocumentoActivoRepository);
  });

  it('listar delega en DocumentoActivoRepository.listarPorActivo con activoId y organizacionId', async () => {
    repository.listarPorActivo.mockResolvedValue([DOCUMENTO]);

    await expect(
      controller.listar('activo-1', { organizacionId: 'duoc-uc' }),
    ).resolves.toEqual([DOCUMENTO]);
    expect(repository.listarPorActivo).toHaveBeenCalledWith(
      'activo-1',
      'duoc-uc',
    );
  });

  it('crear delega en OrquestadorService.procesarAltaDocumentoActivo con activoId y el body', async () => {
    orquestadorService.procesarAltaDocumentoActivo.mockResolvedValue(DOCUMENTO);
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      tipo: 'documento',
      url: 'https://example.com/doc.pdf',
      descripcion: 'Factura de compra',
    } as AltaDocumentoActivoBody;

    await expect(controller.crear('activo-1', body)).resolves.toBe(DOCUMENTO);
    expect(orquestadorService.procesarAltaDocumentoActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
    );
  });

  it('eliminar delega en OrquestadorService.procesarEliminarDocumentoActivo con activoId, documentoId y el body', async () => {
    orquestadorService.procesarEliminarDocumentoActivo.mockResolvedValue(
      undefined,
    );
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
    } as EliminarDocumentoActivoBody;

    await expect(
      controller.eliminar('activo-1', 'documento-1', body),
    ).resolves.toBeUndefined();
    expect(
      orquestadorService.procesarEliminarDocumentoActivo,
    ).toHaveBeenCalledWith('activo-1', 'documento-1', body);
  });
});
