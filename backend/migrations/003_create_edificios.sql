-- Edificios: estado estructural y de rescate
CREATE TABLE IF NOT EXISTS edificios (
  id                   SERIAL PRIMARY KEY,
  nombre               TEXT NOT NULL,
  lat                  DOUBLE PRECISION,
  lng                  DOUBLE PRECISION,
  direccion            TEXT,
  estado               TEXT NOT NULL DEFAULT 'dano_grave'
                         CHECK (estado IN ('colapsado','dano_grave','atrapados','en_rescate','evacuado_ok')),
  atrapados_estimados  INTEGER DEFAULT 0 CHECK (atrapados_estimados >= 0),
  descripcion          TEXT,
  foto_url             TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edificios_estado ON edificios (estado);
CREATE INDEX IF NOT EXISTS idx_edificios_created_at ON edificios (created_at DESC);
