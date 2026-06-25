-- DEDUP de residencias por (nombre, parroquia) para carga incremental del CSV
-- sin duplicar a medida que se agregan bloques. parroquia NULL se trata como cadena vacia
-- (mismo criterio que personas_intel).
CREATE UNIQUE INDEX IF NOT EXISTS uq_residencias_dedup
  ON residencias (nombre, COALESCE(parroquia, ''));
