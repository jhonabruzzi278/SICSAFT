import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';

// Vista de previsualización de alta fidelidad del Wizard de Instalación y Registro de Organización
// para documentación y control visual de calidad de los 4 pasos del primer arranque.

export function WizardPreviewPage() {
  const [searchParams] = useSearchParams();
  const pasoParam = searchParams.get('paso') ?? '1';
  const pasoActual = Number(pasoParam) || 1;

  const [qrPwa, setQrPwa] = useState<string>('');
  const [qrApk, setQrApk] = useState<string>('');
  const [tabQr, setTabQr] = useState<'pwa' | 'apk'>('pwa');

  useEffect(() => {
    void Promise.all([
      QRCode.toDataURL('https://192.168.1.42:8765', { width: 175, margin: 1 }),
      QRCode.toDataURL('https://192.168.1.42:8765/sicsaft-aft.apk', { width: 175, margin: 1 }),
    ]).then(([pwa, apk]) => {
      setQrPwa(pwa);
      setQrApk(apk);
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 bg-[radial-gradient(60rem_40rem_at_50%_-10%,oklch(30%_0.09_252/0.5),transparent_70%)]">
      {/* Brand Bar */}
      <header className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-bg font-bold shadow-elev-float">
            S
          </div>
          <div>
            <span className="font-bold tracking-tight text-accent-strong text-base">
              SICSAFT CORE
            </span>
            <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-strong">
              v1.0.0 Enterprise
            </span>
          </div>
        </div>
        <span className="text-xs text-text-dim">Instalador de Primer Arranque</span>
      </header>

      {/* Main Card Content */}
      <main className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-8 shadow-elev-2">
          {/* Step Indicator */}
          {pasoActual <= 3 && (
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2.5 rounded-full transition-all ${
                      s === pasoActual
                        ? 'w-8 bg-accent shadow-elev-float'
                        : s < pasoActual
                          ? 'w-2.5 bg-accent/50'
                          : 'w-2.5 bg-border'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-mono text-text-dim">
                Paso {pasoActual} de 3
              </span>
            </div>
          )}

          {/* PASO 1: Datos de instalación / organización */}
          {pasoActual === 1 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-text">
                  Datos de esta instalación
                </h1>
                <p className="mt-1 text-sm text-text-dim">
                  Configuración inicial de la organización, sede principal y nivel contratado.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1">
                    Nombre de la organización / cliente
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="EMPRESA SUCHEL TROPICAL - DIRECCIÓN GENERAL"
                    className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1">
                    Identificador único (slug de base de datos)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="suchel-dg"
                    className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1">
                    Sede principal
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="Oficina Director General & Secretaría"
                    className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-dim mb-2">
                    Nivel de producto contratado
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-bg-raised/50 p-3 opacity-60">
                      <div className="font-semibold text-xs text-text">Nivel 1</div>
                      <p className="text-[11px] text-text-dim mt-0.5">Operación y control patrimonial</p>
                    </div>
                    <div className="rounded-xl border-2 border-accent bg-accent/10 p-3 shadow-xs">
                      <div className="font-semibold text-xs text-accent-strong flex items-center justify-between">
                        Nivel 2 (Completo)
                        <span className="rounded bg-accent px-1.5 py-0.2 text-[9px] text-bg font-bold">ACTIVO</span>
                      </div>
                      <p className="text-[11px] text-text mt-0.5">
                        Incluye <strong>CIP</strong> (Centro de Inteligencia Patrimonial)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-bg shadow-elev-float"
                  >
                    Continuar al Alta del Director →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: Alta del Director */}
          {pasoActual === 2 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-text">
                  Director dado de alta
                </h1>
                <p className="mt-1 text-sm text-text-dim">
                  Credencial de acceso generada con rol <strong>Directivo</strong> en EMPRESA SUCHEL TROPICAL.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1">
                    Email del Director
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="director@sucheltropical.cu"
                    className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
                  />
                </div>

                <div className="rounded-xl border border-success/30 bg-success/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-success uppercase tracking-wider">
                      Contraseña inicial de un solo uso
                    </span>
                    <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] text-success font-medium">
                      Cambio forzado en 1er login
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-lg font-bold text-text tracking-widest">
                    k9#Xp$2mQ!
                  </p>
                </div>

                <p className="text-xs text-text-dim">
                  El Director utilizará esta contraseña provisional para acceder al Portal Ejecutivo y será obligado a definir una nueva clave segura.
                </p>

                <div className="pt-2">
                  <button
                    type="button"
                    className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-bg shadow-elev-float"
                  >
                    Continuar al Alta del Profesional AFT →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Alta del Profesional AFT */}
          {pasoActual === 3 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-text">
                  Profesional de AFT dado de alta
                </h1>
                <p className="mt-1 text-sm text-text-dim">
                  Credencial generada con rol <strong>Administrador Patrimonial</strong> en EMPRESA SUCHEL TROPICAL.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1">
                    Email del Profesional AFT
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="aft@sucheltropical.cu"
                    className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
                  />
                </div>

                <div className="rounded-xl border border-success/30 bg-success/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-success uppercase tracking-wider">
                      Contraseña inicial de un solo uso
                    </span>
                    <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] text-success font-medium">
                      Cambio forzado en 1er login
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-lg font-bold text-text tracking-widest">
                    w7&Rz#9tK@
                  </p>
                </div>

                <p className="text-xs text-text-dim">
                  Con este rol, el operador administrará el Centro de Control Patrimonial (CCP) y sincronizará la APP QR en terreno.
                </p>

                <div className="pt-2">
                  <button
                    type="button"
                    className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-bg shadow-elev-float"
                  >
                    Finalizar Instalación y Generar Conexión →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PASO 4: Instalación Completa / Pantalla Listo con QR Dual */}
          {pasoActual === 4 && (
            <div className="space-y-5">
              <div className="text-center">
                <span className="inline-block rounded-full bg-success/20 px-3 py-1 text-xs font-bold text-success mb-2">
                  ✓ INSTALACIÓN EXITOSA
                </span>
                <h1 className="text-2xl font-bold text-text">
                  Instalación completa
                </h1>
                <p className="mt-1 text-sm text-text-dim">
                  Todos los microservicios, bases de datos y portales están en línea.
                </p>
              </div>

              {/* Selector de QR Móvil */}
              <div className="rounded-xl border border-border bg-bg-raised p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">
                    Acceso Móvil para Relevamiento
                  </span>
                  <div className="inline-flex rounded-lg border border-border bg-bg-card p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setTabQr('pwa')}
                      className={`px-2.5 py-0.5 rounded font-medium ${
                        tabQr === 'pwa' ? 'bg-accent text-bg' : 'text-text-dim'
                      }`}
                    >
                      PWA Web
                    </button>
                    <button
                      type="button"
                      onClick={() => setTabQr('apk')}
                      className={`px-2.5 py-0.5 rounded font-medium ${
                        tabQr === 'apk' ? 'bg-accent text-bg' : 'text-text-dim'
                      }`}
                    >
                      APK Android
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg">
                  {tabQr === 'pwa' && qrPwa && (
                    <img src={qrPwa} alt="QR PWA" className="h-36 w-36" />
                  )}
                  {tabQr === 'apk' && qrApk && (
                    <img src={qrApk} alt="QR APK" className="h-36 w-36" />
                  )}
                </div>

                <div className="text-center">
                  <span className="text-[11px] font-mono text-accent-strong">
                    https://192.168.1.42:8765
                    {tabQr === 'apk' ? '/sicsaft-aft.apk' : ''}
                  </span>
                  <p className="text-[10px] text-text-dim mt-0.5">
                    {tabQr === 'pwa'
                      ? 'Escanea con la cámara del teléfono en la misma red Wi-Fi'
                      : 'Descarga e instala el APK nativo SICSAFT AFT en el teléfono'}
                  </p>
                </div>
              </div>

              {/* Carpeta Ingesta */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-bg-raised/60 px-3 py-2 text-xs">
                <span className="text-text-dim">Carpeta vigilada:</span>
                <span className="font-mono text-text">C:\SICSAFT\IngestaExcel</span>
              </div>

              <button
                type="button"
                className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-bg shadow-elev-float"
              >
                Abrir Portal de Control Patrimonial (CCP)
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-text-faint">
        SICSAFT Enterprise Asset Intelligence • Protocolo OIDC / PKCE • Base Patrimonial Inmutable
      </footer>
    </div>
  );
}
