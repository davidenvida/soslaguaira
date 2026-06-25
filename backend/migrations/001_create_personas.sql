-- Personas: reportes de "busco" (desaparecidos) y "reporto" (a salvo / visto)
CREATE TABLE IF NOT EXISTS personas (
  id                SERIAL PRIMARY KEY,
  tipo              TEXT NOT NULL CHECK (tipo IN ('busco', 'reporto')),
  nombre            TEXT NOT NULL,
  edad              INTEGER,
  descripcion       TEXT,
  foto_url          TEXT,
  estado            TEXT NOT NULL DEFAULT 'desconocido'
                      CHECK (estado IN ('desaparecido','a_salvo','herido','visto_con_vida','fallecido','desconocido')),
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  direccion         TEXT,
  edificio          TEXT,
  piso              TEXT,
  contacto_nombre   TEXT,
  contacto_telefono TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personas_tipo ON personas (tipo);
CREATE INDEX IF NOT EXISTS idx_personas_estado ON personas (estado);
CREATE INDEX IF NOT EXISTS idx_personas_created_at ON personas (created_at DESC);
