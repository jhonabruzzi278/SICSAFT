import { PrinterIcon } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const COLUMN_OPTIONS = [2, 3, 4, 5, 6, 8] as const;
const MAX_COPIES = 200;

interface PrintOptionsDialogProps {
  open: boolean;
  labelCount: number;
  columns: number;
  onColumnsChange: (columns: number) => void;
  copies: number;
  onCopiesChange: (copies: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function PrintOptionsDialog({
  open,
  labelCount,
  columns,
  onColumnsChange,
  copies,
  onCopiesChange,
  onCancel,
  onConfirm,
}: PrintOptionsDialogProps) {
  const totalLabels = labelCount * copies;
  const rows = Math.ceil(totalLabels / columns);

  function handleCopiesInput(value: string) {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return;
    onCopiesChange(Math.min(Math.max(parsed, 1), MAX_COPIES));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent data-testid="print-options-modal" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar impresión</DialogTitle>
          <DialogDescription>Elegí cuántas etiquetas entran por fila y cuántas copias de cada una.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
              Etiquetas por fila
            </span>
            <div className="flex flex-wrap gap-2" data-testid="print-columns-options">
              {COLUMN_OPTIONS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={option === columns ? 'default' : 'outline'}
                  className={cn('w-12')}
                  aria-pressed={option === columns}
                  data-testid={`print-columns-${option}`}
                  onClick={() => onColumnsChange(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="print-copies-input" className="text-xs">
              Copias por etiqueta
            </Label>
            <Input
              id="print-copies-input"
              data-testid="print-copies-input"
              type="number"
              min={1}
              max={MAX_COPIES}
              value={copies}
              onChange={(e) => handleCopiesInput(e.target.value)}
              className="w-24"
            />
            <p className="text-sm text-muted-foreground" data-testid="print-options-summary">
              {totalLabels} {totalLabels === 1 ? 'etiqueta' : 'etiquetas'} en total · {rows} {rows === 1 ? 'fila' : 'filas'} aprox.
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onCancel} data-testid="print-options-cancel">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={onConfirm} data-testid="print-options-confirm">
            <PrinterIcon />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
