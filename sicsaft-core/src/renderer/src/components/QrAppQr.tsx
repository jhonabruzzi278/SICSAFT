import { useEffect, useState } from "react";
import QRCode from "qrcode";

// DOC-028 Fase D -- QR con la URL https://<ip-lan>:8765 de la PWA de la APP QR que sirve el propio
// .exe. El Profesional de AFT lo escanea con la cámara del teléfono y abre la app sin tipear una
// IP ni correr comandos. La URL y el arranque del servidor los resuelve el proceso principal
// (getUrlAppQr).
export function QrAppQr() {
  const [url, setUrl] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    window.sicsaftCore
      .getUrlAppQr()
      .then(async (u) => {
        if (cancelado) return;
        setUrl(u);
        const d = await QRCode.toDataURL(u, { width: 190, margin: 1 });
        if (!cancelado) setDataUrl(d);
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (error) {
    return (
      <p className="mt-4 text-xs text-[var(--muted-foreground)]">
        No se pudo generar el acceso para el teléfono: {error}
      </p>
    );
  }

  return (
    <div className="mx-auto mt-4 flex w-full max-w-xs flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-card p-4">
      <p className="text-sm font-semibold text-foreground">
        App del Profesional de AFT
      </p>
      <p className="text-xs text-[var(--muted-foreground)]">
        Escaneá con la cámara del teléfono.
      </p>
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="Código QR para abrir la APP QR en el teléfono"
          width={190}
          height={190}
          className="rounded-[var(--radius-lg)]"
        />
      ) : (
        <div className="size-[190px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--input)]" />
      )}
      {url && (
        <p className="break-all text-center font-mono text-[11px] text-[var(--faint-foreground)]">
          {url}
        </p>
      )}
      <p className="text-center text-[11px] leading-snug text-[var(--faint-foreground)]">
        El teléfono tiene que estar en la misma red Wi-Fi que esta PC. La
        primera vez el navegador muestra un aviso de seguridad (certificado
        propio) — es esperado, tocá &quot;Continuar&quot;.
      </p>
    </div>
  );
}
