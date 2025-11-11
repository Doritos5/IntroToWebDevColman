const fs = require('fs');
const path = require('path');
const catalogModel = require('../models/catalogModel');
const userModel = require('../models/userModel');
const viewingSessionModel = require('../models/viewingSessionModel');
const { logInfo, logError } = require('../middleware/logger');

const INITIAL_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE = process.env.ITEMS_PER_PAGE || 50;

function normalizePageSize(value, fallback = DEFAULT_PAGE_SIZE) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    const floored = Math.floor(numeric);
    if (floored <= 0) {
        return fallback;
    }

    return floored;
}

function normalizeOffset(value) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return 0;
    }

    return Math.max(Math.floor(numeric), 0);
}

function getConfiguredPageSize() {
    const envValue =
        process.env.num_of_items_per_page ??
        process.env.NUM_OF_ITEMS_PER_PAGE ??
        process.env.VIDEOS_PER_PAGE;

    return normalizePageSize(envValue, DEFAULT_PAGE_SIZE);
}

function resolveVideoPath(relativePath) {
    if (path.isAbsolute(relativePath)) {
        return relativePath;
    }
    return path.join(__dirname, '..', '..', 'storage', 'videos', relativePath);
}

async function renderCatalogPage(req, res, next) {
    try {
        const userEmail = req.session.user.email;
        const profileId = req.query.profileId;
        const user = await userModel.getUserByEmail(userEmail, { hydrate: true });
        let profileName = '';
        if (user && user.profiles && profileId) {
            const profile = user.profiles.find(p => p.id === profileId);
            if (profile) {
                profileName = profile.displayName;
            }
        }

        const videosPerPage = getConfiguredPageSize();

        // Get all available genres for dynamic navigation
        const availableGenres = await catalogModel.getAllGenres();
        logInfo('[Catalog] Render catalog page', {
            userEmail,
            profileId,
            profileName,
            videosPerPage
        });
        res.render('catalog', {
            catalogFeed: '',
            profileName,
            videosPerPage,
            initialPageSize: INITIAL_PAGE_SIZE,
            availableGenres,
            cacheBuster: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
    } catch (error) {
        logError('[Catalog] Error rendering catalog page', error, { userEmail: req.session.user?.email });
        next(error);
    }
}

async function renderVideoDetailPage(req, res, next) {
    try {
        const { videoId } = req.params;
        const { profileId = '' } = req.query;
        const userEmail = req.session.user.email;
        const video = await catalogModel.findVideoById(videoId);
        if (!video) {
            logInfo('[Catalog] Video not found for details', { videoId });
            return res.status(404).send('Video not found.');
        }
        const user = await userModel.getUserByEmail(userEmail, { hydrate: true });
        let profileName = '';
        let likedContent = [];
        let isLiked = false;
        if (user && user.profiles && profileId) {
            const profile = user.profiles.find((p) => p.id === profileId);
            if (profile) {
                profileName = profile.displayName;
                likedContent = profile.likeContent || [];
                isLiked = likedContent.includes(video.id);
            }
        }
        const recommendations = await catalogModel.findRecommendationsByGenres({
            genres: video.genres,
            excludeId: video.id,
            limit: 8,
        });
        logInfo('[Catalog] Render video detail', {
            videoId,
            profileId,
            profileName,
            isLiked
        });
        res.render('item', {
            video,
            profileName,
            profileId,
            isLiked,
            recommendations,
        });
    } catch (error) {
        logError('[Catalog] Error rendering video detail', error, { videoId: req.params.videoId, profileId: req.query.profileId || '' });
        next(error);
    }
}

async function getCatalogByQuery(req, res, next) {
    try {
        const query = req.params.query;
        const searchTerm = query ? query.trim() : '';
        logInfo('[Catalog] Search catalog', { searchTerm });
        const feedHtml = await catalogModel.generateCatalogFeed(
            searchTerm
                ? (item) => item.title.toLowerCase().includes(searchTerm.toLowerCase())
                : null
        );
        return res.type('html').send(feedHtml);
    } catch (error) {
        logError('[Catalog] Error in getCatalogByQuery', error, { query: req.params.query });
        next(error);
    }
}

async function getCatalogData(req, res) {
    try {
        const userEmail = req.session.user.email;
        const { profileId, page = 1, limit, offset, search = '', sortBy = 'title', requestCategory } = req.query;
        const configuredPageSize = getConfiguredPageSize();
        const videosPerPage = typeof limit !== 'undefined'
            ? normalizePageSize(limit, configuredPageSize)
            : configuredPageSize;
        const hasOffset = typeof offset !== 'undefined';
        const normalizedOffset = hasOffset ? normalizeOffset(offset) : undefined;
        const user = await userModel.getUserByEmail(userEmail, { hydrate: true });
        let likedContent = [];
        if (user && profileId) {
            const profile = user.profiles.find(p => p.id === profileId);
            if (profile) {
                likedContent = profile.likeContent || [];
            }
        }
        let catalog;
        let genreSections = [];
        let mostPopular = null;

        if (sortBy === 'home' && profileId) {
            // Continue Watching: Get videos with viewing progress for this profile
            catalog = await catalogModel.getContinueWatching({
                profileId,
                offset: normalizedOffset,
                limit: videosPerPage,
                search,
            });

            // Get Most Popular section (max 10 items)
            if (!hasOffset || normalizedOffset === 0) {
                mostPopular = await catalogModel.getMostPopular(10);
            }

            // Get genre sections for home page
            genreSections = await catalogModel.getVideosByGenre(videosPerPage || DEFAULT_PAGE_SIZE);
        } else if (sortBy.startsWith('genre:')) {
            // Genre-specific catalog
            const genre = sortBy.replace('genre:', '');
            catalog = await catalogModel.getCatalogByGenre({
                genre,
                page,
                offset: normalizedOffset,
                limit: videosPerPage,
                search,
            });
        } else {
            // Regular catalog (including Most Popular)
            catalog = await catalogModel.getCatalog({
                page,
                offset: normalizedOffset,
                limit: videosPerPage,
                search,
                sortBy,
            });
        }
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        logInfo('[Catalog] Get catalog data', {
            userEmail,
            profileId,
            sortBy,
            page,
            limit: videosPerPage,
            requestCategory
        });

        res.json({
            catalog: catalog.items,
            likedContent,
            page: catalog.page,
            offset: catalog.offset,
            total: catalog.total,
            totalPages: Math.ceil(catalog.total / catalog.limit),
            limit: catalog.limit,
            requestCategory,
            genreSections, // Include genre sections for home page
            mostPopular: sortBy === 'home' ? mostPopular : undefined,
            timestamp: Date.now(), // Force fresh data
        });
    } catch (error) {
        console.error('Error fetching catalog data:', error);
        logError('[Catalog] Error fetching catalog data', error, {
            userEmail: req.session.user?.email,
            profileId: req.query.profileId,
            sortBy: req.query.sortBy
        });
        res.status(500).json({ message: 'Server error' });
    }
}

async function streamVideo(req, res) {
    const { videoId } = req.params;

    try {
        const video = await catalogModel.findVideoById(videoId);
        if (!video) {
            logInfo('[Catalog] Stream failed - video not found', { videoId });
            return res.status(404).json({ message: 'Video not found.' });
        }

        const videoPath = resolveVideoPath(video.videoPath);
        const ext = path.extname(videoPath).toLowerCase();
        const mimeType = ext === '.webm'
            ? 'video/webm'
            : ext === '.ogg' || ext === '.ogv'
                ? 'video/ogg'
                : 'video/mp4';
        if (!fs.existsSync(videoPath)) {
            logInfo('[Catalog] Stream failed - file missing', { videoId, videoPath });
            return res.status(404).json({ message: 'Video file missing on server.' });
        }

        const stat = fs.statSync(videoPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (!range) {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': mimeType,
            });
            fs.createReadStream(videoPath).pipe(res);
            return;
        }

        const CHUNK_SIZE = 10 ** 6;
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + CHUNK_SIZE, fileSize - 1);

        const contentLength = end - start + 1;
        const stream = fs.createReadStream(videoPath, { start, end });

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': contentLength,
            'Content-Type': mimeType,
        });

        logInfo('[Catalog] Stream video', {
            videoId,
            withRange: !!range,
            start,
            end
        });

        stream.pipe(res);
    } catch (error) {
        console.error('Error streaming video:', error);
        logError('[Catalog] Error streaming video', error, { videoId });
        res.status(500).json({ message: 'Error streaming video.' });
    }
}

