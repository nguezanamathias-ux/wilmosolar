const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Referral = require('../models/Referral');
const Purchase = require('../models/Purchase');

exports.dashboard = async (req, res) => {
    const user = await User.findByPhone(req.session.user.phone);
    const productsCount = await Purchase.countByUser(req.session.user.phone);
    req.session.user.balance = Number(user.balance) || 0;
    res.render('user/dashboard', {
        title: 'Tableau de bord',
        user,
        productsCount,
        success: req.flash.success,
        error: req.flash.error,
        currentPage: 'dashboard',
        csrfToken: req.csrfToken(),
        hideAbout: true
    });
};

exports.team = async (req, res) => {
    const user = await User.findByPhone(req.session.user.phone);
    const referrals = await Referral.getReferrals(req.session.user.phone);
    const referralLink = `${req.protocol}://${req.get('host')}/register?ref=${user.referral_code}`;
    res.render('user/team', {
        title: 'Mon equipe',
        referrals,
        referralLink,
        currentPage: 'team',
        csrfToken: req.csrfToken(),
        hideAbout: true
    });
};

exports.referralsIncome = async (req, res) => {
    const user = await User.findByPhone(req.session.user.phone);
    const referralsWithPurchase = await Referral.getReferralsWithPurchase(req.session.user.phone);
    res.render('user/referrals-income', {
        title: 'Revenu des invites',
        referralsWithPurchase,
        totalCommissions: user.total_commissions,
        currentPage: 'referrals-income',
        csrfToken: req.csrfToken()
    });
};

exports.transactions = async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const transactions = await Transaction.findByUser(req.session.user.phone, limit, offset);
    const totalCount = await Transaction.countByUser(req.session.user.phone);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const totals = transactions.reduce((acc, t) => {
        const amount = Number(t.amount) || 0;
        if (amount >= 0) acc.in += amount;
        if (amount < 0) acc.out += Math.abs(amount);
        return acc;
    }, { in: 0, out: 0 });
    res.render('user/transactions', {
        title: 'Journal de transactions',
        transactions,
        page,
        totalPages,
        totals,
        currentPage: 'transactions',
        csrfToken: req.csrfToken(),
        hideAbout: true
    });
};

exports.support = (req, res) => {
    const supportTelegramLink = process.env.TELEGRAM_SUPPORT_LINK || 'https://t.me/wilmosolar_shop';
    res.render('user/support', {
        title: 'Service client',
        telegramLink: supportTelegramLink,
        currentPage: 'support',
        csrfToken: req.csrfToken()
    });
};

exports.account = async (req, res) => {
    const user = await User.findByPhone(req.session.user.phone);
    const productsCount = await Purchase.countByUser(req.session.user.phone);
    res.render('user/account', {
        title: 'Mon compte',
        user,
        productsCount,
        currentPage: 'account',
        csrfToken: req.csrfToken(),
        hideAbout: true
    });
};

exports.companyProfile = (req, res) => {
    res.render('user/company-profile', {
        title: 'Profil de la societe',
        currentPage: 'company-profile',
        csrfToken: req.csrfToken(),
        hideAbout: true
    });
};
