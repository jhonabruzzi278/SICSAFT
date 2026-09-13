import { useSearchParams } from 'react-router-dom';
import { ResumenTab } from './ResumenTab';
import { ActivosTab } from './ActivosTab';
import { ControlesAreaTab } from './ControlesAreaTab';

// Fase 2 (rediseño CIP) — el CIP deja de ser una página única y pasa a tener sub-pestañas.
// Fase 3/4: "Activos" y "Controles de área" ya viven acá (portados de ccp/src/pages/ActivosPage.tsx
// e InventariosPage.tsx). El tab activo vive en la URL (mismo criterio "URL as state" que el
// resto del repo) para no perder contexto al recargar o compartir el link.
type CipTab = 'resumen' | 'activos' | 'controles-area';

const TABS: { id: CipTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'activos', label: 'Activos' },
  { id: 'controles-area', label: 'Controles de área' },
];

function esCipTab(valor: string | null): valor is CipTab {
  return TABS.some((t) => t.id === valor);
}

export function CipPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tabActivo: CipTab = esCipTab(tabParam) ? tabParam : 'resumen';

  function cambiarTab(tab: CipTab) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Secciones del Centro de Inteligencia Patrimonial"
        className="inline-flex rounded-lg border border-border bg-bg-card p-1 text-sm"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tabActivo === tab.id}
            onClick={() => cambiarTab(tab.id)}
            className={`rounded-md px-3.5 py-1.5 font-medium transition-colors ${
              tabActivo === tab.id
                ? 'bg-accent text-bg shadow-sm'
                : 'text-text-dim hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tabActivo === 'resumen' && <ResumenTab />}
        {tabActivo === 'activos' && <ActivosTab />}
        {tabActivo === 'controles-area' && <ControlesAreaTab />}
      </div>
    </div>
  );
}
