const express = require('express');
const { handleLike } = require('../controllers/likeController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/like', isAuthenticated, handleLike);

module.exports = router;