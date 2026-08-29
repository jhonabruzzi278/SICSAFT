import { useState } from "react";
import type { EstadoIpLan } from "@shared/ipc-contract";
import { WizardCard } from "../components/WizardCard";
import { Button } from "../components/Button";

// DOC-028 Fase C.1 -- pantalla de recuperación cuando la IP de LAN de esta PC cambió desde la
// instalación (DHCP que reasigna). No es un paso numerado del wizard: solo aparece en un
// relanzamiento donde getEstadoIpLan() devolvió `cambio: true`. Reconfigurar re-registra el
// redirectUri del client OIDC de la APP QR en Keycloak (el login del escritorio es loopback, no
// se ve afectado) y sigue directo al login.
export function PasoIpCambio({
  estado,
  onReconfigurado,
}: {
  estado: EstadoIpLan;
  onReconfigurado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [reconfigurando, setReconfigurando] = useState(false);

  async function reconfigurar(): Promise<void> {
    setError(null);
    setReconfigurando(true);
    try {
      await window.sicsaftCore.reconfigurarIpLan();
      onReconfigurado();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setReconfigurando(false);
    }
  }

  return (
    <WizardCard
      titulo="La IP de esta PC cambió"
      subtitulo="El acceso desde el teléfono del Profesional de AFT hay que reapuntarlo a la dirección nueva."
    >
      <div className="space-y-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-card px-4 py-3 text-sm">
          <p className="text-[var(--muted-foreground)]">
            Dirección registrada al instalar:{" "}
            <span className="font-mono text-foreground">
              {estado.ipGuardada}
            </span>
          </p>
          <p className="mt-1 text-[var(--muted-foreground)]">
            Dirección actual de esta PC:{" "}
            <span className="font-mono text-foreground">{estado.ipActual}</span>
          </p>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Al continuar se actualiza el registro de la APP QR en el servidor de
          identidad. El login del escritorio no se ve afectado. Para que no
          vuelva a pasar, pedile a quien administra la red una reserva de IP
          fija (DHCP) para esta PC.
        </p>
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        <Button
          type="button"
          onClick={() => void reconfigurar()}
          disabled={reconfigurando}
        >
          {reconfigurando ? "Reconfigurando…" : "Reconfigurar y continuar"}
        </Button>
      </div>
    </WizardCard>
  );
}
