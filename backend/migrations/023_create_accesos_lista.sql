-- Gate de acceso a la imagen de una lista: para ver/descargar la foto hay que dejar
-- nombre + telefono. Queda registro de que un familiar accedio (evidencia de aviso).
CREATE TABLE IF NOT EXISTS accesos_lista (
  id         SERIAL PRIMARY KEY,
  lista_id   INTEGER NOT NULL REFERENCES listas_manuscritas(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  telefono   TEXT NOT NULL,
  pais       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accesos_lista_lista ON accesos_lista (lista_id);
