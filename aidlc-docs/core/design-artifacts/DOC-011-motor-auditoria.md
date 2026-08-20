# DOC-011: Motor de Auditoría (Fase 2)

## Alcance MVP

```ts
interface AuditoriaRepository {
  registrar(entrada: {
    usuario: string;         // operadorId del ContextoOperacion
    equipo?: string;         // sin dato real todavia -- ver "Que NO resuelve"
    ip?: string;              // idem
    operacion: string;        // ej. "POST /inventarios"
    resultado: string;        // "recibido" | "rechazado:<motivo>"
    observaciones?: string;
  }): Promise<void>;
}
```

Invocado **una vez por transacción**, siempre, desde el Orquestador (DOC-007) — nunca desde un
motor individual, para no duplicar el registro si un motor falla a mitad de camino.

## `equipo`/`ip`: sin dato real en esta fase

Tomo IV 2.9 pide "usuario, fecha, hora, operación, resultado, equipo, dirección IP" — CIS no le
pasa a CORE ni el equipo ni la IP del operador hoy (`CoreClientService` no reenvía esos datos, y
DOC-006 no los agrega al contrato porque DOC-002 tampoco los pide del cliente). Se dejan como
columnas nullable en `auditoria` (ya así en DOC-005) y se completan cuando CIS los propague —
no se bloquea esta fase por un dato que ningún nivel superior está enviando todavía.

## Qué NO resuelve este documento

- Consulta/reporte de auditoría (`GET /auditoria`) — sin consumidor (CIP, Fase 6).
- Retención/purga — Tomo III 4.10 dice que el historial nunca se borra; sin política de archivado
  todavía porque no hay volumen real que la justifique.

## Documentos relacionados

[ARCHITECTURA-WAF.md 3](../../../ARQUITECTURA-WAF.md#3-pilar-seguridad) — "la auditoría es en sí
un control de seguridad". [DOC-007](DOC-007-arquitectura-core.md) — quién la invoca y cuándo.
