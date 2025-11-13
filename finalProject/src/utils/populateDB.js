// Populate the database with varied fake data for Streamix
// - Users: admin and regular users
// - Profiles linked to users
// - Series (with multiple episodes per series)
// - Movies
// - Random likes/ratings
// - Poster URLs use picsum with seed = encoded title

// Ensure .env is loaded
try { require('dotenv').config(); } catch (_) {}

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { Video, Series } = require('../models/catalogModel');
const { User } = require('../models/userModel');
const { Profile } = require('../models/profileModel');

function slugSeed(title) {
    return encodeURIComponent(String(title || '').trim() || 'streamix');
}

function picsumPoster(title) {
    return `https://picsum.photos/seed/${slugSeed(title)}/600/338`;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, digits = 1) {
    const n = Math.random() * (max - min) + min;
    return Number(n.toFixed(digits));
}

const GENRES = [
    'Action', 'Drama', 'Comedy', 'Sci-Fi', 'Thriller',
    'Documentary', 'Animation', 'Fantasy', 'Adventure', 'Crime',
    'Romance', 'Horror', 'Mystery', 'Biography', 'History',
    'War', 'Western', 'Musical', 'Family', 'Sport'
];

const SERIES_TAGLINES = [
    'a sweeping space opera',
    'a gritty urban saga',
    'a time-twisting mystery',
    'a neon-soaked sci-fi odyssey',
    'an epic clash of destinies',
    'a heartfelt journey of found family',
    'a pulse-pounding thriller',
    'a whimsical tale of wonder',
    'a cerebral puzzle box',
    'a charm-filled adventure'
];

const MOVIE_TAGLINES = [
    'a high-stakes thriller',
    'a heartfelt drama',
    'a sharp-witted comedy',
    'a road trip to remember',
    'a race against time',
    'a story of second chances',
    'a daring heist gone sideways',
    'a love letter to the night',
    'a quiet storm of emotions',
    'a dazzling mystery'
];

// Deterministic hash for stable selection per title
function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0; // convert to 32-bit int
    }
    return Math.abs(h);
}

function titleDesc(title, pool) {
    const idx = hashStr(String(title || '')) % pool.length;
    return `${pool[idx]}.`;
}

function pickGenresForTitle(title) {
    const h = hashStr(String(title || ''));
    const count = 1 + (h % 3); // 1..3 genres
    const result = [];
    const used = new Set();
    const len = GENRES.length;
    for (let i = 0; result.length < count && used.size < len; i += 1) {
        const idx = (h + i * 7) % len;
        const genre = GENRES[idx];
        if (!used.has(genre)) {
            used.add(genre);
            result.push(genre);
        }
    }
    return result;
}

