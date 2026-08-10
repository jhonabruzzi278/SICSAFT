import { useEffect, useRef, useState } from 'react';
import { LayoutGridIcon, ListIcon, PlusIcon, PrinterIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductGrid, type CatalogViewMode } from '@/components/ProductGrid';
import { ProductFormDialog } from '@/components/ProductFormDialog';
import { LabelPreviewDialog } from '@/components/LabelPreviewDialog';
import { StockAdjustDialog } from '@/components/StockAdjustDialog';
import { usePrintLabels } from '@/components/PrintLabelsProvider';
import type { CatalogProduct } from '@/components/ProductCard';
import { FULL_CATALOG } from '@/lib/catalog-data';
import { buildLabelUnits, type LabelUnit } from '@/lib/labels';
import { applyStockDelta } from '@/lib/stock';
import {
  deleteProduct,
  getAllProducts,
  initInventoryDb,
  lookupProduct,
  productCodeExists,
  putProduct,
  type Product,
} from '@/lib/db';

const VIEW_STORAGE_KEY = 'qrvault-catalog-view';

function readStoredView(): CatalogViewMode {
  if (typeof window === 'undefined') return 'grid';
  return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
}

export function CatalogPage() {
  const dbRef = useRef<IDBDatabase | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<CatalogViewMode>(readStoredView);
  const [formTarget, setFormTarget] = useState<CatalogProduct | 'create' | null>(null);
  const [previewUnits, setPreviewUnits] = useState<LabelUnit[] | null>(null);
  const [stockProduct, setStockProduct] = useState<CatalogProduct | null>(null);
  const printLabels = usePrintLabels();

  async function loadProducts(db: IDBDatabase) {
    const dbProducts = await getAllProducts(db);
    const dbByCode = new Map(dbProducts.map((p) => [p.code, p]));

    // Para códigos ya registrados, el registro de IndexedDB es la fuente de
    // verdad (puede tener ediciones); FULL_CATALOG sólo sirve de plantilla
    // de nombre/descripción para códigos que todavía no se registraron.
    const fromCatalog: CatalogProduct[] = FULL_CATALOG.map((product) => {
      const dbProduct = dbByCode.get(product.code);
      return dbProduct ? { ...dbProduct, isRegistered: true } : { ...product, isRegistered: false };
    });
    const customOnly: CatalogProduct[] = dbProducts
      .filter((p) => !FULL_CATALOG.some((c) => c.code === p.code))
      .map((product) => ({ ...product, isRegistered: true }));

    setProducts([...fromCatalog, ...customOnly].sort((a, b) => a.code.localeCompare(b.code)));
  }

  useEffect(() => {
    let cancelled = false;
    initInventoryDb().then((db) => {
      if (cancelled) return;
      dbRef.current = db;
      loadProducts(db);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleViewChange(next: CatalogViewMode) {
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  async function handleDelete(code: string) {
    const db = dbRef.current;
    if (!db) return;
    await deleteProduct(db, code);
    await loadProducts(db);
  }

  async function handleFormSubmit(product: Product): Promise<{ duplicateCode?: boolean }> {
    const db = dbRef.current;
    if (!db) return {};

    const isEdit = formTarget !== 'create';
    if (!isEdit && (await productCodeExists(db, product.code))) {
      return { duplicateCode: true };
    }

    await putProduct(db, product);
    await loadProducts(db);
    if (!isEdit) {
      setPreviewUnits(buildLabelUnits(product));
    }
    return {};
  }

  async function handleAdjustStock(code: string, delta: number, variantCode?: string) {
    const db = dbRef.current;
    if (!db) return;

    const existing = await lookupProduct(db, code);
    if (!existing) return;

    const updated = applyStockDelta(existing, delta, variantCode);
    await putProduct(db, updated);
    await loadProducts(db);
    setStockProduct({ ...updated, isRegistered: true });
  }

  function handlePrintAll() {
    const units = products.filter((p) => p.isRegistered).flatMap((p) => buildLabelUnits(p));
    printLabels(units);
  }

  const normalizedFilter = search.trim().toLowerCase();
  const filtered = products.filter(
    (p) =>
      !normalizedFilter ||
      p.code.toLowerCase().includes(normalizedFilter) ||
      p.name.toLowerCase().includes(normalizedFilter),
  );
  const registeredCount = products.filter((p) => p.isRegistered).length;
  const unregisteredCount = products.length - registeredCount;
  const formOpen = formTarget !== null;
  const formProduct = formTarget === 'create' ? null : formTarget;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-success" data-testid="registered-count">
              {registeredCount}
            </p>
            <p className="text-sm text-muted-foreground">Registrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-warning" data-testid="unregistered-count">
              {unregisteredCount}
            </p>
            <p className="text-sm text-muted-foreground">No registrados</p>
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-center gap-2 p-6">
          <Button data-testid="new-product-btn" onClick={() => setFormTarget('create')}>
            <PlusIcon />
            Nuevo Producto
          </Button>
          <Button variant="outline" data-testid="print-btn" onClick={handlePrintAll}>
            <PrinterIcon />
            Imprimir códigos QR
          </Button>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Input
          data-testid="search-input"
          placeholder="🔎 Buscar por código o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
          className="flex-1"
        />
        <div className="flex gap-1" role="group" aria-label="Tipo de vista">
          <Button
            type="button"
            variant={view === 'grid' ? 'default' : 'outline'}
            size="icon-sm"
            aria-pressed={view === 'grid'}
            onClick={() => handleViewChange('grid')}
            data-testid="view-grid-btn"
          >
            <LayoutGridIcon />
            <span className="sr-only">Vista de cuadrícula</span>
          </Button>
          <Button
            type="button"
            variant={view === 'list' ? 'default' : 'outline'}
            size="icon-sm"
            aria-pressed={view === 'list'}
            onClick={() => handleViewChange('list')}
            data-testid="view-list-btn"
          >
            <ListIcon />
            <span className="sr-only">Vista de lista</span>
          </Button>
        </div>
      </div>

      <ProductGrid
        products={filtered}
        view={view}
        onDelete={handleDelete}
        onPrint={(product) => printLabels(buildLabelUnits(product))}
        onAdjustStock={setStockProduct}
        onEdit={setFormTarget}
      />

      <ProductFormDialog
        open={formOpen}
        product={formProduct}
        onOpenChange={(open) => !open && setFormTarget(null)}
        onSubmit={handleFormSubmit}
      />
      <LabelPreviewDialog units={previewUnits} onOpenChange={(open) => !open && setPreviewUnits(null)} />
      <StockAdjustDialog
        product={stockProduct}
        onOpenChange={(open) => !open && setStockProduct(null)}
        onAdjust={handleAdjustStock}
      />
    </div>
  );
}
