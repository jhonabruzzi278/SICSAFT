import { useEffect, useState } from 'react';
import { MinusIcon, PlusIcon } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CatalogProduct } from '@/components/ProductCard';

interface StockAdjustDialogProps {
  product: CatalogProduct | null;
  onOpenChange: (open: boolean) => void;
  onAdjust: (code: string, delta: number, variantCode?: string) => Promise<void>;
}

export function StockAdjustDialog({ product, onOpenChange, onAdjust }: StockAdjustDialogProps) {
  const [amount, setAmount] = useState(1);
  const [variantCode, setVariantCode] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!product) return;
    setAmount(1);
    setVariantCode(product.variants && product.variants.length > 0 ? product.variants[0].code : undefined);
    // Sólo se reinicia la selección al abrir un producto distinto, no en cada
    // refresco de stock del mismo producto (product cambia de referencia).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.code]);

  const hasVariants = Boolean(product?.variants && product.variants.length > 0);
  const currentStock = hasVariants
    ? (product?.variants?.find((v) => v.code === variantCode)?.stock ?? 0)
    : (product?.stock ?? 0);

  async function handleAdjust(sign: 1 | -1) {
    if (!product || amount <= 0) return;
    setSubmitting(true);
    try {
      await onAdjust(product.code, sign * amount, variantCode);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={Boolean(product)} onOpenChange={onOpenChange}>
      <DialogContent data-testid="stock-adjust-modal" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="font-medium break-words" data-testid="stock-adjust-name">
              {product?.name}
            </p>
            <p className="text-sm text-muted-foreground">{product?.code}</p>
          </div>

          {hasVariants && (
            <div className="space-y-1.5">
              <Label>Variante</Label>
              <Select value={variantCode} onValueChange={setVariantCode}>
                <SelectTrigger data-testid="stock-adjust-variant" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {product?.variants?.map((v) => (
                    <SelectItem key={v.code} value={v.code}>
                      {v.code}
                      {v.name ? ` — ${v.name}` : ''} (stock: {v.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm text-muted-foreground">Stock actual</span>
            <span className="text-xl font-bold" data-testid="stock-adjust-current">
              {currentStock}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock-adjust-amount">Cantidad</Label>
            <Input
              id="stock-adjust-amount"
              data-testid="stock-adjust-amount"
              type="number"
              min={1}
              step="1"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Math.round(e.target.valueAsNumber || 1)))}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              data-testid="stock-adjust-subtract"
              disabled={submitting || currentStock <= 0}
              onClick={() => handleAdjust(-1)}
            >
              <MinusIcon />
              Restar
            </Button>
            <Button
              type="button"
              className="flex-1"
              data-testid="stock-adjust-add"
              disabled={submitting}
              onClick={() => handleAdjust(1)}
            >
              <PlusIcon />
              Sumar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" data-testid="stock-adjust-close">
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
