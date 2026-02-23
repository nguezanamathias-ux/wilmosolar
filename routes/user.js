const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const productController = require('../controllers/productController');
const transactionController = require('../controllers/transactionController');
const { depositValidation, ussdConfirmValidation, withdrawalValidation } = require('../middleware/validators');
const { isAuthenticated, isActive } = require('../middleware/auth');

router.use(isAuthenticated, isActive);

router.get('/dashboard', userController.dashboard);
router.get('/team', userController.team);
router.get('/referrals-income', userController.referralsIncome);
router.get('/transactions', userController.transactions);
router.get('/support', userController.support);
router.get('/account', userController.account);
router.get('/company-profile', userController.companyProfile);

router.get('/products', productController.listProducts);
router.get('/products/:id', productController.details);
router.post('/products/buy/:id', productController.buy);
router.get('/my-products', productController.myProducts);

router.post('/deposit', depositValidation, transactionController.deposit);
router.post('/ussd-confirm', ussdConfirmValidation, transactionController.ussdConfirm);
router.post('/withdrawal', withdrawalValidation, transactionController.withdrawal);

module.exports = router;
