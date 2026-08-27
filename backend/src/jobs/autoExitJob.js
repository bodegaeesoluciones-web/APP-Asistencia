'use strict';

/**
 * autoExitJob.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Job automático que se ejecuta todos los días a las 9:00 PM (hora Panamá).
 *
 * Busca técnicos activos que:
 *   1. Registraron ENTRADA válida hoy.
 *   2. NO registraron SALIDA hoy.
 *   3. Tienen configurada una hora de salida (exit_time) en su perfil.
 *
 * Para cada uno, inserta automáticamente un registro de salida usando la hora
 * configurada en `users.exit_time` (p. ej. '16:30'), marcado como
 * is_manual_edit = true y manual_status = 'Auto-salida'.
 *
 * También registra cada acción en audit_log con la acción 'AUTO_EXIT_APPLIED'.
 * ──────────────────────────────────────────────────────────────────────────────
 */

const cron = require('node-cron');
const { pool } = require('../config/db');
const { getSettings } = require('../services/settingsService');
const { logAudit } = require('../utils/audit');

/**
 * Procesa y registra la salida automática de los técnicos que no han
 * marcado salida en el día actual.
 *
 * @returns {Promise<void>}
 */
async function runAutoExit() {
  console.log('[AutoExitJob] Iniciando verificación de salidas pendientes...');

  try {
    const settings = await getSettings();
    const TZ = (settings.timezone && settings.timezone.trim())
      ? settings.timezone.trim()
      : 'America/Panama';

    // Fecha de hoy en la zona horaria configurada (formato 'YYYY-MM-DD')
    const todayInTz = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

    // ── Consultar técnicos con entrada pero sin salida hoy, que tengan
    //    exit_time configurado en su perfil ──────────────────────────────────
    const { rows: pendingUsers } = await pool.query(
      `SELECT u.id, u.full_name, u.exit_time
       FROM users u
       WHERE u.role != 'admin'
         AND u.status = 'active'
         AND u.exit_time IS NOT NULL
         AND u.exit_time != ''
         AND EXISTS (
           SELECT 1 FROM attendance a
           WHERE a.user_id = u.id
             AND DATE(a.timestamp AT TIME ZONE $1) = $2::date
             AND a.type = 'entry'
             AND a.is_valid = true
         )
         AND NOT EXISTS (
           SELECT 1 FROM attendance a
           WHERE a.user_id = u.id
             AND DATE(a.timestamp AT TIME ZONE $1) = $2::date
             AND a.type = 'exit'
         )`,
      [TZ, todayInTz]
    );

    if (pendingUsers.length === 0) {
      console.log('[AutoExitJob] No hay técnicos con salida pendiente. Nada que hacer.');
      return;
    }

    console.log(`[AutoExitJob] Técnicos con salida pendiente: ${pendingUsers.length}`);

    for (const user of pendingUsers) {
      try {
        // Construir el timestamp de salida: 'YYYY-MM-DD HH:MM:00' → convertir
        // a UTC usando la zona horaria configurada (igual que overrideAttendance)
        const exitTime = user.exit_time; // e.g. '16:30'
        const timestampStr = `${todayInTz} ${exitTime}:00`; // 'YYYY-MM-DD HH:MM:00'

        // Insertar registro de salida automático
        await pool.query(
          `INSERT INTO attendance
             (user_id, type, timestamp, is_valid, is_manual_edit, manual_status, ip_address)
           VALUES
             ($1, 'exit', $2::timestamp AT TIME ZONE $3, true, true, 'Auto-salida', 'system')`,
          [user.id, timestampStr, TZ]
        );

        // Registrar en auditoría
        await logAudit({
          userId: null, // acción del sistema, no de un usuario humano
          action: 'AUTO_EXIT_APPLIED',
          details: {
            targetUserId: user.id,
            targetFullName: user.full_name,
            exitTime: user.exit_time,
            date: todayInTz,
            tz: TZ,
          },
          ipAddress: 'system',
          deviceFingerprint: null,
          success: true,
        });

        console.log(
          `[AutoExitJob] ✅ Salida automática registrada → ${user.full_name} (${user.exit_time})`
        );
      } catch (userErr) {
        console.error(
          `[AutoExitJob] ❌ Error al registrar salida para ${user.full_name} (id=${user.id}):`,
          userErr.message
        );
      }
    }

    console.log('[AutoExitJob] Proceso completado.');
  } catch (err) {
    console.error('[AutoExitJob] Error general en el job:', err.message);
  }
}

/**
 * Inicializa el cron job.
 * Expresión: '0 21 * * *' → todos los días a las 9:00 PM.
 *
 * node-cron evalúa la expresión en la hora del sistema (UTC en servidores
 * de producción). Se usa la opción `timezone` para fijarla a Panamá.
 */
function startAutoExitJob() {
  // Ejecutar todos los días a las 9:00 PM hora Panamá (America/Panama)
  cron.schedule('0 21 * * *', runAutoExit, {
    timezone: 'America/Panama',
  });

  console.log(
    '[AutoExitJob] Job programado: todos los días a las 9:00 PM (America/Panama)'
  );
}

module.exports = { startAutoExitJob, runAutoExit };
