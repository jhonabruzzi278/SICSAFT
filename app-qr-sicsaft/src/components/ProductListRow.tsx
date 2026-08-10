import { useMemo } from 'react';
import qrcodeGenerator from 'qrcode-generator';
import { PackagePlusIcon, PencilIcon, PrinterIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useEntrance } from '@/hooks/useEntrance';
import type { CatalogProduct } from '@/components/ProductCard';

interface ProductListRowProps {
  product: CatalogProduct;
  onDelete: (code: string) => void;
  onPrint: (product: CatalogProduct) => void;
  onAdjustStock: (product: CatalogProduct) => void;
  onEdit: (product: CatalogProduct) => void;
}

export function ProductListRow({ product, onDelete, onPrint, onAdjustStock, onEdit }: ProductListRowProps) {
  const qrSvg = useMemo(() => {
    const qr = qrcodeGenerator(0, 'M');
    qr.addData(product.code);
    qr.make();
    return qr.createSvgTag({ cellSize: 3, margin: 1 });
  }, [product.code]);

  const isLowStock = product.minStock != null && product.stock != null && product.stock <= product.minStock;
  const shown = useEntrance();

  return (
    <div
      data-testid="product-list-row"
      data-code={product.code}
      data-open={shown || undefined}
      className={cn(
        'flex translate-y-2 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2.5 opacity-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] last:border-b-0 data-open:translate-y-0 data-open:opacity-100',
        !product.isRegistered && 'bg-warning/5',
      )}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-popover">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            data-testid="product-list-row-image"
            className="h-full w-full object-cover"
          />
        ) : (
          // qrSvg viene de qrcode-generator a partir de product.code (código interno), no de HTML/input de usuario.
          <div
            data-testid="product-list-row-qr"
            className="flex h-full w-full items-center justify-center [&_svg]:h-auto [&_svg]:w-8"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
      </div>

      <div className="min-w-[8rem] flex-1">
        <p className="truncate font-bold" data-testid="product-list-row-code">
          {product.code}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {product.name}
          {!product.isRegistered && ' (no registrado)'}
        </p>
      </div>

      {isLowStock && (
        <Badge variant="outline" className="hidden shrink-0 text-warning sm:inline-flex" data-testid="product-list-row-badge">
          Stock bajo
        </Badge>
      )}

      {product.isRegistered && (
        <div className="ml-auto flex shrink-0 gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Editar"
            onClick={() => onEdit(product)}
            data-testid="product-list-row-edit"
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Ajustar stock"
            onClick={() => onAdjustStock(product)}
            data-testid="product-list-row-adjust-stock"
          >
            <PackagePlusIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Imprimir etiqueta"
            onClick={() => onPrint(product)}
            data-testid="product-list-row-print"
          >
            <PrinterIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Quitar del inventario"
            className="text-destructive"
            onClick={() => onDelete(product.code)}
            data-testid="product-list-row-delete"
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
    </div>
  );
}
