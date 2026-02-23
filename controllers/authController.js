const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Referral = require('../models/Referral');
const { logRegistrationBlocked } = require('../utils/activityLogger');

exports.getRegister = (req, res) => {
    res.render('auth/register', { 
        title: 'Inscription',
        error: null,
        body: {},
        ref: req.query.ref || '',
        csrfToken: req.csrfToken()
    });
};

exports.postRegister = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/register', {
            title: 'Inscription',
            error: errors.array()[0].msg,
            body: req.body,
            ref: req.body.invitation_code || '',
            csrfToken: req.csrfToken()
        });
    }

    const { phone, password, full_name, invitation_code } = req.body;

    try {
        const existing = await User.findByPhone(phone);
        if (existing) {
            return res.render('auth/register', {
                title: 'Inscription',
                error: 'Ce numero est deja inscrit',
                body: req.body,
                ref: invitation_code || '',
                csrfToken: req.csrfToken()
            });
        }

        let referrer = null;
        if (invitation_code) {
            const referrerUser = await User.findByReferralCode(invitation_code);
            if (referrerUser) {
                referrer = referrerUser.phone;
            } else {
                return res.render('auth/register', {
                    title: 'Inscription',
                    error: 'Code d\'invitation invalide',
                    body: req.body,
                    ref: invitation_code,
                    csrfToken: req.csrfToken()
                });
            }
        }

        await User.create({ phone, password, full_name, referred_by: referrer });

        if (referrer) {
            await Referral.create(referrer, phone);
        }

        const user = await User.findByPhone(phone);

        if (req.session && (req.session.user || req.session.admin)) {
            try {
                logRegistrationBlocked({
                    referrer: referrer || null,
                    newUserPhone: phone,
                    currentSessionPhone: req.session.user && req.session.user.phone ? req.session.user.phone : null,
                    currentAdmin: req.session.admin && req.session.admin.username ? req.session.admin.username : null,
                    ip: req.ip,
                    userAgent: req.get('User-Agent') || null
                });
            } catch (e) {
                console.error('Logging failed:', e);
            }
            req.flash('success', 'Compte cree. Connectez-vous sur un autre appareil pour finaliser la connexion.');
            return res.redirect(req.session.admin ? '/admin/dashboard' : '/user/dashboard');
        }

        req.session.regenerate((err) => {
            if (err) {
                console.error('Session regeneration failed:', err);
                return res.redirect('/login?registered=1&phone=' + encodeURIComponent(phone));
            }

            req.session.user = { phone: user.phone, full_name: user.full_name, balance: Number(user.balance) || 0 };
            req.session.save((saveErr) => {
                if (saveErr) console.error('Session save after registration failed:', saveErr);
                res.redirect('/user/dashboard');
            });
        });

    } catch (err) {
        console.error(err);
        res.render('auth/register', {
            title: 'Inscription',
            error: 'Erreur lors de l\'inscription',
            body: req.body,
            ref: invitation_code || '',
            csrfToken: req.csrfToken()
        });
    }
};

exports.getLogin = (req, res) => {
    const inactive = req.query.inactive === '1';
    const registered = req.query.registered === '1' || req.query.registered === 'true';
    const prefillPhone = req.query.phone || '';
    const autoBlocked = req.query.auto_login_blocked === '1' || req.query.auto_login_blocked === 'true';
    res.render('auth/login', { 
        title: 'Connexion',
        hideAbout: true,
        pageClass: 'auth-page',
        compactHeader: true,
        error: inactive ? 'Votre compte a ete desactive' : null,
        success: registered && !autoBlocked ? 'Inscription reussie. Connectez-vous pour commencer.' : null,
        autoBlocked: autoBlocked,
        body: { phone: prefillPhone },
        csrfToken: req.csrfToken()
    });
};

