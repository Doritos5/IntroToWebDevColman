const express = require('express');
const { getUserProfiles, updateProfileName, createNewProfile, deleteProfile } = require('../controllers/profileController');
const { ensureAuth, ensureProfileOwner } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(ensureAuth);

router.get('/', getUserProfiles);

router.put('/:profileId', ensureProfileOwner, updateProfileName);

router.post('/', createNewProfile);

router.delete('/:profileId', ensureProfileOwner, deleteProfile);

module.exports = router;