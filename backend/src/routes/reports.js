const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/export/excel', reportsController.exportExcel);
router.get('/export/pdf', reportsController.exportPDF);

module.exports = router;
