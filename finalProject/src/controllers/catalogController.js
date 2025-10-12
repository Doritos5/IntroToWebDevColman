const fs = require('fs');
const path = require('path');
const catalogModel = require('../models/catalogModel');
const userModel = require('../models/userModel');
const viewingSessionModel = require('../models/viewingSessionModel');

function resolveVideoPath(relativePath) {
    if (path.isAbsolute(relativePath)) {
        return relativePath;
    }
    return path.join(__dirname, '..', '..', 'storage', 'videos', relativePath);
}

async function renderCatalogPage(req, res, next) {
    try {
        const userEmail = req.email;

        const profileId = req.query.profileId;

        const user = await userModel.findUserByEmail(userEmail);

        let profileName = '';
        if (user && profileId) {
            const profile = user.profiles.find(p => p.id === profileId);
            if (profile) {
                profileName = profile.displayName;
            }
        }

        const videosPerPage = Number(process.env.VIDEOS_PER_PAGE || 12);

        res.render('catalog', {
            catalogFeed: '',
            profileName,
            videosPerPage,
        });

    } catch (error) {
        next(error);
    }
}

async function renderVideoDetailPage(req, res, next) {
    try {
        const { videoId } = req.params;
        const { profileId = '' } = req.query;
        const userEmail = req.email;

        const video = await catalogModel.findVideoById(videoId);
        if (!video) {
            return res.status(404).send('Video not found.');
        }

        const user = await userModel.findUserByEmail(userEmail);

        let profileName = '';
        let likedContent = [];
        let isLiked = false;

        if (user && profileId) {
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
        const userEmail = req.email;
        const { profileId, page = 1, limit, search = '' } = req.query;
        const videosPerPage = Number(limit || process.env.VIDEOS_PER_PAGE || 12);
        const user = await userModel.findUserByEmail(userEmail);

        let likedContent = [];
        if (user && profileId) {
            const profile = user.profiles.find(p => p.id === profileId);
            if (profile) {
                likedContent = profile.likeContent || [];
            }
        }

        const catalog = await catalogModel.getCatalog({
            page,
            limit: videosPerPage,
            search,
        });

        res.json({
            catalog: catalog.items,
            likedContent,
            page: catalog.page,
            total: catalog.total,
            totalPages: Math.ceil(catalog.total / catalog.limit),
            limit: catalog.limit,
        });

    } catch (error) {
        console.error('Error fetching catalog data:', error);
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

    try {
        const progress = await viewingSessionModel.getProgress({
            userEmail: req.email,
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
            userEmail: req.email,
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
};