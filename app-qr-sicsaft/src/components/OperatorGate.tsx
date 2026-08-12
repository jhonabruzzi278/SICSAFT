import { useState } from 'react';
import { UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OperatorGateProps {
  onContinue: (name: string) => void;
}

export function OperatorGate({ onContinue }: OperatorGateProps) {
  const [name, setName] = useState('');

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onContinue(trimmed);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="size-5 text-brand" />
          Identificar operador
        </CardTitle>
        <CardDescription>Ingresá tu nombre para iniciar un inventario.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Label htmlFor="operator-name-input" className="sr-only">
          Nombre del operador
        </Label>
        <Input
          id="operator-name-input"
          data-testid="operator-name-input"
          placeholder="Ej. Juan Pérez"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          autoComplete="off"
        />
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!name.trim()}
          data-testid="operator-continue-btn"
        >
          Continuar
        </Button>
      </CardContent>
    </Card>
  );
}
