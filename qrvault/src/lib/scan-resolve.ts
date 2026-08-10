// Resuelve un código escaneado contra el inventario. Códigos de variante se
// imprimen como "BASE-VARIANTE" (ver labels.ts); si el código no matchea un
// producto directamente, se intenta separar en producto base + variante
// antes de darlo por no registrado.
import { lookupProduct } from './db';
import { FULL_CATALOG } from './catalog-data';

export interface ScanResolution {
  found: boolean;
  name: string;
}

export async function resolveScannedProduct(db: IDBDatabase, code: string): Promise<ScanResolution> {
  const dbEntry = await lookupProduct(db, code);
  if (dbEntry) return { found: true, name: dbEntry.name };

  const dashIndex = code.lastIndexOf('-');
  if (dashIndex > 0) {
    const baseCode = code.slice(0, dashIndex);
    const variantCode = code.slice(dashIndex + 1);
    const baseEntry = await lookupProduct(db, baseCode);
    const variant = baseEntry?.variants?.find((v) => v.code === variantCode);
    if (baseEntry && variant) {
      return { found: true, name: `${baseEntry.name} — ${variant.name || variant.code}` };
    }
  }

  const catalogEntry = FULL_CATALOG.find((p) => p.code === code);
  return { found: false, name: catalogEntry?.name ?? 'Producto desconocido' };
}
