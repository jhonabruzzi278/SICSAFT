/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { ResolvedorImportacionService } from './resolvedor-importacion.service';
import type { AreaRepository } from '../estructura/area.repository';
import type { ResponsableRepository } from '../estructura/responsable.repository';
import type { CatalogoTipoActivoRepository } from './catalogo-tipo-activo.repository';

function build() {
  const areaRepository = {
    buscarPorNombre: jest.fn(),
    crear: jest.fn(),
  } as unknown as jest.Mocked<AreaRepository>;
  const responsableRepository = {
    buscarPorNombre: jest.fn(),
    crear: jest.fn(),
  } as unknown as jest.Mocked<ResponsableRepository>;
  const catalogoTipoActivoRepository = {
    listar: jest.fn(),
    crear: jest.fn(),
  } as unknown as jest.Mocked<CatalogoTipoActivoRepository>;
  const service = new ResolvedorImportacionService(
    areaRepository,
    responsableRepository,
    catalogoTipoActivoRepository,
  );
  return {
    service,
    areaRepository,
    responsableRepository,
    catalogoTipoActivoRepository,
  };
}

describe('ResolvedorImportacionService', () => {
  describe('resolverCatalogo', () => {
    it('devuelve el id del catálogo existente que matchea por familia o tipo (case/espacios)', async () => {
      const { service, catalogoTipoActivoRepository } = build();
      catalogoTipoActivoRepository.listar.mockResolvedValue([
        { id: 'cat-mob', tipo: 'Escritorio', familia: ' Mobiliario ' } as never,
      ]);

      expect(await service.resolverCatalogo('MOBILIARIO')).toBe('cat-mob');
      expect(catalogoTipoActivoRepository.crear).not.toHaveBeenCalled();
    });

    it('matchea también por tipo cuando la familia no coincide', async () => {
      const { service, catalogoTipoActivoRepository } = build();
      catalogoTipoActivoRepository.listar.mockResolvedValue([
        { id: 'cat-x', tipo: 'Notebook', familia: 'Informática' } as never,
      ]);

      expect(await service.resolverCatalogo('notebook')).toBe('cat-x');
      expect(catalogoTipoActivoRepository.crear).not.toHaveBeenCalled();
    });

    it('crea el catálogo cuando no existe, con defaults media/qr', async () => {
      const { service, catalogoTipoActivoRepository } = build();
      catalogoTipoActivoRepository.listar.mockResolvedValue([]);
      catalogoTipoActivoRepository.crear.mockResolvedValue({
        id: 'cat-nuevo',
      } as never);

      expect(await service.resolverCatalogo(' Informática ')).toBe('cat-nuevo');
      expect(catalogoTipoActivoRepository.crear).toHaveBeenCalledWith({
        tipo: 'Informática',
        familia: 'Informática',
        criticidad: 'media',
        tecnologiaIdentificacion: 'qr',
      });
    });
  });

  describe('resolverArea', () => {
    it('devuelve el id del área existente', async () => {
      const { service, areaRepository } = build();
      areaRepository.buscarPorNombre.mockResolvedValue({
        id: 'area-1',
      } as never);

      expect(await service.resolverArea('muni', 'OFICINA DIRECTOR')).toBe(
        'area-1',
      );
      expect(areaRepository.crear).not.toHaveBeenCalled();
    });

    it('crea el área cuando no existe, con la dirección como dependencia y un código con slug', async () => {
      const { service, areaRepository } = build();
      areaRepository.buscarPorNombre.mockResolvedValue(null);
      areaRepository.crear.mockResolvedValue({ id: 'area-nueva' } as never);

      const id = await service.resolverArea(
        'muni',
        'Oficina Director General',
        'DIRECCION GENERAL',
      );

      expect(id).toBe('area-nueva');
      const arg = areaRepository.crear.mock.calls[0][0];
      expect(arg.organizacionId).toBe('muni');
      expect(arg.nombre).toBe('Oficina Director General');
      expect(arg.dependencia).toBe('DIRECCION GENERAL');
      expect(arg.codigo).toMatch(/^OFICINA-DIRECTOR-GENERAL-[0-9a-f]{8}$/);
    });

    it('crea el área sin dependencia cuando no viene dirección', async () => {
      const { service, areaRepository } = build();
      areaRepository.buscarPorNombre.mockResolvedValue(null);
      areaRepository.crear.mockResolvedValue({ id: 'area-x' } as never);

      await service.resolverArea('muni', 'Pañol');

      expect(areaRepository.crear.mock.calls[0][0].dependencia).toBeUndefined();
    });
  });

  describe('resolverResponsable', () => {
    it('devuelve el id del responsable existente', async () => {
      const { service, responsableRepository } = build();
      responsableRepository.buscarPorNombre.mockResolvedValue({
        id: 'resp-1',
      } as never);

      expect(
        await service.resolverResponsable('muni', 'DIRECTOR GENERAL', 'area-1'),
      ).toBe('resp-1');
      expect(responsableRepository.crear).not.toHaveBeenCalled();
    });

    it('crea el responsable cuando no existe, con identificación sintética IMPORT-', async () => {
      const { service, responsableRepository } = build();
      responsableRepository.buscarPorNombre.mockResolvedValue(null);
      responsableRepository.crear.mockResolvedValue({
        id: 'resp-nuevo',
      } as never);

      const id = await service.resolverResponsable(
        'muni',
        'Director General',
        'area-1',
      );

      expect(id).toBe('resp-nuevo');
      const arg = responsableRepository.crear.mock.calls[0][0];
      expect(arg.identificacion).toMatch(
        /^IMPORT-DIRECTOR-GENERAL-[0-9a-f]{8}$/,
      );
      expect(arg.nombre).toBe('Director General');
      expect(arg.areaId).toBe('area-1');
      expect(arg.organizacionId).toBe('muni');
    });
  });

  describe('resolverSoloExistentes (DOC-030 — dry-run, no crea nada)', () => {
    it('resuelve los nombres a los ids ya existentes sin crear', async () => {
      const {
        service,
        areaRepository,
        responsableRepository,
        catalogoTipoActivoRepository,
      } = build();
      areaRepository.buscarPorNombre.mockResolvedValue({
        id: 'area-1',
      } as never);
      responsableRepository.buscarPorNombre.mockResolvedValue({
        id: 'resp-1',
      } as never);
      catalogoTipoActivoRepository.listar.mockResolvedValue([
        { id: 'cat-mob', tipo: 'Escritorio', familia: 'Mobiliario' } as never,
      ]);

      expect(
        await service.resolverSoloExistentes('muni', {
          areaNombre: 'Oficina 1',
          responsableNombre: 'Encargado 1',
          categoriaNombre: 'MOBILIARIO',
        }),
      ).toEqual({
        areaId: 'area-1',
        responsableId: 'resp-1',
        catalogoId: 'cat-mob',
      });
      expect(areaRepository.crear).not.toHaveBeenCalled();
      expect(responsableRepository.crear).not.toHaveBeenCalled();
      expect(catalogoTipoActivoRepository.crear).not.toHaveBeenCalled();
    });

    it('deja el campo en undefined cuando el nombre no corresponde a algo ya existente', async () => {
      const { service, areaRepository, responsableRepository } = build();
      areaRepository.buscarPorNombre.mockResolvedValue(null);
      responsableRepository.buscarPorNombre.mockResolvedValue(null);

      expect(
        await service.resolverSoloExistentes('muni', {
          areaNombre: 'Área nueva',
          responsableNombre: 'Nadie',
        }),
      ).toEqual({
        areaId: undefined,
        responsableId: undefined,
        catalogoId: undefined,
      });
    });

    it('no consulta cuando no hay nombres', async () => {
      const { service, areaRepository, responsableRepository } = build();

      expect(await service.resolverSoloExistentes('muni', {})).toEqual({
        areaId: undefined,
        responsableId: undefined,
        catalogoId: undefined,
      });
      expect(areaRepository.buscarPorNombre).not.toHaveBeenCalled();
      expect(responsableRepository.buscarPorNombre).not.toHaveBeenCalled();
    });
  });
});
