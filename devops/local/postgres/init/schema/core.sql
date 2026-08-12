-- Esquema de CORE para el modelo de Contrato (base-patrimonial/DOC-004-modelo-contrato.md §2).
-- Asume que ya existe y esta seleccionada la base `core` (ver init/02-core.sh, que crea la base
-- y despues aplica este archivo) — no crea la base ni el usuario, solo tablas y datos.
--
-- Reusado tal cual por CI (core-ci.yml aplica este mismo archivo contra el servicio postgres del
-- job) para que el esquema de prueba nunca se desincronice del que corre en docker-compose local.

-- Organizacion: solo cache de lectura del org_id/nombre que administra Zitadel (fuente de
-- verdad de identidad) — ver DOC-004 §2 "Organización". Nunca se escribe de vuelta a Zitadel.
CREATE TABLE organizaciones (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL
);

-- Sede: unidad gruesa de cobertura contractual (DOC-004 §2 "Sede").
CREATE TABLE sedes (
    id TEXT PRIMARY KEY,
    organizacion_id TEXT NOT NULL REFERENCES organizaciones (id),
    nombre TEXT NOT NULL
);

CREATE TABLE contratos (
    id TEXT PRIMARY KEY,
    organizacion_id TEXT NOT NULL REFERENCES organizaciones (id),
    vigencia_desde TIMESTAMPTZ NOT NULL,
    -- NULL = indefinido, vigente hasta cancelacion explicita (DOC-004 §2 "Contrato").
    vigencia_hasta TIMESTAMPTZ,
    estado TEXT NOT NULL CHECK (
        estado IN ('vigente', 'suspendido', 'vencido', 'cancelado')
    ),
    -- Vocabulario controlado de DOC-004 §5 — hoy solo existe 'inventario-qr'.
    modulos_contratados TEXT[] NOT NULL DEFAULT '{}',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relacion N:N contrato<->sede (DOC-004 §2: "un contrato puede cubrir varias sedes").
-- El invariante "una sede, un contrato vigente" (DOC-004 §4) no se enforcea acá con una
-- constraint (requeriria un indice parcial cruzando el estado de `contratos`, que Postgres no
-- soporta directo sin trigger) — se valida en la capa de aplicacion
-- (assertInvarianteSedeUnContratoVigente en core/src/entitlements/contrato.seed.ts), igual que ya
-- se hacia para el seed en memoria. No hay endpoint de escritura todavia, asi que esto alcanza.
CREATE TABLE contrato_sedes (
    contrato_id TEXT NOT NULL REFERENCES contratos (id) ON DELETE CASCADE,
    sede_id TEXT NOT NULL REFERENCES sedes (id) ON DELETE CASCADE,
    PRIMARY KEY (contrato_id, sede_id)
);

-- Seed: mismo caso de negocio que core/src/entitlements/contrato.seed.ts (SEED_CONTRATOS) y que
-- cis/src/qr-connector/qr-connector.seed.ts — DUOC UC, contrato vigente solo para Melipilla.
-- Mantener sincronizado a mano si alguno de los tres cambia.
INSERT INTO organizaciones (id, nombre) VALUES ('duoc-uc', 'DUOC UC');

INSERT INTO sedes (id, organizacion_id, nombre)
VALUES ('melipilla', 'duoc-uc', 'Melipilla');

INSERT INTO contratos (
    id, organizacion_id, vigencia_desde, vigencia_hasta, estado, modulos_contratados
)
VALUES (
    'contrato-duoc-uc-melipilla',
    'duoc-uc',
    '2026-01-01T00:00:00.000Z',
    NULL,
    'vigente',
    ARRAY['inventario-qr']
);

INSERT INTO contrato_sedes (contrato_id, sede_id)
VALUES ('contrato-duoc-uc-melipilla', 'melipilla');
