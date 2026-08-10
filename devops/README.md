# Infraestructura / DevOps / Observabilidad SICSAFT (capacidad transversal — OPS)

## Objetivo
Capacidad transversal de infraestructura, CI/CD y observabilidad para todos los sistemas del
ecosistema (APP QR, CIS, CORE, WEB, CIP, RFID, Integraciones).

## Estado
🔲 No iniciado. Carpeta creada como placeholder.

## Alcance previsto
- CI/CD por sistema (cada uno probablemente con su propio pipeline).
- Estrategia de logs/trazas/métricas compartida (correlationId de extremo a extremo — ver
  DOC-002 del Conector QR para el diseño ya definido a nivel de APP QR/CIS).
- Gestión de secretos y variables de entorno por ambiente.
- Estrategia de despliegue (APP QR ya usa Vercel para el front — ver `../app-qr-sicsaft/vercel.json`).

## Depende de
Decisiones de stack de cada sistema (CIS, CORE, etc.) para poder definir pipelines concretos.

## Bloquea
Nada de forma dura, pero sin esto no hay entorno productivo real para ningún sistema más allá
de APP QR.

## Documentos relacionados
Pendiente: DOC-018 Observabilidad, DOC-019 Infraestructura.
Marco de referencia ya definido (aplicable sin importar el proveedor de nube que se elija):
[ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) — pilar de Excelencia Operacional (§2: IaC, CI/CD
por sistema, `correlationId` de extremo a extremo, tres señales de observabilidad, despliegues
progresivos) y pilar de Costos (§6: escalar cada nivel de forma independiente, autoscaling por
demanda real, apagar lo que no tiene tráfico).

## Próximo paso sugerido
Esperar a tener CIS/CORE con un ADR de stack antes de diseñar pipelines concretos — hoy sería
prematuro. El marco de [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) ya está disponible como
entregable: tarjeta Trello `OPS-DOC-001` (Hecho).
