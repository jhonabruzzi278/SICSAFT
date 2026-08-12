import { Building2Icon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Organization } from '@/lib/organizations-data';

interface OrganizationPickerProps {
  organizations: Organization[];
  onSelect: (organization: Organization) => void;
}

export function OrganizationPicker({ organizations, onSelect }: OrganizationPickerProps) {
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
        <CardDescription>Elegí la organización donde vas a inventariar.</CardDescription>
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleValueChange}>
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
                {organization.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
