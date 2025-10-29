const express = require('express');
const { getUserProfiles, updateProfileName, createNewProfile } = require('../controllers/profileController');
const { ensureAuth, ensureProfileOwner } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(ensureAuth);

router.get('/', getUserProfiles);


router.put('/:profileId', ensureProfileOwner, updateProfileName);

router.post('/', createNewProfile);

module.exports = router;