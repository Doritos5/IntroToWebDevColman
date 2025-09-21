const express = require('express');
const { getUserProfiles, updateProfileName, createNewProfile } = require('../controllers/profileController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/profiles', isAuthenticated, getUserProfiles);

router.put('/profiles/:profileId', isAuthenticated, updateProfileName);

router.post('/profiles', isAuthenticated, createNewProfile);

module.exports = router;