const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');
const {
    renderCatalogPage,
    renderVideoDetailPage,
    getCatalogData,
    getCatalogByQuery,
    streamVideo,
    getVideoProgress,
    getNextVideo,
    listEpisodes,
    updateVideoProgress,
} = require('../controllers/catalogController');

router.get('/', isAuthenticated, renderCatalogPage);
router.get('/item/:videoId', isAuthenticated, renderVideoDetailPage);


router.get('/data', isAuthenticated, getCatalogData);

router.get("/search/", isAuthenticated, getCatalogByQuery);
router.get("/search/:query", isAuthenticated, getCatalogByQuery);

router.get('/video/:videoId/stream', isAuthenticated, streamVideo);
router.get('/video/:videoId/progress', isAuthenticated, getVideoProgress);
router.get('/video/:videoId/next', isAuthenticated, getNextVideo);
router.get('/videos', isAuthenticated, listEpisodes);
router.post('/video/:videoId/progress', isAuthenticated, updateVideoProgress);

module.exports = router;

