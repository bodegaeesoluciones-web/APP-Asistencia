'use strict';

const { Dropbox } = require('dropbox');
require('isomorphic-fetch');

/**
 * Dropbox Service
 * Sube fotos de evidencia de asistencia a Dropbox y retorna la URL compartida.
 *
 * Requiere env:
 *   DROPBOX_ACCESS_TOKEN  — Token de acceso de Dropbox (long-lived o refresh-based)
 */

function getClient() {
  if (!process.env.DROPBOX_ACCESS_TOKEN) {
    throw new Error('DROPBOX_ACCESS_TOKEN no configurado en variables de entorno.');
  }
  return new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });
}

/**
 * Construye la ruta de carpeta: /AsistTrack/Evidencias/YYYY/MM/DD/
 * @param {Date} date
 */
function buildFolderPath(date) {
  const year  = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day   = String(date.getDate()).padStart(2, '0');
  return `/AsistTrack/Evidencias/${year}/${month}/${day}`;
}

/**
 * Sube una imagen en base64 a Dropbox.
 * @param {string} base64Data  — Contenido base64 de la imagen (sin cabecera data:image/...)
 * @param {string} username    — Username del colaborador (para nombre del archivo)
 * @param {string} type        — 'entry' | 'exit'
 * @returns {Promise<string>}  — URL permanente de descarga de Dropbox (dl.dropboxusercontent.com)
 */
async function uploadPhoto(base64Data, username, type) {
  const dbx = getClient();
  const now  = new Date();

  // Strip data URI header if present
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');

  const folder    = buildFolderPath(now);
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const typeLabel = type === 'entry' ? 'entrada' : 'salida';
  const filename  = `${username}_${typeLabel}_${timestamp}.webp`;
  const fullPath  = `${folder}/${filename}`;

  // Upload with autorename in case of collision
  await dbx.filesUpload({
    path: fullPath,
    contents: buffer,
    mode: { '.tag': 'add' },
    autorename: true,
  });

  // Create a shared link or get the existing one
  let sharedLink;
  try {
    const result = await dbx.sharingCreateSharedLinkWithSettings({
      path: fullPath,
      settings: {
        requested_visibility: { '.tag': 'public' },
      },
    });
    sharedLink = result.result.url;
  } catch (err) {
    // If a shared link already exists, retrieve it
    if (err?.error?.error_summary?.startsWith('shared_link_already_exists')) {
      const existing = await dbx.sharingListSharedLinks({ path: fullPath, direct_only: true });
      sharedLink = existing.result.links[0]?.url;
    } else {
      throw err;
    }
  }

  // Convert the shared link to a direct download URL
  // Dropbox shared links end with ?dl=0 — replace with ?raw=1 for direct
  const directUrl = sharedLink.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');

  return directUrl;
}

module.exports = { uploadPhoto };
