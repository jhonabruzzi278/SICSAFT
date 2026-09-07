#!/usr/bin/env node
// Inventario del repo para la revisión de código y documentación (DOC-032).
//
// Por qué existe: una revisión de 70k líneas repartidas en 8 sistemas no se sostiene de memoria
// entre sesiones. Este script recalcula las métricas que ORDENAN la revisión (dónde hay más
// comentario por línea, qué documento afirma algo que el código ya no hace) y las deja en un JSON
// que el grafo de `aidlc-docs/diagrams/grafo-revision-codigo.html` inyecta. Correrlo de nuevo es
// la forma de saber si una fase realmente movió la aguja, en vez de creerlo.
//
// No reemplaza el criterio: marca CANDIDATOS. Un comentario largo puede ser el más valioso del
// archivo (ver managed-process.ts, que documenta por qué taskkill va antes del kill).
//
//   node herramientas/revision-codigo/inventario.mjs            # escribe inventario.json
//   node herramientas/revision-codigo/inventario.mjs --tabla    # además imprime la tabla

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

// Un "sistema" es una unidad de revisión: se lee, se decide y se mergea por separado. `rutas` son
// prefijos de path; `capa` agrupa para el grafo y `entrega` marca lo que el cliente recibe (eso
// sube la prioridad: un comentario equivocado ahí cuesta más caro).
const SISTEMAS = [
  {
    id: "cis",
    nombre: "CIS (API Gateway)",
    capa: "backend",
    capaMaestra: "Capa 2: Centro de Interoperabilidad",
    rutas: ["cis/"],
    entrega: true,
    puerto: "3000 (HTTP / REST)",
    entrypoint: "cis/src/main.ts",
    protocolos: ["HTTP/1.1", "OIDC JWT", "Zod Validation", "Circuit Breaker", "Rate Limiting"],
    almacenamiento: "Stateless (Valida tokens y enruta)",
    coberturaTests: "309 tests unitarios/integración Jest (37 suites)",
    modos: ["Nivel 1 (Base)", "Nivel 2 (Avanzado)"],
    rol: "API Gateway & Autenticación OIDC",
    tecnologias: ["NestJS", "Keycloak 26", "Zod", "Axios", "Circuit Breaker", "Rate Limiting"],
    funcionalidades: [
      "Punto de Entrada Único Seguro para todas las aplicaciones cliente (Web, Móvil, ETL)",
      "Validación Criptográfica de Tokens JWT OIDC emitidos por Keycloak 26",
      "Validación de Esquemas de Entrada con Zod en todas las rutas",
      "Circuit Breaker y Rate Limiting para protección contra sobrecarga",
      "Inyección de Token de Servicio Interno hacia CORE y CIP",
      "Degradación Elegante en Nivel 1 cuando CIP no está desplegado (CIP-05)",
      "Normalización y Logging estructurado de peticiones y respuestas"
    ],
    resumenTecnico: "Centro de Interoperabilidad: Punto de entrada único seguro, validación de JWT OIDC con Keycloak 26, proxy seguro a CORE/CIP y tolerancia a fallos.",
  },
  {
    id: "core",
    nombre: "CORE (Motor BPI)",
    capa: "backend",
    capaMaestra: "Capa 3: Motor de Orquestación Patrimonial",
    rutas: ["core/src/", "core/test/", "core/migrations/"],
    entrega: true,
    puerto: "3001 (Interno BPI)",
    entrypoint: "core/src/main.ts",
    protocolos: ["HTTP Interno", "PostgreSQL Wire", "pg-boss Outbox", "ACID Transactions"],
    almacenamiento: "PostgreSQL 16 (Esquema BPI versionado con node-pg-migrate)",
    coberturaTests: "95 tests Vitest (11 dominios patrimoniales)",
    modos: ["Nivel 1 (Base)", "Nivel 2 (Avanzado)"],
    rol: "Motor Patrimonial BPI & Orquestador",
    tecnologias: ["NestJS", "PostgreSQL", "node-pg-migrate", "pg-boss", "Reglas CFPS"],
    funcionalidades: [
      "Gobernanza y Regla de Oro: Único componente autorizado a mutar la Base Patrimonial Inteligente (BPI)",
      "Máquina de Estados de Contratos y Licencias de Uso (DOC-004)",
      "Motor de Reglas de Negocio CFPS (Clasificador Funcional del Patrimonio)",
      "11 Dominios Patrimoniales: Bienes, Ubicaciones, Estructura Org, Custodios, etc.",
      "Ingesta Transaccional de Lotes Contables desde Staging",
      "Procesamiento de Sesiones de Inventario Físico y Conciliación",
      "Generación de Eventos de Dominio asíncronos vía cola transaccional pg-boss",
      "Auditoría Inmutable (Quién, Qué, Cuándo, Dónde) con snapshots de estado"
    ],
    resumenTecnico: "Núcleo de negocio: Esquema BPI PostgreSQL versionado, máquina de estados de contratos (DOC-004), 11 dominios patrimoniales y auditoría inmutable.",
  },
  {
    id: "cip",
    nombre: "CIP (Analítica)",
    capa: "backend",
    capaMaestra: "Capa 5: Centro de Inteligencia Patrimonial",
    rutas: ["cip/"],
    entrega: false,
    puerto: "3002 (Worker Interno)",
    entrypoint: "cip/src/main.ts",
    protocolos: ["HTTP Interno", "pg-boss Event Queue", "PostgreSQL Wire"],
    almacenamiento: "PostgreSQL 16 (Vistas materializadas y series temporales)",
    coberturaTests: "26 suites Jest (Veredicto cruzado y agregación)",
    modos: ["Nivel 2 (Opcional - desactivable en N1 para ahorrar 120MB RAM)"],
    rol: "Inteligencia Decisional & Agregación",
    tecnologias: ["NestJS", "PostgreSQL", "pg-boss", "Worker Asíncrono"],
    funcionalidades: [
      "Consumo Asíncrono de Eventos de Inventario y Bienes vía pg-boss",
      "Cálculo de Veredicto Patrimonial Canónico (4 estados con matriz de contrato cruzada)",
      "Alertas Analíticas y Detección de Inconsistencias (CIP-04)",
      "Evolución Patrimonial Temporal y Matriz de Score de Riesgo (CIP-06)",
      "Generación de Vistas Materializadas para Reportes y KPIs Ejecutivos",
      "Endpoints de Alta Velocidad para Dashboards Directivos",
      "Arranque Condicional Nivel 1 / Nivel 2 (CIP-05)"
    ],
    resumenTecnico: "Centro de Inteligencia Patrimonial: Agregación asíncrona desacoplada de eventos de inventario, cálculo de veredictos y endpoints para dashboards directivos.",
  },
  {
    id: "ccp",
    nombre: "CCP (Portal AFT)",
    capa: "frontend",
    capaMaestra: "Capa 1: Fuentes de Captura y Gestión",
    rutas: ["ccp/"],
    entrega: true,
    puerto: "8766 (HTTP Local)",
    entrypoint: "ccp/src/main.tsx",
    protocolos: ["HTTP/1.1", "OIDC PKCE (RFC 7636)", "REST Client"],
    almacenamiento: "LocalStorage / SessionStorage (Tokens OIDC de sesión)",
    coberturaTests: "86 tests Vitest (Ficha activos, catálogos, lotes)",
    modos: ["Nivel 1 (Base)", "Nivel 2 (Avanzado)"],
    rol: "Portal Web del Profesional de AFT",
    tecnologias: ["React 19", "Vite", "Tailwind CSS", "OIDC PKCE (RFC 7636)", "Vitest"],
    funcionalidades: [
      "Ficha Integral de Activo Fijo (Datos técnicos, contables, fotos, custodio, ubicación)",
      "Árbol de Estructura Organizacional (Gerencia / Subgerencia / Departamento)",
      "Wizard de Ingesta Masiva de Planillas Excel con Validación Previa y Mapeo Dinámico",
      "Generación e Impresión de Etiquetas QR y Código 128",
      "Gestión de Bajas, Traslados y Reasignaciones de Bienes",
      "Monitoreo de Sesiones de Inventario en Tiempo Real",
      "Flujo de Autenticación Segura OIDC con PKCE (RFC 7636)"
    ],
    resumenTecnico: "Centro de Control Patrimonial: Ficha de activos, estructura organizacional, ingesta supervisada de planillas Excel y generación de etiquetas QR/Código 128.",
  },
  {
    id: "core-frontend",
    nombre: "CORE frontend (Directivo)",
    capa: "frontend",
    capaMaestra: "Capa 1: Fuentes de Captura y Gestión",
    rutas: ["core/frontend/"],
    entrega: true,
    puerto: "8768 (HTTP Local)",
    entrypoint: "core/frontend/src/main.tsx",
    protocolos: ["HTTP/1.1", "OIDC PKCE (RFC 7636)", "REST Client"],
    almacenamiento: "SessionStorage (Tokens OIDC directivos)",
    coberturaTests: "4 suites Vitest (KPIs ejecutivos y conciliación)",
    modos: ["Nivel 1 (Base)", "Nivel 2 (Avanzado)"],
    rol: "Dashboard Ejecutivo Directivo",
    tecnologias: ["React 19", "Vite", "Tailwind CSS", "OIDC PKCE", "Analítica CIP"],
    funcionalidades: [
      "Dashboard Ejecutivo con Gráficos de Conciliación Física vs Contable",
      "Indicadores Clave de Desempeño (KPIs de Cobertura Patrimonial y Avance)",
      "Designación y Asignación Formal de Profesionales AFT a Unidades",
      "Visualización de Veredictos y Alertas de Inconsistencia (Nivel 2)",
      "Reportes de Estado Patrimonial para Dirección y Finanzas",
      "Acceso Restringido por Rol Directivo con OIDC PKCE"
    ],
    resumenTecnico: "Portal institucional para directores y autoridades: Indicadores de conciliación física, cobertura patrimonial y designación de profesionales AFT.",
  },
  {
    id: "app-qr",
    nombre: "APP QR (PWA Móvil)",
    capa: "frontend",
    capaMaestra: "Capa 1: Fuentes de Captura y Gestión",
    rutas: ["app-qr-sicsaft/"],
    entrega: true,
    puerto: "8767 / sicsaft.local (HTTPS LAN)",
    entrypoint: "app-qr-sicsaft/src/main.tsx",
    protocolos: ["HTTPS / TLS SAN", "mDNS (.local)", "OIDC PKCE", "Offline Sync"],
    almacenamiento: "IndexedDB (Cola offline de sesiones de escaneo)",
    coberturaTests: "15 suites Vitest (Flujo oficial 8 pasos y escaneo)",
    modos: ["Nivel 1 (Base)", "Nivel 2 (Avanzado)"],
    rol: "PWA Móvil de Captura en Terreno",
    tecnologias: ["React 19", "Vite PWA", "Html5Qrcode", "IndexedDB", "Offline Queue"],
    funcionalidades: [
      "Flujo Oficial de Escaneo de 8 Pasos en Terreno (DOC-001)",
      "Escaneo Óptico por Cámara de Códigos QR y Códigos de Barra 128",
      "Verificación Instantánea del Bien (Descripción, Serie, Estado, Custodio)",
      "Levantamiento de Incidencias con Registro de Daños o Faltantes",
      "Operación Offline 100% Autónoma con Almacenamiento en IndexedDB",
      "Cola de Sincronización Automática al Recuperar Conectividad LAN",
      "Acceso LAN sin Advertencias SSL vía mDNS `sicsaft.local` y TLS SAN (FUT-04)"
    ],
    resumenTecnico: "Aplicación móvil de inventario: Flujo oficial de escaneo de 8 pasos (DOC-001), validación de bien, registro de incidencias y operación offline con cola de reintentos.",
  },
  {
    id: "sicsaft-core",
    nombre: "SICSAFT CORE (.exe)",
    capa: "entregable",
    capaMaestra: "Entregable On-Premise (Windows .exe)",
    rutas: ["sicsaft-core/"],
    entrega: true,
    puerto: "8765 (IPC / Electron API)",
    entrypoint: "sicsaft-core/src/main/main.ts",
    protocolos: ["Electron IPC", "Process Orchestration", "mDNS Beacon", "Self-signed TLS"],
    almacenamiento: "AppData/Local (Postgres binario + Keycloak data)",
    coberturaTests: "50 suites Playwright/Vitest (Supervisión de procesos y fallback)",
    modos: ["Nivel 1 (Sin CIP ~120MB RAM)", "Nivel 2 (Full Stack)"],
    rol: "App de Escritorio Nativa (.exe)",
    tecnologias: ["Electron", "PostgreSQL Embebido", "Keycloak 26", "Playwright E2E", "Inno Setup"],
    funcionalidades: [
      "Orquestación y Supervisión de Ciclo de Vida de Subprocesos (Postgres, Keycloak, CIS, CORE, CIP)",
      "Cero Dependencias Externas: No requiere Docker, WSL2 ni instalaciones previas en el SO",
      "Servidor HTTP Embebido para Portales Web (CCP en :8766, Directivo en :8768)",
      "Servidor HTTPS LAN y Emisor mDNS `sicsaft.local` en :8767 para Conexión Móvil",
      "Arranque Condicional Nivel 1 (Omite subproceso CIP ahorrando ~120MB de RAM)",
      "Bandeja de Sistema (System Tray) con Monitoreo de Salud de Servicios y Logs",
      "Firma Digital de Código con Authenticode SHA-256 (SmartScreen EXE-08)"
    ],
    resumenTecnico: "Entregable cliente On-Premise: Binario nativo Windows que orquesta y aísla Postgres, Keycloak 26, CIS, CORE y CIP sin requerir Docker ni WSL2.",
  },
  {
    id: "herramientas",
    nombre: "Herramientas (ETL)",
    capa: "tooling",
    capaMaestra: "Capa 1: Fuentes de Captura y Gestión",
    rutas: ["herramientas/"],
    entrega: true,
    puerto: "CLI / Script Python",
    entrypoint: "herramientas/ingesta-contable/normalizar.py",
    protocolos: ["File System", "CSV / XLSX", "HTTP Upload"],
    almacenamiento: "Archivos temporales staging .parquet / .csv",
    coberturaTests: "16 tests Pytest (Normalización contable)",
    modos: ["Nivel 1 (Base)", "Nivel 2 (Avanzado)"],
    rol: "Normalizador Contable Excel/CSV",
    tecnologias: ["Python 3.12", "Pandas", "Pytest", "Ruff", "ETL"],
    funcionalidades: [
      "Normalización de Planillas Contables Institucionales Heterogéneas (Excel/CSV)",
      "Limpieza de Caracteres, Formateo de Fechas, Valores Monetarios y Códigos de Inventario",
      "Generación de Archivos Canónicos para Carga en Staging de la BPI",
      "Validación de Integridad y Detección Temprana de Duplicados"
    ],
    resumenTecnico: "Sidecar de ingesta contable: Transforma formatos heterogéneos de planillas contables institucionales hacia el esquema canónico de importación de la BPI.",
  },
  {
    id: "devops",
    nombre: "DevOps & Release",
    capa: "tooling",
    capaMaestra: "Herramientas & Despliegue",
    rutas: ["devops/"],
    entrega: false,
    puerto: "CI/CD & PowerShell",
    entrypoint: "herramientas/devops/firmar-instalador.ps1",
    protocolos: ["Authenticode SHA-256", "Inno Setup 6.x", "GitHub Actions"],
    almacenamiento: "Artefactos ZIP y ejecutables .exe firmados",
    coberturaTests: "Pipeline CI/CD automatizado en GitHub Actions",
    modos: ["Release Automation"],
    rol: "Infraestructura On-Premise & CI/CD",
    tecnologias: ["Inno Setup .iss", "GitHub Actions", "PowerShell", "Authenticode"],
    funcionalidades: [
      "Generación del Instalador Desatendido Windows (.exe) con Inno Setup",
      "Pipeline Automatizado de Release en GitHub Actions (.github/workflows/release-automation.yml)",
      "Firma Digital de Código con Authenticode SHA-256 (firmar-instalador.ps1)",
      "Empaquetado Completo en ZIP para Entrega a Clientes On-Premise con Documentación y Checksums"
    ],
    resumenTecnico: "Instalador desatendido para Windows Server / Windows 10/11, scripts de provisioning y pipelines de CI/CD automatizados.",
  },
  {
    id: "casos-de-uso",
    nombre: "Casos de uso (e2e)",
    capa: "tooling",
    capaMaestra: "Aseguramiento de Calidad",
    rutas: ["casos-de-uso/"],
    entrega: false,
    puerto: "Test Runner",
    entrypoint: "casos-de-uso/playwright.config.ts",
    protocolos: ["E2E Acceptance", "Playwright Automation"],
    almacenamiento: "Resultados de test y traces Playwright",
    coberturaTests: "12 especificaciones de casos de uso completos",
    modos: ["Validación Integral"],
    rol: "Harness de Casos de Uso E2E",
    tecnologias: ["Playwright", "TypeScript", "Pruebas de Aceptación"],
    funcionalidades: [
      "Validación de Flujos de Usuario Reales (Directivo, Profesional AFT, Capturista)",
      "Pruebas de Integración Extremo a Extremo (E2E) con Playwright",
      "Verificación de Concurrencia y Resiliencia en el Stack Real"
    ],
    resumenTecnico: "Validación end-to-end de los flujos de usuario completos (Directivo, Profesional AFT y Capturista) contra el stack real.",
  },
  {
    id: "landing",
    nombre: "Landing Page",
    capa: "frontend",
    capaMaestra: "Portal Institucional",
    rutas: ["landing/"],
    entrega: false,
    puerto: "Estático",
    entrypoint: "landing/index.html",
    protocolos: ["HTML5", "CSS3"],
    almacenamiento: "N/A",
    coberturaTests: "Inspección visual",
    modos: ["Institucional"],
    rol: "Portal Institucional y Marca",
    tecnologias: ["HTML5", "CSS3 Moderno", "Brand Guidelines"],
    funcionalidades: [
      "Presentación Institucional del Ecosistema SICSAFT",
      "Demostración de Principios de Diseño y Marca (BRAND.md)"
    ],
    resumenTecnico: "Página institucional y presentación del ecosistema SICSAFT basada en BRAND.md.",
  },
  {
    id: "docs",
    nombre: "Documentación Normativa",
    capa: "docs",
    capaMaestra: "Gobernanza Arquitectónica",
    rutas: ["aidlc-docs/", "adr/", "base-patrimonial/", "seguridad/", "integraciones/", "rfid/", "apk-aft/"],
    entrega: false,
    puerto: "N/A",
    entrypoint: "aidlc-docs/README.md",
    protocolos: ["Markdown", "Mermaid", "DOC/ADR Specifications"],
    almacenamiento: "Repositorio Git",
    coberturaTests: "Auditoría DOC-032 (100% resuelta)",
    modos: ["Referencia Global"],
    rol: "Arquitectura & Decisiones AI-DLC",
    tecnologias: ["Markdown", "Mermaid", "ADR", "DOC Specifications"],
    funcionalidades: [
      "124 Documentos Normativos y de Especificación Arquitectónica (Tomos I a IV)",
      "Registro Inmutable de Decisiones de Arquitectura (ADRs 001-005)",
      "Especificaciones Técnicas Detalladas (DOCs 001-032)",
      "Auditoría Integral de Calidad y Consistencia DOC-032"
    ],
    resumenTecnico: "124 documentos normativos y de especificación arquitectónica del ecosistema (Tomos I a IV, ADRs 001-005, DOCs 001-032).",
  },
];

