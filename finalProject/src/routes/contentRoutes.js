const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Video, Series } = require('../models/catalogModel');
const router = express.Router();

// Multer setup for mp4 uploads
const uploadDir = path.join(__dirname, '..', '..', 'storage', 'videos');
// Ensure upload directory exists
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) { console.warn('[Content] Failed to ensure upload dir:', e.message); }
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const base = path.basename(file.originalname, path.extname(file.originalname))
            .replace(/[^a-z0-9-_]+/gi, '_')
            .slice(0, 60);
        cb(null, `${Date.now()}_${base}.mp4`);
    },
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const isMp4 = file.mimetype === 'video/mp4' || path.extname(file.originalname).toLowerCase() === '.mp4';
        if (!isMp4) return cb(new Error('Only MP4 videos are allowed'));
        cb(null, true);
    },
    limits: { fileSize: 1024 * 1024 * 1024 }, // up to ~1GB
});

// Redirect to login if not authorized
function ensureAdminRedirect(req, res, next) {
    const user = req.session?.user;
    if (!user || user.role !== 'admin') {
        return res.redirect(302, '/login');
    }
    next();
}

router.get('/add-content', ensureAdminRedirect, (req, res) => {
    return res.render('add-content', { message: null, error: null });
});

router.post('/add-content', ensureAdminRedirect, upload.single('videoFile'), async (req, res) => {
    try {
        const {
            title = '',
            description = '',
            year = '',
            genres = '',
            poster = '',
            type = 'movie',
            seriesTitle = '',
            episodeNumber = '',
        } = req.body || {};
        // Validation & normalization
        function required(name, val, predicate = (v)=>!!v) { return predicate(val) ? null : name; }
        const missing = [
            required('title', title.trim()),
            required('year', year, v => Number(v) >= 1900 && Number(v) <= 2100),
            required('poster', poster.trim()),
            required('genres', String(genres).trim()),
            required('videoFile', req.file)
        ].filter(Boolean);
        const normalizedType = type === 'series' ? 'series' : 'movie';
        if (normalizedType === 'series') {
            missing.push(...[
                required('seriesTitle', (seriesTitle || '').trim()),
                required('episodeNumber', episodeNumber, v => Number(v) > 0)
            ].filter(Boolean));
        }
        if (missing.length) return res.status(400).render('add-content', { error: `Missing required fields: ${missing.join(', ')}`, message: null });

        // Normalized / parsed values
        const numericYear = Number(year);
        const parsedGenres = Array.isArray(genres)
            ? genres
            : String(genres)
                .split(',')
                .map(g => g.trim())
                .filter(Boolean);

        let seriesId = null;
        let episodeNum = undefined;
        if (normalizedType === 'series') {
            const sTitle = (seriesTitle || '').trim();
            let seriesDoc = await Series.findOne({ title: sTitle }).lean();
            if (!seriesDoc) {
                seriesDoc = await Series.create({ title: sTitle, description: '' });
            }
            seriesId = seriesDoc._id || seriesDoc.id;
            episodeNum = Number(episodeNumber);
        }

        // Fetch rating from IMDb with abort timeout
        let fetchedRating = 0;
        const omdbApiKey = process.env.OMDB_API_KEY;
        if (omdbApiKey) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(()=>controller.abort(), 8000);
                const queryTitle = encodeURIComponent(title.trim());
                const queryYear = numericYear ? `&y=${numericYear}` : '';
                const omdbUrl = `https://www.omdbapi.com/?t=${queryTitle}${queryYear}&apikey=${omdbApiKey}`;
                const resp = await fetch(omdbUrl, { signal: controller.signal });
                clearTimeout(timer);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data && data.Response === 'True') {
                        const raw = data.imdbRating;
                        if (raw && !isNaN(Number(raw))) {
                            fetchedRating = Math.min(10, Math.max(0, Number(raw)));
                        }
                    }
                }
            } catch (e) {
                console.warn('[Content] Rating fetch skipped:', e.message);
            }
        }

        const created = await Video.create({
            title: title.trim(),
            description: description || '',
            year: numericYear,
            genres: parsedGenres,
            poster: poster.trim(),
            likes: 0,
            rating: fetchedRating,
            videoPath: path.basename(req.file.filename),
            type: normalizedType,
            series: seriesId,
            episodeNumber: episodeNum,
        });

        return res.render('add-content', { message: 'Content added successfully', error: null });
    } catch (err) {
        console.warn('[Content] Add content error');
        return res.status(500).render('add-content', { error: 'Failed to add content', message: null });
    }
});

module.exports = router;
