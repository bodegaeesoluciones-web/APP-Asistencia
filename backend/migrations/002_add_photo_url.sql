-- ============================================================
-- Migración 002: Agregar columna photo_url a attendance
-- ============================================================

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);

-- Índice opcional para búsquedas de registros con foto
CREATE INDEX IF NOT EXISTS idx_attendance_photo_url ON attendance(photo_url)
  WHERE photo_url IS NOT NULL;
