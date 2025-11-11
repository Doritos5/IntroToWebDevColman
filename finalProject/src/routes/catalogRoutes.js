const express = require('express');
const router = express.Router();
const { ensureAuth, ensureAdmin } = require('../middleware/authMiddleware');
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
    adminCreateVideo,
    adminUpdateVideo,
    adminDeleteVideo,
} = require('../controllers/catalogController');
const { ViewingSession } = require('../models/viewingSessionModel');

router.use(ensureAuth);

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
router.post('/admin/videos', ensureAuth, ensureAdmin, adminCreateVideo);
router.put('/admin/videos/:videoId', ensureAuth, ensureAdmin, adminUpdateVideo);
router.delete('/admin/videos/:videoId', ensureAuth, ensureAdmin, adminDeleteVideo);

// Watched sets for client-side filtering
router.get('/debug/viewing-sessions', async (req, res) => {
    try {
        const profileId = String(req.query.profileId || '').trim();
        const genre = req.query.genre ? String(req.query.genre).trim() : null;
        const userEmail = String(req.session.user?.email || '').toLowerCase();
        if (!profileId) return res.status(400).json({ message: 'profileId required' });

        const sessions = await ViewingSession.find({ profileId, userEmail })
            .select({ videoId: 1 })
            .lean();

        const videoIds = sessions.map(s => s.videoId).filter(Boolean);
        let watchedMovieIds = [];
        let watchedSeriesIds = [];
        let watchedVideoIds = [];
        if (videoIds.length > 0) {
            const match = { _id: { $in: videoIds } };
            if (genre) match.genres = genre;
            const watchedVideos = await require('../models/catalogModel').Video.find(match)
                .select({ _id: 1, type: 1, series: 1 })
                .lean();
            watchedVideoIds = watchedVideos.map(v => v._id.toString());
            watchedMovieIds = watchedVideos.filter(v => v.type === 'movie').map(v => v._id.toString());
            watchedSeriesIds = watchedVideos.filter(v => v.type === 'series' && v.series).map(v => v.series.toString());
        }

        res.json({
            watchedMovieIds,
            watchedSeriesIds,
            watchedVideoIds,
            genre: genre || null,
        });
    } catch (err) {
        console.error('Debug sessions error:', err);
        res.status(500).json({ message: 'error' });
    }
});

module.exports = router;

