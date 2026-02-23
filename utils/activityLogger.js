const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'registrations.log');

function ensureDir() {
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
}

function logRegistrationBlocked(details = {}) {
    try {
        ensureDir();
        const entry = Object.assign({ timestamp: new Date().toISOString() }, details);
        fs.appendFile(logFile, JSON.stringify(entry) + '\n', (err) => {
            if (err) console.error('activityLogger append error:', err);
        });
    } catch (err) {
        console.error('activityLogger error:', err);
    }
}

module.exports = { logRegistrationBlocked };
