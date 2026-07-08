-- ============================================================
-- Migración 005: Actualizar timezone a America/Panama
-- ============================================================
-- Panamá usa GMT-5 fijo (sin horario de verano).
-- America/Lima también es GMT-5 pero tiene reglas históricas de DST
-- que pueden causar diferencias en cálculos de fechas históricas.
-- America/Panama es el identificador correcto y más preciso.

UPDATE settings
SET value = 'America/Panama',
    updated_at = NOW()
WHERE key = 'timezone'
  AND (value = 'America/Lima' OR value IS NULL);

-- Si no existía, insertar
INSERT INTO settings (key, value)
VALUES ('timezone', 'America/Panama')
ON CONFLICT (key) DO NOTHING;
