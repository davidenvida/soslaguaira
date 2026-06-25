-- Cola PRIVADA de coincidencias sensibles (roster de FALLECIDOS): nunca se muestra a la
-- familia en el flujo publico; el admin/David las maneja con cuidado y verificacion.
CREATE TABLE IF NOT EXISTS coincidencias_sensibles (
  id               SERIAL PRIMARY KEY,
  reportado_nombre TEXT,
  reportado_cedula TEXT,
  reportado_origen TEXT,
  entrada_nombre   TEXT,
  entrada_estado   TEXT,
  lista_fuente     TEXT,
  lista_tipo       TEXT,
  atendida         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coinc_sensibles_atendida ON coincidencias_sensibles (atendida);
