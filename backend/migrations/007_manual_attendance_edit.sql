-- ============================================================
-- Migración 007: Soporte para edición manual de asistencias
-- ============================================================
-- Agrega las columnas necesarias para que los administradores
-- puedan editar manualmente registros de asistencia desde
-- la Planilla Quincenal sin errores de columna inexistente.

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS is_manual_edit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_status  VARCHAR(50) DEFAULT NULL;

-- Índice para consultas de registros editados manualmente
CREATE INDEX IF NOT EXISTS idx_attendance_is_manual_edit
  ON attendance(is_manual_edit)
  WHERE is_manual_edit = true;

COMMENT ON COLUMN attendance.is_manual_edit IS
  'Indica si el registro fue creado o modificado manualmente por un administrador';

COMMENT ON COLUMN attendance.manual_status IS
  'Estado especial asignado manualmente (ej: Ausente, Incapacitado, Suspendido)';
