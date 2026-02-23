require('dotenv').config();
const https = require('https');

async function sendTelegram(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const postData = JSON.stringify({ chat_id: chatId, text: message });

    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

async function notifyAdmin(type, details) {
    try {
        const message = `Nouvelle demande ${type} \nUtilisateur: ${details.userPhone} \nMontant: ${details.amount} FCFA\nID: ${details.id || '-'}\nVoir admin dashboard pour confirmer.`;
        await sendTelegram(message);
    } catch (err) {
        console.error('notifyAdmin error:', err);
    }
}

module.exports = { notifyAdmin };
