import React from 'react';
import { Badge, Button } from '@/components/ui';
import { IconCheck, IconRepeat, IconShield, IconSparkles } from '@/components/icons';

export interface VeredictoProps {
  veredictoGlobal: {
    estado: 'exitoso' | 'aceptable' | 'defectuoso';
    titulo: string;
    porcentaje: number;
    color: string;
  };
  totalBienes: number;
  bienesControlados: number;
  totalFueraDeArea: number;
  totalNoLocalizados: number;
  tasaDiferenciaPct: number;
  cargando: boolean;
  onActualizar: () => void;
}

export const VeredictoCard: React.FC<VeredictoProps> = ({
  veredictoGlobal,
  totalBienes,
  bienesControlados,
  totalFueraDeArea,
  totalNoLocalizados,
  tasaDiferenciaPct,
  cargando,
  onActualizar,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-7 text-white shadow-xl border border-indigo-900/40">
      <div className="absolute right-0 top-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute left-1/3 bottom-0 -mb-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-400/30">
              <IconSparkles className="h-3.5 w-3.5" />
              Inteligencia Patrimonial en Vivo
            </span>
            <Badge variant="outline" className="text-white/80 border-white/20">
              Nivel 2 Profesional
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Centro de Inteligencia Patrimonial</span>
            <span
              className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full border shadow-sm"
              style={{
                backgroundColor: `${veredictoGlobal.color}20`,
                borderColor: veredictoGlobal.color,
                color: veredictoGlobal.color,
              }}
            >
              <IconShield className="h-4 w-4" />
              Veredicto: {veredictoGlobal.titulo}
            </span>
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Consolidación analítica de {totalBienes.toLocaleString()} bienes patrimoniales
            registrados, tasas de conciliación física por escaneo QR e indicadores de custodia
            institucional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onActualizar}
            disabled={cargando}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 transition-all"
          >
            <IconRepeat className={`h-4 w-4 mr-2 ${cargando ? 'animate-spin' : ''}`} />
            {cargando ? 'Actualizando...' : 'Recalcular Métricas'}
          </Button>
        </div>
      </div>

      <div className="relative z-10 mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-white/10 pt-5 text-xs">
        <div>
          <span className="text-slate-400 block font-medium">Bienes Conciliados</span>
          <span className="text-lg font-bold text-white">
            {bienesControlados.toLocaleString()} / {totalBienes.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Tasa de Efectividad</span>
          <span className="text-lg font-bold text-emerald-400">{veredictoGlobal.porcentaje}%</span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Fuera de Ubicación</span>
          <span className="text-lg font-bold text-amber-400">
            {totalFueraDeArea.toLocaleString()} activos
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Índice de Discrepancia</span>
          <span className="text-lg font-bold text-rose-400">{tasaDiferenciaPct}%</span>
        </div>
      </div>
    </div>
  );
};
