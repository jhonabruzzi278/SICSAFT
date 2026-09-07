#!/usr/bin/env node
/**
 * SICSAFT Version Manager — Gestor Profesional de Versionado Semántico
 * 
 * Uso:
 *   node herramientas/versionado/version-manager.mjs status
 *   node herramientas/versionado/version-manager.mjs sync
 *   node herramientas/versionado/version-manager.mjs set 1.0.0 [--tag]
 *   node herramientas/versionado/version-manager.mjs bump <patch|minor|major> [--tag]
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const VERSION_FILE = path.join(ROOT_DIR, 'VERSION');
const CHANGELOG_FILE = path.join(ROOT_DIR, 'CHANGELOG.md');

// Lista de paquetes que forman el ecosistema monorepo
const PAQUETES = [
  { clave: 'root', nombre: 'SICSAFT (Global)', archivo: 'VERSION', tipo: 'txt' },
  { clave: 'sicsaft-core', nombre: 'SICSAFT CORE (.EXE)', archivo: 'sicsaft-core/package.json', tipo: 'json' },
  { clave: 'cis', nombre: 'CIS (Gateway)', archivo: 'cis/package.json', tipo: 'json' },
  { clave: 'core', nombre: 'CORE (Motor Patrimonial)', archivo: 'core/package.json', tipo: 'json' },
  { clave: 'ccp', nombre: 'CCP (Centro de Control)', archivo: 'ccp/package.json', tipo: 'json' },
  { clave: 'cip', nombre: 'CIP (Inteligencia)', archivo: 'cip/package.json', tipo: 'json' },
  { clave: 'app-qr', nombre: 'APP QR (Captura Móvil)', archivo: 'app-qr-sicsaft/package.json', tipo: 'json' },
  { clave: 'directivo', nombre: 'Portal Directivo', archivo: 'core/frontend/package.json', tipo: 'json' },
  { clave: 'casos-uso', nombre: 'E2E Casos de Uso', archivo: 'casos-de-uso/e2e/package.json', tipo: 'json' },
  { clave: 'landing', nombre: 'Landing Page', archivo: 'landing/package.json', tipo: 'json' },
];

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function obtenerVersionRaiz() {
  if (!fs.existsSync(VERSION_FILE)) {
    fs.writeFileSync(VERSION_FILE, '1.0.0\n', 'utf8');
    return '1.0.0';
  }
  return fs.readFileSync(VERSION_FILE, 'utf8').trim();
}

function leerVersionPaquete(pkg) {
  const rutaCompleta = path.join(ROOT_DIR, pkg.archivo);
  if (!fs.existsSync(rutaCompleta)) return 'N/A (No existe)';
  if (pkg.tipo === 'txt') {
    return fs.readFileSync(rutaCompleta, 'utf8').trim();
  }
  try {
    const data = JSON.parse(fs.readFileSync(rutaCompleta, 'utf8'));
    return data.version || 'Sin versión';
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

function escribirVersionPaquete(pkg, nuevaVersion) {
  const rutaCompleta = path.join(ROOT_DIR, pkg.archivo);
  if (!fs.existsSync(rutaCompleta)) return false;

  if (pkg.tipo === 'txt') {
    fs.writeFileSync(rutaCompleta, `${nuevaVersion}\n`, 'utf8');
    return true;
  }

  try {
    const raw = fs.readFileSync(rutaCompleta, 'utf8');
    const data = JSON.parse(raw);
    data.version = nuevaVersion;
    fs.writeFileSync(rutaCompleta, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return true;
  } catch (err) {
    console.error(`  ❌ Error actualizando ${pkg.archivo}: ${err.message}`);
    return false;
  }
}

function calcularBump(versionActual, tipo) {
  const partes = versionActual.split('.').map((p) => parseInt(p, 10));
  if (partes.length < 3 || partes.some(isNaN)) {
    throw new Error(`La versión actual "${versionActual}" no es un SemVer válido.`);
  }

  let [major, minor, patch] = partes;
  switch (tipo.toLowerCase()) {
    case 'major':
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor += 1;
      patch = 0;
      break;
    case 'patch':
      patch += 1;
      break;
    default:
      throw new Error(`Tipo de bump no válido: "${tipo}". Opciones: patch, minor, major.`);
  }

  return `${major}.${minor}.${patch}`;
}

function mostrarEstado() {
  const versionRaiz = obtenerVersionRaiz();
  console.log('📦 SICSAFT — Estado del Control de Versiones\n');
  console.log(`🎯 Versión Global Maestra (VERSION): v${versionRaiz}\n`);

  console.log('Subsistemas y Paquetes:');
  console.log('----------------------------------------------------------------------');
  console.log(String('Paquete').padEnd(25) + String('Versión Actual').padEnd(18) + 'Ruta');
  console.log('----------------------------------------------------------------------');

  let sincronizado = true;
  for (const pkg of PAQUETES) {
    const ver = leerVersionPaquete(pkg);
    const estaOk = ver === versionRaiz;
    if (!estaOk && pkg.clave !== 'root') sincronizado = false;

    const icono = estaOk ? '🟢' : '🟡';
    console.log(
      `${icono} ${pkg.nombre.padEnd(22)} ${ver.padEnd(16)} ${pkg.archivo}`
    );
  }

  console.log('----------------------------------------------------------------------');
  if (sincronizado) {
    console.log('\n✨ Todos los subsistemas están sincronizados con la versión maestra.');
  } else {
    console.log('\n⚠️ Hay discrepancias de versión entre subsistemas.');
    console.log('💡 Ejecuta "node herramientas/versionado/version-manager.mjs sync" para sincronizarlos.');
  }
}

function aplicarVersion(nuevaVersion, crearTag = false) {
  if (!SEMVER_REGEX.test(nuevaVersion)) {
    console.error(`\n❌ Error: "${nuevaVersion}" no cumple con el estándar Semantic Versioning (SemVer 2.0).`);
    process.exit(1);
  }

  console.log(`\n🚀 Aplicando nueva versión v${nuevaVersion} a todos los subsistemas...\n`);

  for (const pkg of PAQUETES) {
    const ok = escribirVersionPaquete(pkg, nuevaVersion);
    if (ok) {
      console.log(`  ✔ [${pkg.clave.padEnd(12)}] ${pkg.nombre} -> v${nuevaVersion}`);
    }
  }

  console.log(`\n✅ Versión v${nuevaVersion} aplicada con éxito en todos los subsistemas.`);

  if (crearTag) {
    try {
      execSync(`git tag -a v${nuevaVersion} -m "Release v${nuevaVersion}"`, { stdio: 'inherit', cwd: ROOT_DIR });
      console.log(`🏷️ Git tag "v${nuevaVersion}" creado.`);
    } catch (err) {
      console.warn(`⚠️ No se pudo crear el tag de git: ${err.message}`);
    }
  }
}

// CLI Principal
const args = process.argv.slice(2);
const comando = args[0] || 'status';
const flagTag = args.includes('--tag') || args.includes('--git-tag');

switch (comando.toLowerCase()) {
  case 'status':
  case '--status':
  case '-s':
    mostrarEstado();
    break;

  case 'sync':
    aplicarVersion(obtenerVersionRaiz(), flagTag);
    break;

  case 'set':
    const targetVer = args[1];
    if (!targetVer) {
      console.error('\n❌ Debes especificar la versión. Ej: node version-manager.mjs set 1.0.0');
      process.exit(1);
    }
    aplicarVersion(targetVer, flagTag);
    break;

  case 'bump':
    const tipoBump = args[1] || 'patch';
    const verActual = obtenerVersionRaiz();
    try {
      const siguienteVer = calcularBump(verActual, tipoBump);
      aplicarVersion(siguienteVer, flagTag);
    } catch (err) {
      console.error(`\n❌ Error en bump: ${err.message}`);
      process.exit(1);
    }
    break;

  default:
    console.log(`
Uso de SICSAFT Version Manager:
  node herramientas/versionado/version-manager.mjs status               # Muestra el estado actual
  node herramientas/versionado/version-manager.mjs sync                 # Sincroniza todos los paquetes con VERSION
  node herramientas/versionado/version-manager.mjs set <version>        # Establece una versión específica (ej. 1.0.0)
  node herramientas/versionado/version-manager.mjs bump <patch|minor|major> # Sube versión automáticamente
    `);
    break;
}
