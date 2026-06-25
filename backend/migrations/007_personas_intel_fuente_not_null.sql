-- fuente_url OBLIGATORIO en personas_intel: cada persona enlazada a su tweet (trazabilidad).
-- Seguro: las filas actuales ya tienen fuente_url (verificado, 0 nulos).
ALTER TABLE personas_intel ALTER COLUMN fuente_url SET NOT NULL;
