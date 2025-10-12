const express = require('express');
const { getUserProfiles, updateProfileName, createNewProfile } = require('../controllers/profileController');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', isAuthenticated, getUserProfiles);

router.put('/:profileId', isAuthenticated, updateProfileName);

router.post('/', isAuthenticated, createNewProfile);

module.exports = router;