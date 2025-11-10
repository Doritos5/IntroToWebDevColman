const mongoose = require('mongoose');
const { ViewingSession } = require('./viewingSessionModel');

const seriesSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
}, {
    timestamps: true,
});

seriesSchema.virtual('id').get(function id() {
    return this._id.toString();
});

seriesSchema.set('toJSON', { virtuals: true });
seriesSchema.set('toObject', { virtuals: true });

const videoSchema = new mongoose.Schema({
    legacyId: { type: Number, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    year: { type: Number },
    genres: { type: [String], default: [] },
    poster: { type: String, default: '' },
    likes: { type: Number, default: 0 },
    rating: { type: Number, default: 0.0, min: 0.0, max: 10.0 },
    videoPath: { type: String, required: true },
    type: {
        type: String,
        enum: ['movie', 'series'],
        default: 'movie',
        required: true,
        index: true,
    },
    series: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Series',
        default: null,
        index: true,
    },
    episodeNumber: { type: Number, min: 1 },
}, {
    timestamps: true,
});

videoSchema.index({ title: 1 });
videoSchema.index({ series: 1, episodeNumber: 1 });

videoSchema.virtual('id').get(function id() {
    return this._id.toString();
});

videoSchema.set('toJSON', { virtuals: true });
videoSchema.set('toObject', { virtuals: true });

const Series = mongoose.models.Series || mongoose.model('Series', seriesSchema);
const Video = mongoose.models.Video || mongoose.model('Video', videoSchema);

function toClientVideo(video) {
    if (!video) {
        return null;
    }

    let raw;

    if (typeof video.toObject === 'function') {
        raw = video.toObject();
    } else if (video._id && !video.id) {
        raw = {
            ...video,
            id: video._id.toString(),
        };
    } else {
        raw = { ...video };
    }

    raw.id = raw.id || raw._id?.toString();
    delete raw._id;
    delete raw.__v;

    const normalized = { ...raw };

    const rawSeries = normalized.series ?? null;
    if (rawSeries && typeof rawSeries === 'object') {
        normalized.seriesId = rawSeries.id
            || rawSeries._id?.toString()
            || (typeof rawSeries.toString === 'function' ? rawSeries.toString() : null);
        normalized.seriesTitle = rawSeries.title || null;
    } else if (rawSeries) {
        normalized.seriesId = typeof rawSeries === 'string'
            ? rawSeries
            : rawSeries.toString();
    }

    if (!normalized.seriesId) {
        normalized.seriesId = normalized.seriesId || null;
    }

    normalized.type = normalized.type || (normalized.seriesId ? 'series' : 'movie');

    if (normalized.type !== 'series') {
        normalized.seriesId = null;
        normalized.seriesTitle = null;
    } else {
        normalized.seriesTitle = normalized.seriesTitle || null;
    }

    const episodeValue = Number(normalized.episodeNumber);
    normalized.episodeNumber = Number.isFinite(episodeValue) ? episodeValue : null;

    delete normalized.series;

    return normalized;
}

function toClientSeries(series) {
    if (!series) {
        return null;
    }

    if (typeof series.toObject === 'function') {
        const raw = series.toObject();
        raw.id = raw.id || raw._id?.toString();
        delete raw._id;
        delete raw.__v;
        return raw;
    }

    if (series._id && !series.id) {
        return {
            ...series,
            id: series._id.toString(),
        };
    }

    return { ...series };
}

async function getCatalog({ page = 1, limit = 10, offset, search, sortBy = 'title' } = {}) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 60);
    const hasOffset = typeof offset !== 'undefined';
    const safeOffset = hasOffset
        ? Math.max(Number(offset) || 0, 0)
        : (safePage - 1) * safeLimit;

    const filter = search
        ? { title: { $regex: search.trim(), $options: 'i' } }
        : {};


    // Determine sort order
    let sortOptions = { title: 1 }; // default sort by title ascending
    if (sortBy === 'popular' || sortBy === 'likes') {
        sortOptions = { likes: -1, title: 1 }; // sort by likes descending, then by title
    }

    const items = await Video.find(filter)
        .skip(safeOffset)
        .sort(sortOptions)
        .limit(safeLimit)
        .lean({ virtuals: true });

    const total = await Video.countDocuments(filter);

    const normalized = items.map((item) => toClientVideo(item));

    return {
        items: normalized,
        total,
        page: hasOffset ? Math.floor(safeOffset / safeLimit) + 1 : safePage,
        offset: safeOffset,
        limit: safeLimit,
    };
}

