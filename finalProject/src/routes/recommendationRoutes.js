const express = require('express');
const { ensureAuth } = require('../middleware/authMiddleware');
const { getRecommendations } = require('../controllers/recommendationController');
const router = express.Router();
router.use(ensureAuth);
router.get('/recommendations', getRecommendations);
module.exports = router;