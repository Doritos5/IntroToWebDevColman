const express = require('express');
const { handleLike, handleUnlike } = require('../controllers/likeController');
const { ensureAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(ensureAuth);

router.post('/like', handleLike);
router.post('/unlike', handleUnlike);

module.exports = router;