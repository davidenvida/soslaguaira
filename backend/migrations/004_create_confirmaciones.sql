-- Confirmaciones: votos de la comunidad (confirmo/desmiento) sobre cualquier reporte
CREATE TABLE IF NOT EXISTS confirmaciones (
  id           SERIAL PRIMARY KEY,
  tipo_reporte TEXT NOT NULL CHECK (tipo_reporte IN ('persona','atrapado','edificio')),
  reporte_id   INTEGER NOT NULL,
  voto         TEXT NOT NULL CHECK (voto IN ('confirmo','desmiento')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_confirmaciones_reporte ON confirmaciones (tipo_reporte, reporte_id);
