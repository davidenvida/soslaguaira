-- Merge cross-fuente sin borrar: una misma persona reportada en X e IG (distinto fuente_url).
-- 'fuentes' acumula fuentes adicionales; 'duplicate_of' marca un registro como duplicado de otro.
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS fuentes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS duplicate_of INTEGER REFERENCES personas_intel(id);

CREATE INDEX IF NOT EXISTS idx_personas_intel_duplicate_of ON personas_intel (duplicate_of);
