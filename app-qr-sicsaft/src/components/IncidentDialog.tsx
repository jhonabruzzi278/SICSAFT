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
}

export function IncidentDialog({ open, itemCode, itemName, initialNote, onOpenChange, onSave }: IncidentDialogProps) {
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
      <DialogContent data-testid="incident-modal">
        <DialogHeader>
          <DialogTitle>
            Incidencia — {itemCode} · {itemName}
          </DialogTitle>
        </DialogHeader>

        <Label htmlFor="incident-note-input" className="sr-only">
          Nota de incidencia
        </Label>
        <Textarea
          id="incident-note-input"
          data-testid="incident-note-input"
          rows={4}
          placeholder="Ej. daño visible, falta un accesorio, mal estado..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />

        <DialogFooter>
          <Button type="button" onClick={handleSave} disabled={!note.trim()} data-testid="incident-save-btn">
            Guardar incidencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
