// Resuelve un código escaneado contra el catálogo ya traído del Conector QR
// (ver qr-connector.ts) y lo clasifica en una de las categorías de DOC-001
// sección 3. Es una función pura y síncrona: valida "offline" contra el
// snapshot que ScanPage pidió una sola vez al iniciar el inventario, no contra
// una consulta en vivo por cada código (matchea la intención de DOC-002).
// Códigos de variante se imprimen como "BASE-VARIANTE" (ver labels.ts); si el
// código no matchea un activo directamente, se intenta separar en activo base
// + variante antes de darlo por no registrado.
import type { ScanCategory } from './db';
import type { ConnectorAsset } from './qr-connector';
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

export function resolveScannedProduct(
  catalog: ConnectorAsset[],
  rawCode: string,
  session: SessionLocation,
  alreadyScanned: Set<string>,
): ScanResolution {
  const code = rawCode.trim().toUpperCase();

  if (!ASSET_CODE_PATTERN.test(code)) {
    return { category: 'invalid', name: code };
  }

  if (alreadyScanned.has(code)) {
    return { category: 'already-scanned', name: code };
  }

  let asset = catalog.find((a) => a.codigoQr === code);
  let matchedName: string | undefined = asset?.nombre;

  if (!asset) {
    const dashIndex = code.lastIndexOf('-');
    if (dashIndex > 0) {
      const baseCode = code.slice(0, dashIndex);
      const variantCode = code.slice(dashIndex + 1);
      const baseAsset = catalog.find((a) => a.codigoQr === baseCode);
      const variant = baseAsset?.variants?.find((v) => v.code === variantCode);
      if (baseAsset && variant) {
        asset = baseAsset;
        matchedName = `${baseAsset.nombre} — ${variant.name || variant.code}`;
      }
    }
  }

  if (!asset) {
    return { category: 'unregistered', name: 'Producto desconocido' };
  }

  const name = matchedName ?? asset.nombre;

  // Sin ubicación patrimonial asignada (datos legacy) no hay base para
  // clasificar — no se bloquea el flujo, se cuenta como correcto.
  if (!asset.organizacionId || !asset.areaId || !asset.ubicacionId) {
    return { category: 'correct', name };
  }

  if (asset.organizacionId !== session.organizationId) {
    // Pertenece a otra organización por completo — fuera del alcance de este
    // inventario, se trata igual que un activo no registrado.
    return { category: 'unregistered', name };
  }

  if (asset.areaId !== session.areaId) {
    const { areaName, locationName } = findAreaLocationNames(asset.organizacionId, asset.areaId, asset.ubicacionId);
    return { category: 'wrong-area', name, expectedAreaName: areaName, expectedLocationName: locationName };
  }

  if (asset.ubicacionId !== session.locationId) {
    const { areaName, locationName } = findAreaLocationNames(asset.organizacionId, asset.areaId, asset.ubicacionId);
    return { category: 'wrong-location', name, expectedAreaName: areaName, expectedLocationName: locationName };
  }

  return { category: 'correct', name };
}
