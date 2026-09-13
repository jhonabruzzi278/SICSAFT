// Fixtures limpios desde cero (0 activos, 0 áreas)
import type { Area, ActivoCatalogo, Organizacion } from '@/lib/cis-client';

export const MOCK_ORGANIZACIONES: Organizacion[] = [
  {
    id: 'org-demo',
    nombre: 'MI EMPRESA / ORGANIZACIÓN',
    sedes: [{ id: 'sede-1', nombre: 'Sede Central' }],
  },
];

export const MOCK_AREAS: Area[] = [];

// `organizacionId: 'duoc-uc'` no es decorativo: el handler de `/catalogo` filtra por
// organizacion y todos los specs navegan con `?organizacionId=duoc-uc`. Con el catalogo vacio
// (o con otra organizacion) las pantallas de catalogo y etiquetas salian sin filas y 7 specs
// fallaban buscando 'DC-01'.
export const MOCK_CATALOGO: ActivoCatalogo[] = [
  {
    id: 'dc-01',
    codigoQr: 'DC-01',
    nombre: '1 EQUIPO CLIMATIZACION 12000 BTU',
    organizacionId: 'duoc-uc',
    areaId: 'area-001',
    areaNombre: 'OFICINA DIRECTOR COMERCIAL',
    areaDependencia: null,
    ubicacionId: 'loc-001',
    estado: 'activo',
    familia: 'Climatización',
    marca: null,
    modelo: null,
    serie: null,
    valorPatrimonial: null,
    fechaCompra: null,
    responsableNombre: null,
  },
  {
    id: 'dc-02',
    codigoQr: 'DC-02',
    nombre: '1 SOFA 3 PERSONAS',
    organizacionId: 'duoc-uc',
    areaId: 'area-001',
    areaNombre: 'OFICINA DIRECTOR COMERCIAL',
    areaDependencia: null,
    ubicacionId: 'loc-001',
    estado: 'activo',
    familia: 'Mobiliario',
    marca: null,
    modelo: null,
    serie: null,
    valorPatrimonial: null,
    fechaCompra: null,
    responsableNombre: null,
  },
];

export const MOCK_SYNC = {
  syncEstado: 'en_linea' as const,
  ultimaSincronizacion: new Date().toISOString(),
  eventosPendientes: 0,
};
