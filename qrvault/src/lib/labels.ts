// Construcción de etiquetas QR imprimibles. Un producto sin variantes genera
// una única etiqueta; un producto con variantes genera una etiqueta por
// variante, cada una con su propio código escaneable (`BASE-VARIANTE`) para
// que el lector pueda distinguirlas (ver scan-resolve.ts).
import type { Product } from './db';

export interface LabelUnit {
  printCode: string;
  title: string;
  priceText: string;
}

export function formatPrice(value: number | undefined): string {
  const amount = Number(value) || 0;
  return `$${amount.toFixed(2)}`;
}

export function buildLabelUnits(product: Product): LabelUnit[] {
  const variants = product.variants ?? [];
  const priceText = product.finalPrice != null ? formatPrice(product.finalPrice) : '';

  if (variants.length === 0) {
    return [{ printCode: product.code, title: product.name, priceText }];
  }

  return variants.map((variant) => ({
    printCode: `${product.code}-${variant.code}`,
    title: `${product.name} — ${variant.name || variant.code}`,
    priceText,
  }));
}
