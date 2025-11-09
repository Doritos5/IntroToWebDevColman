const { getUserByEmail, updateProfile, addProfileToUser, deleteProfileById } = require('../models/userModel');
const { deleteHistoryByProfileId } = require('../models/viewingSessionModel');

async function getUserProfiles(req, res) {
    try {
        const userEmail = req.session.user.email;
        const user = await getUserByEmail(userEmail, { hydrate: true });
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
    const userEmail = req.session.user.email;

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

async function createNewProfile(req, res) {
    const { profileName } = req.body;
    const userEmail = req.session.user.email;

    if (!profileName || profileName.trim().length < 1) {
        return res.status(400).json({ message: 'Profile name is required.' });
    }

    try {
        const user = await getUserByEmail(userEmail, { hydrate: true });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (user.profiles && user.profiles.length >= 5) {
            return res.status(400).json({ message: 'Maximum of 5 profiles per user allowed.' });
        }
        const newProfile = await addProfileToUser(userEmail, profileName.trim());
        return res.status(201).json({ message: 'Profile created successfully!', profile: newProfile });
    } catch (error) {
        console.error('Error creating new profile:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function deleteProfile(req, res) {
    try {
        const { profileId } = req.params;
        await deleteHistoryByProfileId(profileId);
        await deleteProfileById(profileId);
        return res.status(200).json({ message: 'Profile and all associated data deleted.' });
    } catch (error) {
        console.error('Error deleting profile:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
}

module.exports = {
    getUserProfiles,
    updateProfileName,
    createNewProfile,
    deleteProfile
};