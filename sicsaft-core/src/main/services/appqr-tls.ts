import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { X509Certificate } from "node:crypto";
import selfsigned from "selfsigned";
import { obtenerIpLan } from "./lan-ip";

// DOC-028 Fase D -- el .exe sirve la PWA de app-qr-sicsaft para que el teléfono del Profesional de
// AFT la abra escaneando un QR. El teléfono llega por la IP de LAN de la PC, nunca "localhost":
// sin HTTPS eso NO es "contexto seguro" y crypto.subtle/PKCE (login OIDC de la APP QR) no existen.
// Mismo criterio que @vitejs/plugin-basic-ssl que usa `vite preview` de app-qr-sicsaft -- el cert
// es autofirmado (el navegador del teléfono muestra un aviso la primera vez, se acepta y queda),
// no se busca que valide contra una CA.
//
// Se genera una vez y se cachea en userData (mismo directorio que postgres-data / keycloak-admin.json).
// Se regenera si venció o si su SubjectAltName ya no cubre la IP de LAN actual (un cambio de IP,
// DOC-028 Fase C, mueve dónde escucha el server -- el aviso del navegador aparece igual por ser
// autofirmado, pero al menos el cert nombra el host correcto).
export interface CertificadoTls {
  key: string;
  cert: string;
}

const VALIDEZ_ANIOS = 10;

function rutaDir(): string {
  return join(app.getPath("userData"), "appqr-tls");
}

function certCubre(certPath: string, ip: string): boolean {
  try {
    const cert = new X509Certificate(readFileSync(certPath));
    if (new Date(cert.validTo).getTime() < Date.now()) return false;
    // subjectAltName p.ej.: "IP Address:192.168.1.8, DNS:localhost"
    return (cert.subjectAltName ?? "").includes(ip);
  } catch {
    return false;
  }
}

export async function obtenerCertificadoAppQr(): Promise<CertificadoTls> {
  const dir = rutaDir();
  const keyPath = join(dir, "key.pem");
  const certPath = join(dir, "cert.pem");
  const ip = obtenerIpLan();

  if (existsSync(keyPath) && existsSync(certPath) && certCubre(certPath, ip)) {
    return {
      key: readFileSync(keyPath, "utf-8"),
      cert: readFileSync(certPath, "utf-8"),
    };
  }

  const vence = new Date();
  vence.setFullYear(vence.getFullYear() + VALIDEZ_ANIOS);
  const pems = await selfsigned.generate([{ name: "commonName", value: ip }], {
    keySize: 2048,
    algorithm: "sha256",
    notAfterDate: vence,
    extensions: [
      { name: "basicConstraints", cA: false },
      {
        name: "subjectAltName",
        altNames: [
          { type: 7, ip }, // IP SAN -- el host real por el que llega el teléfono
          { type: 2, value: "localhost" }, // por si se prueba desde la misma PC
        ],
      },
    ],
  });

  mkdirSync(dir, { recursive: true });
  writeFileSync(keyPath, pems.private, { mode: 0o600 });
  writeFileSync(certPath, pems.cert);
  return { key: pems.private, cert: pems.cert };
}
