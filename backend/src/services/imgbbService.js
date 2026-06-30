'use strict';

/**
 * ImgBB Service
 * Sube fotos de evidencia de asistencia a ImgBB.
 * Retorna la URL pública directa.
 *
 * Requiere en Render:
 *   IMGBB_API_KEY — Tu clave de API de ImgBB
 */

async function uploadPhoto(base64Data, username, type) {
  if (!process.env.IMGBB_API_KEY) {
    throw new Error('IMGBB_API_KEY no configurado en las variables de entorno de Render.');
  }

  // Quitar la cabecera data:image/...;base64, si existe
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

  const formData = new URLSearchParams();
  formData.append('key', process.env.IMGBB_API_KEY);
  formData.append('image', cleanBase64);
  
  // Nombre opcional para el archivo
  const typeLabel = type === 'entry' ? 'entrada' : 'salida';
  const safeUser = (username || 'usuario').replace(/[^a-zA-Z0-9_-]/g, '_');
  formData.append('name', `${safeUser}_${typeLabel}_${Date.now()}`);

  const resp = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await resp.json();

  if (!resp.ok || !data.success) {
    throw new Error(`ImgBB upload failed: ${data.error?.message || resp.statusText}`);
  }

  return data.data.url; // Devuelve directamente la URL final
}

module.exports = { uploadPhoto };
