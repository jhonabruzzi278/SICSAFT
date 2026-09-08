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

export const MOCK_CATALOGO: ActivoCatalogo[] = [];

export const MOCK_SYNC = {
  syncEstado: 'en_linea' as const,
  ultimaSincronizacion: new Date().toISOString(),
  eventosPendientes: 0,
};
