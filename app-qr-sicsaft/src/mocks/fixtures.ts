// Fixtures limpios desde cero
import type { ConnectorAsset, OrganizacionSummary } from '@/lib/qr-connector';

export const MOCK_ORGANIZACIONES: OrganizacionSummary[] = [
  {
    id: 'org-demo',
    nombre: 'MI EMPRESA / ORGANIZACIÓN',
    sedes: [{ id: 'sede-1', nombre: 'Sede Central' }],
  },
];

export const MOCK_CATALOGO: ConnectorAsset[] = [];
