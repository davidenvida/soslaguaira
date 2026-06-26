-- Feature 'Match reportes<->listas': registrar cuando un reporte fue revisado contra las
-- listas manuscritas de hospital (reunificacion). Aditivo, nullable.
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS revisado_listas_at  TIMESTAMPTZ;
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS revisado_listas_por TEXT;
