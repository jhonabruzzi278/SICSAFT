import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AreaRepository } from '../estructura/area.repository';
import { ResponsableRepository } from '../estructura/responsable.repository';
import { CatalogoTipoActivoRepository } from './catalogo-tipo-activo.repository';

// DOC-029 RF-B — al aprobar un lote de importación de Excel, las filas pueden traer nombres del
// cliente (DIRECCION GENERAL, DIRECTOR GENERAL, MOBILIARIO...) en vez de ids. Este servicio los
// resuelve-o-crea contra la estructura real de la organización. La operación completa ya verificó
// el rol del Profesional de AFT que aprueba (OrquestadorService.ejecutarOperacionOficial). Las
// entidades que crea quedan con la misma máquina de estados que las de alta manual — nunca se
// borran (Tomo III 4.10).

// Marcas diacríticas combinadas (U+0300–U+036F): se quitan tras normalizar a NFD.
const DIACRITICOS = /[̀-ͯ]/g;

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

@Injectable()
export class ResolvedorImportacionService {
  constructor(
    private readonly areaRepository: AreaRepository,
    private readonly responsableRepository: ResponsableRepository,
    private readonly catalogoTipoActivoRepository: CatalogoTipoActivoRepository,
  ) {}

  // catalogo_activos es compartido entre organizaciones (sin organizacion_id) — se busca por
  // familia o tipo == categoría, sin distinguir mayúsculas ni espacios sobrantes.
  async resolverCatalogo(categoriaNombre: string): Promise<string> {
    const clave = categoriaNombre.trim().toLowerCase();
    const existente = (await this.catalogoTipoActivoRepository.listar()).find(
      (t) =>
        t.familia.trim().toLowerCase() === clave ||
        t.tipo.trim().toLowerCase() === clave,
    );
    if (existente) return existente.id;
    const creado = await this.catalogoTipoActivoRepository.crear({
      tipo: categoriaNombre.trim(),
      familia: categoriaNombre.trim(),
      criticidad: 'media',
      tecnologiaIdentificacion: 'qr',
    });
    return creado.id;
  }

  async resolverArea(
    organizacionId: string,
    nombre: string,
    direccionNombre?: string | null,
  ): Promise<string> {
    const existente = await this.areaRepository.buscarPorNombre(
      organizacionId,
      nombre,
    );
    if (existente) return existente.id;
    const creada = await this.areaRepository.crear({
      organizacionId,
      codigo: `${slug(nombre)}-${randomUUID().slice(0, 8)}`,
      nombre: nombre.trim(),
      dependencia: direccionNombre?.trim() || undefined,
    });
    return creada.id;
  }

  async resolverResponsable(
    organizacionId: string,
    nombre: string,
    areaId: string,
  ): Promise<string> {
    const existente = await this.responsableRepository.buscarPorNombre(
      organizacionId,
      nombre,
    );
    if (existente) return existente.id;
    // `responsables.identificacion` es UNIQUE — se sintetiza una para las altas por importación.
    const creado = await this.responsableRepository.crear({
      organizacionId,
      identificacion: `IMPORT-${slug(nombre)}-${randomUUID().slice(0, 8)}`,
      nombre: nombre.trim(),
      areaId,
    });
    return creado.id;
  }
}
