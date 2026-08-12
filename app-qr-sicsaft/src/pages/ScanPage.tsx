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
import { OperatorGate } from '@/components/OperatorGate';
import { OrganizationPicker } from '@/components/OrganizationPicker';
import { AreaLocationPicker } from '@/components/AreaLocationPicker';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { initInventoryDb, saveSession } from '@/lib/db';
import { resolveScannedProduct } from '@/lib/scan-resolve';
import { triggerScanFeedback } from '@/lib/scan-feedback';
import { downloadCsv } from '@/lib/csv-export';
import { getStoredOperatorName, setStoredOperatorName } from '@/lib/operator';
import { ORGANIZATIONS, type Organization, type OrgArea, type OrgLocation } from '@/lib/organizations-data';

type View = 'operator' | 'organization' | 'area-location' | 'home' | 'scanning' | 'report';

export function ScanPage() {
  const dbRef = useRef<IDBDatabase | null>(null);
  const scannedCodesRef = useRef<Set<string>>(new Set());
  const startedAtRef = useRef<string>('');
  const [dbReady, setDbReady] = useState(false);
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [area, setArea] = useState<OrgArea | null>(null);
  const [location, setLocation] = useState<OrgLocation | null>(null);
  const [view, setView] = useState<View>('operator');
  const [cameraActive, setCameraActive] = useState(false);
  const [scanned, setScanned] = useState<Map<string, ScannedItem>>(new Map());
  const [manualCode, setManualCode] = useState('');
  const { canInstall, showIosHint, promptInstall } = useInstallPrompt();

  useEffect(() => {
    let cancelled = false;
    initInventoryDb().then((db) => {
      if (cancelled) return;
      dbRef.current = db;
      setDbReady(true);
    });

    const storedOperator = getStoredOperatorName();
    if (storedOperator) {
      setOperatorName(storedOperator);
      setView('organization');
    }

    return () => {
      cancelled = true;
    };
  }, []);

  function handleOperatorContinue(name: string) {
    setStoredOperatorName(name);
    setOperatorName(name);
    setView('organization');
  }

  function handleOrganizationSelect(selected: Organization) {
    setOrganization(selected);
    setArea(null);
    setLocation(null);
    setView('area-location');
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

  async function handleDecode(rawText: string) {
    const db = dbRef.current;
    if (!db) return;
    const code = rawText.trim().toUpperCase();
    if (!code) return;

    if (scannedCodesRef.current.has(code)) {
      toast.warning(`Ya escaneado: ${code}`);
      return;
    }
    scannedCodesRef.current.add(code);

    const { found, name } = await resolveScannedProduct(db, code);
    setScanned((prev) => new Map(prev).set(code, { code, name, found }));
    triggerScanFeedback(found);
    if (found) {
      toast.success(`✔ ${code} — ${name}`);
    } else {
      toast.error(`✖ ${code} — no registrado`);
    }
  }

  function handleManualEntry() {
    if (!manualCode.trim()) return;
    handleDecode(manualCode);
    setManualCode('');
  }

  function startScanning() {
    startedAtRef.current = new Date().toISOString();
    setView('scanning');
    setCameraActive(true);
  }

  async function finishScanning() {
    setCameraActive(false);
    const db = dbRef.current;
    const items = Array.from(scanned.values());
    if (db && operatorName && organization && area && location) {
      await saveSession(db, {
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
        found: items.filter((i) => i.found).length,
        missing: items.filter((i) => !i.found).map(({ code, name }) => ({ code, name })),
        syncStatus: 'local',
      });
    }
    setView('report');
  }

  function resetSession() {
    scannedCodesRef.current.clear();
    setScanned(new Map());
    setView('home');
  }

  function exportCsv() {
    const items = Array.from(scanned.values());
    const rows: (string | number)[][] = [['codigo', 'nombre', 'estado']];
    items.forEach((item) => rows.push([item.code, item.name, item.found ? 'encontrado' : 'no_registrado']));
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadCsv(`qrvault-reporte-${timestamp}.csv`, rows);
  }

  const items = Array.from(scanned.values());
  const foundCount = items.filter((i) => i.found).length;
  const missing = items.filter((i) => !i.found);

  if (view === 'operator') {
    return <OperatorGate onContinue={handleOperatorContinue} />;
  }

  if (view === 'organization') {
    return <OrganizationPicker organizations={ORGANIZATIONS} onSelect={handleOrganizationSelect} />;
  }

  if (view === 'area-location' && organization) {
    return <AreaLocationPicker organization={organization} onContinue={handleAreaLocationContinue} />;
  }

  if (view === 'home') {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLineIcon className="size-5 text-brand" />
              Escanear inventario
            </CardTitle>
            <CardDescription data-testid="session-summary">
              {operatorName} · {organization?.name} · {area?.name} · {location?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button size="lg" onClick={startScanning} disabled={!dbReady} data-testid="start-scan-btn">
              <ScanLineIcon />
              Escanear código QR
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={changeOrganization} data-testid="change-org-btn">
              <PencilIcon />
              Cambiar
            </Button>
          </CardContent>
        </Card>

        {(canInstall || showIosHint) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Instalar APP QR SICSAFT</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>
        )}
      </div>
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
            <ScannedList items={items} />
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
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold" data-testid="report-total">
            {items.length}
          </p>
          <p className="text-sm text-muted-foreground">Escaneados</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-success" data-testid="report-found">
            {foundCount}
          </p>
          <p className="text-sm text-muted-foreground">Encontrados</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-destructive" data-testid="report-missing">
            {missing.length}
          </p>
          <p className="text-sm text-muted-foreground">Fuera de BD</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="text-sm">Productos no registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-destructive" data-testid="report-missing-list">
              {missing.map((item) => (
                <li key={item.code}>
                  {item.code} – {item.name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 md:col-span-3">
        <Button type="button" variant="outline" onClick={exportCsv} data-testid="export-csv-btn">
          <DownloadIcon />
          Exportar CSV
        </Button>
        <Button type="button" onClick={resetSession} data-testid="reset-btn">
          <RotateCcwIcon />
          Nueva sesión
        </Button>
      </div>
    </div>
  );
}
