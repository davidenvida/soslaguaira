-- Tracking de aviso a la familia en coincidencias (reunificacion): si ya se informo y por que via.
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS informado_familia BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS informado_via TEXT;  -- telefono | publicacion
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS informado_at TIMESTAMPTZ;
