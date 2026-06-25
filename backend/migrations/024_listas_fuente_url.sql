-- Enlace a la publicacion de origen de la lista (el tweet/post de donde se saco).
-- (Distinto de 'fuente' = nombre del hospital.)
ALTER TABLE listas_manuscritas ADD COLUMN IF NOT EXISTS fuente_url TEXT;

-- Quien subio la lista (nombre/apellido/telefono). Visible solo a admin.
ALTER TABLE listas_manuscritas ADD COLUMN IF NOT EXISTS subido_nombre TEXT;
ALTER TABLE listas_manuscritas ADD COLUMN IF NOT EXISTS subido_apellido TEXT;
ALTER TABLE listas_manuscritas ADD COLUMN IF NOT EXISTS subido_telefono TEXT;
