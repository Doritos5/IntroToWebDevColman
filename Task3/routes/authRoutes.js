const express = require('express');
const {
    login,
    logout,
    register,
} = require('../controllers/authController');
const path = require("path");
const router = express.Router();
const publicPath = path.join(__dirname, '..', 'public');

router.get('/', (_req, res) => {
    res.sendFile(path.join(publicPath, 'login', 'loginPage.html'));
});
router.post('/login', login);
router.post('/logout', logout);
router.post('/register', register);

module.exports = router;