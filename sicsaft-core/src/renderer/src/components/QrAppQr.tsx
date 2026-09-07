import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { InfoAppQr } from "@shared/ipc-contract";

// DOC-028 Fase D / DOC-029 RF-H -- selector dual de acceso para el teléfono del Profesional de AFT:
//  - PWA: abre directo en el navegador del teléfono escaneando https://<ip-lan>:8765.
//  - APK Nativa: descarga el instalador sicsaft-aft.apk para una experiencia sin avisos de cert.
export function QrAppQr() {
  const [info, setInfo] = useState<InfoAppQr | null>(null);
  const [tipo, setTipo] = useState<"pwa" | "apk">("pwa");
  const [dataUrlPwa, setDataUrlPwa] = useState<string | null>(null);
  const [dataUrlApk, setDataUrlApk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    window.sicsaftCore
      .getInfoAppQr()
      .then(async (inf) => {
        if (cancelado) return;
        setInfo(inf);
        const [qrPwa, qrApk] = await Promise.all([
          QRCode.toDataURL(inf.urlPwa, { width: 175, margin: 1 }),
          QRCode.toDataURL(inf.urlApk, { width: 175, margin: 1 }),
        ]);
        if (!cancelado) {
          setDataUrlPwa(qrPwa);
          setDataUrlApk(qrApk);
        }
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

  const qrActual = tipo === "pwa" ? dataUrlPwa : dataUrlApk;
  const urlActual = tipo === "pwa" ? info?.urlPwa : info?.urlApk;

  return (
    <div className="mx-auto mt-4 flex w-full max-w-sm flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold text-foreground">
        Acceso Móvil — Profesional de AFT
      </p>

      {/* Selector de pestañas PWA vs APK */}
      <div className="flex w-full rounded-lg bg-[var(--input)]/50 p-1 text-xs">
        <button
          type="button"
          onClick={() => setTipo("pwa")}
          className={`flex-1 rounded-md py-1.5 font-medium transition-all ${
            tipo === "pwa"
              ? "bg-card text-foreground shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-foreground"
          }`}
        >
          📱 PWA (Navegador)
        </button>
        <button
          type="button"
          onClick={() => setTipo("apk")}
          className={`flex-1 rounded-md py-1.5 font-medium transition-all ${
            tipo === "apk"
              ? "bg-card text-foreground shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-foreground"
          }`}
        >
          📦 APK Android
        </button>
      </div>

      <p className="text-xs text-[var(--muted-foreground)]">
        {tipo === "pwa"
          ? "Escaneá con la cámara para abrir en el navegador."
          : "Escaneá con la cámara para descargar la APK nativa."}
      </p>

      {qrActual ? (
        <img
          src={qrActual}
          alt={
            tipo === "pwa"
              ? "Código QR para abrir la PWA en el teléfono"
              : "Código QR para descargar la APK Android"
          }
          width={175}
          height={175}
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-1"
        />
      ) : (
        <div className="size-[175px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--input)]" />
      )}

      {urlActual && (
        <p className="break-all text-center font-mono text-[11px] text-[var(--faint-foreground)]">
          {urlActual}
        </p>
      )}

      {tipo === "pwa" ? (
        <p className="text-center text-[11px] leading-snug text-[var(--faint-foreground)]">
          El teléfono debe estar en la misma red Wi-Fi. La primera vez tocá
          &quot;Continuar&quot; ante el aviso de certificado propio.
        </p>
      ) : (
        <p className="text-center text-[11px] leading-snug text-[var(--faint-foreground)]">
          Descargá e instalá la APK para una experiencia de escaneo fluida sin
          avisos de certificado en el navegador.
        </p>
      )}
    </div>
  );
}
