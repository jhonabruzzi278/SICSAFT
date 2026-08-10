// Catálogo demo de 20 productos ficticios (usado para generar QR y mostrar
// nombres). La "base de datos" real (IndexedDB) sólo contiene los primeros
// 15 al arrancar (ver db.ts) — el resto se puede cargar desde el formulario
// "Nuevo Producto".
import type { Product } from './db';

export const FULL_CATALOG: Product[] = [
  { code: 'P001', name: 'Caramelos Verdes', description: 'Caramelos surtidos sabor menta, bolsa 200g.' },
  { code: 'P002', name: 'Yogurt de Fresa', description: 'Yogurt bebible sabor fresa, envase 1L.' },
  { code: 'P003', name: 'Galletas de Chocolate', description: 'Galletas rellenas de chocolate, paquete 150g.' },
  { code: 'P004', name: 'Agua Mineral', description: 'Agua mineral natural, botella 600ml.' },
  { code: 'P005', name: 'Bebida Cola', description: 'Bebida gaseosa sabor cola, botella 2L.' },
  { code: 'P006', name: 'Café Instantáneo', description: 'Café soluble premium, frasco 170g.' },
  { code: 'P007', name: 'Arroz Premium', description: 'Arroz blanco grano largo, saco 5kg.' },
  { code: 'P008', name: 'Aceite Vegetal', description: 'Aceite vegetal comestible, botella 1L.' },
  { code: 'P009', name: 'Atún en Agua', description: 'Atún en agua, lata 170g.' },
  { code: 'P010', name: 'Leche Entera', description: 'Leche entera UHT, cartón 1L.' },
  { code: 'P011', name: 'Pan Integral', description: 'Pan de molde integral, paquete 500g.' },
  { code: 'P012', name: 'Mermelada de Frutilla', description: 'Mermelada de frutilla, frasco 300g.' },
  { code: 'P013', name: 'Cereal de Avena', description: 'Cereal de avena integral, caja 400g.' },
  { code: 'P014', name: 'Té Verde', description: 'Té verde en filtrantes, caja de 20.' },
  { code: 'P015', name: 'Miel Natural', description: 'Miel de abeja pura, frasco 500g.' },
  { code: 'P016', name: 'Jabón Líquido', description: 'Jabón líquido para manos, botella 400ml.' },
  { code: 'P017', name: 'Shampoo Aloe Vera', description: 'Shampoo con aloe vera, botella 750ml.' },
  { code: 'P018', name: 'Pasta Dental', description: 'Pasta dental blanqueadora, tubo 90g.' },
  { code: 'P019', name: 'Papel Higiénico', description: 'Papel higiénico doble hoja, paquete x4.' },
  { code: 'P020', name: 'Detergente Líquido', description: 'Detergente líquido para ropa, botella 1L.' },
];

export const REGISTERED_CODES: string[] = FULL_CATALOG.slice(0, 15).map((p) => p.code);