async function generateCatalogFeed(filterFunc = null) {
    const { items } = await getCatalog({ page: 1, limit: 1000 });

    const filtered = typeof filterFunc === 'function'
        ? items.filter(filterFunc)
        : items;

    const sorted = filtered.sort((a, b) => a.title.localeCompare(b.title));

    return sorted.map(generateCardHTML).join('');
}

function generateCardHTML(item) {
    const badges = (item.genres || [])
        .map((genre) => `<span class="badge text-bg-secondary me-1 mb-1">${genre}</span>`)
        .join('');

    return `
      <div class="col-6 col-md-4 col-lg-3 mb-4">
        <div class="card h-100 bg-dark text-white" data-video-id="${item.id}">
          <img src="${item.poster}" class="card-img-top" alt="${item.title}">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-1">${item.title}</h5>
            <div class="small text-white-50 mb-2">${item.year ?? ''}</div>
            <div class="mb-3">${badges}</div>
            <div class="mt-auto d-flex justify-content-between align-items-center">
              <span class="small"><i class="bi bi-heart-fill text-danger me-1"></i>
              <span data-likes-id="${item.id}">${item.likes ?? 0}</span>
              </span>
              <button class="btn btn-sm btn-outline-light" data-item-id="${item.id}" data-like-button>Like</button>
            </div>
          </div>
        </div>
      </div>`;
}

async function findVideoById(id) {
    if (!id) {
        return null;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
    }

    const video = await Video.findById(id)
        .populate('series')
        .lean({ virtuals: true });
    return toClientVideo(video);
}

async function incrementLikes(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
    }

    const updated = await Video.findByIdAndUpdate(
        id,
        { $inc: { likes: 1 } },
        { new: true, lean: true, virtuals: true }
    );

    return toClientVideo(updated);
}

async function decrementLikes(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
    }

    const updated = await Video.findOneAndUpdate(
        { _id: id, likes: { $gt: 0 } },
        { $inc: { likes: -1 } },
        { new: true, lean: true, virtuals: true }
    );

    if (updated) {
        return toClientVideo(updated);
    }

    return findVideoById(id);
}

async function listAllVideos({ page = 1, limit = 100 } = {}) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 500);
    const skip = (safePage - 1) * safeLimit;

    const items = await Video.find({})
        .sort({ title: 1 })
        .skip(skip)
        .limit(safeLimit)
        .lean({ virtuals: true });

    const total = await Video.countDocuments({});


    return {
        items: items.map((item) => toClientVideo(item)),
        total,
        page: safePage,
        limit: safeLimit,
    };
}

async function findNextVideo(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
    }

    const current = await Video.findById(id)
        .select({ title: 1, type: 1, series: 1, episodeNumber: 1 })
        .lean();
    if (!current) {
        return null;
    }

    if (current.type === 'series' && current.series) {
        const query = {
            series: current.series,
            type: 'series',
        };

        if (Number.isFinite(current.episodeNumber)) {
            query.episodeNumber = { $gt: current.episodeNumber };
        } else {
            query._id = { $ne: id };
        }

        const nextEpisode = await Video.findOne(query)
            .sort({ episodeNumber: 1, title: 1 })
            .lean({ virtuals: true });

        if (nextEpisode) {
            return toClientVideo(nextEpisode);
        }

        return null;
    }

    const next = await Video.findOne({ title: { $gt: current.title } })
        .sort({ title: 1 })
        .lean({ virtuals: true });

    if (next) {
        return toClientVideo(next);
    }

    const first = await Video.findOne({})
        .sort({ title: 1 })
        .lean({ virtuals: true });

    if (!first) {
        return null;
    }

    if (first._id?.toString() === id) {
        return null;
    }

    return toClientVideo(first);
}

async function findRecommendationsByGenres({ genres = [], excludeId, limit = 8 } = {}) {
    const normalizedGenres = Array.isArray(genres)
        ? genres.filter((genre) => typeof genre === 'string' && genre.trim().length > 0)
        : [];

    const filter = {};

    if (normalizedGenres.length > 0) {
        filter.genres = {$in: normalizedGenres};
    }

    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
        filter._id = {$ne: excludeId};
    }

    const query = Video.find(filter)
        .sort({likes: -1, title: 1})
        .limit(Math.max(0, Number(limit) || 0))
        .lean({virtuals: true});

    const items = await query;

    return items.map((item) => toClientVideo(item));
}

