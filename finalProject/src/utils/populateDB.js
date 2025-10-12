// Team - in order to populate your local DB - run this

const fs = require('fs/promises'); // enable us to use "await" in fs calls - like #11
const path = require('path');
const { Video, Series } = require('../models/catalogModel');
const { User } = require('../models/userModel');
const { Profile } = require('../models/profileModel');

async function readJsonSafe(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        console.error(`[Seed] Failed to read ${filePath}:`, error);
        return null;
    }
}

function normalizeNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
}

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

async function populateCatalog() {
    const videoCount = await Video.estimatedDocumentCount();
    const seriesCount = await Series.estimatedDocumentCount();

    if (videoCount > 0 || seriesCount > 0) {
        return;
    }

    const catalogJsonPath = path.join(__dirname, '..', 'models', 'data', 'catalog.json');
    const payload = await readJsonSafe(catalogJsonPath) || {};


    const movies = ensureArray(payload.movies);
    const seriesEntries = ensureArray(payload.series);

    if (!movies.length && !seriesEntries.length) {
        console.warn('[Seed] No catalog entries found in JSON seed file.');
        return;
    }

    let movieCount = 0;
    let episodeCount = 0;

    const seriesDocsInput = seriesEntries.map((series) => ({
        title: series.title,
        description: series.description || '',
    }));

    const insertedSeries = seriesDocsInput.length
        ? await Series.insertMany(seriesDocsInput)
        : [];

    if (insertedSeries.length) {
        console.log(`[Seed] Inserted ${insertedSeries.length} series definitions from JSON seed.`);
    }

    const videosToInsert = [];

    movies.forEach((movie) => {
        if (!movie || !movie.title) {
            return;
        }

        videosToInsert.push({
            legacyId: normalizeNumber(movie.legacyId ?? movie.id),
            title: movie.title,
            description: movie.description || '',
            year: normalizeNumber(movie.year),
            genres: ensureArray(movie.genres),
            poster: movie.poster || '',
            likes: normalizeNumber(movie.likes) || 0,
            videoPath: movie.videoPath || 'sample.mp4',
            type: 'movie',
        });

        movieCount += 1;
    });

    seriesEntries.forEach((series, index) => {
        const seriesDoc = insertedSeries[index];
        if (!seriesDoc) {
            return;
        }

        const fallbackPoster = series.poster || '';
        const fallbackGenres = ensureArray(series.genres);
        const fallbackVideoPath = series.videoPath || 'sample.mp4';
        const fallbackYear = normalizeNumber(series.year);
        const fallbackDescription = series.description || '';
        const fallbackLikes = normalizeNumber(series.likes) || 0;

        const episodes = ensureArray(series.episodes);
        episodes.forEach((episode, episodeIndex) => {
            if (!episode || !episode.title) {
                return;
            }

            const explicitEpisode = normalizeNumber(episode.episodeNumber);
            const episodeNumber = explicitEpisode || episodeIndex + 1;
            const episodeGenres = ensureArray(episode.genres);
            const resolvedGenres = episodeGenres.length ? episodeGenres : fallbackGenres;
            const episodeLikes = normalizeNumber(episode.likes);
            const resolvedLikes = episodeLikes !== undefined ? episodeLikes : fallbackLikes;
            const episodeYear = normalizeNumber(episode.year);
            const resolvedYear = episodeYear !== undefined ? episodeYear : fallbackYear;

            videosToInsert.push({
                legacyId: normalizeNumber(episode.legacyId ?? episode.id),
                title: episode.title,
                description: episode.description || fallbackDescription,
                year: resolvedYear,
                genres: resolvedGenres,
                poster: episode.poster || fallbackPoster,
                likes: resolvedLikes,
                videoPath: episode.videoPath || fallbackVideoPath,
                type: 'series',
                series: seriesDoc._id,
                episodeNumber,
            });

            episodeCount += 1;
        });
    });

    if (!videosToInsert.length) {
        console.warn('[Seed] No videos generated from catalog seed data.');
        return;
    }

    await Video.insertMany(videosToInsert);
    console.log(`[Seed] Inserted ${movieCount} movies and ${episodeCount} episodes (${videosToInsert.length} videos total) from JSON seed.`);
}

async function populateUsers() {
    const existingCount = await User.estimatedDocumentCount();
    if (existingCount > 0) {
        return;
    }

    const usersJsonPath = path.join(__dirname, '..', 'models', 'data', 'users.json');
    const payload = await readJsonSafe(usersJsonPath);
    const users = payload && Array.isArray(payload.users) ? payload.users : [];

    if (!users.length) {
        console.warn('[Seed] No users found in JSON seed file.');
        return;
    }

    const videos = await Video.find({}, { legacyId: 1 }).lean();
    const idMap = new Map();
    videos.forEach((video) => {
        if (typeof video.legacyId === 'number') {
            idMap.set(video.legacyId, video._id.toString());
        }
    });

    const normalizedUsers = users.map((user) => ({
        ...user,
        email: user.email.toLowerCase(),
        profiles: (user.profiles || []).map((profile) => ({
            ...profile,
            likeContent: (profile.likeContent || [])
                .map((legacy) => idMap.get(legacy))
                .filter(Boolean),
        })),
    }));

    const userDocs = normalizedUsers.map(({ profiles, ...userFields }) => userFields);
    await User.insertMany(userDocs);

    const insertedUsers = await User.find({
        email: { $in: userDocs.map((user) => user.email) },
    }, { id: 1, email: 1 }).lean();

    const emailToUserId = new Map(insertedUsers.map((user) => [user.email, user.id]));

    const profileDocs = normalizedUsers.flatMap((user) => {
        const userId = emailToUserId.get(user.email);
        if (!userId) {
            return [];
        }

        return (user.profiles || []).map((profile) => ({
            ...profile,
            userId,
        }));
    });

    if (profileDocs.length > 0) {
        await Profile.insertMany(profileDocs);
    }

    console.log(`[Seed] Inserted ${normalizedUsers.length} users and ${profileDocs.length} profiles from JSON seed.`);
}

async function populateDB() {
    await populateCatalog();
    await populateUsers();
}

const mongoose = require('mongoose');
const uri = 'mongodb://127.0.0.1:27017/SuperNetflix';

mongoose.connect(uri)
    .then(async () => {
        console.log('[Seed] Connected to MongoDB');
        await populateDB();
        console.log('[Seed] Done.');
        mongoose.disconnect();
    })
    .catch(err => console.error(err));
