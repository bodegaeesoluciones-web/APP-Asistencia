'use strict';

const cloudinary = require('cloudinary').v2;

/**
 * Cloudinary Service
 * Sube fotos de evidencia de asistencia a Cloudinary y retorna la URL directa.
 *
 * Requiere en Render (variable de entorno única):
 *   CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 */

// Configurar con la URL si existe en el entorno
if (process.env.CLOUDINARY_URL) {
  // Cloudinary SDK automatically picks up the CLOUDINARY_URL env var, 
  // but we can explicitly configure it if needed.
  cloudinary.config({
    secure: true
  });
}

/**
 * Sube una imagen en base64 a Cloudinary.
 * @param {string} base64Data  — Contenido base64 (con o sin header data:image/...)
 * @param {string} username    — Username del colaborador
 * @param {string} type        — 'entry' | 'exit'
 * @returns {Promise<string>}  — URL directa de la imagen
 */
async function uploadPhoto(base64Data, username, type) {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error('CLOUDINARY_URL no está configurado en las variables de entorno de Render.');
  }

  // Asegurarnos que la data base64 tenga el header adecuado si no lo tiene
  let uploadStr = base64Data;
  if (!uploadStr.startsWith('data:image')) {
    uploadStr = `data:image/webp;base64,${uploadStr}`;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const typeLabel = type === 'entry' ? 'entrada' : 'salida';
  const safeUser = (username || 'usuario').replace(/[^a-zA-Z0-9_-]/g, '_');
  
  // Guardar organizado en carpetas: AsistTrack/YYYY/MM
  const folderPath = `AsistTrack/${year}/${month}`;
  const publicId = `${safeUser}_${typeLabel}_${timestamp}`;

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      uploadStr,
      {
        folder: folderPath,
        public_id: publicId,
        format: 'webp', // Forzar optimización webp
        quality: 'auto',
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        // Devolvemos la URL segura (https)
        resolve(result.secure_url);
      }
    );
  });
}

module.exports = { uploadPhoto };
