const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { pool } = require('../config/db');
const { getSettings } = require('../services/settingsService');

async function getAttendance(req) {
  // Reuse filtered attendance logic
  const rows = await getFilteredAttendance(req);
  return rows;
}

exports.getAttendance = async (req, res) => {
  try {
    const data = await getAttendance(req);
    res.json(data);
  } catch (err) {
    console.error('Attendance fetch error:', err);
    res.status(500).json({ error: 'Error al obtener datos de asistencia' });
  }
};

async function getFilteredAttendance(req) {
  const { startDate, endDate, userId, status } = req.query;
  const settings = await getSettings();
  const tz = settings.timezone || 'America/Lima';
  
  let query = `
    SELECT a.id, a.type, a.timestamp AT TIME ZONE $1 as local_time, 
           a.is_valid, a.rejection_reason, a.latitude, a.longitude,
           a.photo_url, a.ip_address,
           u.full_name as user_name, u.username as cedula, u.position as user_position, u.mobile_number, d.device_name
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN devices d ON a.device_id = d.id
    WHERE 1=1
  `;
  const params = [tz];
  let paramCount = 2;

  if (startDate) {
    query += ` AND DATE(a.timestamp AT TIME ZONE $1) >= $${paramCount++}`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND DATE(a.timestamp AT TIME ZONE $1) <= $${paramCount++}`;
    params.push(endDate);
  }
  if (userId) {
    query += ` AND a.user_id = $${paramCount++}`;
    params.push(userId);
  }
  if (status) { // 'valid' or 'invalid'
    query += ` AND a.is_valid = $${paramCount++}`;
    params.push(status === 'valid');
  }

  query += ` ORDER BY a.timestamp DESC`;

  const { rows } = await pool.query(query, params);
  return rows;
}

exports.exportExcel = async (req, res) => {
  try {
    const records = await getFilteredAttendance(req);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Asistencia', {
      views: [{ state: 'frozen', ySplit: 1 }] // Congelar la primera fila (cabeceras)
    });

    // Definir columnas y anchos
    worksheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Hora', key: 'hora', width: 12 },
      { header: 'Colaborador', key: 'nombre', width: 35 },
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Cargo', key: 'cargo', width: 25 },
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Estado', key: 'estado', width: 25 },
      { header: 'Móvil', key: 'movil', width: 15 },
      { header: 'Dispositivo', key: 'dispositivo', width: 30 },
      { header: 'Latitud', key: 'lat', width: 15 },
      { header: 'Longitud', key: 'lng', width: 15 },
      { header: 'IP', key: 'ip', width: 18 },
      { header: 'Evidencia', key: 'evidencia', width: 20 }
    ];

    // Estilizar las cabeceras (Fila 1)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Letra blanca
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' } // Fondo azul profesional
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 30;

    // Llenar datos y estilizar filas
    records.forEach((r, index) => {
      const isEntry = r.type === 'entry';
      const isValid = r.is_valid;
      
      const row = worksheet.addRow({
        fecha: new Date(r.local_time).toLocaleDateString('es-ES'),
        hora: new Date(r.local_time).toLocaleTimeString('es-ES'),
        nombre: r.user_name,
        cedula: r.cedula || '-',
        cargo: r.user_position || '-',
        tipo: isEntry ? 'ENTRADA' : 'SALIDA',
        estado: isValid ? 'Válido' : (r.rejection_reason || 'Rechazado'),
        movil: r.mobile_number || '-',
        dispositivo: r.device_name || '-',
        lat: r.latitude || '-',
        lng: r.longitude || '-',
        ip: r.ip_address || '-',
        evidencia: r.photo_url && r.photo_url !== '-' ? { text: '📷 Ver Foto', hyperlink: r.photo_url } : '-'
      });

      // Altura de fila
      row.height = 25;
      row.alignment = { vertical: 'middle', horizontal: 'center' };
      
      // Alinear nombres a la izquierda
      row.getCell('nombre').alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell('cargo').alignment = { vertical: 'middle', horizontal: 'left' };

      // Filas alternas (zebra striping) para fácil lectura
      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; // Gris clarito
      }

      // Colores de Tipo
      const tipoCell = row.getCell('tipo');
      tipoCell.font = { bold: true, color: { argb: isEntry ? 'FF10B981' : 'FFF59E0B' } }; // Verde o Naranja

      // Colores de Estado
      const estadoCell = row.getCell('estado');
      estadoCell.font = { bold: true, color: { argb: isValid ? 'FF10B981' : 'FFEF4444' } }; // Verde o Rojo
      
      // Estilo de Enlace de Evidencia
      const evidenciaCell = row.getCell('evidencia');
      if (r.photo_url && r.photo_url !== '-') {
        evidenciaCell.font = { color: { argb: 'FF2563EB' }, underline: true, bold: true };
      }
    });

    res.setHeader('Content-Disposition', 'attachment; filename="Reporte_Asistencia.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Error al generar Excel' });
  }
};

exports.exportPDF = async (req, res) => {
  try {
    const records = await getFilteredAttendance(req);
    
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    
    res.setHeader('Content-Disposition', 'attachment; filename="reporte_asistencia.pdf"');
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(16).text('Reporte de Asistencia', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10);
    
    // Simple table headers
    const startY = doc.y;
    doc.text('Fecha', 30, startY);
    doc.text('Hora', 100, startY);
    doc.text('Técnico', 160, startY);
    doc.text('Tipo', 350, startY);
    doc.text('Estado', 420, startY);
    
    doc.moveTo(30, startY + 15).lineTo(560, startY + 15).stroke();
    
    let y = startY + 20;

    records.forEach(r => {
      if (y > 750) {
        doc.addPage();
        y = 30;
      }
      
      doc.text(new Date(r.local_time).toLocaleDateString(), 30, y);
      doc.text(new Date(r.local_time).toLocaleTimeString(), 100, y);
      doc.text(r.user_name, 160, y, { width: 180, truncate: true });
      doc.text(r.type === 'entry' ? 'Entrada' : 'Salida', 350, y);
      
      if (r.is_valid) {
        doc.fillColor('green').text('Válido', 420, y).fillColor('black');
      } else {
        doc.fillColor('red').text('Rechazado', 420, y).fillColor('black');
      }
      
      y += 20;
    });

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar PDF' });
    }
  }
};
