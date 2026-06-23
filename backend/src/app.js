const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const env = require('./config/env');
const qrService = require('./services/qrService');

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
app.use(helmet());
app.use(cors({
  origin: env.ALLOWED_ORIGINS,
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Servir frontend estático (build de Vite)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Catch-all: cualquier ruta no-API devuelve el index.html del frontend
app.get('*', (req, res) => {
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
