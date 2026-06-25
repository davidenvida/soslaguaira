-- Unificacion del directorio: personas_intel = reportes OSINT + reportes de la app.
-- origen distingue la fuente; fuente_url pasa a ser obligatorio SOLO para osint.

ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'osint'
  CHECK (origen IN ('osint', 'app'));

-- lat/lng directos: cuando la persona marca el pin en el mapa del formulario.
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- fuente_url: obligatorio solo para osint (trazabilidad al tweet); opcional para app.
ALTER TABLE personas_intel ALTER COLUMN fuente_url DROP NOT NULL;
ALTER TABLE personas_intel ADD CONSTRAINT chk_personas_intel_fuente_osint
  CHECK (origen = 'app' OR fuente_url IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_personas_intel_origen ON personas_intel (origen);
