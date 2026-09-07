import { Alert, Button } from '@/components/ui';

export function EditFormFooter({
  error,
  isSubmitting,
  onCancel,
}: {
  error: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
}) {
  return (
    <>
      {error && <Alert>{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </>
  );
}
