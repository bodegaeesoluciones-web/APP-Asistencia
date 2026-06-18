const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { pool } = require('../config/db');
const { getSetting } = require('./settingsService');

class QRService {
  constructor() {
    this.intervalId = null;
    this.wsServer = null;
  }

  setWsServer(wss) {
    this.wsServer = wss;
  }

  async generateToken() {
    const token = uuidv4();
    const rotationMinutes = parseInt(await getSetting('qr_rotation_minutes', '60'), 10);
    
    // Deactivate previous active tokens
    await pool.query('UPDATE qr_tokens SET is_active = false WHERE is_active = true');

    const { rows } = await pool.query(
      `INSERT INTO qr_tokens (token, expires_at, is_active)
       VALUES ($1, NOW() + interval '1 minute' * $2, true)
       RETURNING *`,
      [token, rotationMinutes]
    );

    const qrData = rows[0];
    const base64Image = await QRCode.toDataURL(token);

    if (this.wsServer) {
      this.wsServer.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({ type: 'QR_UPDATED', token, image: base64Image }));
        }
      });
    }

    return { ...qrData, image: base64Image };
  }

  async getCurrentToken() {
    const { rows } = await pool.query(
      `SELECT * FROM qr_tokens 
       WHERE is_active = true AND expires_at > NOW() 
       ORDER BY generated_at DESC LIMIT 1`
    );

    if (rows.length === 0) {
      return await this.generateToken();
    }

    const qrData = rows[0];
    const base64Image = await QRCode.toDataURL(qrData.token);
    return { ...qrData, image: base64Image };
  }

  async validateToken(tokenStr) {
    const { rows } = await pool.query(
      `SELECT * FROM qr_tokens 
       WHERE token = $1 AND is_active = true AND expires_at > NOW()`,
      [tokenStr]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  async startRotationInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const rotationMinutes = parseInt(await getSetting('qr_rotation_minutes', '60'), 10);
    const rotationMs = rotationMinutes * 60 * 1000;

    console.log(`Starting QR rotation interval: ${rotationMinutes} minutes`);
    
    // Ensure we have an initial token
    await this.getCurrentToken();

    this.intervalId = setInterval(async () => {
      console.log('Rotating QR token...');
      try {
        await this.generateToken();
      } catch (err) {
        console.error('Failed to rotate QR token:', err);
      }
    }, rotationMs);
  }
}

const qrService = new QRService();
module.exports = qrService;
