import { Injectable } from '@nestjs/common';
import { AuditoriaIdentidadService } from '../auditoria-identidad/auditoria-identidad.service';
import { ZitadelAdminService } from '../zitadel-admin/zitadel-admin.service';
import type { GrantUsuario } from '../zitadel-admin/zitadel-admin.types';
import type {
  AsignarProfesionalAftBody,
  AsignarProfesionalAftResult,
} from './directivo.schemas';
import { ADMINISTRADOR_PATRIMONIAL_ROLE } from './directivo.constants';

// DOC-022 3 — reusa ZitadelAdminService tal cual (ya existente desde DOC-021 4, Administrador del
// Sistema) sin ningún cambio ahí: la única diferencia con AdministradorService es que acá el
// `zitadelOrgId` nunca viene de un parámetro de ruta, lo resuelve DirectivoGuard a partir del
// propio JWT del Directivo.
@Injectable()
export class DirectivoService {
  constructor(
    private readonly zitadelAdminService: ZitadelAdminService,
    private readonly auditoriaIdentidad: AuditoriaIdentidadService,
  ) {}

  listarUsuariosOrganizacion(
    zitadelOrgId: string,
    correlationId: string,
  ): Promise<GrantUsuario[]> {
    return this.zitadelAdminService.listarGrants(zitadelOrgId, correlationId);
  }

  // Gap 3 (flujo real Admin->Directivo->Profesional AFT) — antes exigía que el email ya existiera
  // en Zitadel (buscarUsuarioPorEmail -> 404 si no). Ahora, si no existe, lo crea
  // (ZitadelAdminService.crearUsuarioHuman, con contraseña inicial generada) antes de asignarle
  // el rol — mismo flujo, un solo paso para el Directivo.
  //
  // DOC-024 3 — envuelto en AuditoriaIdentidadService.ejecutar: mismo motivo que
  // AdministradorService.asignarUsuarioOrganizacion, esto nunca toca CORE. `organizacionId` se
  // reporta como el `zitadelOrgId` recibido — para organizaciones creadas via Gap 1 este YA ES
  // el id de CORE (mismo valor); para la organización sembrada (id de CORE distinto del real de
  // Zitadel) el registro de auditoría degrada con gracia a `organizacionId: null`
  // (AuditoriaRepository.registrar, ver DOC-024 3) en vez de fallar — sin necesidad de inyectar
  // aquí el mapeo dinámico que sólo usa AdministradorService.
  async asignarProfesionalAft(
    zitadelOrgId: string,
    body: AsignarProfesionalAftBody,
    operadorId: string,
    correlationId: string,
  ): Promise<AsignarProfesionalAftResult> {
    return this.auditoriaIdentidad.ejecutar(
      'POST /directivo/usuarios',
      operadorId,
      correlationId,
      async () => {
        const usuario = await this.zitadelAdminService.buscarUsuarioPorEmail(
          body.email,
          correlationId,
        );
        if (usuario) {
          await this.zitadelAdminService.crearGrant(
            zitadelOrgId,
            usuario.id,
            ADMINISTRADOR_PATRIMONIAL_ROLE,
            correlationId,
          );
          return { creado: false, passwordInicial: null };
        }
        const { userId, passwordInicial } =
          await this.zitadelAdminService.crearUsuarioHuman(
            body.email,
            correlationId,
          );
        await this.zitadelAdminService.crearGrant(
          zitadelOrgId,
          userId,
          ADMINISTRADOR_PATRIMONIAL_ROLE,
          correlationId,
        );
        return { creado: true, passwordInicial };
      },
      { organizacionId: zitadelOrgId },
    );
  }
}
