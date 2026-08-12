// Resuelve un código escaneado contra el inventario y lo clasifica en una de
// las categorías de DOC-001 sección 3. Códigos de variante se imprimen como
// "BASE-VARIANTE" (ver labels.ts); si el código no matchea un producto
// directamente, se intenta separar en producto base + variante antes de darlo
// por no registrado.
import { lookupProduct, type ScanCategory } from './db';
import { FULL_CATALOG } from './catalog-data';
import { ORGANIZATIONS } from './organizations-data';

const ASSET_CODE_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)?$/;

function findAreaLocationNames(
  organizationId: string,
  areaId: string,
  locationId: string,
): { areaName?: string; locationName?: string } {
  const organization = ORGANIZATIONS.find((o) => o.id === organizationId);
  const area = organization?.areas.find((a) => a.id === areaId);
  const location = area?.locations.find((l) => l.id === locationId);
  return { areaName: area?.name, locationName: location?.name };
}

export interface ScanResolution {
  category: ScanCategory;
  name: string;
  expectedAreaName?: string;
  expectedLocationName?: string;
}

export interface SessionLocation {
  organizationId: string;
  areaId: string;
  locationId: string;
}

export async function resolveScannedProduct(
  db: IDBDatabase,
  rawCode: string,
  session: SessionLocation,
  alreadyScanned: Set<string>,
): Promise<ScanResolution> {
  const code = rawCode.trim().toUpperCase();

  if (!ASSET_CODE_PATTERN.test(code)) {
    return { category: 'invalid', name: code };
  }

  if (alreadyScanned.has(code)) {
    return { category: 'already-scanned', name: code };
  }

  let dbEntry = await lookupProduct(db, code);
  let matchedName: string | undefined = dbEntry?.name;

  if (!dbEntry) {
    const dashIndex = code.lastIndexOf('-');
    if (dashIndex > 0) {
      const baseCode = code.slice(0, dashIndex);
      const variantCode = code.slice(dashIndex + 1);
      const baseEntry = await lookupProduct(db, baseCode);
      const variant = baseEntry?.variants?.find((v) => v.code === variantCode);
      if (baseEntry && variant) {
        dbEntry = baseEntry;
        matchedName = `${baseEntry.name} — ${variant.name || variant.code}`;
      }
    }
  }

  if (!dbEntry) {
    const catalogEntry = FULL_CATALOG.find((p) => p.code === code);
    return { category: 'unregistered', name: catalogEntry?.name ?? 'Producto desconocido' };
  }

  const name = matchedName ?? dbEntry.name;

  // Sin ubicación patrimonial asignada (datos legacy) no hay base para
  // clasificar — no se bloquea el flujo, se cuenta como correcto.
  if (!dbEntry.organizationId || !dbEntry.areaId || !dbEntry.locationId) {
    return { category: 'correct', name };
  }

  if (dbEntry.organizationId !== session.organizationId) {
    // Pertenece a otra organización por completo — fuera del alcance de este
    // inventario, se trata igual que un activo no registrado.
    return { category: 'unregistered', name };
  }

  if (dbEntry.areaId !== session.areaId) {
    const { areaName, locationName } = findAreaLocationNames(dbEntry.organizationId, dbEntry.areaId, dbEntry.locationId);
    return { category: 'wrong-area', name, expectedAreaName: areaName, expectedLocationName: locationName };
  }

  if (dbEntry.locationId !== session.locationId) {
    const { areaName, locationName } = findAreaLocationNames(dbEntry.organizationId, dbEntry.areaId, dbEntry.locationId);
    return { category: 'wrong-location', name, expectedAreaName: areaName, expectedLocationName: locationName };
  }

  return { category: 'correct', name };
}
