-- Capa de INGESTA de intel de X (tiempo real). NO toca las tablas existentes.

-- 1) personas_intel: reportes crudos recopilados por las asistentes.
CREATE TABLE IF NOT EXISTS personas_intel (
  id                SERIAL PRIMARY KEY,
  nombre_completo   TEXT NOT NULL,
  edad              INTEGER,
  estado            TEXT NOT NULL CHECK (estado IN ('desaparecido','a_salvo','fallecido','atrapado')),
  ultima_ubicacion  TEXT,
  parroquia         TEXT,
  sector_o_edificio TEXT,
  descripcion       TEXT,
  foto_url          TEXT,
  reportante        TEXT,
  relacion          TEXT,
  contacto          TEXT,
  fuente_url        TEXT,
  fecha_reporte     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personas_intel_estado ON personas_intel (estado);
CREATE INDEX IF NOT EXISTS idx_personas_intel_parroquia ON personas_intel (parroquia);

-- DEDUP: el mismo tweet (nombre + fuente) no se duplica. fuente_url NULL se trata como cadena vacia.
CREATE UNIQUE INDEX IF NOT EXISTS uq_personas_intel_dedup
  ON personas_intel (nombre_completo, COALESCE(fuente_url, ''));

-- 2) residencias: urbanizaciones/edificios/sectores referenciados en la intel.
CREATE TABLE IF NOT EXISTS residencias (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  parroquia   TEXT,
  tipo        TEXT CHECK (tipo IN ('urbanizacion','edificio','sector')),
  lat         DOUBLE PRECISION,
  lon         DOUBLE PRECISION,
  fuente      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_residencias_parroquia ON residencias (parroquia);
