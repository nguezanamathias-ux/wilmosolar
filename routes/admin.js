const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/admin');

// Login and logout are now handled by the unified auth routes
router.get('/logout', adminController.logout);

router.use(isAdmin);

router.get('/dashboard', adminController.dashboard);
router.get('/volumes', adminController.volumes);
router.get('/users', adminController.users);
router.get('/users/:phone/referrals', adminController.userReferrals);
router.get('/users/:phone/toggle', adminController.toggleUser);
router.get('/withdrawals', adminController.withdrawals);
router.get('/withdrawals/history', adminController.withdrawalsHistory);
router.post('/withdrawals/:id/confirm', adminController.confirmWithdrawal);
router.post('/withdrawals/:id/reject', adminController.rejectWithdrawal);
router.get('/deposits', adminController.deposits);
router.get('/deposits/history', adminController.depositsHistory);
router.post('/deposits/:id/confirm', adminController.confirmDeposit);
router.post('/deposits/:id/reject', adminController.rejectDeposit);
router.get('/purchases', adminController.purchases);

module.exports = router;
