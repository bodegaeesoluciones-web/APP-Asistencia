const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/current', authenticateToken, requireAdmin, qrController.getCurrentQR);
router.post('/rotate', authenticateToken, requireAdmin, qrController.rotateQR);
router.get('/validate/:token', authenticateToken, qrController.validateQR);

module.exports = router;
