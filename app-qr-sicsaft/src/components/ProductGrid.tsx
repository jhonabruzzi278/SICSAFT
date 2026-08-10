import { ProductCard, type CatalogProduct } from '@/components/ProductCard';
import { ProductListRow } from '@/components/ProductListRow';

export type CatalogViewMode = 'grid' | 'list';

interface ProductGridProps {
  products: CatalogProduct[];
  view: CatalogViewMode;
  onDelete: (code: string) => void;
  onPrint: (product: CatalogProduct) => void;
  onAdjustStock: (product: CatalogProduct) => void;
  onEdit: (product: CatalogProduct) => void;
}

export function ProductGrid({ products, view, onDelete, onPrint, onAdjustStock, onEdit }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p data-testid="no-results" className="text-sm text-muted-foreground">
        No se encontraron productos que coincidan con la búsqueda.
      </p>
    );
  }

  if (view === 'list') {
    return (
      <div data-testid="products-list" className="rounded-md border border-border px-3 sm:px-4">
        {products.map((product) => (
          <ProductListRow
            key={product.code}
            product={product}
            onDelete={onDelete}
            onPrint={onPrint}
            onAdjustStock={onAdjustStock}
            onEdit={onEdit}
          />
        ))}
      </div>
    );
  }

  return (
    <div data-testid="products-grid" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {products.map((product) => (
        <ProductCard
          key={product.code}
          product={product}
          onDelete={onDelete}
          onPrint={onPrint}
          onAdjustStock={onAdjustStock}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