async function getVideoProgress(req, res) {
    const { videoId } = req.params;
    const { profileId } = req.query;

    if (!profileId) {
        logInfo('[Progress] Get progress failed - missing profileId', { videoId });
        return res.status(400).json({ message: 'Profile ID is required.' });
    }

    const userEmail = req.session.user.email;

    try {
        const progress = await viewingSessionModel.getProgress({
            userEmail,
            profileId,
            videoId,
        });

        if (!progress) {
            logInfo('[Progress] No progress for video', { videoId, profileId });
            return res.json({ positionSeconds: 0, durationSeconds: 0 });
        }

        logInfo('[Progress] Get video progress', {
            videoId,
            profileId,
            hasProgress: true
        });

        return res.json({
            positionSeconds: progress.positionSeconds || 0,
            durationSeconds: progress.durationSeconds || 0,
            updatedAt: progress.updatedAt,
        });
    } catch (error) {
        console.error('Error retrieving video progress:', error);
        logError('[Progress] Error retrieving video progress', error, { videoId, profileId });
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function getNextVideo(req, res) {
    const { videoId } = req.params;

    try {
        const nextVideo = await catalogModel.findNextVideo(videoId);
        if (!nextVideo) {
            logInfo('[Catalog] Next video not found', { videoId });
            return res.status(404).json({ message: 'Next video not found.' });
        }

        logInfo('[Catalog] Get next video', {
            videoId,
            nextVideoId: nextVideo.id
        });

        return res.json({ video: nextVideo });
    } catch (error) {
        console.error('Error fetching next video:', error);
        logError('[Catalog] Error fetching next video', error, { videoId });
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function listEpisodes(req, res) {
    const { page = 1, limit = 100, seriesId } = req.query;

    try {
        if (seriesId) {
            const result = await catalogModel.listEpisodesBySeries(seriesId, { page, limit });
            logInfo('[Catalog] List episodes by series', { seriesId, page, limit });
            return res.json(result);
        }

        const result = await catalogModel.listAllVideos({ page, limit });
        logInfo('[Catalog] List all videos (episodes)', { page, limit });
        return res.json(result);
    } catch (error) {
        console.error('Error fetching episodes list:', error);
        logError('[Catalog] Error fetching episodes list', error, { seriesId, page, limit });
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function updateVideoProgress(req, res) {
    const { videoId } = req.params;
    const { profileId, positionSeconds, durationSeconds } = req.body;

    if (!profileId) {
        logInfo('[Progress] Update failed - missing profileId', { videoId });
        return res.status(400).json({ message: 'Profile ID is required.' });
    }

    try {
        const session = await viewingSessionModel.updateProgress({
            userEmail: req.session.user.email,
            profileId,
            videoId,
            positionSeconds,
            durationSeconds,
        });

        if (!session) {
            logInfo('[Progress] Update failed - invalid video identifier', { videoId, profileId });
            return res.status(400).json({ message: 'Invalid video identifier.' });
        }
        logInfo('[Progress] Progress saved', {
            videoId,
            profileId,
            positionSeconds,
            durationSeconds
        });
        return res.json({ message: 'Progress saved.' });
    } catch (error) {
        console.error('Error updating video progress:', error);
        logError('[Progress] Error updating video progress', error, {
            videoId,
            profileId
        });
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function adminCreateVideo(req, res) {
    try {
        const created = await catalogModel.createVideo(req.body);
        logInfo('[Admin] Video created', {
            videoId: created.id,
            title: created.title
        });
        return res.status(201).json(created);
    } catch (error) {
        console.error('[adminCreateVideo] error:', error);
        logError('[Admin] Error creating video', error);
        return res.status(500).json({ message: 'Server error' });
    }
}

async function adminUpdateVideo(req, res) {
    try {
        const { videoId } = req.params;
        const updated = await catalogModel.updateVideoById(videoId, req.body);
        if (!updated){
            logInfo('[Admin] Update failed - video not found', { videoId });
            return res.status(404).json({ message: 'Video not found' });}

        logInfo('[Admin] Video updated', { videoId });    
        return res.json(updated);
    } catch (error) {
        console.error('[adminUpdateVideo] error:', error);
        logError('[Admin] Error updating video', error, { videoId });
        return res.status(500).json({ message: 'Server error' });
    }
}

async function adminDeleteVideo(req, res) {
    try {
        const { videoId } = req.params;
        const ok = await catalogModel.deleteVideoById(videoId);
        if (!ok){
            logInfo('[Admin] Delete failed - video not found', { videoId });
             return res.status(404).json({ message: 'Video not found' });}
        logInfo('[Admin] Video deleted', { videoId });
        return res.status(204).end();
    } catch (error) {
        console.error('[adminDeleteVideo] error:', error);
        logError('[Admin] Error deleting video', error, { videoId });
        return res.status(500).json({ message: 'Server error' });
    }
}


module.exports = {
    renderCatalogPage,
    renderVideoDetailPage,
    getCatalogByQuery,
    getCatalogData,
    streamVideo,
    getVideoProgress,
    getNextVideo,
    listEpisodes,
    updateVideoProgress,
    adminCreateVideo,
    adminUpdateVideo,
    adminDeleteVideo,
};