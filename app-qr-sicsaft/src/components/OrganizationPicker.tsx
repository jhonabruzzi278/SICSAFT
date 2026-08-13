import { Building2Icon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OrganizacionSummary } from '@/lib/qr-connector';

interface OrganizationPickerProps {
  organizations: OrganizacionSummary[];
  onSelect: (organization: OrganizacionSummary) => void;
  disabled?: boolean;
}

export function OrganizationPicker({ organizations, onSelect, disabled }: OrganizationPickerProps) {
  function handleValueChange(id: string) {
    const organization = organizations.find((o) => o.id === id);
    if (organization) onSelect(organization);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2Icon className="size-5 text-brand" />
          Seleccionar organización
        </CardTitle>
        <CardDescription>
          {disabled ? 'Cargando catálogo…' : 'Elegí la organización donde vas a inventariar.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleValueChange} disabled={disabled}>
          <SelectTrigger data-testid="organization-select" className="w-full">
            <SelectValue placeholder="Elegí una organización" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((organization) => (
              <SelectItem
                key={organization.id}
                value={organization.id}
                data-testid={`organization-option-${organization.id}`}
              >
                {organization.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
