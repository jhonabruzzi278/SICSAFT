// Lógica pura para ajustar stock (sumar/rebajar) sin bajar de 0. Si se
// indica variantCode, ajusta esa variante y recalcula el stock total del
// producto como la suma de sus variantes.
import type { Product } from './db';

export function applyStockDelta(product: Product, delta: number, variantCode?: string): Product {
  if (variantCode) {
    const variants = (product.variants ?? []).map((v) =>
      v.code === variantCode ? { ...v, stock: Math.max(0, v.stock + delta) } : v,
    );
    return { ...product, variants, stock: variants.reduce((sum, v) => sum + v.stock, 0) };
  }
  return { ...product, stock: Math.max(0, (product.stock ?? 0) + delta) };
}
