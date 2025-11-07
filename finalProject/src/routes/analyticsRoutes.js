const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const sessions = db.collection('viewingsessions');
    const videos = db.collection('videos');

    const today = new Date();

    // Daily views per profile (last 7 days)
    const from7 = new Date(today);
    from7.setDate(from7.getDate() - 6);
    from7.setHours(0, 0, 0, 0);

    const dailyAgg = await sessions.aggregate([
      {
        $match: {
          createdAt: { $gte: from7 }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            profileId: '$profileId'
          },
          views: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          profiles: {
            $push: {
              profileId: '$_id.profileId',
              views: '$views'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    const dailyViewsLabels = dailyAgg.map(d => d._id);

    const profileIds = [
      ...new Set(
        dailyAgg.flatMap(d => d.profiles.map(p => p.profileId))
      )
    ];

    const dailyViewsDatasets = profileIds.map((pid, index) => {
      const shortLabel =
        typeof pid === 'string'
          ? `Profile ${pid.slice(-4)}`
          : `Profile ${index + 1}`;

      return {
        label: shortLabel,
        data: dailyViewsLabels.map(date => {
          const day = dailyAgg.find(d => d._id === date);
          if (!day) return 0;
          const entry = day.profiles.find(p => p.profileId === pid);
          return entry ? entry.views : 0;
        }),
        backgroundColor: `hsl(${(index * 67) % 360}, 70%, 50%)`
      };
    });

    // Content popularity by genre (last 90 days)
    const from90 = new Date(today);
    from90.setDate(from90.getDate() - 89);
    from90.setHours(0, 0, 0, 0);

    const genreAgg = await sessions.aggregate([
      {
        $match: {
          createdAt: { $gte: from90 }
        }
      },
      {
        $lookup: {
          from: 'videos',
          localField: 'videoId',
          foreignField: '_id',
          as: 'video'
        }
      },
      { $unwind: '$video' },
      { $unwind: '$video.genres' },
      {
        $group: {
          _id: '$video.genres',
          views: { $sum: 1 }
        }
      },
      { $sort: { views: -1 } }
    ]).toArray();

    const genreLabels = genreAgg.map(g => g._id);
    const genreData = genreAgg.map(g => g.views);

    res.render('analytics', {
      title: 'Analytics',
      dailyViewsLabels,
      dailyViewsDatasets,
      genreLabels,
      genreData
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;