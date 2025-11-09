const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const sessions = db.collection('viewingsessions');
    const videos = db.collection('videos');

    const today = new Date();

    // ----- Daily views per profile (last 7 days, including today) -----
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyAgg = await sessions.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
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

    const dailyViewsLabels = dailyAgg.map(row => row._id);

    const profileIds = [
      ...new Set(
        dailyAgg.flatMap(row => row.profiles.map(p => p.profileId))
      )
    ];

    const dailyViewsDatasets = profileIds.map((profileId, index) => ({
      label: `Profile ${index + 1}`,
      data: dailyViewsLabels.map(date => {
        const day = dailyAgg.find(row => row._id === date);
        if (!day) return 0;
        const profile = day.profiles.find(p => p.profileId === profileId);
        return profile ? profile.views : 0;
      })
    }));

    // ----- Content popularity by genre (last 90 days) -----
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    const genreAgg = await sessions.aggregate([
      {
        $match: {
          createdAt: { $gte: ninetyDaysAgo }
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
