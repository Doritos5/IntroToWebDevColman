const express = require('express');
const {
    login,
    logout,
    register,
    renderSettingsPage,
} = require('../controllers/authController');
const { ensureAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', (req, res) => {
    if (req.session?.user) return res.redirect('/profiles_page');
    res.render('login');
});

// Alias for login page to support redirects to /login
router.get('/login', (req, res) => {
    if (req.session?.user) return res.redirect('/profiles_page');
    res.render('login');
});

router.post('/login', login);
router.post('/logout', logout);
router.get('/register', (req, res) => {
    if (req.session?.user) {
        return res.status(403).json({ message: 'You are already logged in.' });
    }
    res.render("register");
});
router.post('/register', register);

router.get('/profiles_page', ensureAuth, (req, res, next) => {
    res.render('profilePage');
});

router.get('/settings/manage-profiles', ensureAuth, renderSettingsPage);
module.exports = router;