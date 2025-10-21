const express = require('express');
const { getUserProfiles, updateProfileName, createNewProfile } = require('../controllers/profileController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', isAuthenticated, getUserProfiles);

router.put('/:profileId', isAuthenticated, updateProfileName);

router.post('/', isAuthenticated, createNewProfile);

router.post('/switch', isAuthenticated, (req, res) => {
  const { profileId } = req.body || {};
  if (!profileId) {
    return res.status(400).send('profileId is required');
  }

  res.cookie('activeProfileId', profileId, {
    httpOnly: false,
    maxAge: 1000 * 60 * 60 * 24 * 30 
  });

  return res.redirect('/catalog'); 
});

module.exports = router;