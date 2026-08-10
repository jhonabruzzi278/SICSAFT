import { useMemo } from 'react';
import qrcodeGenerator from 'qrcode-generator';
import { PackagePlusIcon, PencilIcon, PrinterIcon, Trash2Icon } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useEntrance } from '@/hooks/useEntrance';
import type { Product } from '@/lib/db';

export interface CatalogProduct extends Product {
  isRegistered: boolean;
}

interface ProductCardProps {
  product: CatalogProduct;
  onDelete: (code: string) => void;
  onPrint: (product: CatalogProduct) => void;
  onAdjustStock: (product: CatalogProduct) => void;
  onEdit: (product: CatalogProduct) => void;
}

export function ProductCard({ product, onDelete, onPrint, onAdjustStock, onEdit }: ProductCardProps) {
  const qrSvg = useMemo(() => {
    const qr = qrcodeGenerator(0, 'M');
    qr.addData(product.code);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2 });
  }, [product.code]);

  const isLowStock = product.minStock != null && product.stock != null && product.stock <= product.minStock;
  const shown = useEntrance();

  return (
    <Card
      data-testid="product-card"
      data-code={product.code}
      data-open={shown || undefined}
      className={cn(
        'translate-y-2.5 opacity-0 transition-[opacity,transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-lg data-open:translate-y-0 data-open:opacity-100',
        !product.isRegistered && 'ring-2 ring-warning ring-dashed',
      )}
    >
      <CardContent className="text-center">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            data-testid="product-card-image"
            className="mx-auto aspect-square w-full max-w-28 rounded-md object-cover"
          />
        ) : (
          // qrSvg viene de qrcode-generator a partir de product.code (código interno), no de HTML/input de usuario.
          <div
            data-testid="product-card-qr"
            className="mx-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-28"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
        <div className="mt-2 font-bold break-words" data-testid="product-card-code">
          {product.code}
        </div>
        <div className="text-sm break-words text-muted-foreground">
          {product.name}
          {!product.isRegistered && ' (no registrado)'}
        </div>
        {isLowStock && (
          <Badge variant="outline" className="mt-2 text-warning" data-testid="product-card-badge">
            Stock bajo
          </Badge>
        )}
      </CardContent>
      {product.isRegistered && (
        <CardFooter className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto min-h-9 w-full flex-wrap gap-1 py-1.5 whitespace-normal wrap-anywhere"
            onClick={() => onEdit(product)}
            data-testid="product-card-edit"
          >
            <PencilIcon />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto min-h-9 w-full flex-wrap gap-1 py-1.5 whitespace-normal wrap-anywhere"
            onClick={() => onAdjustStock(product)}
            data-testid="product-card-adjust-stock"
          >
            <PackagePlusIcon />
            Ajustar stock
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto min-h-9 w-full flex-wrap gap-1 py-1.5 whitespace-normal wrap-anywhere"
            onClick={() => onPrint(product)}
            data-testid="product-card-print"
          >
            <PrinterIcon />
            Imprimir etiqueta
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto min-h-9 w-full flex-wrap gap-1 py-1.5 whitespace-normal wrap-anywhere text-destructive"
            onClick={() => onDelete(product.code)}
            data-testid="product-card-delete"
          >
            <Trash2Icon />
            Quitar del inventario
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
