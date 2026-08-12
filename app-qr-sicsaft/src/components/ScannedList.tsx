import { AlertTriangleIcon, MessageSquarePlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEntrance } from '@/hooks/useEntrance';
import type { ScanCategory } from '@/lib/db';

export interface ScannedItem {
  code: string;
  name: string;
  category: ScanCategory;
  expectedAreaName?: string;
  expectedLocationName?: string;
  incidentNote?: string;
  outOfPlace?: boolean;
  externalFind?: boolean;
}

const CATEGORY_LABEL: Record<ScanCategory, string> = {
  correct: '✔ Correcto',
  'wrong-area': '⚠ Otra área',
  'wrong-location': '⚠ Otra ubicación',
  unregistered: '✖ No registrado',
  invalid: '✖ Código inválido',
  'already-scanned': 'Ya escaneado',
  duplicate: '⚠ Duplicado',
};

const CATEGORY_CLASS: Record<ScanCategory, string> = {
  correct: 'text-success',
  'wrong-area': 'text-warning',
  'wrong-location': 'text-warning',
  unregistered: 'text-destructive',
  invalid: 'text-destructive',
  'already-scanned': 'text-muted-foreground',
  duplicate: 'text-destructive',
};

interface ScannedListProps {
  items: ScannedItem[];
  onMarkOutOfPlace: (code: string) => void;
  onExternalFind: (code: string) => void;
  onDiscard: (code: string) => void;
  onAddIncident: (code: string) => void;
}

function ScannedListItem({
  item,
  onMarkOutOfPlace,
  onExternalFind,
  onDiscard,
  onAddIncident,
}: { item: ScannedItem } & Omit<ScannedListProps, 'items'>) {
  const shown = useEntrance();
  const isWrongPlace = item.category === 'wrong-area' || item.category === 'wrong-location';

  return (
    <li
      data-testid="scanned-item"
      data-category={item.category}
      data-open={shown || undefined}
      className="flex -translate-x-2 flex-col gap-1.5 bg-secondary px-3 py-2 text-sm opacity-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-open:translate-x-0 data-open:opacity-100"
    >
      <div className="flex items-center gap-3">
        <span className="font-semibold text-brand" data-testid="scanned-item-code">
          {item.code}
        </span>
        <span className="flex-1 truncate text-muted-foreground">{item.name}</span>
        <span data-testid="scanned-item-status" className={CATEGORY_CLASS[item.category]}>
          {CATEGORY_LABEL[item.category]}
        </span>
      </div>

      {isWrongPlace && (
        <div className="text-xs text-muted-foreground" data-testid="scanned-item-expected">
          Registrado en: {item.expectedAreaName} · {item.expectedLocationName}
        </div>
      )}

      {item.incidentNote && (
        <div className="text-xs text-warning" data-testid="scanned-item-incident-note">
          Incidencia: {item.incidentNote}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isWrongPlace && (
          <Button
            type="button"
            variant={item.outOfPlace ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => onMarkOutOfPlace(item.code)}
            data-testid="mark-out-of-place-btn"
          >
            <AlertTriangleIcon />
            {item.outOfPlace ? 'Marcado fuera de lugar' : 'Marcar fuera de lugar'}
          </Button>
        )}
        {item.category === 'unregistered' && !item.externalFind && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onExternalFind(item.code)}
              data-testid="mark-external-find-btn"
            >
              Registrar hallazgo externo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDiscard(item.code)}
              data-testid="discard-item-btn"
            >
              Descartar
            </Button>
          </>
        )}
        {item.category === 'unregistered' && item.externalFind && (
          <span className="text-xs text-success" data-testid="external-find-badge">
            Hallazgo externo registrado
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onAddIncident(item.code)}
          data-testid="add-incident-btn"
        >
          <MessageSquarePlusIcon />
          {item.incidentNote ? 'Editar incidencia' : 'Agregar incidencia'}
        </Button>
      </div>
    </li>
  );
}

export function ScannedList({ items, onMarkOutOfPlace, onExternalFind, onDiscard, onAddIncident }: ScannedListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no escaneaste ningún producto.</p>;
  }

  return (
    <ul data-testid="scanned-list" className="max-h-[40vh] space-y-2 overflow-y-auto">
      {items
        .slice()
        .reverse()
        .map((item) => (
          <ScannedListItem
            key={item.code}
            item={item}
            onMarkOutOfPlace={onMarkOutOfPlace}
            onExternalFind={onExternalFind}
            onDiscard={onDiscard}
            onAddIncident={onAddIncident}
          />
        ))}
    </ul>
  );
}
