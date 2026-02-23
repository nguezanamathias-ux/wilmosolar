const { body } = require('express-validator');

exports.registerValidation = [
    body('phone')
        .notEmpty().withMessage('Le telephone est requis')
        .isMobilePhone('any').withMessage('Format de telephone invalide')
        .custom(value => !/\s/.test(value)).withMessage('Pas d\'espaces'),
    body('password')
        .isLength({ min: 8 }).withMessage('Mot de passe minimum 8 caracteres'),
    body('confirm_password')
        .custom((value, { req }) => value === req.body.password).withMessage('Les mots de passe ne correspondent pas'),
    body('invitation_code')
        .optional({ checkFalsy: true })
        .isLength({ min: 4, max: 20 }).withMessage('Code d\'invitation invalide')
];

exports.loginValidation = [
    body('phone').notEmpty().withMessage('Identifiant requis'),
    body('password').notEmpty().withMessage('Mot de passe requis')
];

exports.depositValidation = [
    body('amount').isFloat({ min: 500 }).withMessage('Montant minimum 500 F'),
    body('method').isIn(['orange_money', 'mobile_money']).withMessage('Methode invalide'),
    body('payment_phone').notEmpty().withMessage('Numero de paiement requis')
];

exports.ussdConfirmValidation = [
    body('deposit_id').isInt({ min: 1 }).withMessage('ID de depot invalide'),
    body('amount').isFloat({ min: 500 }).withMessage('Montant invalide'),
    body('transaction_code').notEmpty().withMessage('Code de transaction requis').isLength({ min: 3 }).withMessage('Code invalide')
];

exports.withdrawalValidation = [
    body('amount').isFloat({ min: 2500 }).withMessage('Montant minimum 2500 FCFA')
];

exports.adminLoginValidation = [
    body('username').notEmpty(),
    body('password').notEmpty()
];
