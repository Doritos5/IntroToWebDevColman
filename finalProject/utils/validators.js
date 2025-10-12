function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(email.trim());
}

function isValidPassword(password) {
    return typeof password === 'string' && password.trim().length >= 3;
}

function isValidUsername(username) {
    if (typeof username !== 'string') return false;
    const trimmed = username.trim();
    if (trimmed.length < 3) return false;
    return /^[a-zA-Z0-9_ ]+$/.test(trimmed);
}

module.exports = {
    isValidEmail,
    isValidPassword,
    isValidUsername,
};