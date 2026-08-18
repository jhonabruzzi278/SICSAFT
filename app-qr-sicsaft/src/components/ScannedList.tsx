import { AlertTriangleIcon, MessageSquarePlusIcon, WrenchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEntrance } from '@/hooks/useEntrance';
import type { EstadoOperativoDeclarable, ScanCategory } from '@/lib/db';

export interface ScannedItem {
  code: string;
  name: string;
  category: ScanCategory;
  expectedAreaName?: string;
  expectedLocationName?: string;
  incidentNote?: string;
  outOfPlace?: boolean;
  externalFind?: boolean;
  estadoDeclarado?: EstadoOperativoDeclarable;
  bajaSugerida?: string;
}

// Fase 3.1/DOC-017 3 — declarable sin rol administrador-patrimonial (Tomo III 1.4, DOC-012
// 5.1). Solo para activos ya registrados en la Base Patrimonial (con codigoQr real, no
// no_registrado/invalido) — no tiene sentido declarar estado de algo que CORE no puede resolver
// a un activo.
const ESTADO_OPTIONS: { value: EstadoOperativoDeclarable; label: string }[] = [
  { value: 'activo', label: 'En servicio' },
  { value: 'mantenimiento', label: 'En mantenimiento' },
  { value: 'inactivo', label: 'Inactivo' },
];

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
  onDeclareEstado: (code: string, estado: EstadoOperativoDeclarable) => void;
  onSuggestBaja: (code: string) => void;
}

const ACTIVO_REAL_CATEGORIES: ScanCategory[] = ['correct', 'wrong-area', 'wrong-location'];

function ScannedListItem({
  item,
  onMarkOutOfPlace,
  onExternalFind,
  onDiscard,
  onAddIncident,
  onDeclareEstado,
  onSuggestBaja,
}: { item: ScannedItem } & Omit<ScannedListProps, 'items'>) {
  const shown = useEntrance();
  const isWrongPlace = item.category === 'wrong-area' || item.category === 'wrong-location';
  const esActivoReal = ACTIVO_REAL_CATEGORIES.includes(item.category);

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

      {item.bajaSugerida && (
        <div className="text-xs text-destructive" data-testid="scanned-item-baja-sugerida">
          Baja sugerida: {item.bajaSugerida}
        </div>
      )}

      {esActivoReal && (
        <div className="flex items-center gap-2">
          <label htmlFor={`estado-${item.code}`} className="text-xs text-muted-foreground">
            Estado:
          </label>
          <select
            id={`estado-${item.code}`}
            data-testid="estado-declarado-select"
            className="rounded border bg-background px-2 py-1 text-xs"
            value={item.estadoDeclarado ?? 'activo'}
            onChange={(e) => onDeclareEstado(item.code, e.target.value as EstadoOperativoDeclarable)}
          >
            {ESTADO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {esActivoReal && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSuggestBaja(item.code)}
            data-testid="suggest-baja-btn"
          >
            <WrenchIcon />
            {item.bajaSugerida ? 'Editar sugerencia de baja' : 'Sugerir baja'}
          </Button>
        )}
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

export function ScannedList({
  items,
  onMarkOutOfPlace,
  onExternalFind,
  onDiscard,
  onAddIncident,
  onDeclareEstado,
  onSuggestBaja,
}: ScannedListProps) {
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
            onDeclareEstado={onDeclareEstado}
            onSuggestBaja={onSuggestBaja}
          />
        ))}
    </ul>
  );
}
