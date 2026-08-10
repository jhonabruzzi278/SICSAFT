import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LabelCard } from '@/components/LabelCard';
import { PrintOptionsDialog } from '@/components/PrintOptionsDialog';
import type { LabelUnit } from '@/lib/labels';

const COLUMNS_STORAGE_KEY = 'qrvault-print-columns';
const DEFAULT_COLUMNS = 3;

function loadStoredColumns(): number {
  const stored = Number(localStorage.getItem(COLUMNS_STORAGE_KEY));
  return stored > 0 ? stored : DEFAULT_COLUMNS;
}

interface PrintLabelsContextValue {
  printLabels: (units: LabelUnit[]) => void;
}

const PrintLabelsContext = createContext<PrintLabelsContextValue | null>(null);

export function PrintLabelsProvider({ children }: { children: ReactNode }) {
  const [pendingUnits, setPendingUnits] = useState<LabelUnit[] | null>(null);
  const [printUnits, setPrintUnits] = useState<LabelUnit[] | null>(null);
  const [columns, setColumns] = useState<number>(loadStoredColumns);
  const [copies, setCopies] = useState<number>(1);

  useEffect(() => {
    if (!printUnits || printUnits.length === 0) return;

    document.body.classList.add('printing-labels');
    window.print();

    const cleanup = () => {
      document.body.classList.remove('printing-labels');
      setPrintUnits(null);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    return () => window.removeEventListener('afterprint', cleanup);
  }, [printUnits]);

  const printLabels = useCallback((next: LabelUnit[]) => {
    if (next.length === 0) return;
    setCopies(1);
    setPendingUnits(next);
  }, []);

  const handleColumnsChange = (next: number) => {
    setColumns(next);
    localStorage.setItem(COLUMNS_STORAGE_KEY, String(next));
  };

  const handleConfirmPrint = () => {
    if (!pendingUnits) return;
    const expanded =
      copies <= 1 ? pendingUnits : pendingUnits.flatMap((unit) => Array.from({ length: copies }, () => unit));
    setPrintUnits(expanded);
    setPendingUnits(null);
  };

  return (
    <PrintLabelsContext.Provider value={{ printLabels }}>
      {children}
      <PrintOptionsDialog
        open={pendingUnits !== null}
        labelCount={pendingUnits?.length ?? 0}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        copies={copies}
        onCopiesChange={setCopies}
        onCancel={() => setPendingUnits(null)}
        onConfirm={handleConfirmPrint}
      />
      {createPortal(
        <div id="label-print-area" style={{ '--print-columns': columns } as React.CSSProperties}>
          {printUnits?.map((unit, index) => <LabelCard key={`${unit.printCode}-${index}`} unit={unit} />)}
        </div>,
        document.body,
      )}
    </PrintLabelsContext.Provider>
  );
}

export function usePrintLabels(): (units: LabelUnit[]) => void {
  const ctx = useContext(PrintLabelsContext);
  if (!ctx) throw new Error('usePrintLabels debe usarse dentro de PrintLabelsProvider');
  return ctx.printLabels;
}
