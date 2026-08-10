import { useEntrance } from '@/hooks/useEntrance';

export interface ScannedItem {
  code: string;
  name: string;
  found: boolean;
}

interface ScannedListProps {
  items: ScannedItem[];
}

function ScannedListItem({ item }: { item: ScannedItem }) {
  const shown = useEntrance();

  return (
    <li
      data-testid="scanned-item"
      data-open={shown || undefined}
      className="flex -translate-x-2 items-center gap-3 bg-secondary px-3 py-2 text-sm opacity-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-open:translate-x-0 data-open:opacity-100"
    >
      <span className="font-semibold text-brand" data-testid="scanned-item-code">
        {item.code}
      </span>
      <span className="flex-1 truncate text-muted-foreground">{item.name}</span>
      <span data-testid="scanned-item-status" className={item.found ? 'text-success' : 'text-destructive'}>
        {item.found ? '✔ Encontrado' : '✖ No registrado'}
      </span>
    </li>
  );
}

export function ScannedList({ items }: ScannedListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no escaneaste ningún producto.</p>;
  }

  return (
    <ul data-testid="scanned-list" className="max-h-[40vh] space-y-2 overflow-y-auto">
      {items
        .slice()
        .reverse()
        .map((item) => (
          <ScannedListItem key={item.code} item={item} />
        ))}
    </ul>
  );
}
