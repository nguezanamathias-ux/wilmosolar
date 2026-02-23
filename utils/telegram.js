require('dotenv').config();

let links;
try {
    links = JSON.parse(process.env.TELEGRAM_LINKS || '[]');
} catch {
    links = [];
}

exports.telegramLinks = links;