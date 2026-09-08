import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');

export function limpiarTodo() {
  console.log('\x1b[33m-> Vaciando todos los datos: inicializando entorno 100% limpio desde cero...\x1b[0m');

  // 1. app-qr-sicsaft/src/lib/catalog-data.ts
  const catalogDataContent = `// Catálogo limpio desde cero (0 activos)
import type { Product } from './db';

export const FULL_CATALOG: Product[] = [];
export const REGISTERED_CODES: string[] = [];
`;
  writeFileSync(join(rootDir, 'app-qr-sicsaft', 'src', 'lib', 'catalog-data.ts'), catalogDataContent, 'utf-8');

  // 2. app-qr-sicsaft/src/mocks/fixtures.ts
  const appQrFixturesContent = `// Fixtures limpios desde cero
import type { ConnectorAsset, OrganizacionSummary } from '@/lib/qr-connector';

export const MOCK_ORGANIZACIONES: OrganizacionSummary[] = [
  {
    id: 'org-demo',
    nombre: 'MI EMPRESA / ORGANIZACIÓN',
    sedes: [{ id: 'sede-1', nombre: 'Sede Central' }],
  },
];

export const MOCK_CATALOGO: ConnectorAsset[] = [];
`;
  writeFileSync(join(rootDir, 'app-qr-sicsaft', 'src', 'mocks', 'fixtures.ts'), appQrFixturesContent, 'utf-8');

  // 3. ccp/src/mocks/fixtures.ts
  const ccpFixturesContent = `// Fixtures limpios desde cero (0 activos, 0 áreas)
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
`;
  writeFileSync(join(rootDir, 'ccp', 'src', 'mocks', 'fixtures.ts'), ccpFixturesContent, 'utf-8');

  console.log('\x1b[32m  OK: Datos reiniciados con éxito (0 activos, 0 áreas).\x1b[0m');
  console.log('\x1b[35m-> Entorno listo para crear activos, importar Excels o configurar áreas desde cero.\x1b[0m\n');
}

limpiarTodo();
