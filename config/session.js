const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const pool = require('./database');

const sessionStore = new MySQLStore({}, pool);

module.exports = session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24,
        sameSite: 'strict'
    },
    name: 'wilmo.sid'
});