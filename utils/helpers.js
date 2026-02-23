exports.formatMoney = (amount) => {
    return amount.toLocaleString() + ' FCFA';
};

exports.generateReferralCode = (phone) => {
    const suffix = phone.slice(-4);
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `WMS${suffix}${rand}`;
};