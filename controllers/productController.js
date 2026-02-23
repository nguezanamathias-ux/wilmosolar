const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Referral = require('../models/Referral');

exports.listProducts = async (req, res) => {
    const products = await Product.findAllActive();
    const user = await User.findByPhone(req.session.user.phone);
    const numericProducts = products.map(p => ({
        ...p,
        price: Number(p.price),
        daily_earnings: Number(p.daily_earnings)
    }));
    const userBalance = Number(user.balance) || 0;

    res.render('user/products', {
        title: 'Produits',
        products: numericProducts,
        userBalance,
        currentPage: 'products',
        csrfToken: req.csrfToken(),
        hideAbout: true
    });
};

exports.details = async (req, res) => {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) {
        return res.status(404).render('error', { title: 'Produit introuvable', message: 'Ce produit n\'existe pas.' });
    }
    const user = await User.findByPhone(req.session.user.phone);
    const userBalance = Number(user.balance) || 0;
    const price = Number(product.price) || 0;
    const daily = Number(product.daily_earnings) || 0;
    const totalReturn = daily * Number(product.duration_days || 0);
    const roi = price > 0 ? Math.round((totalReturn / price) * 100) : 0;

    res.render('user/product-details', {
        title: product.name,
        product: {
            ...product,
            price,
            daily_earnings: daily
        },
        totalReturn,
        roi,
        userBalance,
        csrfToken: req.csrfToken(),
        currentPage: 'products',
        hideAbout: true
    });
};

exports.buy = async (req, res) => {
    const productId = req.params.id;
    const userPhone = req.session.user.phone;

    const connection = await require('../config/database').getConnection();
    try {
        await connection.beginTransaction();

        const [productRows] = await connection.query(
            'SELECT * FROM products WHERE id = ? AND is_active = 1',
            [productId]
        );
        const product = productRows[0];
        if (!product) throw new Error('Produit introuvable');

        const [userRows] = await connection.query('SELECT balance FROM users WHERE phone = ? FOR UPDATE', [userPhone]);
        const user = userRows[0];
        const userBalanceNum = Number(user.balance) || 0;
        const productPriceNum = Number(product.price) || 0;
        const productDailyNum = Number(product.daily_earnings) || 0;
        if (userBalanceNum < productPriceNum) throw new Error('Solde insuffisant');

        await connection.query('UPDATE users SET balance = balance - ? WHERE phone = ?', [productPriceNum, userPhone]);

        await Purchase.create(userPhone, productId, productPriceNum, productDailyNum, connection);

        await connection.query(
            `INSERT INTO transactions (user_phone, type, amount, description, status)
             VALUES (?, 'achat', ?, ?, 'confirmee')`,
            [userPhone, -productPriceNum, `Achat: ${product.name}`]
        );

        const isFirst = await Purchase.isFirstPurchase(userPhone, connection);
        if (isFirst) {
            const [userData] = await connection.query('SELECT referred_by FROM users WHERE phone = ?', [userPhone]);
            const referrer = userData[0].referred_by;
            if (referrer) {
                const bonus = Math.round(productPriceNum * 0.3 * 100) / 100;
                await connection.query(
                    'UPDATE users SET balance = balance + ?, total_commissions = total_commissions + ? WHERE phone = ?',
                    [bonus, bonus, referrer]
                );
                await connection.query(
                    `INSERT INTO transactions (user_phone, type, amount, description, status)
                     VALUES (?, 'bonus_parrainage', ?, ?, 'confirmee')`,
                    [referrer, bonus, `Bonus 30% achat de ${userPhone}`]
                );
                await connection.query(
                    `UPDATE referrals SET bonus_earned = bonus_earned + ?
                     WHERE referrer_phone = ? AND referred_phone = ?`,
                    [bonus, referrer, userPhone]
                );
            }
        }

        await connection.commit();

        const updatedUser = await User.findByPhone(userPhone);
        req.session.user.balance = Number(updatedUser.balance) || 0;

        req.flash('success', 'Achat effectue avec succes');
        res.redirect('/user/my-products');
    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.flash('error', err.message || 'Erreur lors de l\'achat');
        res.redirect('/user/products');
    } finally {
        connection.release();
    }
};

exports.myProducts = async (req, res) => {
    const purchases = await Purchase.findActiveByUser(req.session.user.phone);
    for (const p of purchases) {
        const product = await Product.findById(p.product_id);
        p.name = product.name;
        p.image_url = product.image_url;
        p.duration_days = product.duration_days;
    }
    res.render('user/my-products', {
        title: 'Mes produits',
        purchases,
        currentPage: 'my-products',
        csrfToken: req.csrfToken()
    });
};