function pickGenres() {
    const count = randomInt(1, 3);
    const shuffled = [...GENRES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

async function resetIfRequested() {
    if (process.argv.includes('--reset')) {
        await Promise.all([
            Video.deleteMany({}),
            Series.deleteMany({}),
            User.deleteMany({}),
            Profile.deleteMany({}),
        ]);
        console.log('[Seed] Cleared existing collections');
    }
}

async function seedCatalog() {
    const existing = await Video.estimatedDocumentCount();
    if (existing > 0 && !process.argv.includes('--force')) {
        console.log(`[Seed] Catalog already has ${existing} videos. Use --force or --reset to regenerate.`);
        return { videos: await Video.find({}).select({_id:1}).lean() };
    }

    // If forcing, clear Series to avoid duplicates across runs
    if (process.argv.includes('--force')) {
        await Series.deleteMany({});
    }

    // Create series
    const seriesTitles = [
        'Galactic Odyssey', 'Crimson City', 'Echoes of Time',
        'Neon Frontier', 'Mystic Lands'
    ];

    const seriesDocs = await Series.insertMany(seriesTitles.map((t) => ({
        title: t,
        description: titleDesc(t, SERIES_TAGLINES),
    })));

    // Create episodes for each series (4–8 episodes)
    const videos = [];
    let legacyCounter = 1;
    // Seeded helpers
    const seededInt = (key, min, max) => {
        const h = hashStr(String(key));
        const span = (max - min + 1);
        return min + (h % span);
    };
    const seededFloat = (key, min, max, digits = 1) => {
        const h = hashStr(String(key));
        const frac = (h % 10000) / 9999; // 0..1
        const val = min + (max - min) * frac;
        return Number(val.toFixed(digits));
    };

    for (const s of seriesDocs) {
        const seasonGenre = pickGenresForTitle(s.title);
        const episodeCount = seededInt(`${s.title}:count`, 4, 8);
        for (let ep = 1; ep <= episodeCount; ep += 1) {
            const title = s.title;
            const desc = s.description;
            videos.push({
                legacyId: legacyCounter++,
                title,
                description: desc,
                year: seededInt(`${s.title}:year`, 2015, 2025),
                genres: seasonGenre,
                poster: picsumPoster(title),
                likes: seededInt(`${s.title}:${ep}:likes`, 0, 5000),
                rating: seededFloat(`${s.title}:${ep}:rating`, 4.0, 9.8, 1),
                videoPath: 'sample.mp4',
                type: 'series',
                series: s._id,
                episodeNumber: ep,
            });
        }
    }

    // Create movies
    const movieTitles = [
        'Odyssey', 'Eclipse', 'Silent Harbor', 'Iron Vale', 'Golden Hour',
        'Midnight Run', 'Paper Crowns', 'Starlight Path', 'Hidden Truths', 'Final Beacon'
    ];

    for (const t of movieTitles) {
        videos.push({
            legacyId: legacyCounter++,
            title: t,
            description: titleDesc(t, MOVIE_TAGLINES),
            year: seededInt(`${t}:year`, 1995, 2025),
            genres: pickGenresForTitle(t),
            poster: picsumPoster(t),
            likes: seededInt(`${t}:likes`, 0, 8000),
            rating: seededFloat(`${t}:rating`, 4.0, 9.8, 1),
            videoPath: 'sample.mp4',
            type: 'movie',
            series: null,
        });
    }

    await Video.deleteMany({});
    const inserted = await Video.insertMany(videos);
    console.log(`[Seed] Inserted ${inserted.filter(v => v.type==='movie').length} movies and ${inserted.filter(v => v.type==='series').length} episodes`);
    return { videos: inserted };
}

async function seedUsersAndProfiles(videoDocs) {
    const existing = await User.estimatedDocumentCount();
    if (existing > 0 && !process.argv.includes('--force') && !process.argv.includes('--reset')) {
        console.log(`[Seed] Users already present (${existing}). Skipping.`);
        return;
    }

    await User.deleteMany({});
    await Profile.deleteMany({});

    const users = [
        { id: 'user-admin', email: 'admin@streamix.local', username: 'Admin', role: 'admin', password: 'admin123' },
        { id: 'user-alice', email: 'alice@streamix.local', username: 'Alice', role: 'user', password: 'alice123' },
        { id: 'user-bob',   email: 'bob@streamix.local',   username: 'Bob',   role: 'user', password: 'bob123'   },
    ];

    // Hash passwords
    const salted = await Promise.all(users.map(async (u) => ({
        ...u,
        password: await bcrypt.hash(u.password, 12),
    })));

    await User.insertMany(salted);
    console.log(`[Seed] Inserted ${salted.length} users (including one admin).`);

    // Build profiles per user with liked content selection
    const pickSomeVideos = (n, seedKey) => {
        const len = videoDocs.length;
        if (len === 0 || n <= 0) return [];
        const res = [];
        const used = new Set();
        const base = hashStr(String(seedKey));
        for (let i = 0; res.length < n && used.size < len; i += 1) {
            const idx = (base + i * 13) % len; // 13 step for spread
            if (!used.has(idx)) {
                used.add(idx);
                res.push(videoDocs[idx]._id.toString());
            }
        }
        return res;
    };

    const profiles = [
        // Admin user profiles
        { id: 'profile-admin-john',  userId: 'user-admin', displayName: 'John',  avatar: '/images/netflix_profile.jpg', likeContent: pickSomeVideos(6, 'admin-john') },
        { id: 'profile-admin-sarah', userId: 'user-admin', displayName: 'Sarah', avatar: '/images/netflix_profile.jpg', likeContent: pickSomeVideos(4, 'admin-sarah') },

        // Alice's household
        { id: 'profile-alice-alice',   userId: 'user-alice', displayName: 'Alice',   avatar: '/images/netflix_profile.jpg', likeContent: pickSomeVideos(7, 'alice-alice') },
        { id: 'profile-alice-charlie', userId: 'user-alice', displayName: 'Charlie', avatar: '/images/netflix_profile.jpg', likeContent: pickSomeVideos(3, 'alice-charlie') },

        // Bob's household
        { id: 'profile-bob-bob',   userId: 'user-bob', displayName: 'Bob',   avatar: '/images/netflix_profile.jpg', likeContent: pickSomeVideos(5, 'bob-bob') },
    ];

    await Profile.insertMany(profiles);
    console.log(`[Seed] Inserted ${profiles.length} profiles linked to users.`);
}

async function populate() {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/streamix';
    await mongoose.connect(uri, { autoIndex: true });
    console.log(`[Seed] Connected to ${uri}`);

    try {
        // Ensure connection is open before attempting any deletes
        await resetIfRequested();
        const { videos } = await seedCatalog();
        await seedUsersAndProfiles(videos);
        console.log('[Seed] Done.');
    } catch (err) {
        console.error('[Seed] Failed:', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    populate();
}
