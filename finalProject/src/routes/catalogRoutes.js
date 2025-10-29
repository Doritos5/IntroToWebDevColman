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

const { ensureAuth, ensureAdmin } = require('../middleware/authMiddleWare');

router.get('/', renderCatalogPage);
router.get('/item/:videoId', renderVideoDetailPage);


router.get('/data', getCatalogData);


router.get("/search/",  getCatalogByQuery);
router.get("/search/:query",  getCatalogByQuery);

router.get('/video/:videoId/stream', streamVideo);
router.get('/video/:videoId/progress',  getVideoProgress);
router.get('/video/:videoId/next', getNextVideo);
router.get('/videos',  listEpisodes);
router.post('/video/:videoId/progress', updateVideoProgress);

module.exports = router;

