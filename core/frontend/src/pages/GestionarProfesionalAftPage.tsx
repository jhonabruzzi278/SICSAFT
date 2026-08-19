import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cisClient, CisApiError, type UsuarioOrganizacion } from '@/lib/cis-client';
import { Alert, Badge, Button, Card, FieldError, Input, Label } from '@/components/ui';

// DOC-022 3 — designar quién es el Profesional de AFT (administrador-patrimonial) de la propia
// organización del Directivo. Sin selector de organización (a diferencia de la sección análoga en
// web_admin/AdminPage.tsx): DirectivoGuard en CIS deriva siempre la organización del propio JWT,
// nunca de lo que mande este formulario — por eso tampoco hay un campo `rol`, el único rol
// asignable desde acá está fijo en el servicio.
const asignarProfesionalAftSchema = z.object({
  email: z.string().email('Email inválido'),
});
type AsignarProfesionalAftForm = z.infer<typeof asignarProfesionalAftSchema>;

function errorDeCisApi(err: unknown, accion: string): string {
  if (err instanceof CisApiError && err.status === 403) {
    return `No tenés el rol directivo necesario para ${accion}.`;
  }
  if (err instanceof CisApiError && err.status === 404) {
    return err.message;
  }
  return err instanceof Error ? err.message : 'Error desconocido';
}

export function GestionarProfesionalAftPage() {
  const [usuarios, setUsuarios] = useState<UsuarioOrganizacion[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AsignarProfesionalAftForm>({ resolver: zodResolver(asignarProfesionalAftSchema) });

  function cargarUsuarios() {
    setListError(null);
    cisClient
      .getUsuariosDirectivo()
      .then(setUsuarios)
      .catch((err: unknown) => setListError(errorDeCisApi(err, 'ver los usuarios')));
  }

  useEffect(cargarUsuarios, []);

  async function onSubmit(values: AsignarProfesionalAftForm) {
    setSubmitError(null);
    setSubmitOk(false);
    try {
      await cisClient.asignarProfesionalAft(values.email);
      setSubmitOk(true);
      reset();
      cargarUsuarios();
    } catch (err: unknown) {
      setSubmitError(errorDeCisApi(err, 'designar al Profesional de AFT'));
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-accent-strong">Profesional de AFT</h1>
      <p className="mb-6 text-sm text-text-dim">
        Designá quién carga y mantiene la información patrimonial de tu organización en CCP.
        Nunca información patrimonial en sí (Activos/Catálogo/Documentos, exclusivo de CCP).
      </p>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {listError && <Alert>{listError}</Alert>}
          {!listError && !usuarios && <p className="text-text-dim">Cargando…</p>}
          {usuarios?.length === 0 && (
            <p className="text-text-dim">Sin usuarios asignados en tu organización todavía.</p>
          )}
          {usuarios && usuarios.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-raised text-text-dim">
                  <tr>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Roles</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.userId} className="border-t border-border">
                      <td className="px-4 py-2">{usuario.email ?? usuario.userId}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {usuario.roles.map((rol) => (
                            <Badge key={rol}>{rol}</Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Card className="h-fit">
          <h3 className="mb-4 font-medium text-text">Designar Profesional de AFT</h3>
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
            <div>
              <Label htmlFor="profesional-email">Email (usuario ya existente en Zitadel)</Label>
              <Input id="profesional-email" type="email" {...register('email')} />
              <FieldError>{errors.email?.message}</FieldError>
            </div>
            {submitError && <Alert>{submitError}</Alert>}
            {submitOk && <Alert variant="success">Profesional de AFT designado.</Alert>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Designando…' : 'Designar'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
