-- Marcar a salvo responsable: auditoria de QUIEN confirma + reversion.
-- Marcar a salvo detiene la busqueda, por eso se registra quien lo confirmo y se puede revertir.
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS confirmado_por TEXT;
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS confirmado_contacto TEXT;
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS confirmado_at TIMESTAMPTZ;
ALTER TABLE personas_intel ADD COLUMN IF NOT EXISTS revertido_at TIMESTAMPTZ;
