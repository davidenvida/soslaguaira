-- Busqueda ACCENT-INSENSITIVE: los nombres venezolanos llevan tildes (Simon/Simon, Jose, Perez).
-- Habilita unaccent() para usar en los WHERE de busqueda (unaccent(col) ILIKE unaccent(q)).
CREATE EXTENSION IF NOT EXISTS unaccent;
