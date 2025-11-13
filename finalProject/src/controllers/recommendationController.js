const mongoose = require('mongoose');
const { Video } = require('../models/catalogModel');
const { Profile } = require('../models/profileModel');
const { ViewingSession } = require('../models/viewingSessionModel');
const userModel = require('../models/userModel');

function asObjectIds(ids = []) {
  return ids
    .map((s) => {
      try { return new mongoose.Types.ObjectId(s); }
      catch { return null; }
    })
    .filter(Boolean);
}

function topN(counterMap, n = 6) {
  return Object.entries(counterMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

exports.getRecommendations = async function getRecommendations(req, res) {
  try {
    const userEmail = req.session?.user?.email;
    const profileId = String(req.query.profileId || '').trim();
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 24, 60));

    if (!userEmail || !profileId) {
      return res.status(400).json({ message: 'profileId and authenticated user are required.' });
    }

    const user = await userModel.getUserByEmail(userEmail);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const profile = await Profile.findOne({ id: profileId, userId: user.id }).lean();
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    const likedIdsStr = Array.isArray(profile.likeContent) ? profile.likeContent : [];
    const likedIds = asObjectIds(likedIdsStr);

    const sessions = await ViewingSession.find({
      userEmail: userEmail.toLowerCase(),
      profileId
    }).select({ videoId: 1 }).lean();

    const watchedIds = asObjectIds(
      sessions.map(s => s.videoId?.toString()).filter(Boolean)
    );

    const seedIds = [...new Set([...likedIds, ...watchedIds])];
    const seeds = seedIds.length
      ? await Video.find({ _id: { $in: seedIds } }).select({ genres: 1 }).lean()
      : [];

    const genreCounterLiked = {};
    const genreCounterWatched = {};

    seeds.forEach(doc => {
      const genres = Array.isArray(doc.genres) ? doc.genres : [];
      const idStr = doc._id.toString();
      const isLiked = likedIds.some(x => x.toString() === idStr);
      const isWatched = watchedIds.some(x => x.toString() === idStr);

      genres.forEach(g => {
        if (isLiked) genreCounterLiked[g] = (genreCounterLiked[g] || 0) + 1;
        if (isWatched) genreCounterWatched[g] = (genreCounterWatched[g] || 0) + 1;
      });
    });

    const topLikedGenres = topN(genreCounterLiked, 6);
    const topWatchedGenres = topN(genreCounterWatched, 6);
    const combinedGenres = [...new Set([...topLikedGenres, ...topWatchedGenres])];

    // Only exclude liked items
    const excludeIds = new Set([...likedIds.map(String)]);

    const baseFilter = combinedGenres.length ? { genres: { $in: combinedGenres } } : {};
    const candidates = await Video.find(baseFilter)
      .select({ title: 1, genres: 1, likes: 1, rating: 1, poster: 1, year: 1, type: 1, series: 1, episodeNumber: 1, description: 1 })
      .sort({ episodeNumber: 1 }) // Sort so we can pick first episode per series
      .lean({ virtuals: true });

    // Get series episode preferences (last watched episode per series)
    const { getSeriesEpisodePreferenceMap, applySeriesEpisodePreferences } = require('../models/catalogModel');
    const preferenceMap = await getSeriesEpisodePreferenceMap(profileId);

    // Apply series deduplication - keep only one episode per series
    const deduplicatedCandidates = await applySeriesEpisodePreferences(candidates, preferenceMap);

    const likedSet = new Set(topLikedGenres);
    const watchedSet = new Set(topWatchedGenres);

    const scored = [];
    for (const v of deduplicatedCandidates) {
      if (!v._id) continue;
      if (excludeIds.has(String(v._id))) continue;

      const g = Array.isArray(v.genres) ? v.genres : [];
      let score = 0;

      // Liked genres are stronger than watched (3 pts vs 2 pts)
      const likedHits = g.filter(x => likedSet.has(x)).length;   
      const watchedHits = g.filter(x => watchedSet.has(x)).length; 

      score += likedHits * 3;
      score += watchedHits * 2;

      // Add likes score
      const likesNorm = Math.log2((Number(v.likes) || 0) + 1);
      score += likesNorm;

      // Add rating score
      const ratingScore = (Number(v.rating) || 0) / 10;
      score += ratingScore * 2; // Weight rating slightly more than likes

      scored.push({ v, score });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Rating first, then likes
      if ((b.v.rating || 0) !== (a.v.rating || 0)) return (b.v.rating || 0) - (a.v.rating || 0);
      if ((b.v.likes || 0) !== (a.v.likes || 0)) return (b.v.likes || 0) - (a.v.likes || 0);
      return String(a.v.title || '').localeCompare(String(b.v.title || ''));
    });

    let items = scored.slice(0, limit).map(x => x.v);

    if (!items.length && seedIds.length) {
      const fallbackVideos = await Video.find({ _id: { $in: seedIds } })
        .select({
          title: 1,
          genres: 1,
          likes: 1,
          rating: 1,
          poster: 1,
          year: 1,
          type: 1,
          series: 1,
          episodeNumber: 1,
          description: 1
        })
        .sort({ episodeNumber: 1 })
        .lean({ virtuals: true });

      // Apply series deduplication
      const deduplicatedFallback = await applySeriesEpisodePreferences(fallbackVideos, preferenceMap);
      items = deduplicatedFallback.slice(0, limit);
    }

    return res.json({
      profileId,
      basis: {
        likedCount: likedIds.length,
        watchedCount: watchedIds.length,
        topLikedGenres,
        topWatchedGenres
      },
      items
    });

  } catch (err) {
    console.error('[recommendations] Error:', err);
    return res.status(500).json({ message: 'Failed to compute recommendations.' });
  }
};
