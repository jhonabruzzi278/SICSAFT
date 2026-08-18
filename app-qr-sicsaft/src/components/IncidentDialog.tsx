import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface IncidentDialogProps {
  open: boolean;
  itemCode: string;
  itemName: string;
  initialNote?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (note: string) => void;
  // Fase 3.1 — reusado tal cual para "sugerir baja" (DOC-012 5.1), un mismo prompt de texto
  // corto con otro título/placeholder/testid. Todos opcionales, con los defaults de incidencia
  // (uso original) para no romper el caller existente.
  title?: string;
  fieldLabel?: string;
  placeholder?: string;
  saveLabel?: string;
  testIdPrefix?: string;
}

export function IncidentDialog({
  open,
  itemCode,
  itemName,
  initialNote,
  onOpenChange,
  onSave,
  title = 'Incidencia',
  fieldLabel = 'Nota de incidencia',
  placeholder = 'Ej. daño visible, falta un accesorio, mal estado...',
  saveLabel = 'Guardar incidencia',
  testIdPrefix = 'incident',
}: IncidentDialogProps) {
  const [note, setNote] = useState(initialNote ?? '');

  useEffect(() => {
    if (open) setNote(initialNote ?? '');
  }, [open, initialNote]);

  function handleSave() {
    if (!note.trim()) return;
    onSave(note.trim());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={`${testIdPrefix}-modal`}>
        <DialogHeader>
          <DialogTitle>
            {title} — {itemCode} · {itemName}
          </DialogTitle>
        </DialogHeader>

        <Label htmlFor={`${testIdPrefix}-note-input`} className="sr-only">
          {fieldLabel}
        </Label>
        <Textarea
          id={`${testIdPrefix}-note-input`}
          data-testid={`${testIdPrefix}-note-input`}
          rows={4}
          placeholder={placeholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!note.trim()}
            data-testid={`${testIdPrefix}-save-btn`}
          >
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
