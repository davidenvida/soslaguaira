-- Voluntarios: gente que se organiza para ayudar. Flexible (tipo_ayuda libre).
CREATE TABLE IF NOT EXISTS voluntarios (
  id             SERIAL PRIMARY KEY,
  nombre         TEXT NOT NULL,
  contacto       TEXT NOT NULL,          -- tel / correo / redes
  zona           TEXT,                   -- ubicacion donde ayuda
  tipo_ayuda     TEXT,                   -- medico/rescate/transporte/alojamiento/alimentos/busqueda/psicologico/donaciones/otro
  disponibilidad TEXT,
  fuente_url     TEXT,                   -- de donde se recopilo (link de internet)
  notas          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voluntarios_zona ON voluntarios (zona);
CREATE INDEX IF NOT EXISTS idx_voluntarios_tipo ON voluntarios (tipo_ayuda);
CREATE INDEX IF NOT EXISTS idx_voluntarios_created ON voluntarios (created_at DESC);
