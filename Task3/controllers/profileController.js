const { findUserByEmail, updateProfile } = require('../models/userModel');

async function getUserProfiles(req, res) {
    try {
        const user = await findUserByEmail(req.email);
        if (user && user.profiles) {
            return res.json(user.profiles);
        }
        return res.status(404).json({ message: 'User or profiles not found.' });
    } catch (error) {
        console.error('Error fetching profiles:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function updateProfileName(req, res) {
    const { profileId } = req.params;
    const { displayName } = req.body;
    const userEmail = req.email;

    if (!displayName) {
        return res.status(400).json({ message: 'New display name is required.' });
    }

    try {
        const updatedProfile = await updateProfile(userEmail, profileId, { displayName });

        if (!updatedProfile) {
            return res.status(404).json({ message: 'Profile not found.' });
        }

        return res.json({ message: 'Profile updated successfully', profile: updatedProfile });
    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
}

// --- ודא שאתה מייצא את שתי הפונקציות ---
module.exports = {
    getUserProfiles,
    updateProfileName
};