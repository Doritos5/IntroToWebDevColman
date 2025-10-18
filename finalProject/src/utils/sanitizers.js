function sanitizeUser(user) {
    if (!user) return null;

    const plain = typeof user.toObject === 'function'
        ? user.toObject()
        : { ...user };

    delete plain.password;
    delete plain.__v;

    return plain;
}

module.exports = {
    sanitizeUser,
};