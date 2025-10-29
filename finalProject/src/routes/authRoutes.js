const express = require('express');
const {
    login,
    logout,
    register,
} = require('../controllers/authController');
const { ensureAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', (req, res) => {
    if (req.session?.user) return res.redirect('/profiles_page');
    res.render('login');
});

router.post('/login', login);
router.post('/logout', logout);
router.get('/register', (req, res) => {
    if (req.session?.user) return res.redirect('/profiles_page');
    res.render('register');
});
router.post('/register', register);

router.get('/profiles_page', ensureAuth, (req, res) => {
    res.render('profilePage');
});

router.get('/settings', ensureAuth, (req, res) => {
    res.render('settings'); // This will render the views/settings.ejs file
});

module.exports = router;