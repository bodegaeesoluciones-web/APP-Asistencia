const qrService = require('../services/qrService');

exports.getCurrentQR = async (req, res) => {
  try {
    const qrData = await qrService.getCurrentToken();
    res.json({
      token: qrData.token,
      image: qrData.image,
      expiresAt: qrData.expires_at
    });
  } catch (err) {
    console.error('GetCurrentQR error:', err);
    res.status(500).json({ error: 'Error al obtener QR' });
  }
};

exports.rotateQR = async (req, res) => {
  try {
    const qrData = await qrService.generateToken();
    res.json({
      message: 'QR rotado exitosamente',
      token: qrData.token,
      image: qrData.image,
      expiresAt: qrData.expires_at
    });
  } catch (err) {
    console.error('RotateQR error:', err);
    res.status(500).json({ error: 'Error al rotar QR' });
  }
};

exports.validateQR = async (req, res) => {
  const { token } = req.params;
  try {
    const validToken = await qrService.validateToken(token);
    if (!validToken) {
      return res.status(404).json({ valid: false, error: 'QR inválido o expirado' });
    }
    res.json({ valid: true, expiresAt: validToken.expires_at });
  } catch (err) {
    console.error('ValidateQR error:', err);
    res.status(500).json({ error: 'Error al validar QR' });
  }
};
