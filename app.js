require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const sessionConfig = require('./config/session');
const { startCronJobs } = require('./utils/cronJobs');

const app = express();

// Securite
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:']
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 200 : 5000,
    message: 'Trop de requetes, veuillez reessayer plus tard.',
    skip: () => process.env.NODE_ENV !== 'production'
});
app.use(limiter);

// Middlewares standards
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(sessionConfig);

// CSRF protection
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Flash + variables locales pour les vues
app.use((req, res, next) => {
    if (!req.session) {
        res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
        res.locals.currentUser = null;
        res.locals.currentAdmin = null;
        res.locals.success = null;
        res.locals.error = null;
        res.locals.reqFlash = null;
        return next();
    }

    const existingFlash = req.session.flash || {};
    res.locals.success = existingFlash.success || null;
    res.locals.error = existingFlash.error || null;

    const flash = function(type, message) {
        req.session.flash = req.session.flash || {};
        req.session.flash[type] = message;
        res.locals[type] = message;
    };
    flash.success = res.locals.success;
    flash.error = res.locals.error;
    req.flash = flash;

    // Clear after exposing to views (show once)
    req.session.flash = {};

    res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
    res.locals.currentUser = req.session.user || null;
    res.locals.currentAdmin = req.session.admin || null;
    res.locals.reqFlash = req.flash;
    next();
});

// Moteur de template
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', require('./routes/index'));
app.use('/user', require('./routes/user'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

// 404
app.use((req, res) => {
    res.status(404).render('error', { title: 'Page non trouvee', message: 'La page demandee n\'existe pas.' });
});

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (res.headersSent) {
        return next(err);
    }
    if (err.code === 'EBADCSRFTOKEN') {
        const devCsrf = process.env.NODE_ENV !== 'production';
        return res.status(403).render('error', { title: 'Erreur CSRF', message: 'Formulaire invalide, veuillez reessayer.', stack: devCsrf ? err.stack : null });
    }
    const dev = process.env.NODE_ENV !== 'production';
    return res.status(500).render('error', { title: 'Erreur', message: dev ? err.message : 'Une erreur est survenue.', stack: dev ? err.stack : null });
});

// Demarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur demarre sur http://localhost:${PORT}`);
    startCronJobs();
});
