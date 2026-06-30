const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const env = require('./config/env');
const qrService = require('./services/qrService');
const { runMigrations } = require('./config/migrate');

// Run DB migrations on startup (idempotent — safe to run every time)
runMigrations();

// Routes
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const adminRoutes = require('./routes/admin');
const qrRoutes = require('./routes/qr');
const reportsRoutes = require('./routes/reports');

const app = express();
const server = http.createServer(app);

// WebSocket Server for QR updates
const wss = new WebSocket.Server({ server, path: '/ws/qr' });
qrService.setWsServer(wss);

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected for QR updates');
  
  // Send current QR immediately upon connection
  qrService.getCurrentToken()
    .then(qrData => {
      ws.send(JSON.stringify({ type: 'QR_UPDATED', token: qrData.token, image: qrData.image }));
    })
    .catch(err => console.error('Error sending initial QR:', err));

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: env.ALLOWED_ORIGINS,
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Start QR Rotation (async — catch errors so a slow DB cold-start doesn't crash the process)
qrService.startRotationInterval().catch(err => {
  console.error('QR rotation startup error (non-fatal, will retry on next interval):', err.message);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/reports', reportsRoutes);

// EMERGENCY WIPE ROUTE
app.get('/api/wipe-db', async (req, res) => {
  const { pool } = require('./config/db');
  const bcrypt = require('bcryptjs');
  try {
    await pool.query('TRUNCATE TABLE users, devices, attendance, qr_tokens, refresh_tokens, audit_log RESTART IDENTITY CASCADE');
    const hash = await bcrypt.hash('Admin123!', 12);
    await pool.query("INSERT INTO users (username, password_hash, full_name, role, status) VALUES ($1, $2, $3, 'admin', 'active')", ['admin', hash, 'Administrador del Sistema']);
    res.send('<h1>✅ Base de datos limpiada correctamente.</h1><p>Se ha restablecido el usuario admin. Ya puedes cerrar esta ventana.</p>');
  } catch (err) {
    res.status(500).send(`<h1>❌ Error al limpiar base de datos</h1><pre>${err.message}</pre>`);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Servir frontend estático (build de Vite)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Catch-all: sirve el archivo HTML específico si existe, si no devuelve el login (index.html)
app.get('*', (req, res) => {
  const fs = require('fs');
  // If the request looks like it's for an HTML page inside dist, try to serve it directly
  const requestedFile = path.join(frontendPath, req.path);
  if (req.path.endsWith('.html') && fs.existsSync(requestedFile)) {
    return res.sendFile(requestedFile);
  }
  // Default fallback: login page
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Start server
server.listen(env.PORT, () => {
  console.log(`✅ Server running on port ${env.PORT}`);
  console.log(`Allowed origins: ${env.ALLOWED_ORIGINS.join(', ')}`);
});
