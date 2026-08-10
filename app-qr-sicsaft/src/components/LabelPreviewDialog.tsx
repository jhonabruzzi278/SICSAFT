import { PrinterIcon } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LabelCard } from '@/components/LabelCard';
import { usePrintLabels } from '@/components/PrintLabelsProvider';
import type { LabelUnit } from '@/lib/labels';

interface LabelPreviewDialogProps {
  units: LabelUnit[] | null;
  onOpenChange: (open: boolean) => void;
}

export function LabelPreviewDialog({ units, onOpenChange }: LabelPreviewDialogProps) {
  const printLabels = usePrintLabels();
  const open = Boolean(units && units.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="label-preview-modal" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Etiqueta generada</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap justify-center gap-3" data-testid="label-preview-list">
          {units?.map((unit) => (
            <LabelCard key={unit.printCode} unit={unit} className="w-40" />
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="label-preview-close-btn">
              Cerrar
            </Button>
          </DialogClose>
          <Button onClick={() => units && printLabels(units)} data-testid="label-preview-print">
            <PrinterIcon />
            Imprimir etiqueta(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
