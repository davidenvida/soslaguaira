-- Buzon de sugerencias del sitio publico.
CREATE TABLE IF NOT EXISTS sugerencias (
  id         SERIAL PRIMARY KEY,
  texto      TEXT NOT NULL,
  contacto   TEXT,
  pais       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sugerencias_created_at ON sugerencias (created_at DESC);
