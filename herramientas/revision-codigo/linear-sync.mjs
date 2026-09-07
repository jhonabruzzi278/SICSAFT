#!/usr/bin/env node
/**
 * SICSAFT — Sincronización Integral con Linear (CLI y GraphQL API)
 *
 * Exporta y organiza todo el proyecto SICSAFT en Linear:
 * - Proyectos por área temática (Arquitectura, Backend, Frontends, CIP, .EXE On-Premise, Futuro)
 * - Labels por subsistema, tipo y prioridad
 * - Issues estructurados con estado real (Done / Todo), evidencia técnica y dependencias
 *
 * Uso:
 *   node herramientas/revision-codigo/linear-sync.mjs --teams
 *   node herramientas/revision-codigo/linear-sync.mjs --dry-run
 *   node herramientas/revision-codigo/linear-sync.mjs --team-key JON --apply
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RAIZ = join(__dirname, '../..');

const LINEAR_GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql';
const API_KEY = process.env.LINEAR_API_KEY;

const SEVERIDAD_A_PRIORIDAD = {
  critica: 1,
  alta: 2,
  media: 3,
  baja: 4,
  info: 0,
};

async function linearQuery(query, variables = {}) {
  if (!API_KEY) {
    throw new Error('Falta la variable de entorno LINEAR_API_KEY.');
  }

  const res = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await res.json();
  if (body.errors && body.errors.length > 0) {
    throw new Error(`Error de Linear GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
  }
  return body.data;
}

function leerJson(rel) {
  const ruta = join(RAIZ, rel);
  if (!existsSync(ruta)) return null;
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

async function listarEquipos() {
  const data = await linearQuery(`
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `);
  return data.teams.nodes;
}

async function obtenerEstadosDeEquipo(teamId) {
  const data = await linearQuery(
    `
    query ($teamId: String!) {
      team(id: $teamId) {
        states {
          nodes {
            id
            name
            type
          }
        }
      }
    }
  `,
    { teamId }
  );
  return data.team.states.nodes;
}

async function obtenerLabelsDeEquipo(teamId) {
  const data = await linearQuery(
    `
    query {
      issueLabels {
        nodes {
          id
          name
        }
      }
    }
  `
  );
  return data.issueLabels?.nodes || [];
}

async function crearLabelSiNoExiste(teamId, nombre, color = '#2563EB') {
  const labels = await obtenerLabelsDeEquipo(teamId);
  const existente = labels.find((l) => l.name.toLowerCase() === nombre.toLowerCase());
  if (existente) return existente.id;

  try {
    const data = await linearQuery(
      `
      mutation ($teamId: String!, $name: String!, $color: String!) {
        issueLabelCreate(input: { teamId: $teamId, name: $name, color: $color }) {
          issueLabel {
            id
            name
          }
        }
      }
    `,
      { teamId, name: nombre, color }
    );
    return data.issueLabelCreate?.issueLabel?.id;
  } catch (err) {
    // Si ya existe a nivel workspace/organización, buscarlo nuevamente
    const freshLabels = await obtenerLabelsDeEquipo(teamId);
    const found = freshLabels.find((l) => l.name.toLowerCase() === nombre.toLowerCase());
    if (found) return found.id;
    return null;
  }
}

async function obtenerProyectosDeEquipo(teamId) {
  const data = await linearQuery(
    `
    query ($teamId: String!) {
      team(id: $teamId) {
        projects {
          nodes {
            id
            name
          }
        }
      }
    }
  `,
    { teamId }
  );
  return data.team.projects.nodes;
}

async function crearProyectoSiNoExiste(teamId, nombre, descripcion = '') {
  const proyectos = await obtenerProyectosDeEquipo(teamId);
  const existente = proyectos.find((p) => p.name.toLowerCase() === nombre.toLowerCase());
  if (existente) return existente.id;

  const data = await linearQuery(
    `
    mutation ($name: String!, $teamIds: [String!]!, $description: String) {
      projectCreate(input: { name: $name, teamIds: $teamIds, description: $description }) {
        project {
          id
          name
        }
      }
    }
  `,
    { name: nombre, teamIds: [teamId], description: descripcion }
  );
  return data.projectCreate.project.id;
}

async function obtenerIniciativas() {
  try {
    const data = await linearQuery(`
      query {
        initiatives {
          nodes {
            id
            name
          }
        }
      }
    `);
    return data.initiatives?.nodes || [];
  } catch {
    return [];
  }
}

async function crearIniciativaSiNoExiste(nombre, descripcion = '', color = '#0284C7') {
  const iniciativas = await obtenerIniciativas();
  const existente = iniciativas.find((i) => i.name.toLowerCase() === nombre.toLowerCase());
  if (existente) return existente.id;

  try {
    const data = await linearQuery(
      `
      mutation ($name: String!, $description: String, $color: String) {
        initiativeCreate(input: { name: $name, description: $description, color: $color }) {
          initiative {
            id
            name
          }
        }
      }
    `,
      { name: nombre, description: descripcion, color }
    );
    return data.initiativeCreate?.initiative?.id;
  } catch (err) {
    return null;
  }
}

async function asociarProyectoAIniciativa(initiativeId, projectId) {
  if (!initiativeId || !projectId) return;
  try {
    await linearQuery(
      `
      mutation ($initiativeId: String!, $projectId: String!) {
        initiativeToProjectCreate(input: { initiativeId: $initiativeId, projectId: $projectId }) {
          initiativeToProject {
            id
          }
        }
      }
    `,
      { initiativeId, projectId }
    );
  } catch {
    // Si ya está asociado, se ignora
  }
}

async function obtenerMilestonesDeProyecto(projectId) {
  try {
    const data = await linearQuery(
      `
      query ($projectId: String!) {
        project(id: $projectId) {
          projectMilestones {
            nodes {
              id
              name
            }
          }
        }
      }
    `,
      { projectId }
    );
    return data.project?.projectMilestones?.nodes || [];
  } catch {
    return [];
  }
}

async function crearMilestoneSiNoExiste(projectId, nombre, descripcion = '') {
  const milestones = await obtenerMilestonesDeProyecto(projectId);
  const existente = milestones.find((m) => m.name.toLowerCase() === nombre.toLowerCase());
  if (existente) return existente.id;

  try {
    const data = await linearQuery(
      `
      mutation ($projectId: String!, $name: String!, $description: String) {
        projectMilestoneCreate(input: { projectId: $projectId, name: $name, description: $description }) {
          projectMilestone {
            id
            name
          }
        }
      }
    `,
      { projectId, name: nombre, description: descripcion }
    );
    return data.projectMilestoneCreate?.projectMilestone?.id;
  } catch (err) {
    return null;
  }
}

async function agregarLinkAProyectoSiNoExiste(projectId, url, label) {
  try {
    await linearQuery(
      `
      mutation ($projectId: String!, $url: String!, $label: String!) {
        entityExternalLinkCreate(input: { projectId: $projectId, url: $url, label: $label }) {
          entityExternalLink {
            id
          }
        }
      }
    `,
      { projectId, url, label }
    );
  } catch {
    // Si ya existe o falla, se ignora
  }
}

async function obtenerIssuesExistentes(teamId) {
  const data = await linearQuery(
    `
    query ($teamId: String!) {
      team(id: $teamId) {
        issues(first: 250) {
          nodes {
            id
            identifier
            title
            state {
              id
              name
              type
            }
          }
        }
      }
    }
  `,
    { teamId }
  );
  return data.team.issues.nodes;
}

async function crearOActualizarIssue(teamId, projectId, stateId, labelIds, titulo, descripcion, prioridad = 0, projectMilestoneId = null) {
  const issues = await obtenerIssuesExistentes(teamId);
  const clavePrefijo = titulo.split(':')[0].trim();
  const existente = issues.find((i) => i.title.trim().startsWith(clavePrefijo));

  const input = {
    title: titulo,
    description: descripcion,
    stateId,
    labelIds,
    priority: prioridad,
  };
  if (projectId) input.projectId = projectId;
  if (projectMilestoneId) input.projectMilestoneId = projectMilestoneId;

  if (existente) {
    await linearQuery(
      `
      mutation ($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          issue {
            id
            identifier
          }
        }
      }
    `,
      { id: existente.id, input }
    );
    return { accion: 'actualizado', identifier: existente.identifier };
  } else {
    input.teamId = teamId;
    const data = await linearQuery(
      `
      mutation ($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          issue {
            id
            identifier
          }
        }
      }
    `,
      { input }
    );
    return { accion: 'creado', identifier: data.issueCreate.issue.identifier };
  }
}

// Estructura completa del Proyecto SICSAFT con Iniciativas, Milestones y Enlaces de Recursos
const INICIATIVAS_DEF = [
  {
    nombre: 'SICSAFT v1.0 — Núcleo y Operación On-Premise',
    descripcion: 'Plataforma base MVP: Arquitectura de backend CIS+CORE, base patrimonial BPI, frontends CCP+APP QR y empaquetado .EXE / DevOps.',
    color: '#0284C7',
  },
  {
    nombre: 'SICSAFT v2.0 — Inteligencia Patrimonial e Integraciones',
    descripcion: 'Módulos avanzados: Analítica decisional CIP, dashboards directivos, hardware RFID y conectores contables institucionales.',
    color: '#8B5CF6',
  },
];

const ESTRUCTURA_PROYECTOS = [
  {
    clave: 'AUDIT',
    nombre: 'SICSAFT - 01. Auditoría y Calidad (DOC-032)',
    descripcion: 'Hallazgos de revisión arquitectónica, consistencia de stack e inventario técnico.',
    iniciativa: 'SICSAFT v1.0 — Núcleo y Operación On-Premise',
    esAudit: true,
    milestones: [
      { nombre: 'v1.0.0 — Auditoría Base Resuelta', descripcion: 'Hallazgos resueltos de stack y comentarios' },
      { nombre: 'v1.1.0 — Blindaje y Calidad Final', descripcion: 'Duplicación PKCE, tests de contrato y densidad de comentarios' },
    ],
    links: [
      { label: 'DOC-032 Contrato de Inspección Profunda', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/documentacion/auditoria/DOC-032-CONTRATO-INSPECCION-PROFUNDA.md' },
      { label: 'Estado de Revisión JSON', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/herramientas/revision-codigo/estado-revision.json' },
    ],
  },
  {
    clave: 'BACKEND',
    nombre: 'SICSAFT - 02. Núcleo Backend (CIS + CORE + BPI)',
    descripcion: 'Centro de Interoperabilidad (API Gateway OIDC Keycloak 26) y Motor Patrimonial CORE con BPI PostgreSQL.',
    iniciativa: 'SICSAFT v1.0 — Núcleo y Operación On-Premise',
    milestones: [
      { nombre: 'v1.0.0 — Motor Patrimonial BPI', descripcion: 'Catálogo, orquestación, reglas y entitlements de contratos' },
    ],
    links: [
      { label: 'DOC-005 Modelo Patrimonial BPI', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/base-patrimonial/DOC-005-modelo-patrimonial.md' },
      { label: 'DOC-004 Modelo de Contrato y Entitlements', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/base-patrimonial/DOC-004-modelo-contrato.md' },
      { label: 'Arquitectura CORE NestJS', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/aidlc-docs/core/design-artifacts/ARCHITECTURE.md' },
    ],
    tareas: [
      { id: 'CIS-01', titulo: 'API Gateway & Autenticación Keycloak 26 OIDC/PKCE', desc: 'Validación de JWT, roles por organización y proxy seguro.', estado: 'done', prio: 2, sistema: 'cis', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
      { id: 'CIS-02', titulo: 'Conectores de Captura QR, Dashboard, Directivo y Admin', desc: 'Endpoints expuestos para clientes móviles, web y analítica.', estado: 'done', prio: 2, sistema: 'cis', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
      { id: 'CIS-03', titulo: 'Rate Limiting en Memoria y Circuit Breaker', desc: 'Resiliencia inter-servicios y protección contra saturación.', estado: 'done', prio: 3, sistema: 'cis', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
      { id: 'CORE-01', titulo: 'Persistencia PostgreSQL y Esquema Versionado', desc: 'Migraciones node-pg-migrate y aislamiento de base de datos.', estado: 'done', prio: 1, sistema: 'core', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
      { id: 'CORE-02', titulo: 'Entitlements y Máquina de Estados de Contratos', desc: 'Resolución de contratos activos por organización y sede (DOC-004).', estado: 'done', prio: 2, sistema: 'core', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
      { id: 'CORE-03', titulo: 'Modelo Patrimonial Esencial y 11 Dominios BPI', desc: 'Tablas de activos, áreas, ubicaciones, responsables y catálogo (DOC-005).', estado: 'done', prio: 1, sistema: 'core', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
      { id: 'CORE-04', titulo: 'Motor de Orquestación Patrimonial (MOP) y Reglas CFPS', desc: 'Validación estricta de reglas de negocio antes de modificar BPI.', estado: 'done', prio: 1, sistema: 'core', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
      { id: 'CORE-05', titulo: 'Ingesta y Veredicto de Inventarios ("Pantalla 8")', desc: 'Procesamiento de sesiones de escaneo y cálculo de veredicto (DOC-029 RF-I).', estado: 'done', prio: 2, sistema: 'core', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
      { id: 'CORE-06', titulo: 'Altas, Bajas, Reincorporaciones e Importación Staging', desc: 'Escritura oficial patrimonial y bandeja de revisión Excel.', estado: 'done', prio: 2, sistema: 'core', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
      { id: 'CORE-07', titulo: 'Motor de Auditoría Inmutable y Trazabilidad Transversal', desc: 'Registro permanente de eventos de seguridad y operaciones.', estado: 'done', prio: 1, sistema: 'core', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
      { id: 'CORE-08', titulo: 'Separación de Roles Keycloak: Supervisor Patrimonial y Auditor', desc: 'Roles diferenciados de auditoría solo-lectura y supervisión patrimonial (DOC-029).', estado: 'todo', prio: 3, sistema: 'core', milestone: 'v1.0.0 — Motor Patrimonial BPI' },
    ],
  },
  {
    clave: 'FRONTEND',
    nombre: 'SICSAFT - 03. Portales Web y Captura (CCP + APP QR)',
    descripcion: 'Centro de Control Patrimonial (Web React/Vite) y Aplicación Móvil PWA/APK de Captura.',
    iniciativa: 'SICSAFT v1.0 — Núcleo y Operación On-Premise',
    milestones: [
      { nombre: 'v1.0.0 — Portales Web y Móvil Operativos', descripcion: 'CCP completo y app de captura PWA de 8 pasos' },
      { nombre: 'v1.1.0 — Validación en Terreno Físico', descripcion: 'Pruebas de cámara y validación en hardware Android real' },
    ],
    links: [
      { label: 'DOC-001 Flujo Oficial de Captura QR', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/aidlc-docs/app-qr-sicsaft/design-artifacts/DOC-001-flujo-oficial.md' },
      { label: 'DOC-029 Endurecimiento CCP Cliente Real', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md' },
      { label: 'Casos de Uso del Profesional AFT', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/casos-de-uso/README.md' },
    ],
    tareas: [
      { id: 'CCP-01', titulo: 'Gestión de Activos Fijos Tangibles (CRUD, Bajas, Estados)', desc: 'Ficha integral del activo, cambios de estado y trazabilidad.', estado: 'done', prio: 2, sistema: 'ccp', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'CCP-02', titulo: 'Estructura Organizacional (Áreas, Ubicaciones, Responsables)', desc: 'Catálogos institucionales y asignación de custodios.', estado: 'done', prio: 2, sistema: 'ccp', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'CCP-03', titulo: 'Ingesta y Revisión de Planillas Excel Supervisada (RF-B)', desc: 'Bandeja de staging para aprobación de cargas masivas contables.', estado: 'done', prio: 2, sistema: 'ccp', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'CCP-04', titulo: 'Módulo de Etiquetas y Generación de Códigos QR (RF-F)', desc: 'Impresión y acuñación de identificadores patrimoniales.', estado: 'done', prio: 3, sistema: 'ccp', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'CCP-05', titulo: 'Visor de Sesiones de Control y Auditoría Operativa (RF-E)', desc: 'Monitoreo de inventarios ejecutados en terreno.', estado: 'done', prio: 3, sistema: 'ccp', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'CCP-06', titulo: 'Segmentación por Rol Directivo y Profesional AFT', desc: 'Control de acceso basado en roles Keycloak 26 (DOC-022).', estado: 'done', prio: 2, sistema: 'core-frontend', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'CCP-07', titulo: 'Veredicto de Sesión Accionable y Auto-Auditoría', desc: 'Deep links del resumen a auditoría/inventario y registro automático de incidencias.', estado: 'todo', prio: 2, sistema: 'ccp', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'QR-01', titulo: 'Flujo Oficial de Captura de 8 Pasos (DOC-001)', desc: 'Identificación, escaneo QR, validación y registro de incidencias.', estado: 'done', prio: 2, sistema: 'app-qr', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'QR-02', titulo: 'Conector QR y Sincronización HTTP con CIS (DOC-002)', desc: 'Cliente HTTP contra API oficial con autenticación OIDC.', estado: 'done', prio: 2, sistema: 'app-qr', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'QR-03', titulo: 'Modo Offline con IndexedDB y Cola de Reintentos', desc: 'Resiliencia para operación en terreno sin cobertura de red.', estado: 'done', prio: 2, sistema: 'app-qr', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'QR-04', titulo: 'Auditoría Local Inmutable con correlationId', desc: 'Registro inmutable en el dispositivo móvil.', estado: 'done', prio: 3, sistema: 'app-qr', milestone: 'v1.0.0 — Portales Web y Móvil Operativos' },
      { id: 'QR-05', titulo: 'Prueba en Dispositivo Físico Android y Validación de Cámara', desc: 'Validación en terreno de cámara, escáner y PWA instalada en teléfonos reales (P0 Demo).', estado: 'todo', prio: 1, sistema: 'app-qr', milestone: 'v1.1.0 — Validación en Terreno Físico' },
    ],
  },
  {
    clave: 'CIP',
    nombre: 'SICSAFT - 04. Inteligencia Patrimonial (CIP)',
    descripcion: 'Centro de Inteligencia Patrimonial, worker de agregación y métricas analíticas.',
    iniciativa: 'SICSAFT v2.0 — Inteligencia Patrimonial e Integraciones',
    milestones: [
      { nombre: 'v1.0.0 — Worker y Dashboards Básicos', descripcion: 'Agregación pg-boss y métricas de inventario' },
      { nombre: 'v2.0.0 — Analítica Predictiva y Riesgo', descripcion: 'Detección avanzada de inconsistencias y alertas patrimoniales' },
    ],
    links: [
      { label: 'DOC-026 CIP Inteligencia Decisional', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/aidlc-docs/cip/design-artifacts/DOC-026-cip-inteligencia-decisional.md' },
      { label: 'Arquitectura CIP Worker y Outbox', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/aidlc-docs/cip/design-artifacts/ARCHITECTURE.md' },
    ],
    tareas: [
      { id: 'CIP-01', titulo: 'Worker de Agregación Asíncrona con PostgreSQL pg-boss', desc: 'Procesamiento desacoplado de eventos patrimoniales vía colas.', estado: 'done', prio: 2, sistema: 'cip', milestone: 'v1.0.0 — Worker y Dashboards Básicos' },
      { id: 'CIP-02', titulo: 'Métricas de Rendimiento, Veredictos y Estados', desc: 'Cálculo analítico de cobertura de inventario y estado de bienes.', estado: 'done', prio: 2, sistema: 'cip', milestone: 'v1.0.0 — Worker y Dashboards Básicos' },
      { id: 'CIP-03', titulo: 'API de Dashboards e Indicadores para Rol Directivo', desc: 'Servicio de analítica consumido por el portal directivo.', estado: 'done', prio: 2, sistema: 'cip', milestone: 'v1.0.0 — Worker y Dashboards Básicos' },
      { id: 'CIP-04', titulo: 'Alertas Analíticas y Detección de Inconsistencias', desc: 'Motor predictivo y avisos de desvíos patrimoniales (Fase 9 / DOC-026).', estado: 'todo', prio: 3, sistema: 'cip', milestone: 'v2.0.0 — Analítica Predictiva y Riesgo' },
      { id: 'CIP-05', titulo: 'Arranque Condicional y Degradación Elegante Nivel 1 sin CIP', desc: 'CIS degrada limpiamente si CIP no está desplegado en Nivel 1, optimizando recursos del .exe cliente.', estado: 'done', prio: 2, sistema: 'cis', milestone: 'v1.0.0 — Worker y Dashboards Básicos' },
      { id: 'CIP-06', titulo: 'Evolución Patrimonial Temporal y Score de Riesgo (RF-15/RF-16)', desc: 'Serie temporal de patrimonio y matriz explicable de riesgo por activo (DOC-026).', estado: 'todo', prio: 3, sistema: 'cip', milestone: 'v2.0.0 — Analítica Predictiva y Riesgo' },
    ],
  },
  {
    clave: 'ENTREGABLE',
    nombre: 'SICSAFT - 05. Entregable y DevOps (.EXE On-Premise)',
    descripcion: 'App de escritorio nativa (.EXE) con procesos embebidos y stack Podman on-premise.',
    iniciativa: 'SICSAFT v1.0 — Núcleo y Operación On-Premise',
    milestones: [
      { nombre: 'v1.0.0 — Instalador .EXE y Runbook', descripcion: 'Binario único Electron con Postgres, Keycloak 26 y servicios embebidos' },
      { nombre: 'v1.1.0 — Certificación en VM Limpia', descripcion: 'Pruebas E2E de instalación en entorno virgen Windows' },
    ],
    links: [
      { label: 'Manual de Despliegue On-Premise', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/devops/onprem/MANUAL-DESPLIEGUE.md' },
      { label: 'Runbook de Instalación .EXE', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/sicsaft-core/RUNBOOK-INSTALACION.md' },
      { label: 'DOC-030 Selector de Nivel 1/2 en .EXE', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/aidlc-docs/sicsaft-core/design-artifacts/DOC-030-nivel-2-en-sicsaft-core-exe.md' },
    ],
    tareas: [
      { id: 'EXE-01', titulo: 'Arquitectura Multi-Proceso Electron Embebida', desc: 'PostgreSQL, Keycloak 26, CIS, CORE y CIP corriendo nativamente.', estado: 'done', prio: 1, sistema: 'sicsaft-core', milestone: 'v1.0.0 — Instalador .EXE y Runbook' },
      { id: 'EXE-02', titulo: 'Wizard de Primer Arranque y Bootstrap de Keycloak', desc: 'Aprovisionamiento automático de organizaciones, roles y usuarios.', estado: 'done', prio: 2, sistema: 'sicsaft-core', milestone: 'v1.0.0 — Instalador .EXE y Runbook' },
      { id: 'EXE-03', titulo: 'Consola Técnica de Diagnóstico y Logs en Pantalla', desc: 'Visualización de logs de procesos y diagnóstico en vivo.', estado: 'done', prio: 3, sistema: 'sicsaft-core', milestone: 'v1.0.0 — Instalador .EXE y Runbook' },
      { id: 'EXE-04', titulo: 'Servidor de Portales Embebidos y Servido PWA QR por LAN', desc: 'Acceso a terminales móviles desde la red local.', estado: 'done', prio: 2, sistema: 'sicsaft-core', milestone: 'v1.0.0 — Instalador .EXE y Runbook' },
      { id: 'EXE-05', titulo: 'Watcher de Ingesta Automática de Carpetas de Red', desc: 'Vigilancia de archivos Excel contables y ejecución de ETL.', estado: 'done', prio: 2, sistema: 'sicsaft-core', milestone: 'v1.0.0 — Instalador .EXE y Runbook' },
      { id: 'EXE-06', titulo: 'Empaquetado de Instalador Windows Inno Setup (.iss)', desc: 'Instalador desatendido para infraestructura on-premise.', estado: 'done', prio: 2, sistema: 'devops', milestone: 'v1.0.0 — Instalador .EXE y Runbook' },
      { id: 'EXE-07', titulo: 'Verificación E2E de Instalador .EXE en VM Windows Limpia', desc: 'Prueba de instalación completa desde cero en máquina limpia sin herramientas de desarrollo (INST-1 / P0 Demo).', estado: 'todo', prio: 1, sistema: 'sicsaft-core', milestone: 'v1.1.0 — Certificación en VM Limpia' },
      { id: 'EXE-08', titulo: 'Firma de Código del Instalador Windows (SmartScreen OV/EV)', desc: 'Certificado digital de firma de ejecutables para eliminar alertas de Windows Defender en clientes finales (INST-2).', estado: 'done', prio: 2, sistema: 'devops', milestone: 'v1.1.0 — Certificación en VM Limpia' },
    ],
  },
  {
    clave: 'FUTURO',
    nombre: 'SICSAFT - 06. Integraciones y Backlog Futuro',
    descripcion: 'Ampliaciones de hardware RFID, APK nativa y conectores ERP.',
    iniciativa: 'SICSAFT v2.0 — Inteligencia Patrimonial e Integraciones',
    milestones: [
      { nombre: 'v2.0.0 — Ecosistema Extendido', descripcion: 'Conectores contables ERP, hardware RFID y APK compilada' },
    ],
    links: [
      { label: 'DOC-016 Conector Contable Bidireccional', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/aidlc-docs/integraciones/design-artifacts/DOC-016-conector-con-contabilidad.md' },
      { label: 'Roadmap Integral SICSAFT', url: 'https://github.com/jhonabruzzi278/SICSAFT/blob/main/ROADMAP.md' },
    ],
    tareas: [
      { id: 'FUT-01', titulo: 'APK Nativa Android con WebView Kotlin (apk-aft/)', desc: 'Compilación, robustecimiento de red y servido del binario .apk con selector de QR.', estado: 'done', prio: 3, sistema: 'sicsaft-core', milestone: 'v2.0.0 — Ecosistema Extendido' },
      { id: 'FUT-02', titulo: 'Subsistema y Conector RFID Nivel 3 (rfid/)', desc: 'Lectura masiva de tags y zonificación en tiempo real.', estado: 'todo', prio: 3, sistema: 'docs', milestone: 'v2.0.0 — Ecosistema Extendido' },
      { id: 'FUT-03', titulo: 'Conector ERP / Contabilidad Bidireccional (DOC-016)', desc: 'Intercambio automático con sistemas contables institucionales.', estado: 'todo', prio: 4, sistema: 'herramientas', milestone: 'v2.0.0 — Ecosistema Extendido' },
      { id: 'FUT-04', titulo: 'Soporte de Red mDNS / Hostname .local para APP QR', desc: 'Resolución de nombres local y certificado HTTPS sin alertas de navegador en smartphones (DOC-028 C.3).', estado: 'done', prio: 2, sistema: 'sicsaft-core', milestone: 'v2.0.0 — Ecosistema Extendido' },
    ],
  },
];

async function main() {
  const args = process.argv.slice(2);
  const esDryRun = args.includes('--dry-run') || (!args.includes('--apply') && !args.includes('--teams'));
  const listarTeams = args.includes('--teams') || args.includes('--list-teams');
  const teamKeyArg = args.find((a, i) => args[i - 1] === '--team-key' || args[i - 1] === '-t');

  console.log('📦 SICSAFT -> Sincronizador Integral con Linear\n');

  if (!API_KEY && !esDryRun) {
    console.error('❌ ERROR: Variable LINEAR_API_KEY no encontrada.');
    process.exit(1);
  }

  if (listarTeams) {
    const teams = await listarEquipos();
    console.log('Equipos disponibles en Linear:');
    teams.forEach((t) => console.log(` - [${t.key}] ${t.name} (ID: ${t.id})`));
    return;
  }

  const estadoRevision = leerJson('herramientas/revision-codigo/estado-revision.json');
  if (!estadoRevision) {
    console.error('❌ Error: estado-revision.json no encontrado.');
    process.exit(1);
  }

  if (esDryRun) {
    console.log('Modo: 🔍 DRY RUN (Simulación)\n');
    console.log('--- Proyectos y Tareas que se sincronizarán en Linear ---');
    for (const proj of ESTRUCTURA_PROYECTOS) {
      console.log(`\n📁 Proyecto: ${proj.nombre} [Iniciativa: ${proj.iniciativa}]`);
      if (proj.esAudit) {
        estadoRevision.hallazgos.forEach((h) => {
          const resuelto = h.decision.startsWith('resuelto');
          console.log(`  - [${h.id}] [${resuelto ? 'Done' : 'Todo'}] ${h.titulo}`);
        });
      } else {
        proj.tareas.forEach((t) => {
          console.log(`  - [${t.id}] [${t.estado === 'done' ? 'Done' : 'Todo'}] ${t.titulo} (Milestone: ${t.milestone})`);
        });
      }
    }
    console.log('\n💡 Para aplicar: node herramientas/revision-codigo/linear-sync.mjs --team-key JON --apply\n');
    return;
  }

  // Sincronización real
  const teams = await listarEquipos();
  const targetTeam = (teamKeyArg ? teams.find((t) => t.key.toUpperCase() === teamKeyArg.toUpperCase()) : teams[0]) || teams[0];
  console.log(`🎯 Sincronizando con el equipo: [${targetTeam.key}] ${targetTeam.name}\n`);

  // 1. Asegurar Iniciativas (Roadmaps)
  console.log('🗺️ Asegurando Grandes Iniciativas en Linear...');
  const mapaIniciativas = {};
  for (const initDef of INICIATIVAS_DEF) {
    const initId = await crearIniciativaSiNoExiste(initDef.nombre, initDef.descripcion, initDef.color);
    if (initId) {
      mapaIniciativas[initDef.nombre] = initId;
      console.log(`  ✔ Iniciativa lista: "${initDef.nombre}"`);
    }
  }

  const states = await obtenerEstadosDeEquipo(targetTeam.id);
  const stateDone = states.find((s) => s.type === 'completed' || s.name.toLowerCase() === 'done');
  const stateTodo = states.find((s) => s.type === 'unstarted' || s.name.toLowerCase() === 'todo');

  for (const projDef of ESTRUCTURA_PROYECTOS) {
    console.log(`\n📁 Asegurando Proyecto: ${projDef.nombre}...`);
    const projectId = await crearProyectoSiNoExiste(targetTeam.id, projDef.nombre, projDef.descripcion);

    // Asociar a su Iniciativa
    if (projDef.iniciativa && mapaIniciativas[projDef.iniciativa]) {
      await asociarProyectoAIniciativa(mapaIniciativas[projDef.iniciativa], projectId);
    }

    // Asegurar Enlaces de Recursos
    if (projDef.links && projDef.links.length > 0) {
      for (const link of projDef.links) {
        await agregarLinkAProyectoSiNoExiste(projectId, link.url, link.label);
      }
    }

    // Asegurar Milestones del Proyecto
    const mapaMilestones = {};
    if (projDef.milestones && projDef.milestones.length > 0) {
      for (const m of projDef.milestones) {
        const mId = await crearMilestoneSiNoExiste(projectId, m.nombre, m.descripcion);
        if (mId) mapaMilestones[m.nombre] = mId;
      }
    }

    if (projDef.esAudit) {
      for (const h of estadoRevision.hallazgos) {
        const resuelto = h.decision.startsWith('resuelto');
        const targetStateId = resuelto ? stateDone?.id : stateTodo?.id;

        const labelSys = await crearLabelSiNoExiste(targetTeam.id, `sistema:${h.sistema}`);
        const labelEje = await crearLabelSiNoExiste(targetTeam.id, `eje:${h.eje}`);
        const labelTipo = await crearLabelSiNoExiste(targetTeam.id, `tipo:auditoria`, '#eb6c36');
        const labelIds = [labelSys, labelEje, labelTipo].filter(Boolean);

        const milestoneNombre = resuelto ? 'v1.0.0 — Auditoría Base Resuelta' : 'v1.1.0 — Blindaje y Calidad Final';
        const projectMilestoneId = mapaMilestones[milestoneNombre] || null;

        const titulo = `[${h.id}] ${h.titulo}`;
        const desc = `### ${h.titulo}
**Eje**: Eje ${h.eje} (${estadoRevision._ejes[h.eje]})
**Sistema**: \`${h.sistema}\`
**Severidad**: ${h.severidad.toUpperCase()}

#### Evidencia
${h.evidencia}

#### Impacto
${h.impacto}

#### Decisión / Estado
\`${h.decision}\`
`;
        const prioridad = SEVERIDAD_A_PRIORIDAD[h.severidad] ?? 0;
        const res = await crearOActualizarIssue(targetTeam.id, projectId, targetStateId, labelIds, titulo, desc, prioridad, projectMilestoneId);
        console.log(`  ✔ [${res.identifier}] ${h.id} -> ${res.accion} (${resuelto ? 'Done' : 'Todo'})`);
      }
    } else {
      for (const t of projDef.tareas) {
        const resuelto = t.estado === 'done';
        const targetStateId = resuelto ? stateDone?.id : stateTodo?.id;

        const labelSys = await crearLabelSiNoExiste(targetTeam.id, `sistema:${t.sistema}`);
        const labelTipo = await crearLabelSiNoExiste(targetTeam.id, `tipo:roadmap`, '#2563EB');
        const labelIds = [labelSys, labelTipo].filter(Boolean);

        const projectMilestoneId = t.milestone ? mapaMilestones[t.milestone] || null : null;

        const titulo = `[${t.id}] ${t.titulo}`;
        const desc = `### ${t.titulo}
**Sistema**: \`${t.sistema}\`
**Descripción**: ${t.desc}

#### Alcance Técnico
Módulo correspondiente al backlog del ecosistema SICSAFT (Tomo IV / ROADMAP oficial).
`;
        const res = await crearOActualizarIssue(targetTeam.id, projectId, targetStateId, labelIds, titulo, desc, t.prio, projectMilestoneId);
        console.log(`  ✔ [${res.identifier}] ${t.id} -> ${res.accion} (${resuelto ? 'Done' : 'Todo'})`);
      }
    }
  }

  console.log('\n🎉 ¡Todo el proyecto SICSAFT ha sido sincronizado y organizado en Linear con Iniciativas, Milestones y Recursos!');
}

main().catch((err) => {
  console.error('\n❌ Error ejecutando sincronización con Linear:', err.message);
  process.exit(1);
});

