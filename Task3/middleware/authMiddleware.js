function isAuthenticated(req, res, next) {
    const userEmail = req.cookies.loggedInUser;
    if (userEmail) {
        req.email = userEmail;
        return next(); // הבקשה יכולה להמשיך
    }

    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
}

module.exports = { isAuthenticated };