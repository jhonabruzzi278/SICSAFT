import { Injectable, NotFoundException } from '@nestjs/common';
import { ZitadelAdminService } from '../zitadel-admin/zitadel-admin.service';
import type { GrantUsuario } from '../zitadel-admin/zitadel-admin.types';
import type { AsignarProfesionalAftBody } from './directivo.schemas';
import { ADMINISTRADOR_PATRIMONIAL_ROLE } from './directivo.constants';

// DOC-022 3 — reusa ZitadelAdminService tal cual (ya existente desde DOC-021 4, Administrador del
// Sistema) sin ningún cambio ahí: la única diferencia con AdministradorService es que acá el
// `zitadelOrgId` nunca viene de un parámetro de ruta, lo resuelve DirectivoGuard a partir del
// propio JWT del Directivo.
@Injectable()
export class DirectivoService {
  constructor(private readonly zitadelAdminService: ZitadelAdminService) {}

  listarUsuariosOrganizacion(
    zitadelOrgId: string,
    correlationId: string,
  ): Promise<GrantUsuario[]> {
    return this.zitadelAdminService.listarGrants(zitadelOrgId, correlationId);
  }

  async asignarProfesionalAft(
    zitadelOrgId: string,
    body: AsignarProfesionalAftBody,
    correlationId: string,
  ): Promise<void> {
    const usuario = await this.zitadelAdminService.buscarUsuarioPorEmail(
      body.email,
      correlationId,
    );
    if (!usuario) {
      throw new NotFoundException({
        message: `No existe ningún usuario de Zitadel con el email '${body.email}'`,
      });
    }
    await this.zitadelAdminService.crearGrant(
      zitadelOrgId,
      usuario.id,
      ADMINISTRADOR_PATRIMONIAL_ROLE,
      correlationId,
    );
  }
}
