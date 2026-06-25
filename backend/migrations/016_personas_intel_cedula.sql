-- Cedula como llave de identidad: reporte del publico con cedula + lista manuscrita
-- con cedula = match DEFINITIVO. Se guarda normalizada (solo digitos). Aditiva, nullable.
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS cedula TEXT;
CREATE INDEX IF NOT EXISTS idx_personas_intel_cedula ON personas_intel (cedula);

-- Tabla personas (reportes de la app: busco/reporto): cedula opcional para reunificacion.
ALTER TABLE personas ADD COLUMN IF NOT EXISTS cedula TEXT;
CREATE INDEX IF NOT EXISTS idx_personas_cedula ON personas (cedula);
