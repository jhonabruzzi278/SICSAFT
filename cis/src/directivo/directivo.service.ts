import { Injectable } from '@nestjs/common';
import { AuditoriaIdentidadService } from '../auditoria-identidad/auditoria-identidad.service';
import { KeycloakAdminService } from '../keycloak-admin/keycloak-admin.service';
import type { GrantUsuario } from '../keycloak-admin/keycloak-admin.types';
import type {
  AsignarProfesionalAftBody,
  AsignarProfesionalAftResult,
} from './directivo.schemas';
import { ADMINISTRADOR_PATRIMONIAL_ROLE } from './directivo.constants';

// DOC-022 3 — reusa KeycloakAdminService tal cual (ADR-004 reemplaza a ZitadelAdminService) sin
// ningún cambio ahí: la única diferencia con AdministradorService es que acá el `organizacionId`
// nunca viene de un parámetro de ruta, lo resuelve DirectivoGuard a partir del propio JWT del
// Directivo (el claim `organization` de Keycloak).
@Injectable()
export class DirectivoService {
  constructor(
    private readonly keycloakAdminService: KeycloakAdminService,
    private readonly auditoriaIdentidad: AuditoriaIdentidadService,
  ) {}

  listarUsuariosOrganizacion(
    organizacionId: string,
    correlationId: string,
  ): Promise<GrantUsuario[]> {
    return this.keycloakAdminService.listarGrants(
      organizacionId,
      correlationId,
    );
  }

  // Gap 3 (flujo real Admin->Directivo->Profesional AFT) — antes exigía que el email ya existiera
  // en el proveedor de identidad (buscarUsuarioPorEmail -> 404 si no). Ahora, si no existe, lo
  // crea (KeycloakAdminService.crearUsuarioHuman, con contraseña inicial generada) antes de
  // asignarle el rol — mismo flujo, un solo paso para el Directivo.
  //
  // DOC-024 3 — envuelto en AuditoriaIdentidadService.ejecutar: mismo motivo que
  // AdministradorService.asignarUsuarioOrganizacion, esto nunca toca CORE.
  async asignarProfesionalAft(
    organizacionId: string,
    body: AsignarProfesionalAftBody,
    operadorId: string,
    correlationId: string,
  ): Promise<AsignarProfesionalAftResult> {
    return this.auditoriaIdentidad.ejecutar(
      'POST /directivo/usuarios',
      operadorId,
      correlationId,
      async () => {
        const usuario = await this.keycloakAdminService.buscarUsuarioPorEmail(
          body.email,
          correlationId,
        );
        if (usuario) {
          await this.keycloakAdminService.crearGrant(
            organizacionId,
            usuario.id,
            ADMINISTRADOR_PATRIMONIAL_ROLE,
            correlationId,
          );
          return { creado: false, passwordInicial: null };
        }
        const { userId, passwordInicial } =
          await this.keycloakAdminService.crearUsuarioHuman(
            body.email,
            correlationId,
          );
        await this.keycloakAdminService.crearGrant(
          organizacionId,
          userId,
          ADMINISTRADOR_PATRIMONIAL_ROLE,
          correlationId,
        );
        return { creado: true, passwordInicial };
      },
      { organizacionId },
    );
  }
}
