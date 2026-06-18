const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Users (Technicians)
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);

// Devices
router.get('/devices', adminController.getDevices);
router.delete('/devices/:id', adminController.deleteDevice);

// History & Audit
router.get('/history', adminController.getAllHistory);
router.get('/audit', adminController.getAuditLog);

// Settings
router.get('/settings', adminController.getSystemSettings);
router.put('/settings', adminController.updateSystemSettings);

module.exports = router;
