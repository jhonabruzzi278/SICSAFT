import {
  ScanLineIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  AlertTriangleIcon,
  XCircleIcon,
  ArrowLeftRightIcon,
  PercentIcon,
  UsersIcon,
  HelpCircleIcon,
  AlertCircleIcon,
  WrenchIcon,
  PowerIcon,
  Trash2Icon,
} from 'lucide-react';
import { StatTile } from '@/components/mobile/StatTile';
import { SectionHeader } from '@/components/mobile/SectionHeader';
import { VERDICT_LABEL, type Verdict } from '@/lib/verdict';

export interface ReportSummaryData {
  verdict: Verdict;
  areaName?: string;
  date: string | Date;
  expected: number;
  scanned: number;
  correct: number;
  missing: number;
  outOfPlace: number;
  areaPct: number;
  external: number;
  unregistered: number;
  incidents: number;
  estadoDeclarado: {
    enServicio: number;
    enMantenimiento: number;
    inactivo: number;
    baja: number;
  };
}

// Clases literales completas (Tailwind JIT no resuelve `text-${x}` dinámico).
const VERDICT_STYLE = {
  exitoso: {
    box: 'border-success/40 bg-success/10',
    text: 'text-success',
    circle: 'bg-success/15 text-success',
    Icon: CheckCircle2Icon,
  },
  aceptable: {
    box: 'border-warning/40 bg-warning/10',
    text: 'text-warning',
    circle: 'bg-warning/15 text-warning',
    Icon: AlertTriangleIcon,
  },
  defectuoso: {
    box: 'border-destructive/40 bg-destructive/10',
    text: 'text-destructive',
    circle: 'bg-destructive/15 text-destructive',
    Icon: XCircleIcon,
  },
} as const;

const ESTADO_DECLARADO_ITEMS = [
  { key: 'enServicio', label: 'EN SERVICIO', Icon: CheckCircle2Icon, tone: 'text-success' },
  {
    key: 'enMantenimiento',
    label: 'EN MANTENIMIENTO',
    Icon: WrenchIcon,
    tone: 'text-warning',
  },
  { key: 'inactivo', label: 'INACTIVO', Icon: PowerIcon, tone: 'text-muted-foreground' },
  { key: 'baja', label: 'BAJA', Icon: Trash2Icon, tone: 'text-destructive' },
] as const;

/**
 * Tarjeta de "Resultado del control" (DOC-029 RF-I / CONTRATO-PANTALLA-8): veredicto + grilla de
 * métricas + estado declarado por el controlador. Presentacional pura — la usan tanto ScanPage
 * (reporte recién generado, datos en vivo) como HistoryPage (reporte de una sesión guardada,
 * reconstruido desde IndexedDB) para que se vean exactamente igual (pedido del usuario 2026-09-11).
 */
export function ReportSummaryCard({ data }: { data: ReportSummaryData }) {
  const { verdict, areaName, date, estadoDeclarado } = data;
  const pctLabel = `${(data.areaPct * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 })} %`;
  const fecha = typeof date === 'string' ? new Date(date) : date;
  const VerdictIcon = VERDICT_STYLE[verdict].Icon;

  return (
    <div className="space-y-3">
      <div
        className={`flex items-start justify-between gap-3 rounded-2xl border-2 border-dashed p-5 shadow-elev-1 ${VERDICT_STYLE[verdict].box}`}
      >
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
            Resultados de acción de supervisión y control de AFT
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Declaración del proceso</p>
          <p
            className={`text-2xl font-bold ${VERDICT_STYLE[verdict].text}`}
            data-testid="report-verdict"
            data-verdict={verdict}
          >
            {VERDICT_LABEL[verdict]}
          </p>
          {areaName && (
            <p className="mt-1 text-xs text-muted-foreground">
              Área {areaName} · {fecha.toLocaleDateString('es-CL')}
            </p>
          )}
        </div>
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${VERDICT_STYLE[verdict].circle}`}
          aria-hidden="true"
        >
          <VerdictIcon className="size-6" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile
          value={data.expected}
          label="Esperados"
          valueTestId="report-expected"
          icon={<ClipboardListIcon className="size-4" />}
        />
        <StatTile
          value={data.scanned}
          label="Escaneados"
          valueTestId="report-total"
          icon={<ScanLineIcon className="size-4" />}
        />
        <StatTile
          value={data.correct}
          label="Correctos"
          tone="success"
          valueTestId="report-correct"
          icon={<CheckCircle2Icon className="size-4" />}
        />
        <StatTile
          value={data.missing}
          label="Faltantes"
          tone="warning"
          valueTestId="report-missing"
          icon={<AlertTriangleIcon className="size-4" />}
        />
        <StatTile
          value={data.outOfPlace}
          label="Fuera de lugar"
          tone="warning"
          valueTestId="report-out-of-place"
          icon={<ArrowLeftRightIcon className="size-4" />}
        />
        <StatTile
          value={pctLabel}
          label="% del área"
          tone="success"
          valueTestId="report-area-pct"
          icon={<PercentIcon className="size-4" />}
        />
        <StatTile
          value={data.external}
          label="Externos"
          valueTestId="report-external-finds"
          icon={<UsersIcon className="size-4" />}
        />
        <StatTile
          value={data.unregistered}
          label="No registrados"
          tone="destructive"
          valueTestId="report-unregistered"
          icon={<HelpCircleIcon className="size-4" />}
        />
        <StatTile
          value={data.incidents}
          label="Incidencias"
          valueTestId="report-incidents"
          icon={<AlertCircleIcon className="size-4" />}
        />
      </div>

      <div className="space-y-2">
        <SectionHeader>Estado de los AFT declarado por el controlador</SectionHeader>
        <div
          className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-dashed border-border p-2 sm:grid-cols-4"
          data-testid="report-estado-declarado"
        >
          {ESTADO_DECLARADO_ITEMS.map(({ key, label, Icon, tone }) => (
            <div
              key={key}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-center shadow-elev-1"
            >
              <Icon className={`size-4 ${tone}`} />
              <p className="text-lg font-bold text-foreground">{estadoDeclarado[key]}</p>
              <p className="text-[0.6rem] font-medium tracking-wide text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
