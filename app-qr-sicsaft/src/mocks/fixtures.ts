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

// Mismos nombres que las sedes de org-001 (arriba) — buildOrganizationTree (qr-connector.ts)
// deriva el nombre de la ubicación de `ubicacionNombre` del activo, no de `sedes`, así que sin
// esto el árbol mostraba el id crudo ("loc-001") en vez del nombre.
const locationNameMap: Record<string, string> = {
  'loc-001': 'Oficina Director General',
  'loc-002': 'Oficina Secretaría Ejecutiva',
  'loc-003': 'Salón de Reuniones',
  'loc-004': 'Departamento Jurídico',
  'loc-005': 'Pantry & Serv. Generales',
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
  ubicacionNombre: locationNameMap[p.locationId] || p.locationId,
}));

// QR-DG-001 con una variante — ejercita la resolución de códigos "BASE-VARIANTE" (labels.ts,
// scan-resolve.ts) contra el catálogo real del Conector QR.
const dg001 = MOCK_CATALOGO.find((a) => a.codigoQr === 'QR-DG-001');
if (dg001) dg001.variants = [{ code: 'M', name: 'Mediana', stock: 0 }];
