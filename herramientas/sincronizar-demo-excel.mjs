import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const rootDir = resolve(import.meta.dirname, '..');

// Argumento: nombre de archivo en 'ejemplo activos/' (por defecto CU-PAT-DIRECCION-COMERCIAL-completo.xlsx)
const nombreArchivo = process.argv[2] || 'CU-PAT-DIRECCION-COMERCIAL-completo.xlsx';
const rutaExcel = join(rootDir, 'ejemplo activos', nombreArchivo);
const rutaEtl = join(rootDir, 'herramientas', 'etl-contable', 'etl_contable.py');

async function sincronizar() {
  console.log(`\x1b[36m-> Procesando Excel: ${nombreArchivo}...\x1b[0m`);
  
  const { stdout } = await execFileAsync('python', [
    rutaEtl,
    '--entrada',
    rutaExcel,
    '--organizacion',
    'org-demo',
    '--salida',
    '-'
  ]);

  const lote = JSON.parse(stdout);
  const items = lote.filas || [];
  console.log(`\x1b[32m  OK: ${items.length} activos extraídos del Excel.\x1b[0m`);

  // Extraer Áreas y Responsables únicos
  const areasMap = new Map();
  items.forEach((it, idx) => {
    const areaKey = it.areaNombre || 'ÁREA GENERAL';
    if (!areasMap.has(areaKey)) {
      areasMap.set(areaKey, {
        id: `area-${String(areasMap.size + 1).padStart(3, '0')}`,
        nombre: areaKey,
        codigo: `AREA-${areasMap.size + 1}`,
        dependencia: it.direccionNombre || 'Dirección General',
        responsableNombre: it.responsableNombre || 'Responsable General'
      });
    }
  });

  const direccionPrincipal = items[0]?.direccionNombre || 'DIRECCIÓN GENERAL';

  // 1. Generar app-qr-sicsaft/src/lib/catalog-data.ts
  const catalogProducts = items.map((it) => {
    const area = areasMap.get(it.areaNombre || 'ÁREA GENERAL');
    return {
      code: it.codigoPatrimonial,
      codigoAft: it.codigoPatrimonial,
      name: it.nombreAft || 'ACTIVO',
      description: `${it.nombreAft || 'ACTIVO'} en ${it.areaNombre || 'ÁREA'} (AFT: ${it.codigoPatrimonial}, Categoría: ${it.categoriaNombre || 'GENERAL'}).`,
      organizationId: 'org-001',
      areaId: area ? area.id : 'area-001',
      locationId: 'loc-001'
    };
  });

  const catalogDataContent = `// Catálogo oficial de los ${items.length} activos de ${direccionPrincipal}
// Extraídos automáticamente de "${nombreArchivo}".
import type { Product } from './db';

export const FULL_CATALOG: Product[] = ${JSON.stringify(catalogProducts, null, 2)};

export const REGISTERED_CODES = FULL_CATALOG.slice(0, 15).map((p) => p.code);
`;

  writeFileSync(
    join(rootDir, 'app-qr-sicsaft', 'src', 'lib', 'catalog-data.ts'),
    catalogDataContent,
    'utf-8'
  );
  console.log(`\x1b[32m  OK: app-qr-sicsaft/src/lib/catalog-data.ts actualizado (${items.length} activos).\x1b[0m`);

  // 2. Generar app-qr-sicsaft/src/mocks/fixtures.ts
  const areaNameMapEntries = Array.from(areasMap.values())
    .map(a => `  '${a.id}': ${JSON.stringify(a.nombre)},`)
    .join('\n');

  const appQrFixturesContent = `// Datos fijos para los handlers de MSW (tests/aidlc, no producción).
// Catálogo sincronizado automáticamente de "${nombreArchivo}".
import { FULL_CATALOG } from '@/lib/catalog-data';
import type { ConnectorAsset, OrganizacionSummary } from '@/lib/qr-connector';

export const MOCK_ORGANIZACIONES: OrganizacionSummary[] = [
  {
    id: 'org-001',
    nombre: 'EMPRESA SUCHEL TROPICAL - ${direccionPrincipal}',
    sedes: [
      { id: 'loc-001', nombre: 'Oficinas & Dependencias' },
    ],
  },
];

const areaNameMap: Record<string, string> = {
${areaNameMapEntries}
};

export const MOCK_CATALOGO: ConnectorAsset[] = FULL_CATALOG.filter(
  (p): p is typeof p & { organizationId: string; areaId: string; locationId: string } =>
    Boolean(p.organizationId && p.areaId && p.locationId),
).map((p) => ({
  codigoQr: p.code,
  codigoAft: p.codigoAft,
  nombre: p.name,
  organizacionId: p.organizationId,
  areaId: p.areaId,
  areaNombre: areaNameMap[p.areaId] || p.areaId,
  ubicacionId: p.locationId,
}));

// Ejercita resolución de variantes BASE-VARIANTE con el primer activo
if (MOCK_CATALOGO.length > 0) {
  MOCK_CATALOGO[0].variants = [{ code: 'M', name: 'Mediana', stock: 0 }];
}
`;

  writeFileSync(
    join(rootDir, 'app-qr-sicsaft', 'src', 'mocks', 'fixtures.ts'),
    appQrFixturesContent,
    'utf-8'
  );
  console.log(`\x1b[32m  OK: app-qr-sicsaft/src/mocks/fixtures.ts actualizado.\x1b[0m`);

  // 3. Generar ccp/src/mocks/fixtures.ts
  const mockAreasCcp = Array.from(areasMap.values()).map(a => ({
    id: a.id,
    organizacionId: 'duoc-uc',
    codigo: a.codigo,
    nombre: a.nombre,
    dependencia: a.dependencia,
    centroCosto: `CC-${a.id.toUpperCase()}`,
    responsableId: `resp-${a.id}`,
    ubicacionPrincipalId: 'loc-001'
  }));

  const mockCatalogoCcp = items.map((it, idx) => {
    const area = areasMap.get(it.areaNombre || 'ÁREA GENERAL');
    return {
      id: `activo-${String(idx + 1).padStart(3, '0')}`,
      codigoQr: it.codigoPatrimonial,
      codigoAft: it.codigoPatrimonial,
      nombre: it.nombreAft || 'ACTIVO',
      organizacionId: 'duoc-uc',
      areaId: area ? area.id : 'area-001',
      areaNombre: area ? area.nombre : 'Área General',
      ubicacionId: 'loc-001',
      estado: 'activo'
    };
  });

  const ccpFixturesContent = `// Datos fijos para los handlers de MSW (solo e2e, ver src/main.tsx VITE_MOCK_API)
// Generado automáticamente desde "${nombreArchivo}".
import type { Area, ActivoCatalogo, Organizacion } from '@/lib/cis-client';

export const MOCK_ORGANIZACIONES: Organizacion[] = [
  {
    id: 'duoc-uc',
    nombre: 'EMPRESA SUCHEL TROPICAL - ${direccionPrincipal}',
    sedes: [
      { id: 'sede-principal', nombre: 'Sede Principal ${direccionPrincipal}' },
    ],
  },
];

export const MOCK_AREAS: Area[] = ${JSON.stringify(mockAreasCcp, null, 2)};

export const MOCK_CATALOGO: ActivoCatalogo[] = ${JSON.stringify(mockCatalogoCcp, null, 2)};

export const MOCK_SYNC = {
  syncEstado: 'en_linea' as const,
  ultimaSincronizacion: '2026-09-08T12:00:00.000Z',
  eventosPendientes: 0,
};
`;

  writeFileSync(
    join(rootDir, 'ccp', 'src', 'mocks', 'fixtures.ts'),
    ccpFixturesContent,
    'utf-8'
  );
  console.log(`\x1b[32m  OK: ccp/src/mocks/fixtures.ts actualizado (${items.length} activos).\x1b[0m`);
  console.log(`\x1b[35m\n-> Sincronización exitosa: ahora el ecosistema opera con los ${items.length} activos de ${nombreArchivo}.\x1b[0m\n`);
}

sincronizar().catch(err => {
  console.error('\x1b[31mERROR al sincronizar Excel:\x1b[0m', err);
  process.exit(1);
});
