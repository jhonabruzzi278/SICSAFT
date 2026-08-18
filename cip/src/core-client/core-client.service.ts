import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOGO_MAX_PAGINAS,
  CATALOGO_PAGE_SIZE,
  CORE_CLIENT_CONFIG,
  SERVICE_TOKEN_HEADER,
} from './core-client.constants';
import type { CoreClientConfig } from './core-client.config';
import type {
  ActivoCatalogo,
  CatalogoPagina,
  SesionDetalle,
} from './core-client.types';

// DOC-018 3 — deliberadamente sin circuit breaker ni retry (a diferencia de
// cis/src/core-client/): CIS los necesita porque multiplexa requests sincronas de usuarios
// reales concurrentes; CIP es un worker de background de un solo consumidor por vez, y BullMQ ya
// da reintentos con backoff a nivel de job si un mensaje falla — agregar una segunda capa de
// resiliencia acá seria redundante (YAGNI, WAF 9).
@Injectable()
export class CoreClientService {
  constructor(
    @Inject(CORE_CLIENT_CONFIG) private readonly config: CoreClientConfig,
  ) {}

  // Itera todas las paginas de GET /catalogo para una organizacion — DOC-018 5.2, volumen bajo
  // en este MVP (mismo criterio que ContratoRepository.findPagina paginando en memoria).
  async obtenerCatalogoCompleto(
    organizacionId: string,
  ): Promise<ActivoCatalogo[]> {
    const activos: ActivoCatalogo[] = [];
    let offset = 0;

    for (let pagina = 0; pagina < CATALOGO_MAX_PAGINAS; pagina += 1) {
      const query = new URLSearchParams({
        organizacionId,
        limit: String(CATALOGO_PAGE_SIZE),
        offset: String(offset),
      });
      const respuesta = await this.fetchJson<CatalogoPagina>(
        `/catalogo?${query.toString()}`,
      );
      activos.push(...respuesta.activos);

      if (respuesta.activos.length === 0 || activos.length >= respuesta.total) {
        return activos;
      }
      offset += CATALOGO_PAGE_SIZE;
    }

    return activos;
  }

  async obtenerInventarioDetalle(sesionId: string): Promise<SesionDetalle> {
    return this.fetchJson<SesionDetalle>(
      `/inventarios/${encodeURIComponent(sesionId)}`,
    );
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const respuesta = await fetch(`${this.config.baseUrl}${path}`, {
      headers: { [SERVICE_TOKEN_HEADER]: this.config.serviceToken },
    });
    if (!respuesta.ok) {
      throw new Error(
        `CORE respondió ${respuesta.status} en ${path} (${await respuesta.text()})`,
      );
    }
    return (await respuesta.json()) as T;
  }
}
