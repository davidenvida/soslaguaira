-- Habilita UPSERT por (nombre_completo, fuente_url): un re-post con foto enriquece en vez de ignorar.
-- fuente_url ya es NOT NULL (007), asi que el indice plano equivale al funcional anterior
-- y permite la inferencia de ON CONFLICT (nombre_completo, fuente_url).
DROP INDEX IF EXISTS uq_personas_intel_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS uq_personas_intel_dedup
  ON personas_intel (nombre_completo, fuente_url);
