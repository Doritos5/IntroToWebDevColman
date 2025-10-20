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


async function populateCatalog() {
    const videoCount = await Video.estimatedDocumentCount();
    const seriesCount = await Series.estimatedDocumentCount();

    if (videoCount > 0 || seriesCount > 0) {
        return;
    }

    const catalogJsonPath = path.join(__dirname, '..', 'models', 'data', 'catalog.json');
    const payload = await readJsonSafe(catalogJsonPath) || {};


    // Helpers
    const getOid = (maybe) => {
        // supports {"$oid":"..."} or a plain string
        if (maybe && typeof maybe === 'object' && typeof maybe.$oid === 'string') return maybe.$oid;
        if (typeof maybe === 'string') return maybe;
        return undefined;
    };

    const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };

    const arr = (v) => Array.isArray(v) ? v : [];

    let movieCount = 0;
    let episodeCount = 0;

    const videosToInsert = [];
    const seriesInsertInputs = [];
    const originalOidByIndex = [];


    // 1) Insert series and build map from original $oid to new _id
    for (const s of arr(payload.series)) {
        seriesInsertInputs.push({
            title: s.title,
            description: s.description || '',
        });
        originalOidByIndex.push(getOid(s?._id));
    }
    const insertedSeries = seriesInsertInputs.length ? await Series.insertMany(seriesInsertInputs) : [];
    const seriesIdByOriginalOid = new Map();
    insertedSeries.forEach((doc, i) => {
        const orig = originalOidByIndex[i];
        if (orig) seriesIdByOriginalOid.set(orig, doc._id);
    });

    // 2) Insert videos (movies + episodes)
    for (const v of arr(payload.videos)) {
        if (!v || !v.title) continue;

        const base = {
            legacyId: toNum(v.legacyId ?? v.id),
            title: v.title,
            description: v.description || '',
            year: toNum(v.year),
            genres: arr(v.genres),
            poster: v.poster || '',
            likes: toNum(v.likes) || 0,
            videoPath: v.videoPath || 'sample.mp4',
        };

        if (v.type === 'movie' || v.series === null) {
            videosToInsert.push({ ...base, type: 'movie' });
            movieCount += 1;
        } else if (v.type === 'series') {
            const seriesOrigOid = getOid(v.series);
            const seriesNewId = seriesIdByOriginalOid.get(seriesOrigOid);
            if (!seriesNewId) {
                console.warn(`[Seed] Skipping episode "${v.title}" – unknown series OID ${seriesOrigOid}`);
                continue;
            }
            const episodeNumber = toNum(v.episodeNumber) || undefined;
            videosToInsert.push({
                ...base,
                type: 'series',
                series: seriesNewId,
                episodeNumber,
            });
            episodeCount += 1;
        } else {
            // Fallback: treat unknown types as movies
            videosToInsert.push({ ...base, type: 'movie' });
            movieCount += 1;
        }
    }

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
const uri = 'mongodb://127.0.0.1:27017/testDor';

mongoose.connect(uri)
    .then(async () => {
        console.log('[Seed] Connected to MongoDB');
        await populateDB();
        console.log('[Seed] Done.');
        mongoose.disconnect();
    })
    .catch(err => console.error(err));
