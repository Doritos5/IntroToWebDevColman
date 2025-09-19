const express = require('express');
const {
    login,
    logout,
    register,
} = require('../controllers/authController');
const router = express.Router();

router.get('/', (_req, res) => {
    res.render("login");
});

router.post('/login', login);
router.post('/logout', logout);
router.get('/register', (_req, res) => {
    res.render("register");
});
router.post('/register', register);

module.exports = router;