const xlsx = require('xlsx');
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
    
    const data = records.map(r => ({
      Fecha: new Date(r.local_time).toLocaleDateString(),
      Hora: new Date(r.local_time).toLocaleTimeString(),
      Técnico: r.user_name,
      Cédula: r.cedula || '-',
      Cargo: r.user_position || '-',
      Móvil: r.mobile_number,
      Tipo: r.type === 'entry' ? 'Entrada' : 'Salida',
      Estado: r.is_valid ? 'Válido' : 'Rechazado',
      Motivo_Rechazo: r.rejection_reason || '-',
      Dispositivo: r.device_name || '-',
      Latitud: r.latitude,
      Longitud: r.longitude,
      Dirección_IP: r.ip_address || '-',
      Evidencia: r.photo_url || '-'
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Asistencia');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="reporte_asistencia.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
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
