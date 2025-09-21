const express = require('express');
const { handleLike, handleUnlike } = require('../controllers/likeController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/like', isAuthenticated, handleLike);

router.post('/unlike', isAuthenticated, handleUnlike);

module.exports = router;