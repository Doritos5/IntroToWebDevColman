const express = require('express');
const {
    login,
    logout,
    register,
} = require('../controllers/authController');
const router = express.Router();


router.get('/', (_req, res) => {
    res.render("catalog");
});

module.exports = router;

