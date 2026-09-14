import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { CuerpoEtl } from "@shared/ipc-contract";
import { agruparParaEtiquetas } from "@/lib/etiquetas";
import {
  EtiquetaActivo,
  type PlantillaEtiqueta,
} from "@/components/EtiquetaActivo";

// Herramienta interna de escritorio (Fase 5, reestructuración CCP/CIP): la corre el equipo
// SICSAFT antes de que el Excel del cliente entre al sistema, para generar/imprimir las
// etiquetas QR de todos sus activos de una sola vez. No habla con CIS/CORE ni con ninguna red —
// el ETL corre localmente en modo dry-run (ver src/main/services/etl-runner.ts) y esta pantalla
// solo arma la hoja imprimible a partir de ese JSON, con la misma lógica y plantillas que ya
// existían en ccp/ (EtiquetaActivo.tsx, lib/etiquetas.ts, lib/code128.ts, portados tal cual).

const TODAS = "__todas__";
type ModoSalto = "direccion" | "area" | "ninguno";

function Boton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const estilos =
    variant === "primary"
      ? "bg-primary text-background hover:bg-primary-strong"
      : "border border-border bg-card text-foreground hover:border-border-strong";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${estilos} ${className}`}
    >
      {children}
    </button>
  );
}

export function App() {
  const [rutaExcel, setRutaExcel] = useState<string | null>(null);
  const [rutaMapeo, setRutaMapeo] = useState<string | null>(null);
  const [organizacionId, setOrganizacionId] = useState("");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cuerpo, setCuerpo] = useState<CuerpoEtl | null>(null);
  const [qrPorLinea, setQrPorLinea] = useState<Map<number, string>>(new Map());

  // Controles de plantilla/salto, mismo criterio que ccp/src/pages/EtiquetasPage.tsx.
  const [plantilla, setPlantilla] = useState<PlantillaEtiqueta>("avery");
  const [modoSalto, setModoSalto] = useState<ModoSalto>("direccion");
  const [direccionSel, setDireccionSel] = useState<string>(TODAS);
  const [mostrarBarcode, setMostrarBarcode] = useState(true);
  const [mostrarInstitucion, setMostrarInstitucion] = useState(true);
  const [vistaHoja, setVistaHoja] = useState(false);

  async function elegirExcel() {
    const ruta = await window.generadorQr.elegirExcel();
    if (ruta) setRutaExcel(ruta);
  }

  async function elegirMapeo() {
    const ruta = await window.generadorQr.elegirMapeo();
    if (ruta) setRutaMapeo(ruta);
  }

  async function generar() {
    if (!rutaExcel || !organizacionId.trim()) return;
    setGenerando(true);
    setError(null);
    setCuerpo(null);
    setQrPorLinea(new Map());
    try {
      const resultado = await window.generadorQr.generar({
        rutaExcel,
        organizacionId: organizacionId.trim(),
        rutaMapeo: rutaMapeo ?? undefined,
      });
      if (resultado.ok) {
        setCuerpo(resultado.cuerpo);
      } else {
        setError(resultado.mensaje);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo generar la hoja de etiquetas.",
      );
    } finally {
      setGenerando(false);
    }
  }

  // QR real (npm `qrcode`) por fila, igual que ccp/src/pages/EtiquetasPage.tsx — se renderiza
  // como data URL una sola vez por generación, no por cada re-render de la hoja.
  useEffect(() => {
    if (!cuerpo) return;
    let ignorar = false;
    void (async () => {
      const pares = await Promise.all(
        cuerpo.filas.map(async (fila) => {
          const dataUrl = await QRCode.toDataURL(fila.codigoQr, {
            width: 184,
            margin: 0,
            errorCorrectionLevel: "M",
          });
          return [fila.linea, dataUrl] as const;
        }),
      );
      if (!ignorar) setQrPorLinea(new Map(pares));
    })();
    return () => {
      ignorar = true;
    };
  }, [cuerpo]);

  const gruposCompletos = useMemo(() => {
    if (!cuerpo) return [];
    return agruparParaEtiquetas(cuerpo.filas);
  }, [cuerpo]);

  const gruposVisibles = useMemo(() => {
    return direccionSel === TODAS
      ? gruposCompletos
      : gruposCompletos.filter((g) => g.direccion === direccionSel);
  }, [gruposCompletos, direccionSel]);

  const totalVisible = gruposVisibles.reduce((n, g) => n + g.total, 0);
  const qrListo =
    cuerpo !== null && cuerpo.filas.every((f) => qrPorLinea.has(f.linea));

  const estimacionHojas = useMemo(() => {
    if (totalVisible === 0) return 0;
    const porHoja =
      plantilla === "avery" ? 30 : plantilla === "tarjeta" ? 10 : 1;
    if (modoSalto === "ninguno") return Math.ceil(totalVisible / porHoja);
    if (modoSalto === "direccion") {
      return gruposVisibles.reduce(
        (acc, g) => acc + Math.ceil(g.total / porHoja),
        0,
      );
    }
    return gruposVisibles.reduce(
      (acc, g) =>
        acc +
        g.departamentos.reduce(
          (depAcc, d) =>
            depAcc +
            d.areas.reduce(
              (areaAcc, a) => areaAcc + Math.ceil(a.activos.length / porHoja),
              0,
            ),
          0,
        ),
      0,
    );
  }, [totalVisible, plantilla, modoSalto, gruposVisibles]);

  const clasesContenedor = [
    `plantilla-${plantilla}`,
    `salto-${modoSalto}`,
    vistaHoja ? "modo-vista-hoja" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={`min-h-screen space-y-6 p-6 ${clasesContenedor}`}>
      <div className="no-print space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Generador de QR / Etiquetas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Herramienta interna — corre el ETL localmente (nunca escribe en la
            BPI) y arma la hoja de etiquetas antes de que el Excel del cliente
            entre al sistema.
          </p>
        </div>

        <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Excel de activos
            </label>
            <div className="flex items-center gap-2">
              <Boton variant="secondary" onClick={() => void elegirExcel()}>
                Elegir archivo…
              </Boton>
              <span className="truncate text-xs text-faint-foreground">
                {rutaExcel ?? "Ningún archivo elegido"}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Organización (id)
            </label>
            <input
              value={organizacionId}
              onChange={(e) => setOrganizacionId(e.target.value)}
              placeholder="ej. duoc-uc"
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Mapeo (opcional)
            </label>
            <div className="flex items-center gap-2">
              <Boton variant="secondary" onClick={() => void elegirMapeo()}>
                Elegir mapeo-&lt;cliente&gt;.json…
              </Boton>
              <span className="truncate text-xs text-faint-foreground">
                {rutaMapeo ?? "Sin mapeo — usa el de por defecto"}
              </span>
            </div>
          </div>

          <div className="flex items-end">
            <Boton
              disabled={!rutaExcel || !organizacionId.trim() || generando}
              onClick={() => void generar()}
              className="w-full"
            >
              {generando ? "Generando…" : "Generar etiquetas"}
            </Boton>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {cuerpo && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <span className="inline-block rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary-strong">
                  {totalVisible} {totalVisible === 1 ? "etiqueta" : "etiquetas"}
                </span>
                <span className="text-xs text-muted-foreground">
                  ~{estimacionHojas}{" "}
                  {estimacionHojas === 1 ? "hoja estimada" : "hojas estimadas"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Boton
                  variant="secondary"
                  onClick={() => setVistaHoja((v) => !v)}
                  className="text-xs"
                >
                  {vistaHoja ? "Modo normal" : "Simular papel"}
                </Boton>
                <Boton
                  disabled={!qrListo || totalVisible === 0}
                  onClick={() => window.print()}
                >
                  {qrListo ? "Imprimir etiquetas (PDF)" : "Generando QR…"}
                </Boton>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2 text-muted-foreground">
                Plantilla:
                <select
                  value={plantilla}
                  onChange={(e) =>
                    setPlantilla(e.target.value as PlantillaEtiqueta)
                  }
                  className="rounded-lg border border-border bg-input px-2.5 py-1 text-xs text-foreground"
                >
                  <option value="avery">Avery 3×10</option>
                  <option value="tarjeta">Tarjetas 2×5</option>
                  <option value="termica">Térmica 1×1</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-muted-foreground">
                Dirección:
                <select
                  value={direccionSel}
                  onChange={(e) => setDireccionSel(e.target.value)}
                  className="rounded-lg border border-border bg-input px-2.5 py-1 text-xs text-foreground"
                >
                  <option value={TODAS}>Todas las direcciones</option>
                  {gruposCompletos.map((g) => (
                    <option key={g.direccion} value={g.direccion}>
                      {g.direccion} ({g.total})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-muted-foreground">
                Salto de página:
                <select
                  value={modoSalto}
                  onChange={(e) => setModoSalto(e.target.value as ModoSalto)}
                  className="rounded-lg border border-border bg-input px-2.5 py-1 text-xs text-foreground"
                >
                  <option value="direccion">Por dirección</option>
                  <option value="area">Por área</option>
                  <option value="ninguno">Continuo (sin salto)</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={mostrarBarcode}
                  onChange={(e) => setMostrarBarcode(e.target.checked)}
                />
                Código de barras (Code 128)
              </label>

              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={mostrarInstitucion}
                  onChange={(e) => setMostrarInstitucion(e.target.checked)}
                />
                Cabecera institucional
              </label>
            </div>
          </div>
        )}
      </div>

      {cuerpo && gruposVisibles.length === 0 && (
        <p className="text-sm text-muted-foreground">
          El Excel no dejó ninguna fila para etiquetar.
        </p>
      )}

      <div
        className={
          vistaHoja
            ? "mx-auto max-w-4xl rounded-2xl border border-neutral-300 bg-white p-8 text-black shadow-2xl"
            : "space-y-10"
        }
      >
        {gruposVisibles.map((grupo) => (
          <section
            key={grupo.direccion}
            className="grupo-direccion direccion space-y-6"
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-lg font-semibold text-foreground print:text-black">
                {grupo.direccion}{" "}
                <span className="text-sm font-normal text-muted-foreground print:text-neutral-600">
                  — {grupo.total} {grupo.total === 1 ? "activo" : "activos"}
                </span>
              </h2>
              <span className="text-xs font-mono text-muted-foreground print:hidden">
                {plantilla.toUpperCase()}
              </span>
            </div>

            {grupo.departamentos.map((departamento) => (
              <div
                key={departamento.departamento}
                className="grupo-departamento space-y-4"
              >
                {grupo.departamentos.length > 1 && (
                  <h3 className="text-sm font-medium text-muted-foreground print:text-neutral-700">
                    {departamento.departamento}
                  </h3>
                )}
                {departamento.areas.map((area) => (
                  <div key={area.areaNombre} className="grupo-area space-y-3">
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase print:text-neutral-700">
                      Área: {area.areaNombre} ({area.activos.length})
                    </h3>

                    <div
                      className={`lista-etiquetas ${
                        plantilla === "avery"
                          ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                          : plantilla === "tarjeta"
                            ? "grid gap-4 sm:grid-cols-2"
                            : "grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                      }`}
                    >
                      {area.activos.map((etiqueta) => {
                        const qr = qrPorLinea.get(etiqueta.linea);
                        if (!qr) return null;
                        return (
                          <EtiquetaActivo
                            key={etiqueta.linea}
                            etiqueta={etiqueta}
                            qrDataUrl={qr}
                            plantilla={plantilla}
                            mostrarBarcode={mostrarBarcode}
                            mostrarInstitucion={mostrarInstitucion}
                            nombreOrganizacion="SICSAFT PATRIMONIO"
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