exports.postLogin = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/login', {
            title: 'Connexion',
            hideAbout: true,
            pageClass: 'auth-page',
            compactHeader: true,
            error: errors.array()[0].msg,
            body: req.body,
            csrfToken: req.csrfToken()
        });
    }

    const { phone, password } = req.body;

    try {
        const admin = await Admin.findByUsername(phone);
        if (admin) {
            console.log('[DEBUG] Admin trouve:', phone);
            const valid = await Admin.verifyPassword(admin, password);
            console.log('[DEBUG] Mot de passe valide:', valid);
            if (valid) {
                console.log('[DEBUG] Mise a jour du dernier login');
                await Admin.updateLastLogin(admin.id);
                console.log('[DEBUG] Regeneration de la session');
                return req.session.regenerate((err) => {
                    if (err) {
                        console.error('[DEBUG] Erreur regenerate session:', err);
                        return res.render('auth/login', {
                            title: 'Connexion',
                            hideAbout: true,
                            pageClass: 'auth-page',
                            compactHeader: true,
                            error: 'Erreur de session',
                            body: req.body,
                            csrfToken: req.csrfToken()
                        });
                    }
                    req.session.admin = { id: admin.id, username: admin.username };
                    delete req.session.user;
                    return req.session.save((saveErr) => {
                        if (saveErr) {
                            console.error('[DEBUG] Erreur save session:', saveErr);
                            return res.render('auth/login', {
                                title: 'Connexion',
                                hideAbout: true,
                                pageClass: 'auth-page',
                                compactHeader: true,
                                error: 'Erreur de session',
                                body: req.body,
                                csrfToken: req.csrfToken()
                            });
                        }
                        console.log('[DEBUG] Redirection vers /admin/dashboard');
                        res.redirect('/admin/dashboard');
                    });
                });
            } else {
                console.log('[DEBUG] Mot de passe incorrect pour admin');
            }
        }

        console.log('[DEBUG] Recherche utilisateur avec phone:', phone);
        const user = await User.findByPhone(phone);
        if (!user) {
            console.log('[DEBUG] Utilisateur non trouve');
            return res.render('auth/login', {
                title: 'Connexion',
                hideAbout: true,
                pageClass: 'auth-page',
                compactHeader: true,
                error: 'Telephone ou mot de passe incorrect',
                body: req.body,
                csrfToken: req.csrfToken()
            });
        }

        if (!user.is_active) {
            console.log('[DEBUG] Utilisateur inactif');
            return res.render('auth/login', {
                title: 'Connexion',
                hideAbout: true,
                pageClass: 'auth-page',
                compactHeader: true,
                error: 'Compte desactive. Contactez le support.',
                body: req.body,
                csrfToken: req.csrfToken()
            });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            console.log('[DEBUG] Mot de passe utilisateur incorrect');
            return res.render('auth/login', {
                title: 'Connexion',
                hideAbout: true,
                pageClass: 'auth-page',
                compactHeader: true,
                error: 'Telephone ou mot de passe incorrect',
                body: req.body,
                csrfToken: req.csrfToken()
            });
        }

        return req.session.regenerate((err) => {
            if (err) {
                console.error('[DEBUG] Erreur regenerate session utilisateur:', err);
                return res.render('auth/login', {
                    title: 'Connexion',
                    hideAbout: true,
                    pageClass: 'auth-page',
                    compactHeader: true,
                    error: 'Erreur de session',
                    body: req.body,
                    csrfToken: req.csrfToken()
                });
            }
            req.session.user = { 
                phone: user.phone, 
                full_name: user.full_name, 
                balance: Number(user.balance) || 0 
            };
            delete req.session.admin;
            return req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('[DEBUG] Erreur save session utilisateur:', saveErr);
                    return res.render('auth/login', {
                        title: 'Connexion',
                        hideAbout: true,
                        pageClass: 'auth-page',
                        compactHeader: true,
                        error: 'Erreur de session',
                        body: req.body,
                        csrfToken: req.csrfToken()
                    });
                }
                res.redirect('/user/dashboard');
            });
        });

    } catch (err) {
        console.error('[ERROR] Erreur connexion:', err);
        res.render('auth/login', {
            title: 'Connexion',
            hideAbout: true,
            pageClass: 'auth-page',
            compactHeader: true,
            error: 'Erreur de connexion',
            body: req.body,
            csrfToken: req.csrfToken()
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};
