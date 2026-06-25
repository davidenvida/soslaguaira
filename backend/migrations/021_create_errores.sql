-- Reportar error: la gente reporta bugs del sitio (se ven en /stats, admin).
CREATE TABLE IF NOT EXISTS errores (
  id         SERIAL PRIMARY KEY,
  texto      TEXT NOT NULL,        -- donde esta el error
  contacto   TEXT,
  pais       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_errores_created_at ON errores (created_at DESC);