// Términos que describen una realidad que el repo ya dejó atrás. `salvoEn` son los lugares donde
// mencionarlos es correcto: un ADR que documenta la decisión superada, o el catálogo que declara
// la depreciación, tienen que poder nombrarla.
const TERMINOS_DEPRECADOS = [
  {
    termino: "Zitadel",
    vigente: "Keycloak",
    fuente: "adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md",
    salvoEn: [/^adr\/ADR-002/, /^adr\/ADR-004/, /CHANGELOG/i],
  },
  {
    termino: "Base Patrimonial Central",
    vigente: "BPI — Base Patrimonial Inteligente",
    fuente: "NOMENCLATURA.md",
    salvoEn: [/^NOMENCLATURA\.md$/],
  },
];

// Los artefactos de la propia revisión hablan DE los hallazgos: este script nombra
// `*.schemas.ts` y `zitadel-admin.service.ts` para explicar qué detecta, y DOC-032 cita "Zitadel"
// y "Base Patrimonial Central" para documentarlos. Sin excluirlos, la herramienta se cuenta a sí
// misma como deuda y el número deja de significar algo.
const ES_ARTEFACTO_DE_REVISION = /^(herramientas\/revision-codigo|aidlc-docs\/revision-codigo)\//;

const EXT_CODIGO = /\.(ts|tsx|js|jsx|mjs|py|ps1)$/;
const ES_TEST = /(\.spec\.|\.test\.|[/\\](tests?|e2e)[/\\])/;
const ES_COMENTARIO = /^\s*(\/\/|\/\*|\*|#(?!!)|<!--)/;

// `git` se invoca por nombre y no por ruta absoluta (a diferencia del `taskkill` de
// managed-process.ts): System32 es una ubicación fija de Windows, pero git se instala en rutas
// distintas por plataforma y por gestor de paquetes, así que resolverlo "a mano" sería adivinar.
// Es una herramienta de operador que corre en el repo del propio desarrollador, no código
// embarcado en el .exe ni en CI.
function git(...args) {
  return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const archivos = git("ls-files")
  .split("\n")
  .filter(Boolean)
  .filter((f) => !f.includes("node_modules/"));

// Los que efectivamente se miden (ver ES_ARTEFACTO_DE_REVISION). El índice de nombres existentes
// se arma con TODOS: un comentario puede citar legítimamente un archivo de esta carpeta.
const medibles = archivos.filter((f) => !ES_ARTEFACTO_DE_REVISION.test(f));

// Índice de nombres de archivo existentes — la base del detector de comentarios huérfanos.
const nombresExistentes = new Set(archivos.map((f) => basename(f).toLowerCase()));

// El repo está en CRLF: sin normalizar, cada línea termina en `\r` invisible y cualquier chequeo
// de fin de línea (el guión de corte de un comentario envuelto, por ejemplo) falla en silencio.
const leer = (f) => {
  try {
    return readFileSync(join(RAIZ, f), "utf8").replaceAll("\r\n", "\n");
  } catch {
    return null; // archivo trackeado pero borrado en el working tree
  }
};

// Artefactos de build (no versionados, pero existen en runtime) y nombres genéricos que aparecen
// en globs. Citarlos NO es un comentario huérfano: `dist/main.js` existe cuando el .exe corre.
const CITA_NO_ES_HUERFANA = /^(main|index|renderer|preload|bundle|vendor)\.(js|mjs|cjs)$/i;
const DIRECTORIO_DE_BUILD = /\b(dist|out|build|release|coverage|node_modules)\//;
// `.d.ts` casi siempre nombra tipos de una dependencia (`electron.d.ts`), no un módulo del repo.
const ES_DECLARACION_DE_TIPOS = /\.d\.ts$/i;

// Nombres de módulo citados dentro de un comentario, con su ruta si la traen.
//
// Cada segmento (`[\w*-]+`) termina obligatoriamente en `.` o `/`, caracteres que la clase no
// admite: el corte de cada repetición queda forzado y el motor no tiene nada que reintentar. Un
// `[\w./-]+\.(ts|js)` — la forma "natural" — sí es ambiguo (el `.` está en la clase Y se exige
// literal después), y ahí el backtracking se vuelve super-lineal: es ReDoS sobre una entrada que,
// además, viene de archivos del repo. El `*` entra en la clase a propósito, para poder reconocer
// un glob (`*.schemas.ts`) y descartarlo después.
const CITA_DE_ARCHIVO = /(?:[\w*-]+[./])+(?:ts|tsx|js|jsx|mjs|py)\b/g;

/**
 * Comentarios que citan un archivo fuente que ya no existe en el repo.
 *
 * Es el hallazgo más objetivo de toda la revisión: no depende de gusto. Si un comentario dice
 * "mismo criterio que zitadel-admin.service.ts" y ese archivo se borró en la migración, el
 * comentario le pide al lector comparar contra algo que no puede abrir. Se corrige o se elimina.
 *
 * Se descartan las familias de falso positivo detectadas al validar las primeras corridas:
 *  - globs (`*.schemas.ts`, `core/src/**\/*.spec.ts`) — nombran un patrón, no un archivo;
 *  - salidas de build (`dist/main.js`) — no están versionadas pero sí existen al ejecutar;
 *  - `.d.ts` de dependencias (`electron.d.ts`) — no son módulos del repo;
 *  - nombres partidos por el salto de línea: un comentario que envuelve `service-` / `orchestrator.ts`
 *    cita un archivo que SÍ existe. Por eso se analiza el bloque de comentario completo, no la
 *    línea suelta, reuniendo el guión de corte.
 */
function comentariosHuerfanos(rutaArchivo, contenido) {
  const hallazgos = [];
  const lineas = contenido.split("\n");

  let bloque = null; // { texto, lineaInicio }
  const cerrarBloque = () => {
    if (!bloque) return;
    const citados = bloque.texto.match(CITA_DE_ARCHIVO) ?? [];
    for (const cita of citados) {
      if (cita.includes("*")) continue; // glob, no un archivo concreto
      if (DIRECTORIO_DE_BUILD.test(cita)) continue;
      if (ES_DECLARACION_DE_TIPOS.test(cita)) continue;
      const nombre = basename(cita).toLowerCase();
      if (CITA_NO_ES_HUERFANA.test(nombre)) continue;
      if (nombresExistentes.has(nombre)) continue;
      hallazgos.push({
        archivo: rutaArchivo,
        linea: bloque.lineaInicio,
        cita,
        texto: bloque.texto.trim().slice(0, 200),
      });
    }
    bloque = null;
  };

  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (!ES_COMENTARIO.test(linea)) {
      cerrarBloque();
      continue;
    }
    const limpia = linea.replace(/^\s*(\/\/+|\/\*+|\*+\/?|#|<!--)\s?/, "").replace(/-->\s*$/, "");
    if (bloque === null) {
      bloque = { texto: limpia, lineaInicio: i + 1 };
    } else {
      // Un guión al final de la línea anterior es un corte de palabra: se une sin espacio para
      // reconstruir `service-orchestrator.ts`.
      bloque.texto += bloque.texto.endsWith("-") ? limpia : ` ${limpia}`;
    }
  }
  cerrarBloque();
  return hallazgos;
}

/** Archivos versionados que pertenecen a un sistema, separados por rol. */
function archivosDe(sistema) {
  const suyos = medibles.filter((f) => sistema.rutas.some((r) => f.startsWith(r)));
  // core/ contiene a core/frontend/: sin esto las líneas del frontend se contarían dos veces.
  const propios = sistema.id === "core" ? suyos.filter((f) => !f.startsWith("core/frontend/")) : suyos;
  const codigo = propios.filter((f) => EXT_CODIGO.test(f));
  return {
    fuente: codigo.filter((f) => !ES_TEST.test(f)),
    tests: codigo.filter((f) => ES_TEST.test(f)),
    docs: propios.filter((f) => f.endsWith(".md")),
  };
}

function medirFuente(fuente) {
  const m = { loc: 0, locComentario: 0, todos: 0, huerfanos: [] };
  for (const f of fuente) {
    const c = leer(f);
    if (c === null) continue;
    const lineas = c.split("\n");
    m.loc += lineas.length;
    m.locComentario += lineas.filter((l) => ES_COMENTARIO.test(l)).length;
    m.todos += (c.match(/\b(TODO|FIXME|XXX|HACK)\b/g) ?? []).length;
    m.huerfanos.push(...comentariosHuerfanos(f, c));
  }
  return m;
}

function contarLineas(rutas) {
  let total = 0;
  for (const f of rutas) {
    const c = leer(f);
    if (c !== null) total += c.split("\n").length;
  }
  return total;
}

/** Documentos del sistema que nombran algo que el repo ya reemplazó. */
function medirDocsDesactualizados(docs) {
  const hallazgos = [];
  for (const f of docs) {
    const c = leer(f);
    if (c === null) continue;
    // Citar el archivo ADR-004 oficial (que lleva zitadel en su nombre) es una cita normativa válida, no una deuda.
    const textoEvaluado = c.replaceAll(/ADR-004-identidad-keycloak-reemplaza-zitadel\.md/gi, "");
    for (const t of TERMINOS_DEPRECADOS) {
      if (t.salvoEn.some((re) => re.test(f))) continue;
      const veces = (textoEvaluado.match(new RegExp(t.termino, "gi")) ?? []).length;
      if (veces > 0) hallazgos.push({ archivo: f, termino: t.termino, vigente: t.vigente, veces });
    }
  }
  return hallazgos;
}

function metricasDe(sistema) {
  const { fuente, tests, docs } = archivosDe(sistema);
  const { loc, locComentario, todos, huerfanos } = medirFuente(fuente);
  const locTests = contarLineas(tests);
  const docsDesactualizados = medirDocsDesactualizados(docs);

  return {
    archivosFuente: fuente.length,
    archivosTest: tests.length,
    docs: docs.length,
    loc,
    locComentario,
    locTests,
    pctComentario: loc > 0 ? Number(((locComentario * 100) / loc).toFixed(1)) : 0,
    // Un sistema con mucho código y poco test se revisa distinto: no hay red que avise si el
    // "limpiar" rompió algo.
    ratioTest: loc > 0 ? Number((locTests / loc).toFixed(2)) : 0,
    todos,
    huerfanos,
    docsDesactualizados,
  };
}

// Aristas del ecosistema — el flujo no negociable de CLAUDE.md ("ninguna fuente de captura escribe
// la BPI directo"). Se declaran a mano porque son la regla, no el resultado de un import graph:
// justamente lo que hay que poder ver de un vistazo es si algo la rompe.
const ARISTAS = [
  { de: "app-qr", a: "cis", tipo: "captura", label: "Captura QR (HTTPS / mDNS)", desc: "Envío de sesiones de escaneo e incidencias con JWT OIDC PKCE a sicsaft.local:8767 / cis:3000 con cola offline IndexedDB." },
  { de: "ccp", a: "cis", tipo: "captura", label: "Portal AFT (REST)", desc: "CRUD de bienes, catálogos, estructuras y aprobación de lotes Excel vía JWT OIDC." },
  { de: "core-frontend", a: "cis", tipo: "captura", label: "Directivo (REST)", desc: "Consultas de KPIs patrimoniales ejecutivos y designación de profesionales AFT." },
  { de: "cis", a: "core", tipo: "orquestacion", label: "Orquestación BPI", desc: "Validación Zod, token de servicio interno y persistencia transaccional BPI." },
  { de: "core", a: "cip", tipo: "eventos", label: "Outbox pg-boss", desc: "Publicación asíncrona desacoplada de eventos de inventario para cálculo de veredictos." },
  { de: "herramientas", a: "cis", tipo: "captura", label: "ETL Contable", desc: "Carga de planillas Excel normalizadas en Python 3.12 hacia la bandeja de staging." },
  { de: "sicsaft-core", a: "cis", tipo: "supervisa", label: "Subproceso Gateway", desc: "Supervisión de ciclo de vida del API Gateway NestJS en puerto 3000." },
  { de: "sicsaft-core", a: "core", tipo: "supervisa", label: "Subproceso Motor BPI", desc: "Supervisión del backend central NestJS y migraciones PostgreSQL en puerto 3001." },
  { de: "sicsaft-core", a: "cip", tipo: "supervisa", label: "Worker CIP (N2)", desc: "Supervisión de worker de analítica (apagado condicionalmente en Nivel 1 para ahorrar 120MB RAM)." },
  { de: "sicsaft-core", a: "ccp", tipo: "sirve", label: "Servidor Estático AFT", desc: "Servidor local HTTP embebido en puerto 8766 para la SPA de profesional AFT." },
  { de: "sicsaft-core", a: "core-frontend", tipo: "sirve", label: "Servidor Estático Directivo", desc: "Servidor local HTTP embebido en puerto 8768 para el portal directivo." },
  { de: "sicsaft-core", a: "app-qr", tipo: "sirve", label: "mDNS Beacon & HTTPS", desc: "Difusión de nombre sicsaft.local y servidor HTTPS en puerto 8767 para móviles." },
  { de: "casos-de-uso", a: "cis", tipo: "prueba", label: "Harness E2E Playwright", desc: "Validación automatizada de flujos de usuario reales contra el stack completo." },
  { de: "devops", a: "sicsaft-core", tipo: "empaqueta", label: "Inno Setup & Authenticode", desc: "Compilación del instalador Windows desatendido y firma digital SHA-256." },
];

const nodos = SISTEMAS.map((s) => ({ ...s, ...metricasDe(s) }));

const inventario = {
  generado: new Date().toISOString(),
  commit: git("rev-parse", "--short", "HEAD").trim(),
  rama: git("rev-parse", "--abbrev-ref", "HEAD").trim(),
  totales: {
    loc: nodos.reduce((a, n) => a + n.loc, 0),
    locTests: nodos.reduce((a, n) => a + n.locTests, 0),
    docs: nodos.reduce((a, n) => a + n.docs, 0),
    huerfanos: nodos.reduce((a, n) => a + n.huerfanos.length, 0),
    docsDesactualizados: nodos.reduce((a, n) => a + n.docsDesactualizados.length, 0),
    todos: nodos.reduce((a, n) => a + n.todos, 0),
  },
  nodos,
  aristas: ARISTAS,
};

const salida = join(AQUI, "inventario.json");
writeFileSync(salida, `${JSON.stringify(inventario, null, 2)}\n`, "utf8");

// `--grafo` inyecta el inventario dentro del HTML del grafo, entre marcadores. El grafo se abre
// desde el disco (file://) y no puede hacer fetch del JSON, así que los datos viajan embebidos.
// El estado de avance y los hallazgos se leen de estado-revision.json y se adjuntan acá: viven en
// otro archivo justamente para que volver a correr este script no pise el criterio ya aplicado.
if (process.argv.includes("--grafo")) {
  const rutaGrafo = join(RAIZ, "aidlc-docs", "diagrams", "grafo-revision-codigo.html");
  const rutaEstado = join(AQUI, "estado-revision.json");

  const revision = JSON.parse(readFileSync(rutaEstado, "utf8"));
  const conRevision = {
    ...inventario,
    revision: { estados: revision.estados ?? {}, hallazgos: revision.hallazgos ?? [] },
  };

  const html = readFileSync(rutaGrafo, "utf8");
  const inicio = "// <!-- INVENTARIO:INICIO -->";
  const fin = "// <!-- INVENTARIO:FIN -->";
  const i = html.indexOf(inicio);
  const f = html.indexOf(fin);
  if (i === -1 || f === -1) {
    throw new Error(`No encontré los marcadores INVENTARIO:INICIO/FIN en ${rutaGrafo}`);
  }
  const bloque =
    `${inicio} bloque reemplazado por inventario.mjs --grafo\n` +
    `const DATOS = ${JSON.stringify(conRevision)};\n`;
  writeFileSync(rutaGrafo, html.slice(0, i) + bloque + html.slice(f), "utf8");

  // Un hallazgo apuntando a un sistema que no existe queda invisible en el grafo — avisar, no
  // fallar: el estado se edita a mano y un id mal escrito no debe romper la regeneración.
  const ids = new Set(nodos.map((n) => n.id));
  for (const h of revision.hallazgos ?? []) {
    if (!ids.has(h.sistema)) {
      console.warn(`  aviso: el hallazgo ${h.id} apunta al sistema "${h.sistema}", que no existe`);
    }
  }
  console.log(`→ ${rutaGrafo}`);
}

if (process.argv.includes("--tabla")) {
  const p = (v, n) => String(v).padStart(n);
  console.log(`\ncommit ${inventario.commit} (${inventario.rama})\n`);
  console.log("sistema                      loc   coment%  test/loc   docs  huérf  docs✗");
  console.log("─".repeat(78));
  for (const n of [...nodos].sort((a, b) => b.loc - a.loc)) {
    console.log(
      `${n.nombre.padEnd(26)}${p(n.loc, 6)}  ${p(n.pctComentario, 6)}%  ${p(n.ratioTest, 8)}  ${p(n.docs, 5)}  ${p(n.huerfanos.length, 5)}  ${p(n.docsDesactualizados.length, 5)}`,
    );
  }
  const t = inventario.totales;
  console.log("─".repeat(78));
  console.log(
    `${"TOTAL".padEnd(26)}${p(t.loc, 6)}  ${p("", 7)}  ${p("", 8)}  ${p(t.docs, 5)}  ${p(t.huerfanos, 5)}  ${p(t.docsDesactualizados, 5)}`,
  );
  console.log(`\nTODO/FIXME: ${t.todos}   ·   líneas de test: ${t.locTests}`);
}

console.log(`\n→ ${salida}`);
