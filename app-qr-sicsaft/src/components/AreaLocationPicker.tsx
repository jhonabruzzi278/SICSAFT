import { useMemo, useState } from 'react';
import { MapPinIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Organization, OrgArea, OrgLocation } from '@/lib/organizations-data';

interface AreaLocationPickerProps {
  organization: Organization;
  onContinue: (area: OrgArea, location: OrgLocation) => void;
}

const SIN_DIRECCION = '__sin-direccion__';

// DOC-033 — agrupa las áreas por "Dirección" (`OrgArea.direccion`, texto libre opcional). Si
// ninguna área de la organización tiene Dirección cargada (cliente simple), no hay nada que
// agrupar: el picker se queda en un solo nivel (Área→Ubicación), igual que antes de este cambio.
function agruparPorDireccion(areas: OrgArea[]): { id: string; name: string; areas: OrgArea[] }[] {
  const direcciones = new Map<string, { id: string; name: string; areas: OrgArea[] }>();
  for (const area of areas) {
    const clave = area.direccion ?? SIN_DIRECCION;
    let grupo = direcciones.get(clave);
    if (!grupo) {
      grupo = {
        id: clave,
        name: area.direccion ?? 'Sin dirección',
        areas: [],
      };
      direcciones.set(clave, grupo);
    }
    grupo.areas.push(area);
  }
  return Array.from(direcciones.values());
}

export function AreaLocationPicker({ organization, onContinue }: AreaLocationPickerProps) {
  const direcciones = useMemo(() => agruparPorDireccion(organization.areas), [organization.areas]);
  // Solo hay Dirección que elegir si al menos un área la tiene cargada — el bucket "Sin
  // dirección" nunca aparece solo.
  const usaDireccion = direcciones.some((d) => d.id !== SIN_DIRECCION);

  const [direccionId, setDireccionId] = useState<string | null>(null);
  const [area, setArea] = useState<OrgArea | null>(null);
  const [location, setLocation] = useState<OrgLocation | null>(null);

  const areasDisponibles = usaDireccion
    ? (direcciones.find((d) => d.id === direccionId)?.areas ?? [])
    : organization.areas;

  function handleDireccionChange(id: string) {
    setDireccionId(id);
    setArea(null);
    setLocation(null);
  }

  function handleAreaChange(id: string) {
    const nextArea = areasDisponibles.find((a) => a.id === id) ?? null;
    setArea(nextArea);
    setLocation(null);
  }

  function handleLocationChange(id: string) {
    const nextLocation = area?.locations.find((l) => l.id === id) ?? null;
    setLocation(nextLocation);
  }

  function handleSubmit() {
    if (!area || !location) return;
    onContinue(area, location);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPinIcon className="size-5 text-brand" />
          Seleccionar área y ubicación
        </CardTitle>
        <CardDescription>{organization.name}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {organization.areas.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="no-areas-message">
            Esta organización todavía no tiene catálogo cargado en CORE — no hay áreas para
            elegir.
          </p>
        )}

        {usaDireccion && (
          <Select onValueChange={handleDireccionChange} disabled={organization.areas.length === 0}>
            <SelectTrigger data-testid="direccion-select" className="w-full">
              <SelectValue placeholder="Elegí una dirección" />
            </SelectTrigger>
            <SelectContent>
              {direcciones.map((d) => (
                <SelectItem key={d.id} value={d.id} data-testid={`direccion-option-${d.id}`}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          onValueChange={handleAreaChange}
          disabled={usaDireccion ? !direccionId : organization.areas.length === 0}
          value={area?.id}
        >
          <SelectTrigger data-testid="area-select" className="w-full">
            <SelectValue placeholder="Elegí un área" />
          </SelectTrigger>
          <SelectContent>
            {areasDisponibles.map((a) => (
              <SelectItem key={a.id} value={a.id} data-testid={`area-option-${a.id}`}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={handleLocationChange} disabled={!area} value={location?.id}>
          <SelectTrigger data-testid="location-select" className="w-full">
            <SelectValue placeholder="Elegí una ubicación" />
          </SelectTrigger>
          <SelectContent>
            {area?.locations.map((l) => (
              <SelectItem key={l.id} value={l.id} data-testid={`location-option-${l.id}`}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!area || !location}
          data-testid="area-location-continue-btn"
        >
          Continuar
        </Button>
      </CardContent>
    </Card>
  );
}
