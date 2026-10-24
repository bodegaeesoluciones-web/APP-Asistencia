const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { apiLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
// deviceCheck removed — technicians can mark from any device
const { body, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  '/mark',
  apiLimiter,
  authenticateToken,
  // deviceCheck removed — no device restriction
  [
    body('latitude').isFloat().withMessage('Latitud inválida'),
    body('longitude').isFloat().withMessage('Longitud inválida'),
    // qrToken removed — QR scanning is no longer required for attendance
  ],
  validateRequest,
  attendanceController.markAttendance
);

router.get('/today', authenticateToken, attendanceController.getTodayAttendance);
router.get('/history', authenticateToken, attendanceController.getMyHistory);

module.exports = router;
