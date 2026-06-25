-- Fase 3: persistir las listas manuscritas interpretadas para alerta proactiva.
-- Al crear un reporte se cruza nombre+cedula contra lista_entradas -> alerta.
CREATE TABLE IF NOT EXISTS listas_manuscritas (
  id             SERIAL PRIMARY KEY,
  fuente         TEXT,        -- hospital / refugio / origen de la lista
  tipo           TEXT,        -- ingresados | fallecidos | trasladados | heridos | ...
  descripcion    TEXT,
  total_entradas INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lista_entradas (
  id         SERIAL PRIMARY KEY,
  lista_id   INTEGER NOT NULL REFERENCES listas_manuscritas(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  cedula     TEXT,            -- normalizada (solo digitos)
  estado     TEXT,
  detalle    TEXT,
  lugar      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lista_entradas_cedula ON lista_entradas (cedula);
CREATE INDEX IF NOT EXISTS idx_lista_entradas_lista ON lista_entradas (lista_id);
