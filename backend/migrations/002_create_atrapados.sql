-- Atrapados: reportes de RESCATE URGENTE
CREATE TABLE IF NOT EXISTS atrapados (
  id                SERIAL PRIMARY KEY,
  cantidad_personas INTEGER NOT NULL DEFAULT 1 CHECK (cantidad_personas > 0),
  edificio          TEXT,
  piso              TEXT,
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  direccion         TEXT,
  estado            TEXT NOT NULL DEFAULT 'atrapado'
                      CHECK (estado IN ('atrapado','en_rescate','rescatado','fallecido')),
  descripcion       TEXT,
  foto_url          TEXT,
  contacto          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atrapados_estado ON atrapados (estado);
CREATE INDEX IF NOT EXISTS idx_atrapados_created_at ON atrapados (created_at DESC);
