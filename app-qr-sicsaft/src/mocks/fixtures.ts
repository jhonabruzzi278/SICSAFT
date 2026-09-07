// Datos fijos para los handlers de MSW (tests/aidlc, no producción). El catálogo se deriva de
// FULL_CATALOG (src/lib/catalog-data.ts) — extraído de CU-PAT-DIRECCION-GENERAL-completo.xls.
import { FULL_CATALOG } from '@/lib/catalog-data';
import type { ConnectorAsset, OrganizacionSummary } from '@/lib/qr-connector';

export const MOCK_ORGANIZACIONES: OrganizacionSummary[] = [
  {
    id: 'org-001',
    nombre: 'EMPRESA SUCHEL TROPICAL - DIRECCIÓN GENERAL',
    sedes: [
      { id: 'loc-001', nombre: 'Oficina Director General' },
      { id: 'loc-002', nombre: 'Oficina Secretaría Ejecutiva' },
      { id: 'loc-003', nombre: 'Salón de Reuniones' },
      { id: 'loc-004', nombre: 'Departamento Jurídico' },
      { id: 'loc-005', nombre: 'Pantry & Serv. Generales' },
    ],
  },
  {
    id: 'org-002',
    nombre: 'EMPRESA SUCHEL TROPICAL - DIRECCIÓN COMERCIAL',
    sedes: [
      { id: 'loc-004', nombre: 'Oficinas Dirección Comercial' },
      { id: 'loc-005', nombre: 'Anexo Distribución' },
    ],
  },
];

const areaNameMap: Record<string, string> = {
  'area-001': 'OFICINA DIRECTOR GENERAL',
  'area-002': 'OFICINA SECRETARIA EJECUTIVA',
  'area-003': 'SALON REUNIONES',
  'area-004': 'JURIDICO',
  'area-005': 'PANTRY',
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

// QR-DG-001 con una variante — ejercita la resolución de códigos "BASE-VARIANTE" (labels.ts,
// scan-resolve.ts) contra el catálogo real del Conector QR.
const dg001 = MOCK_CATALOGO.find((a) => a.codigoQr === 'QR-DG-001');
if (dg001) dg001.variants = [{ code: 'M', name: 'Mediana', stock: 0 }];
