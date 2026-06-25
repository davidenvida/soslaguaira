-- Enriquecimiento de analitica de visitas: ubicacion, operadora y dispositivo.
-- PRIVACIDAD: NO se guarda la IP; solo lo derivado (region/ciudad/operadora) via geo-IP.
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS ciudad TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS operadora TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS dispositivo TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS navegador TEXT;

CREATE INDEX IF NOT EXISTS idx_visitas_operadora ON visitas (operadora);
CREATE INDEX IF NOT EXISTS idx_visitas_ciudad ON visitas (ciudad);
