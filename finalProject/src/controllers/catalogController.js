const fs = require('fs');
const path = require('path');
const catalogModel = require('../models/catalogModel');
const userModel = require('../models/userModel');
const viewingSessionModel = require('../models/viewingSessionModel');

const INITIAL_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE = 5;

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

        res.render('catalog', {
            catalogFeed: '',
            profileName,
            videosPerPage,
            initialPageSize: INITIAL_PAGE_SIZE,
        });
    } catch (error) {
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
        res.render('item', {
            video,
            profileName,
            profileId,
            isLiked,
            recommendations,
        });
    } catch (error) {
        next(error);
    }
}

async function getCatalogByQuery(req, res, next) {
    try {
        const query = req.params.query;
        const searchTerm = query ? query.trim() : '';

        const feedHtml = await catalogModel.generateCatalogFeed(
            searchTerm
                ? (item) => item.title.toLowerCase().includes(searchTerm.toLowerCase())
                : null
        );

        return res.type('html').send(feedHtml);
    } catch (error) {
        next(error);
    }
}

async function getCatalogData(req, res) {
    try {
        console.log('[getCatalogData] Starting request, session user:', req.session?.user?.email);
        const userEmail = req.session.user.email;
        const { profileId, page = 1, limit, offset, search = '', sortBy = 'title' } = req.query;
        console.log('[getCatalogData] Query params:', { profileId, page, limit, offset, search, sortBy });
        const configuredPageSize = getConfiguredPageSize();
        const videosPerPage = typeof limit !== 'undefined'
            ? normalizePageSize(limit, configuredPageSize)
            : configuredPageSize;
        const hasOffset = typeof offset !== 'undefined';
        const normalizedOffset = hasOffset ? normalizeOffset(offset) : undefined;
        console.log('[getCatalogData] Looking for user:', userEmail);
        const user = await userModel.getUserByEmail(userEmail, { hydrate: true });
        console.log('[getCatalogData] User found:', !!user, user ? `with ${user.profiles?.length || 0} profiles` : 'null');
        let likedContent = [];
        if (user && profileId) {
            const profile = user.profiles.find(p => p.id === profileId);
            if (profile) {
                likedContent = profile.likeContent || [];
            }
        }
        console.log('[getCatalogData] Calling catalogModel.getCatalog with:', { page, offset: normalizedOffset, limit: videosPerPage, search, sortBy });
        const catalog = await catalogModel.getCatalog({
            page,
            offset: normalizedOffset,
            limit: videosPerPage,
            search,
            sortBy,
        });
        res.json({
            catalog: catalog.items,
            likedContent,
            page: catalog.page,
            offset: catalog.offset,
            total: catalog.total,
            totalPages: Math.ceil(catalog.total / catalog.limit),
            limit: catalog.limit,
        });
    } catch (error) {
        console.error('[getCatalogData] Error fetching catalog data:', error);
        console.error('[getCatalogData] Error stack:', error.stack);
        res.status(500).json({ message: 'Server error' });
    }
}

async function streamVideo(req, res) {
    const { videoId } = req.params;

    try {
        const video = await catalogModel.findVideoById(videoId);
        if (!video) {
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

        stream.pipe(res);
    } catch (error) {
        console.error('Error streaming video:', error);
        res.status(500).json({ message: 'Error streaming video.' });
    }
}

async function getVideoProgress(req, res) {
    const { videoId } = req.params;
    const { profileId } = req.query;

    if (!profileId) {
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
            return res.json({ positionSeconds: 0, durationSeconds: 0 });
        }

        return res.json({
            positionSeconds: progress.positionSeconds || 0,
            durationSeconds: progress.durationSeconds || 0,
            updatedAt: progress.updatedAt,
        });
    } catch (error) {
        console.error('Error retrieving video progress:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function getNextVideo(req, res) {
    const { videoId } = req.params;

    try {
        const nextVideo = await catalogModel.findNextVideo(videoId);
        if (!nextVideo) {
            return res.status(404).json({ message: 'Next video not found.' });
        }

        return res.json({ video: nextVideo });
    } catch (error) {
        console.error('Error fetching next video:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function listEpisodes(req, res) {
    const { page = 1, limit = 100, seriesId } = req.query;

    try {
        if (seriesId) {
            const result = await catalogModel.listEpisodesBySeries(seriesId, { page, limit });
            return res.json(result);
        }

        const result = await catalogModel.listAllVideos({ page, limit });
        return res.json(result);
    } catch (error) {
        console.error('Error fetching episodes list:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function updateVideoProgress(req, res) {
    const { videoId } = req.params;
    const { profileId, positionSeconds, durationSeconds } = req.body;

    if (!profileId) {
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
            return res.status(400).json({ message: 'Invalid video identifier.' });
        }

        return res.json({ message: 'Progress saved.' });
    } catch (error) {
        console.error('Error updating video progress:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function adminCreateVideo(req, res) {
    try {
        const created = await catalogModel.createVideo(req.body);
        return res.status(201).json(created);
    } catch (error) {
        console.error('[adminCreateVideo] error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
}

async function adminUpdateVideo(req, res) {
    try {
        const { videoId } = req.params;
        const updated = await catalogModel.updateVideoById(videoId, req.body);
        if (!updated) return res.status(404).json({ message: 'Video not found' });
        return res.json(updated);
    } catch (error) {
        console.error('[adminUpdateVideo] error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
}

async function adminDeleteVideo(req, res) {
    try {
        const { videoId } = req.params;
        const ok = await catalogModel.deleteVideoById(videoId);
        if (!ok) return res.status(404).json({ message: 'Video not found' });
        return res.status(204).end();
    } catch (error) {
        console.error('[adminDeleteVideo] error:', error);
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