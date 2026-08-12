// Catálogo demo de 20 productos ficticios (usado para generar QR y mostrar
// nombres). La "base de datos" real (IndexedDB) sólo contiene los primeros
// 15 al arrancar (ver db.ts) — el resto se puede cargar desde el formulario
// "Nuevo Producto".
//
// Ubicación patrimonial asignada a los 15 registrados, repartida entre las
// organizaciones/áreas/ubicaciones semilla de organizations-data.ts, para
// poder ejercitar las 6 categorías de escaneo alcanzables (scan-resolve.ts):
// P001-P004 = org-001/area-001/loc-001 (la ubicación que usan por defecto los
// tests e2e — ver tests/helpers.js), P005-P007 = misma área, otra ubicación,
// P008-P009 = otra área de la misma organización, P010-P015 = organización
// distinta. P016-P020 no están en la DB — siempre "no registrado".
import type { Product } from './db';

export const FULL_CATALOG: Product[] = [
  {
    code: 'P001',
    name: 'Caramelos Verdes',
    description: 'Caramelos surtidos sabor menta, bolsa 200g.',
    organizationId: 'org-001',
    areaId: 'area-001',
    locationId: 'loc-001',
  },
  {
    code: 'P002',
    name: 'Yogurt de Fresa',
    description: 'Yogurt bebible sabor fresa, envase 1L.',
    organizationId: 'org-001',
    areaId: 'area-001',
    locationId: 'loc-001',
  },
  {
    code: 'P003',
    name: 'Galletas de Chocolate',
    description: 'Galletas rellenas de chocolate, paquete 150g.',
    organizationId: 'org-001',
    areaId: 'area-001',
    locationId: 'loc-001',
  },
  {
    code: 'P004',
    name: 'Agua Mineral',
    description: 'Agua mineral natural, botella 600ml.',
    organizationId: 'org-001',
    areaId: 'area-001',
    locationId: 'loc-001',
  },
  {
    code: 'P005',
    name: 'Bebida Cola',
    description: 'Bebida gaseosa sabor cola, botella 2L.',
    organizationId: 'org-001',
    areaId: 'area-001',
    locationId: 'loc-002',
  },
  {
    code: 'P006',
    name: 'Café Instantáneo',
    description: 'Café soluble premium, frasco 170g.',
    organizationId: 'org-001',
    areaId: 'area-001',
    locationId: 'loc-002',
  },
  {
    code: 'P007',
    name: 'Arroz Premium',
    description: 'Arroz blanco grano largo, saco 5kg.',
    organizationId: 'org-001',
    areaId: 'area-001',
    locationId: 'loc-002',
  },
  {
    code: 'P008',
    name: 'Aceite Vegetal',
    description: 'Aceite vegetal comestible, botella 1L.',
    organizationId: 'org-001',
    areaId: 'area-002',
    locationId: 'loc-003',
  },
  {
    code: 'P009',
    name: 'Atún en Agua',
    description: 'Atún en agua, lata 170g.',
    organizationId: 'org-001',
    areaId: 'area-002',
    locationId: 'loc-003',
  },
  {
    code: 'P010',
    name: 'Leche Entera',
    description: 'Leche entera UHT, cartón 1L.',
    organizationId: 'org-002',
    areaId: 'area-003',
    locationId: 'loc-004',
  },
  {
    code: 'P011',
    name: 'Pan Integral',
    description: 'Pan de molde integral, paquete 500g.',
    organizationId: 'org-002',
    areaId: 'area-003',
    locationId: 'loc-004',
  },
  {
    code: 'P012',
    name: 'Mermelada de Frutilla',
    description: 'Mermelada de frutilla, frasco 300g.',
    organizationId: 'org-002',
    areaId: 'area-003',
    locationId: 'loc-004',
  },
  {
    code: 'P013',
    name: 'Cereal de Avena',
    description: 'Cereal de avena integral, caja 400g.',
    organizationId: 'org-002',
    areaId: 'area-004',
    locationId: 'loc-005',
  },
  {
    code: 'P014',
    name: 'Té Verde',
    description: 'Té verde en filtrantes, caja de 20.',
    organizationId: 'org-002',
    areaId: 'area-004',
    locationId: 'loc-005',
  },
  {
    code: 'P015',
    name: 'Miel Natural',
    description: 'Miel de abeja pura, frasco 500g.',
    organizationId: 'org-002',
    areaId: 'area-004',
    locationId: 'loc-005',
  },
  { code: 'P016', name: 'Jabón Líquido', description: 'Jabón líquido para manos, botella 400ml.' },
  { code: 'P017', name: 'Shampoo Aloe Vera', description: 'Shampoo con aloe vera, botella 750ml.' },
  { code: 'P018', name: 'Pasta Dental', description: 'Pasta dental blanqueadora, tubo 90g.' },
  { code: 'P019', name: 'Papel Higiénico', description: 'Papel higiénico doble hoja, paquete x4.' },
  { code: 'P020', name: 'Detergente Líquido', description: 'Detergente líquido para ropa, botella 1L.' },
];

export const REGISTERED_CODES: string[] = FULL_CATALOG.slice(0, 15).map((p) => p.code);
