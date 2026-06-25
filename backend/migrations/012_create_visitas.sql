-- Analitica de visitas propia (sin Cloudflare, sin cookies, sin IP completa).
-- 'pais' sale del header CF-IPCountry si viene; nunca se guarda la IP.
CREATE TABLE IF NOT EXISTS visitas (
  id         SERIAL PRIMARY KEY,
  path       TEXT,
  pais       TEXT,
  referer    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitas_created_at ON visitas (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitas_pais ON visitas (pais);
CREATE INDEX IF NOT EXISTS idx_visitas_path ON visitas (path);
