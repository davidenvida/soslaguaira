-- Takedown / resguardo de privacidad: marcar fichas para revision/remocion humana.
-- NO borra; solo marca. Un humano revisa la cola de flaggeadas.
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS flag_motivo TEXT;
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_personas_intel_flagged ON personas_intel (flagged);
