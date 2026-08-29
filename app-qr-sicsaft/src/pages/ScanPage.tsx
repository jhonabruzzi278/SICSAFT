import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ScanLineIcon,
  DownloadIcon,
  RotateCcwIcon,
  PauseIcon,
  CheckCircle2Icon,
  ArrowDownToLineIcon,
  PencilIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrScanner } from '@/components/QrScanner';
import { ScannedList, type ScannedItem } from '@/components/ScannedList';
import { Screen } from '@/components/mobile/Screen';
import { SectionHeader } from '@/components/mobile/SectionHeader';
import { StatTile } from '@/components/mobile/StatTile';
import { OperatorGate } from '@/components/OperatorGate';
import { OrganizationPicker } from '@/components/OrganizationPicker';
import { AreaLocationPicker } from '@/components/AreaLocationPicker';
import { IncidentDialog } from '@/components/IncidentDialog';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import type { EstadoOperativoDeclarable, ScannedSessionItem } from '@/lib/db';
import {
  qrConnector,
  buildOrganizationTree,
  type ConnectorAsset,
  type OrganizacionSummary,
} from '@/lib/qr-connector';
import { submitInventario } from '@/lib/sync-queue';
import { resolveScannedProduct } from '@/lib/scan-resolve';
import { triggerScanFeedback } from '@/lib/scan-feedback';
import { downloadCsv } from '@/lib/csv-export';
import { oidcClient, AuthenticationRequiredError } from '@/lib/oidc/oidc-client';
import { getOrCreateDeviceId } from '@/lib/device-id';
import { logAuditEvent } from '@/lib/audit-log';
import { calcularVeredicto, VERDICT_LABEL } from '@/lib/verdict';
import { getScanMode, setScanMode, SCAN_MODE_OPTIONS, type ScanMode } from '@/lib/scan-mode';
import type { Organization, OrgArea, OrgLocation } from '@/lib/organizations-data';

type View = 'operator' | 'organization' | 'area-location' | 'home' | 'scanning' | 'report';

