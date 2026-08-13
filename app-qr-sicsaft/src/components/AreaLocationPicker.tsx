import { useState } from 'react';
import { MapPinIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Organization, OrgArea, OrgLocation } from '@/lib/organizations-data';

interface AreaLocationPickerProps {
  organization: Organization;
  onContinue: (area: OrgArea, location: OrgLocation) => void;
}

export function AreaLocationPicker({ organization, onContinue }: AreaLocationPickerProps) {
  const [area, setArea] = useState<OrgArea | null>(null);
  const [location, setLocation] = useState<OrgLocation | null>(null);

  function handleAreaChange(id: string) {
    const nextArea = organization.areas.find((a) => a.id === id) ?? null;
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
        <Select onValueChange={handleAreaChange} disabled={organization.areas.length === 0}>
          <SelectTrigger data-testid="area-select" className="w-full">
            <SelectValue placeholder="Elegí un área" />
          </SelectTrigger>
          <SelectContent>
            {organization.areas.map((a) => (
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
