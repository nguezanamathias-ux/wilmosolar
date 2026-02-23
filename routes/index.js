const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerValidation, loginValidation } = require('../middleware/validators');

router.get('/', (req, res) => res.redirect('/login'));
router.get('/login', authController.getLogin);
router.post('/login', loginValidation, authController.postLogin);
router.get('/register', authController.getRegister);
router.post('/register', registerValidation, authController.postRegister);
router.get('/logout', authController.logout);
router.get('/legal', (req, res) => {
    res.render('legal/legal', {
        title: 'Mentions legales',
        hideAbout: true,
        csrfToken: req.csrfToken()
    });
});
router.get('/cgu', (req, res) => {
    res.render('legal/cgu', {
        title: 'Conditions generales d\'utilisation',
        hideAbout: true,
        csrfToken: req.csrfToken()
    });
});
router.get('/privacy', (req, res) => {
    res.render('legal/privacy', {
        title: 'Politique de confidentialite',
        hideAbout: true,
        csrfToken: req.csrfToken()
    });
});

module.exports = router;