export function ScanPage() {
  const catalogRef = useRef<ConnectorAsset[]>([]);
  const scannedCodesRef = useRef<Set<string>>(new Set());
  const startedAtRef = useRef<string>('');
  const invalidAttemptsRef = useRef(0);
  const correlationIdRef = useRef<string>('');
  const deviceIdRef = useRef(getOrCreateDeviceId());
  const [startingScan, setStartingScan] = useState(false);
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizacionSummary[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [area, setArea] = useState<OrgArea | null>(null);
  const [location, setLocation] = useState<OrgLocation | null>(null);
  const [view, setView] = useState<View>('operator');
  const [cameraActive, setCameraActive] = useState(false);
  const [scanned, setScanned] = useState<Map<string, ScannedItem>>(new Map());
  const [manualCode, setManualCode] = useState('');
  const [incidentTarget, setIncidentTarget] = useState<string | null>(null);
  const [bajaTarget, setBajaTarget] = useState<string | null>(null);
  const [scanMode, setScanModeState] = useState<ScanMode>(() => getScanMode());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { canInstall, showIosHint, promptInstall } = useInstallPrompt();

  useEffect(() => {
    let cancelled = false;
    // Se completa la sesión OIDC en AuthCallbackPage (o ya venía de una sesión previa dentro de
    // la misma pestaña — sessionStorage, ver oidc/token-store.ts) — acá solo se resuelve
    // auth/session contra CIS con el token ya vigente.
    if (!oidcClient.isAuthenticated()) return;

    qrConnector
      .authSession()
      .then((result) => {
        if (cancelled) return;
        setOperatorName(oidcClient.getCurrentOperatorDisplayName());
        setOrganizations(result.organizaciones);
        setView('organization');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Token vencido sin refresh posible u otra falla real — oidcClient.getValidAccessToken()
        // ya limpió la sesión, se queda en la pantalla de login (view ya arranca en 'operator').
        if (!(err instanceof AuthenticationRequiredError)) {
          toast.error('No se pudo iniciar sesión. Intentá de nuevo.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleOrganizationSelect(summary: OrganizacionSummary) {
    setLoadingCatalog(true);
    try {
      // CIS no tiene un endpoint propio para listar áreas/ubicaciones (decisión confirmada) — se
      // trae el catálogo completo de la organización una sola vez acá y se deriva el árbol que
      // espera AreaLocationPicker; startScanning() reutiliza este mismo catálogo, sin refetch.
      const catalogo = await qrConnector.getCatalogo(summary.id);
      catalogRef.current = catalogo;
      setOrganization(buildOrganizationTree(summary, catalogo));
      setArea(null);
      setLocation(null);
      setView('area-location');
    } catch (err) {
      if (err instanceof AuthenticationRequiredError) {
        toast.error('Tu sesión venció. Iniciá sesión de nuevo.');
        setView('operator');
      } else {
        toast.error('No se pudo cargar el catálogo de la organización. Intentá de nuevo.');
      }
    } finally {
      setLoadingCatalog(false);
    }
  }

  function handleAreaLocationContinue(selectedArea: OrgArea, selectedLocation: OrgLocation) {
    setArea(selectedArea);
    setLocation(selectedLocation);
    setView('home');
  }

  function changeOrganization() {
    setOrganization(null);
    setArea(null);
    setLocation(null);
    setView('organization');
  }

  function handleDecode(rawText: string) {
    if (!operatorName || !organization || !area || !location) return;
    const code = rawText.trim().toUpperCase();
    if (!code) return;

    const resolution = resolveScannedProduct(
      catalogRef.current,
      code,
      { organizationId: organization.id, areaId: area.id, locationId: location.id },
      scannedCodesRef.current,
    );

    logAuditEvent({
      event: 'scan',
      correlationId: correlationIdRef.current,
      operatorName,
      deviceId: deviceIdRef.current,
      code,
      category: resolution.category,
      organizationName: organization.name,
      areaName: area.name,
      locationName: location.name,
    });

    if (resolution.category === 'invalid') {
      invalidAttemptsRef.current += 1;
      triggerScanFeedback(false);
      toast.error(`Código inválido: ${code}`);
      return;
    }

    if (resolution.category === 'already-scanned') {
      toast.warning(`Ya escaneado: ${code}`);
      return;
    }

    scannedCodesRef.current.add(code);
    setScanned((prev) =>
      new Map(prev).set(code, {
        code,
        name: resolution.name,
        category: resolution.category,
        expectedAreaName: resolution.expectedAreaName,
        expectedLocationName: resolution.expectedLocationName,
      }),
    );
    triggerScanFeedback(resolution.category === 'correct');

    switch (resolution.category) {
      case 'correct':
        toast.success(`✔ ${code} — ${resolution.name}`);
        break;
      case 'wrong-area':
        toast.warning(`⚠ ${code} — otra área (${resolution.expectedAreaName})`);
        break;
      case 'wrong-location':
        toast.warning(`⚠ ${code} — otra ubicación (${resolution.expectedLocationName})`);
        break;
      case 'unregistered':
        toast.error(`✖ ${code} — no registrado`);
        break;
    }
  }

  function handleManualEntry() {
    if (!manualCode.trim()) return;
    handleDecode(manualCode);
    setManualCode('');
  }

  function handleMarkOutOfPlace(code: string) {
    setScanned((prev) => {
      const item = prev.get(code);
      if (!item) return prev;
      return new Map(prev).set(code, { ...item, outOfPlace: !item.outOfPlace });
    });
  }

  function handleExternalFind(code: string) {
    setScanned((prev) => {
      const item = prev.get(code);
      if (!item) return prev;
      return new Map(prev).set(code, { ...item, externalFind: true });
    });
  }

  function handleDiscard(code: string) {
    scannedCodesRef.current.delete(code);
    setScanned((prev) => {
      const next = new Map(prev);
      next.delete(code);
      return next;
    });
  }

  function handleSaveIncident(note: string) {
    if (!incidentTarget || !operatorName) return;
    setScanned((prev) => {
      const item = prev.get(incidentTarget);
      if (!item) return prev;
      return new Map(prev).set(incidentTarget, { ...item, incidentNote: note });
    });
    setIncidentTarget(null);
    logAuditEvent({
      event: 'incident_added',
      correlationId: correlationIdRef.current,
      operatorName,
      deviceId: deviceIdRef.current,
      code: incidentTarget,
      incidentNote: note,
    });
  }

  // Fase 3.1/DOC-017 3, DOC-012 5.1 — declarable sin rol administrador-patrimonial.
  function handleDeclareEstado(code: string, estado: EstadoOperativoDeclarable) {
    setScanned((prev) => {
      const item = prev.get(code);
      if (!item) return prev;
      return new Map(prev).set(code, { ...item, estadoDeclarado: estado });
    });
  }

  // Solo guarda el motivo — nunca ejecuta la baja (la ejecuta el Administrador Patrimonial desde
  // WEB tras revisar, ver DOC-012 5.1).
  function handleSaveBaja(motivo: string) {
    if (!bajaTarget) return;
    setScanned((prev) => {
      const item = prev.get(bajaTarget);
      if (!item) return prev;
      return new Map(prev).set(bajaTarget, { ...item, bajaSugerida: motivo });
    });
    setBajaTarget(null);
  }

  function handleScanModeChange(mode: ScanMode) {
    setScanMode(mode);
    setScanModeState(mode);
  }

  function startScanning() {
    if (!operatorName || !organization || !area || !location) return;
    setStartingScan(true);
    // El catálogo ya se trajo completo al elegir la organización (handleOrganizationSelect) —
    // catalogRef.current sigue vigente acá, no hace falta un segundo fetch.
    startedAtRef.current = new Date().toISOString();
    invalidAttemptsRef.current = 0;
    // Generado al iniciar, no al enviar (DOC-002 sección 6) — viaja en cada
    // operación relacionada con este inventario.
    correlationIdRef.current = crypto.randomUUID();
    logAuditEvent({
      event: 'inventory_started',
      correlationId: correlationIdRef.current,
      operatorName,
      deviceId: deviceIdRef.current,
      organizationName: organization.name,
      areaName: area.name,
      locationName: location.name,
    });
    setStartingScan(false);
    setView('scanning');
    setCameraActive(true);
  }

  function finishScanning() {
    setCameraActive(false);
    if (operatorName && organization && area && location) {
      logAuditEvent({
        event: 'inventory_finished',
        correlationId: correlationIdRef.current,
        operatorName,
        deviceId: deviceIdRef.current,
        organizationName: organization.name,
        areaName: area.name,
        locationName: location.name,
      });
    }
    // No se envía todavía — DOC-001 pantalla 11 pide un paso explícito de
    // confirmación (confirmAndSend) antes de tocar el Conector QR.
    setView('report');
  }

  async function confirmAndSend() {
    if (!operatorName || !organization || !area || !location || sending || sent) return;
    setSending(true);
    const items = Array.from(scanned.values());
    const sessionItems: ScannedSessionItem[] = items.map(
      ({ code, name, category, incidentNote, outOfPlace, externalFind, estadoDeclarado, bajaSugerida }) => ({
        code,
        name,
        category,
        incidentNote,
        outOfPlace,
        externalFind,
        estadoDeclarado,
        bajaSugerida,
      }),
    );
    const missingCount = missingAssets.length;
    const outOfPlaceTotal =
      items.filter((i) => i.category === 'wrong-area').length +
      items.filter((i) => i.category === 'wrong-location').length;
    try {
      await submitInventario({
        operatorName,
        organizationId: organization.id,
        organizationName: organization.name,
        areaId: area.id,
        areaName: area.name,
        locationId: location.id,
        locationName: location.name,
        startedAt: startedAtRef.current,
        date: new Date().toISOString(),
        total: items.length,
        correct: items.filter((i) => i.category === 'correct').length,
        wrongArea: items.filter((i) => i.category === 'wrong-area').length,
        wrongLocation: items.filter((i) => i.category === 'wrong-location').length,
        unregistered: items.filter((i) => i.category === 'unregistered').length,
        invalid: invalidAttemptsRef.current,
        incidents: items.filter((i) => i.incidentNote).length,
        missing: missingCount,
        verdict: calcularVeredicto(missingCount, outOfPlaceTotal),
        items: sessionItems,
        correlationId: correlationIdRef.current,
      });
      setSent(true);
    } catch {
      // submitInventario ya maneja sin conexión internamente (queda en cola
      // "pending" y se reintenta solo) — si igual tira, es un fallo real de
      // guardado local (IndexedDB), no de red.
      toast.error('No se pudo guardar el inventario.');
    } finally {
      setSending(false);
    }
  }

  function resetSession() {
    scannedCodesRef.current.clear();
    invalidAttemptsRef.current = 0;
    setScanned(new Map());
    setIncidentTarget(null);
    setBajaTarget(null);
    setSending(false);
    setSent(false);
    setView('home');
  }

  function exportCsv() {
    const items = Array.from(scanned.values());
    const rows: (string | number)[][] = [['codigo', 'nombre', 'categoria', 'incidencia', 'fuera_de_lugar']];
    items.forEach((item) =>
      rows.push([item.code, item.name, item.category, item.incidentNote ?? '', item.outOfPlace ? 'si' : 'no']),
    );
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadCsv(`qrvault-reporte-${timestamp}.csv`, rows);
  }

  const items = Array.from(scanned.values());
  const correctCount = items.filter((i) => i.category === 'correct').length;
  const wrongAreaCount = items.filter((i) => i.category === 'wrong-area').length;
  const wrongLocationCount = items.filter((i) => i.category === 'wrong-location').length;
  const outOfPlaceCount = wrongAreaCount + wrongLocationCount;
  const unregisteredCount = items.filter((i) => i.category === 'unregistered').length;
  const incidentCount = items.filter((i) => i.incidentNote).length;
  const nonCorrectItems = items.filter((i) => i.category !== 'correct');
  const incidentItem = incidentTarget ? scanned.get(incidentTarget) : undefined;
  const expectedAssets = catalogRef.current.filter((a) => a.areaId === area?.id && a.ubicacionId === location?.id);
  const missingAssets = expectedAssets.filter((a) => !scannedCodesRef.current.has(a.codigoQr));
  const externalFindCount = items.filter((i) => i.category === 'unregistered' && i.externalFind).length;
  // Fase 3.1/DOC-017 2 y 4.
  const verdict = calcularVeredicto(missingAssets.length, outOfPlaceCount);
  const outOfAreaByArea = new Map<string, ScannedItem[]>();
  items
    .filter((i) => i.category === 'wrong-area')
    .forEach((item) => {
      const key = item.expectedAreaName ?? 'Área desconocida';
      const grupo = outOfAreaByArea.get(key) ?? [];
      grupo.push(item);
      outOfAreaByArea.set(key, grupo);
    });
  const bajaItem = bajaTarget ? scanned.get(bajaTarget) : undefined;

  if (view === 'operator') {
    return <OperatorGate />;
  }

  if (view === 'organization') {
    return (
      <OrganizationPicker
        organizations={organizations}
        onSelect={handleOrganizationSelect}
        disabled={loadingCatalog}
      />
    );
  }

  if (view === 'area-location' && organization) {
    return <AreaLocationPicker organization={organization} onContinue={handleAreaLocationContinue} />;
  }

  if (view === 'home') {
    return (
      <Screen
        title="Nuevo control"
        action={
          <Button type="button" variant="ghost" size="sm" onClick={changeOrganization} data-testid="change-org-btn">
            <PencilIcon />
            Cambiar
          </Button>
        }
      >
        {/* Contexto de la sesión: operador · organización · área · ubicación. */}
        <div
          className="rounded-xl border border-border bg-card p-4 text-sm shadow-elev-1"
          data-testid="session-summary"
        >
          <p className="font-semibold">{organization?.name}</p>
          <p className="mt-0.5 text-muted-foreground">
            {area?.name} · {location?.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{operatorName}</p>
        </div>

        {/* CTA primaria de la app. */}
        <button
          type="button"
          onClick={startScanning}
          disabled={startingScan}
          data-testid="start-scan-btn"
          className="flex w-full flex-col items-center gap-3 rounded-2xl bg-primary p-8 text-primary-foreground shadow-elev-float transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <ScanLineIcon className="size-10" />
          <span className="text-lg font-semibold">Escanear código QR</span>
        </button>

        <div className="space-y-2">
          <SectionHeader>Modo de control</SectionHeader>
          <div className="flex flex-wrap gap-2" data-testid="scan-mode-selector">
            {SCAN_MODE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                variant={scanMode === opt.value ? 'default' : 'outline'}
                size="sm"
                disabled={opt.disabled}
                title={opt.description}
                onClick={() => handleScanModeChange(opt.value)}
                data-testid={`scan-mode-${opt.value}`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {(canInstall || showIosHint) && (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-elev-1">
            <p className="text-sm font-semibold">Instalar APP QR SICSAFT</p>
            {canInstall && (
              <Button variant="outline" className="w-full" onClick={promptInstall} data-testid="install-btn">
                <ArrowDownToLineIcon />
                Instalar app
              </Button>
            )}
            {showIosHint && (
              <p className="text-sm text-muted-foreground">
                Para instalarla: tocá <strong>Compartir</strong> y luego <strong>"Agregar a inicio"</strong>.
              </p>
            )}
          </div>
        )}
      </Screen>
    );
  }

  if (view === 'scanning') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Cámara</CardTitle>
          </CardHeader>
          <CardContent>
            <QrScanner active={cameraActive} onDecode={handleDecode} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">¿El QR no escanea?</CardTitle>
            <CardDescription>Ingresá el código manualmente</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Label htmlFor="manual-code-input" className="sr-only">
              Código manual
            </Label>
            <Input
              id="manual-code-input"
              data-testid="manual-code-input"
              placeholder="Ej. P001"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualEntry();
              }}
              autoComplete="off"
              className="uppercase"
            />
            <Button type="button" variant="secondary" onClick={handleManualEntry} data-testid="manual-code-btn">
              Agregar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Productos escaneados</span>
              <span className="text-2xl font-bold text-brand" data-testid="scanned-count">
                {scanned.size}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScannedList
              items={items}
              onMarkOutOfPlace={handleMarkOutOfPlace}
              onExternalFind={handleExternalFind}
              onDiscard={handleDiscard}
              onAddIncident={setIncidentTarget}
              onDeclareEstado={handleDeclareEstado}
              onSuggestBaja={setBajaTarget}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCameraActive((v) => !v)}
            data-testid="toggle-camera-btn"
          >
            <PauseIcon />
            {cameraActive ? 'Pausar cámara' : 'Reanudar cámara'}
          </Button>
          <Button type="button" variant="default" className="flex-1" onClick={finishScanning} data-testid="finish-btn">
            <CheckCircle2Icon />
            Finalizar y ver reporte
          </Button>
        </div>

        <IncidentDialog
          open={incidentTarget !== null}
          itemCode={incidentTarget ?? ''}
          itemName={incidentItem?.name ?? ''}
          initialNote={incidentItem?.incidentNote}
          onOpenChange={(open) => {
            if (!open) setIncidentTarget(null);
          }}
          onSave={handleSaveIncident}
        />

        <IncidentDialog
          open={bajaTarget !== null}
          itemCode={bajaTarget ?? ''}
          itemName={bajaItem?.name ?? ''}
          initialNote={bajaItem?.bajaSugerida}
          onOpenChange={(open) => {
            if (!open) setBajaTarget(null);
          }}
          onSave={handleSaveBaja}
          title="Sugerir baja"
          fieldLabel="Motivo de la baja sugerida"
          placeholder="Ej. pantalla rota, no enciende, irreparable..."
          saveLabel="Guardar sugerencia"
          testIdPrefix="baja-sugerida"
        />
      </div>
    );
  }

  // Clases literales completas (Tailwind JIT no resuelve `text-${x}` dinámico).
  const VERDICT_STYLE = {
    exitoso: { box: 'border-success/30 bg-success/10', text: 'text-success' },
    aceptable: { box: 'border-warning/30 bg-warning/10', text: 'text-warning' },
    defectuoso: { box: 'border-destructive/30 bg-destructive/10', text: 'text-destructive' },
  } as const;

  return (
    <Screen title="Resultado del control">
      {/* Veredicto de la sesión (Fase 3.1/DOC-017 2). */}
      <div className={`rounded-2xl border p-5 shadow-elev-1 ${VERDICT_STYLE[verdict].box}`}>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Resultado del control
        </p>
        <p
          className={`mt-1 text-2xl font-bold ${VERDICT_STYLE[verdict].text}`}
          data-testid="report-verdict"
          data-verdict={verdict}
        >
          {VERDICT_LABEL[verdict]}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile value={items.length} label="Escaneados" valueTestId="report-total" />
        <StatTile value={expectedAssets.length} label="Esperados" valueTestId="report-expected" />
        <StatTile value={missingAssets.length} label="Faltantes" tone="warning" valueTestId="report-missing" />
        <StatTile value={correctCount} label="Correctos" tone="success" valueTestId="report-correct" />
        <StatTile value={outOfPlaceCount} label="Fuera de lugar" tone="warning" valueTestId="report-out-of-place" />
        <StatTile value={unregisteredCount} label="No registrados" tone="destructive" valueTestId="report-unregistered" />
        <StatTile value={externalFindCount} label="Externos" valueTestId="report-external-finds" />
        <StatTile value={incidentCount} label="Incidencias" valueTestId="report-incidents" />
      </div>

      <div className="space-y-2">
        <SectionHeader>Detalle (todo lo que no fue correcto)</SectionHeader>
        <div className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
          {nonCorrectItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-1 text-sm" data-testid="report-detail-list">
              {nonCorrectItems.map((item) => (
                <li key={item.code} className="text-destructive">
                  {item.code} – {item.name} · {item.category}
                  {item.incidentNote ? ` · incidencia: ${item.incidentNote}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeader>Activos faltantes (esperados y no escaneados)</SectionHeader>
        <div className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
          {missingAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-1 text-sm" data-testid="report-missing-list">
              {missingAssets.map((asset) => (
                <li key={asset.codigoQr} className="text-warning">
                  {asset.codigoQr} – {asset.nombre}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeader>AFT que no corresponden a esta área</SectionHeader>
        <div className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
          {outOfAreaByArea.size === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-2 text-sm" data-testid="report-out-of-area-list">
              {Array.from(outOfAreaByArea.entries()).map(([areaName, grupo]) => (
                <li key={areaName}>
                  <span className="font-semibold">{areaName}</span>
                  <ul className="ml-4 space-y-0.5">
                    {grupo.map((item) => (
                      <li key={item.code} className="text-warning">
                        {item.code} – {item.name}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          onClick={confirmAndSend}
          disabled={sending || sent}
          data-testid="confirm-send-btn"
        >
          <CheckCircle2Icon />
          {sent ? 'Enviado ✔' : sending ? 'Enviando…' : 'Confirmar y enviar'}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={exportCsv} data-testid="export-csv-btn">
            <DownloadIcon />
            Exportar CSV
          </Button>
          <Button type="button" variant="secondary" className="flex-1" onClick={resetSession} data-testid="reset-btn">
            <RotateCcwIcon />
            Nueva sesión
          </Button>
        </div>
      </div>
    </Screen>
  );
}
