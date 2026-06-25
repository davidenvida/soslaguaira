-- "Ver listas subidas": guardar la imagen original de cada lista interpretada.
ALTER TABLE listas_manuscritas ADD COLUMN IF NOT EXISTS foto_url TEXT;
