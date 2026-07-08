/**
 * Timezone utilities for Panamá (America/Panama, GMT-5, sin horario de verano).
 *
 * PROBLEMA CONOCIDO:
 *   new Date().toISOString() siempre devuelve UTC.
 *   En Panamá (GMT-5), si son las 19:00 hora local, UTC es 00:00 del día siguiente.
 *   Esto hace que "hoy" sea incorrecto al usar toISOString().split('T')[0].
 *
 * SOLUCIÓN:
 *   Usar Intl.DateTimeFormat con timeZone: 'America/Panama' para obtener
 *   la fecha/hora correcta en Panamá en todo momento.
 */

export const PANAMA_TZ = 'America/Panama';

/**
 * Retorna la fecha de hoy en Panamá como string 'YYYY-MM-DD'.
 */
export function todayPanama() {
  return new Date().toLocaleDateString('en-CA', { timeZone: PANAMA_TZ });
}

/**
 * Retorna la fecha de hace N días en Panamá como string 'YYYY-MM-DD'.
 */
export function daysAgoPanama(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: PANAMA_TZ });
}

/**
 * Formatea un string de timestamp (sin zona, ej: '2026-07-07T09:29:25')
 * que ya viene convertido por el backend a America/Panama.
 * Retorna solo la hora HH:MM en formato es-ES.
 *
 * IMPORTANTE: El backend devuelve local_time como string SIN zona horaria,
 * ya convertido a America/Panama. Al concatenar 'T' sin zona, new Date()
 * lo trata como hora local del navegador, lo que puede ser incorrecto si
 * el PC no está configurado en GMT-5.
 * Solución: parsear manualmente HH:MM del string.
 */
export function formatTimeFromLocalStr(localTimeStr) {
  if (!localTimeStr) return '--:--';
  // localTimeStr = '2026-07-07T09:29:25' (ya en hora Panamá)
  // Extraer HH:MM directamente del string para evitar reinterpretación
  const timePart = localTimeStr.split('T')[1];
  if (!timePart) return '--:--';
  return timePart.slice(0, 5); // 'HH:MM'
}

/**
 * Extrae la fecha 'YYYY-MM-DD' de un string local_time del backend.
 * Seguro porque no pasa por el constructor de Date.
 */
export function extractDateFromLocalStr(localTimeStr) {
  if (!localTimeStr) return '';
  return localTimeStr.split('T')[0]; // 'YYYY-MM-DD'
}
