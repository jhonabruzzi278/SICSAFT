import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Button, Input, Label, Badge } from '@/components/ui';

export function WizardPreviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pasoParam = searchParams.get('paso');

  // Estado interactivo del Wizard
  const [pasoActual, setPasoActual] = useState<number>(() => {
    const p = Number(pasoParam);
    return p >= 1 && p <= 4 ? p : 1;
  });

  // Datos del Paso 1: Instalación y Nivel
  const [clienteNombre, setClienteNombre] = useState('');
  const [organizacionId, setOrganizacionId] = useState('');
  const [sedePrincipal, setSedePrincipal] = useState('');
  const [nivel, setNivel] = useState<1 | 2>(2);

  // Datos del Paso 2: Director
  const [directorEmail, setDirectorEmail] = useState('');
  const [directorPass] = useState('k9#Xp$2mQ!');

  // Datos del Paso 3: Profesional AFT
  const [aftEmail, setAftEmail] = useState('');
  const [aftPass] = useState('w7&Rz#9tK@');

  // Datos del Paso 4: QR Dual
  const [qrPwa, setQrPwa] = useState<string>('');
  const [qrApk, setQrApk] = useState<string>('');
  const [tabQr, setTabQr] = useState<'pwa' | 'apk'>('pwa');
  const [lanIp] = useState('192.168.1.42');

  useEffect(() => {
    void Promise.all([
      QRCode.toDataURL(`https://${lanIp}:8765`, {
        width: 175,
        margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      }),
      QRCode.toDataURL(`https://${lanIp}:8765/sicsaft-aft.apk`, {
        width: 175,
        margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      }),
    ]).then(([pwa, apk]) => {
      setQrPwa(pwa);
      setQrApk(apk);
    });
  }, [lanIp]);

  function autoSlug(nombre: string) {
    return nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function handleNombreChange(val: string) {
    setClienteNombre(val);
    setOrganizacionId(autoSlug(val));
  }

  // Esta pantalla es una MAQUETA del wizard del instalador (el real vive en sicsaft-core), así
  // que termina mandando al login de verdad. Hasta 2026-09-08 fabricaba acá mismo un JWT
  // `alg: "none"` con el rol elegido y lo guardaba como si fuera una sesión: el portal quedaba
  // "logueado" sin que existiera nada en Keycloak y CIS rechazaba cada request. Una maqueta no
  // puede acuñar credenciales.
  function completarInstalacion() {
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6 bg-[radial-gradient(60rem_40rem_at_50%_-10%,oklch(30%_0.09_252/0.5),transparent_70%)]">
      {/* Brand Bar */}
      <header className="flex items-center justify-between border-b border-border/40 pb-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-bg font-extrabold shadow-elev-float">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-accent-strong text-base">
                SICSAFT CORE
              </span>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-strong border border-accent/30">
                Instalador Nativo
              </span>
            </div>
            <span className="block text-[11px] text-text-dim">
              Asistente de Primer Arranque y Provisión de Organización
            </span>
          </div>
        </div>
      </header>

      {/* Main Card Content */}
      <main className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-xl rounded-2xl border border-border bg-bg-card p-6 sm:p-8 shadow-2xl">
          {/* Step Indicator */}
          <div className="mb-6 flex items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPasoActual(s)}
                  className={`h-2.5 rounded-full transition-all ${
                    s === pasoActual
                      ? 'w-10 bg-accent shadow-elev-float'
                      : s < pasoActual
                        ? 'w-3 bg-accent/60'
                        : 'w-3 bg-border'
                  }`}
                  title={`Ir al Paso ${s}`}
                />
              ))}
            </div>
            <span className="text-xs font-mono font-semibold text-text-dim">
              Paso {pasoActual} de 4
            </span>
          </div>

          {/* ========================================================= */}
          {/* PASO 1: Datos de Instalación, Organización y Nivel */}
          {/* ========================================================= */}
          {pasoActual === 1 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-text">
                  1. Datos de esta instalación
                </h1>
                <p className="mt-1 text-xs text-text-dim">
                  Configuración inicial del cliente, sede principal y nivel
                  contratado en la Base Patrimonial Inteligente (BPI).
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="clienteNombre">
                    Nombre de la Organización / Cliente
                  </Label>
                  <Input
                    id="clienteNombre"
                    value={clienteNombre}
                    onChange={(e) => handleNombreChange(e.target.value)}
                    className="mt-1 font-medium"
                  />
                </div>

                <div>
                  <Label htmlFor="organizacionId">
                    Identificador único (Slug DNS-Safe)
                  </Label>
                  <Input
                    id="organizacionId"
                    value={organizacionId}
                    onChange={(e) => setOrganizacionId(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                  <span className="text-[11px] text-text-dim mt-0.5 block">
                    Se autocompleta automáticamente. Solo minúsculas, números y
                    guiones.
                  </span>
                </div>

                <div>
                  <Label htmlFor="sedePrincipal">Sede Principal</Label>
                  <Input
                    id="sedePrincipal"
                    value={sedePrincipal}
                    onChange={(e) => setSedePrincipal(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Nivel de Producto Contratado</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                    <div
                      onClick={() => setNivel(1)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        nivel === 1
                          ? 'border-accent bg-accent/10 shadow-sm'
                          : 'border-border bg-bg-raised/40 hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-text">
                          Nivel 1 — Modo Básico
                        </span>
                        {nivel === 1 && (
                          <Badge variant="success">SELECCIONADO</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-text-dim mt-1">
                        APP QR + CCP completo (gestión de activos, fichas
                        técnicas, etiquetas, auditoría e importaciones).
                      </p>
                    </div>

                    <div
                      onClick={() => setNivel(2)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        nivel === 2
                          ? 'border-accent bg-accent/15 shadow-sm ring-1 ring-accent'
                          : 'border-border bg-bg-raised/40 hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-accent-strong">
                          Nivel 2 — Modo Profesional
                        </span>
                        {nivel === 2 && (
                          <Badge variant="success">SELECCIONADO</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-text-dim mt-1">
                        Todo el Nivel 1 +{' '}
                        <strong>
                          CIP (Centro de Inteligencia Patrimonial)
                        </strong>{' '}
                        con analítica y KPIs en tiempo real,{' '}
                        <strong>en el portal del Directivo</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <Button
                    type="button"
                    className="w-full !py-2.5 text-xs font-bold shadow-md"
                    onClick={() => setPasoActual(2)}
                  >
                    Continuar al Alta del Director →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 2: Alta del Director */}
          {/* ========================================================= */}
          {pasoActual === 2 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-text">
                  2. Alta del Director General
                </h1>
                <p className="mt-1 text-xs text-text-dim">
                  Credencial de acceso generada con rol{' '}
                  <strong>Directivo</strong> para supervisión ejecutiva y
                  designación.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="directorEmail">
                    Correo Electrónico del Director
                  </Label>
                  <Input
                    id="directorEmail"
                    value={directorEmail}
                    onChange={(e) => setDirectorEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Contraseña Temporal Autogenerada
                    </span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-medium">
                      Cambio forzado en 1er login
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-xl font-bold text-text tracking-widest select-all">
                    {directorPass}
                  </p>
                </div>

                <p className="text-xs text-text-dim">
                  El Director utilizará esta credencial inicial para supervisar
                  contratos, autorizar bajas críticas y acceder al portal
                  ejecutivo.
                </p>

                <div className="flex gap-2 pt-3">
                  <Button
                    variant="secondary"
                    className="w-1/3 !py-2.5 text-xs"
                    onClick={() => setPasoActual(1)}
                  >
                    ← Volver
                  </Button>
                  <Button
                    className="w-2/3 !py-2.5 text-xs font-bold shadow-md"
                    onClick={() => setPasoActual(3)}
                  >
                    Continuar al Alta del Profesional AFT →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 3: Alta del Profesional AFT */}
          {/* ========================================================= */}
          {pasoActual === 3 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-text">
                  3. Alta del Profesional de AFT
                </h1>
                <p className="mt-1 text-xs text-text-dim">
                  Credencial generada con rol{' '}
                  <strong>Administrador Patrimonial</strong> para gestionar el
                  catálogo y relevamientos.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="aftEmail">
                    Correo Electrónico del Profesional AFT
                  </Label>
                  <Input
                    id="aftEmail"
                    value={aftEmail}
                    onChange={(e) => setAftEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Contraseña Temporal Autogenerada
                    </span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-medium">
                      Cambio forzado en 1er login
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-xl font-bold text-text tracking-widest select-all">
                    {aftPass}
                  </p>
                </div>

                <p className="text-xs text-text-dim">
                  Con este rol, el operador administrará el Centro de Control
                  Patrimonial (CCP), cargará planillas por Python ETL y
                  sincronizará la APP QR en terreno.
                </p>

                <div className="flex gap-2 pt-3">
                  <Button
                    variant="secondary"
                    className="w-1/3 !py-2.5 text-xs"
                    onClick={() => setPasoActual(2)}
                  >
                    ← Volver
                  </Button>
                  <Button
                    className="w-2/3 !py-2.5 text-xs font-bold shadow-md"
                    onClick={() => setPasoActual(4)}
                  >
                    Finalizar Instalación y Ver Conexión QR →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 4: Instalación Completa & QR Dual de Conexión */}
          {/* ========================================================= */}
          {pasoActual === 4 && (
            <div className="space-y-5">
              <div className="text-center">
                <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 mb-2 border border-emerald-500/40">
                  ✓ INSTALACIÓN EXITOSA EN LA BPI
                </span>
                <h1 className="text-2xl font-extrabold text-text">
                  Instalación Completa
                </h1>
                <p className="mt-1 text-xs text-text-dim">
                  La organización{' '}
                  <strong className="text-text">{clienteNombre}</strong> ha sido
                  provisionada exitosamente en modo{' '}
                  {nivel === 2
                    ? 'Nivel 2 (Profesional con CIP)'
                    : 'Nivel 1 (Básico)'}
                  .
                </p>
              </div>

              {/* Selector de QR Móvil */}
              <div className="rounded-xl border border-border bg-bg-raised p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text">
                    Acceso Móvil para Relevamiento en Terreno
                  </span>
                  <div className="inline-flex rounded-lg border border-border bg-bg-card p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setTabQr('pwa')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        tabQr === 'pwa'
                          ? 'bg-accent text-bg shadow-sm'
                          : 'text-text-dim hover:text-text'
                      }`}
                    >
                      PWA Web (Cámara)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTabQr('apk')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        tabQr === 'apk'
                          ? 'bg-accent text-bg shadow-sm'
                          : 'text-text-dim hover:text-text'
                      }`}
                    >
                      APK Android (.apk)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-inner">
                  {tabQr === 'pwa' && qrPwa && (
                    <img
                      src={qrPwa}
                      alt="QR PWA"
                      className="h-36 w-36 object-contain"
                    />
                  )}
                  {tabQr === 'apk' && qrApk && (
                    <img
                      src={qrApk}
                      alt="QR APK"
                      className="h-36 w-36 object-contain"
                    />
                  )}
                </div>

                <div className="text-center">
                  <span className="text-xs font-mono font-bold text-accent-strong">
                    https://{lanIp}:8765
                    {tabQr === 'apk' ? '/sicsaft-aft.apk' : ''}
                  </span>
                  <p className="text-[11px] text-text-dim mt-0.5">
                    {tabQr === 'pwa'
                      ? 'Escanea con la cámara del celular en la misma red Wi-Fi para abrir la App de Escaneo QR.'
                      : 'Descarga e instala el APK nativo SICSAFT AFT directamente en tu teléfono Android.'}
                  </p>
                </div>
              </div>

              {/* Botones de Entrada al Portal */}
              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  className="w-full !py-2.5 text-xs font-bold shadow-lg"
                  onClick={() => completarInstalacion()}
                >
                  🚀 Ingresar al Portal como Profesional AFT
                  {aftEmail ? ` (${aftEmail})` : ''}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full !py-2 text-xs font-semibold"
                  onClick={() => completarInstalacion()}
                >
                  🏛️ Ingresar como Director
                  {directorEmail ? ` (${directorEmail})` : ''}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-text-dim max-w-4xl mx-auto w-full border-t border-border/40 pt-4">
        SICSAFT Enterprise Asset Intelligence • Protocolo OIDC / PKCE • Base
        Patrimonial Inmutable (BPI)
      </footer>
    </div>
  );
}