async function listEpisodesBySeries(seriesId, {page = 1, limit = 100} = {}) {
        if (!seriesId || !mongoose.Types.ObjectId.isValid(seriesId)) {
            return {
                items: [],
                total: 0,
                page: 1,
                limit: Number(limit) || 100,
                series: null,
            };
        }

        const safePage = Math.max(Number(page) || 1, 1);
        const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 500);
        const skip = (safePage - 1) * safeLimit;

        const filter = {
            series: seriesId,
            type: 'series',
        };

    const items = await Video.find(filter)
        .sort({ episodeNumber: 1, title: 1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('series')
        .lean({ virtuals: true });

    const total = await Video.countDocuments(filter);

    const series = await Series.findById(seriesId).lean({ virtuals: true });


        return {
            items: items.map((item) => toClientVideo(item)),
            total,
            page: safePage,
            limit: safeLimit,
            series: toClientSeries(series),
        };
    }

async function getContinueWatching({ profileId, offset = 0, limit = 10, search = '' } = {}) {
    try {
        // Find viewing sessions for this specific profile with actual progress
        const viewingSessions = await ViewingSession.find({
            profileId: profileId,
            positionSeconds: { $gt: 0, $exists: true }, // Has started watching
            durationSeconds: { $gt: 0, $exists: true }, // Has valid duration
            $expr: { 
                $and: [
                    { $gt: ['$positionSeconds', 0] },
                    { $lt: ['$positionSeconds', { $multiply: ['$durationSeconds', 0.99] }] }
                ]
            } // Not completed (less than 99%)
        })
        .sort({ updatedAt: -1 }) // Most recently watched first
        .populate('videoId')
        .exec();

        if (!viewingSessions || viewingSessions.length === 0) {
            return {
                items: [],
                total: 0,
                page: 1,
                offset,
                limit,
            };
        }

        // Extract valid video objects and apply pagination
        let videoItems = viewingSessions
            .map(session => session.videoId)
            .filter(video => video && video._id);

        // Apply search filter if provided
        if (search && search.trim()) {
            const searchLower = search.toLowerCase().trim();
            videoItems = videoItems.filter(video => 
                video.title && video.title.toLowerCase().includes(searchLower)
            );
        }

        // Apply pagination manually since we need to filter first
        const totalFilteredItems = videoItems.length;
        const paginatedItems = videoItems.slice(offset, offset + limit);

        return {
            items: paginatedItems.map(video => toClientVideo(video)),
            total: totalFilteredItems,
            page: Math.floor(offset / limit) + 1,
            offset,
            limit,
        };
    } catch (error) {
        console.error('Error in getContinueWatching:', error);
        return {
            items: [],
            total: 0,
            page: 1,
            offset: 0,
            limit,
        };
    }
}

async function getVideosByGenre(limit = 10) {
    try {
        // Get all unique genres from the videos collection
        const genres = await Video.distinct('genres', { genres: { $exists: true, $ne: [] } });

        const genreSections = [];

        for (const genre of genres) {
            // For each genre, get the newest videos (by year)
            // For series, get only the first episode and max 1 per series
            const videos = await Video.aggregate([
                // 1. Match videos that have this genre
                { $match: { genres: genre } },

                // 2. Sort so that $first picks earliest episode for series
                { $sort: { year: 1, episodeNumber: 1 } },

                // 3. Group by series (for series) or by self (for movies)
                {
                    $group: {
                        _id: {
                            // Group by series ID for series, by video ID for movies
                            seriesId: {
                                $cond: [
                                    { $eq: ['$type', 'series'] },
                                    '$series',
                                    '$_id'
                                ]
                            },
                            type: '$type'
                        },
                        firstEpisode: { $first: '$$ROOT' }
                    }
                },

                // 4. Replace root with the first episode document
                { $replaceRoot: { newRoot: '$firstEpisode' } },

                // 5. Lookup the related series document
                {
                    $lookup: {
                        from: 'series',
                        localField: 'series',
                        foreignField: '_id',
                        as: 'seriesDoc'
                    }
                },

                // 6. Unwind to convert [seriesDoc] → seriesDoc (null if no series)
                { $unwind: { path: '$seriesDoc', preserveNullAndEmptyArrays: true } },

                // 7. Add seriesTitle and seriesData fields
                {
                    $addFields: {
                        seriesTitle: '$seriesDoc.title',
                    }
                },

                // 8. Sort final list by year descending
                { $sort: { year: -1 } },

                // 9. Limit to desired number of results
                { $limit: limit },

                // 10. Remove internal seriesDoc
                {
                    $project: {
                        seriesDoc: 0
                    }
                }
            ]);

            if (videos.length > 0) {
                genreSections.push({
                    genre,
                    videos: videos.map(toClientVideo)
                });
            }
        }

        return genreSections;
    } catch (error) {
        console.error('Error getting videos by genre:', error);
        return [];
    }
}

/**
 * Get all unique genres from the video collection
 * @returns {Promise<string[]>} Array of genre names
 */
async function getAllGenres() {
    try {
        const genres = await Video.distinct('genres');
        return genres.filter(genre => genre && genre.trim()).sort();
    } catch (error) {
        console.error('Error getting genres:', error);
        return [];
    }
}

/**
 * Get videos for a specific genre with pagination
 * @param {string} genre - Genre name
 * @param {Object} options - Pagination and search options
 * @returns {Promise<Object>} Paginated catalog for genre
 */
async function getCatalogByGenre({ genre, page = 1, offset, limit = 10, search = '' }) {
    try {
        const pageNumber = Math.max(1, Number(page));
        const pageSize = Math.max(1, Number(limit));
        const searchCondition = search
            ? { title: { $regex: search, $options: 'i' } }
            : {};

        // Build aggregation pipeline
        const pipeline = [
            // Match genre and search conditions
            {
                $match: {
                    genres: genre,
                    ...searchCondition
                }
            },

            // Group series to get only first episodes
            {
                $group: {
                    _id: {
                        seriesId: { $ifNull: ['$series', '$_id'] },
                        type: '$type'
                    },
                    doc: { $first: '$$ROOT' }
                }
            },

            // Replace root with the document
            { $replaceRoot: { newRoot: '$doc' } },

            // Sort by year (newest first), then by title
            { $sort: { year: -1, title: 1 } }
        ];

        // Add pagination
        if (offset !== undefined) {
            const skipAmount = Math.max(0, Number(offset));
            pipeline.push({ $skip: skipAmount });
        } else {
            const skipAmount = (pageNumber - 1) * pageSize;
            pipeline.push({ $skip: skipAmount });
        }

        pipeline.push({ $limit: pageSize });

        const videos = await Video.aggregate(pipeline);

        // Get total count for pagination
        const countPipeline = [
            {
                $match: {
                    genres: genre,
                    ...searchCondition
                }
            },
            {
                $group: {
                    _id: {
                        seriesId: { $ifNull: ['$series', '$_id'] },
                        type: '$type'
                    }
                }
            },
            { $count: 'total' }
        ];

        const countResult = await Video.aggregate(countPipeline);
        const totalCount = countResult[0]?.total || 0;

        return {
            items: videos.map(toClientVideo),
            total: totalCount,
            page: pageNumber,
            offset: offset !== undefined ? Math.max(0, Number(offset)) : (pageNumber - 1) * pageSize,
            limit: pageSize,
        };
    } catch (error) {
        console.error('Error getting catalog by genre:', error);
        return {
            items: [],
            total: 0,
            page: 1,
            offset: 0,
            limit: limit,
        };
    }
}

async function getMostPopular(limit = 10) {
    try {
        const videos = await Video.aggregate([
            // Sort by likes
            { $sort: { likes: -1, episodeNumber: 1 } },
            
            // Group series together to get only first episode per series
            {
                $group: {
                    _id: {
                        // Group by series ID for series, by video ID for movies
                        seriesId: { $cond: [{ $eq: ['$type', 'series'] }, '$series', '$_id'] },
                        type: '$type'
                    },
                    firstEpisode: { $first: '$$ROOT' }
                }
            },
            
            { $replaceRoot: { newRoot: '$firstEpisode' } },
            
            // Sort by likes (descending)
            { $sort: { likes: -1 } },
            
            // Limit to specified number of items
            { $limit: limit }
        ]);

        return videos.map(toClientVideo);
    } catch (error) {
        console.error('Error getting most popular videos:', error);
        return [];
    }
}

module.exports = {
    Video,
    Series,
    getCatalog,
    getContinueWatching,
    generateCatalogFeed,
    findVideoById,
    incrementLikes,
    decrementLikes,
    listAllVideos,
    findNextVideo,
    findRecommendationsByGenres,
    listEpisodesBySeries,
    getVideosByGenre,
    getAllGenres,
    getCatalogByGenre,
    getMostPopular,
};

