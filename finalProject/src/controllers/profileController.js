const { getUserByEmail, updateProfile, addProfileToUser, deleteProfileById } = require('../models/userModel');
const { logInfo, logError } = require('../middleware/logger');
const { deleteHistoryByProfileId } = require('../models/viewingSessionModel');

async function getUserProfiles(req, res) {
    try {
        const userEmail = req.session.user.email;
        const user = await getUserByEmail(userEmail, { hydrate: true });
        if (user && user.profiles) {
            logInfo('[Profiles] Fetched user profiles', { userEmail, profilesCount: user.profiles.length });
            return res.json(user.profiles);
        }
        logInfo('[Profiles] No profiles found for user', { userEmail });
        return res.status(404).json({ message: 'User or profiles not found.' });
    } catch (error) {
        console.error('Error fetching profiles:', error);
        logError('[Profiles] Error fetching profiles', error, { userEmail });
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function updateProfileName(req, res) {
    const { profileId } = req.params;
    const { displayName } = req.body;
    const userEmail = req.session.user.email;

    if (!displayName) {
        logInfo('[Profiles] Update failed - missing displayName', { userEmail, profileId });
        return res.status(400).json({ message: 'New display name is required.' });
    }
    try {
        const updatedProfile = await updateProfile(userEmail, profileId, { displayName });
        if (!updatedProfile) {
            logInfo('[Profiles] Update failed - profile not found', { userEmail, profileId });
            return res.status(404).json({ message: 'Profile not found.' });
        }
        logInfo('[Profiles] Profile updated successfully', {
            userEmail,
            profileId,
            newDisplayName: displayName
        });
        return res.json({ message: 'Profile updated successfully', profile: updatedProfile });
    } catch (error) {
        console.error('Error updating profile:', error);
        logError('[Profiles] Error updating profile', error, { userEmail, profileId });
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function createNewProfile(req, res) {
    const { profileName } = req.body;
    const userEmail = req.session.user.email;

    if (!profileName || profileName.trim().length < 1) {
        logInfo('[Profiles] Create failed - missing profileName', { userEmail });
        return res.status(400).json({ message: 'Profile name is required.' });
    }

    try {
        const user = await getUserByEmail(userEmail, { hydrate: true });

        if (!user) {
            logInfo('[Profiles] Create failed - user not found', { userEmail });
            return res.status(404).json({ message: 'User not found.' });
        }
        if (user.profiles && user.profiles.length >= 5) {
            logInfo('[Profiles] Create failed - max profiles reached', {
                userEmail,
                profilesCount: user.profiles.length
            });
            return res.status(400).json({ message: 'Maximum of 5 profiles per user allowed.' });
        }
        const newProfile = await addProfileToUser(userEmail, profileName.trim());
        logInfo('[Profiles] Profile created successfully', {
            userEmail,
            profileId: newProfile.id || newProfile._id,
            profileName: newProfile.displayName || profileName.trim()
        });
        return res.status(201).json({ message: 'Profile created successfully!', profile: newProfile });
    } catch (error) {
        console.error('Error creating new profile:', error);
        logError('[Profiles] Error creating new profile', error, { userEmail });
        return res.status(500).json({ message: 'Server error.' });
    }
}

async function deleteProfile(req, res) {
    try {
        const { profileId } = req.params;
        await deleteHistoryByProfileId(profileId);
        await deleteProfileById(profileId);
        logInfo('[Profiles] Profile deleted successfully', { profileId });
        return res.status(200).json({ message: 'Profile and all associated data deleted.' });
    } catch (error) {
        console.error('Error deleting profile:', error);
        logError('[Profiles] Error deleting profile', error, { profileId });
        return res.status(500).json({ message: 'Server error.' });
    }
}

module.exports = {
    getUserProfiles,
    updateProfileName,
    createNewProfile,
    deleteProfile
};