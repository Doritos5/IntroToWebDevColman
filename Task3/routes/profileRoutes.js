const express = require('express');
const { getUserProfiles, updateProfileName } = require('../controllers/profileController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/profiles', isAuthenticated, getUserProfiles);

router.put('/profiles/:profileId', isAuthenticated, updateProfileName);

module.exports = router;