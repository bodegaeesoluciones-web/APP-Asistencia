'use strict';

/**
 * Imgur Service
 * Sube fotos de evidencia de asistencia a Imgur usando la API anónima.
 * Retorna la URL pública directa.
 *
 * Requiere en Render:
 *   IMGUR_CLIENT_ID — Client ID de tu aplicación en Imgur
 */

async function uploadPhoto(base64Data, username, type) {
  if (!process.env.IMGUR_CLIENT_ID) {
    throw new Error('IMGUR_CLIENT_ID no configurado en las variables de entorno de Render.');
  }

  // Quitar la cabecera data:image/png;base64, si existe, para enviar solo el contenido
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

  const formData = new URLSearchParams();
  formData.append('image', cleanBase64);
  formData.append('type', 'base64');
  formData.append('title', `Asistencia - ${username} - ${type}`);

  const resp = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
    },
    body: formData,
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(`Imgur upload failed: ${data.data?.error || resp.statusText}`);
  }

  return data.data.link; // Devuelve directamente la URL final (ej: https://i.imgur.com/xxxxx.jpg)
}

module.exports = { uploadPhoto };
