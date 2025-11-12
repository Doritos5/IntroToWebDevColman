const mongoose = require('mongoose');
const userModel = require('../models/userModel');
const catalogModel = require('../models/catalogModel');
const { logInfo, logError } = require('../middleware/logger');

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

async function handleLike(req, res) {
    const { itemId, profileId } = req.body;
    const userEmail = req.session.user.email;

    if (!itemId || !profileId) {
        logInfo('[Likes] Like failed - missing parameters', { userEmail, itemId, profileId });
        return res.status(400).json({ message: 'Item ID and Profile ID are required.' });
    }

    if (!isValidObjectId(itemId)) {
        logInfo('[Likes] Like failed - invalid item ID', { userEmail, itemId });
        return res.status(400).json({ message: 'Invalid video identifier.' });
    }

    try {
        const updatedProfile = await userModel.addLikeToProfile(userEmail, profileId, itemId);
        const updatedItem = await catalogModel.incrementLikes(itemId);
        logInfo('[Likes] Attempting to like item', { userEmail, profileId, itemId });
        if (!updatedProfile || !updatedItem) {
            logInfo('[Likes] Like failed - profile or item not found', { userEmail, profileId, itemId });
            return res.status(404).json({ message: 'Profile or catalog item not found.' });
        }
        logInfo('[Likes] Like successful', {
            userEmail,
            profileId,
            itemId,
            newLikesCount: Number(updatedItem.likes ?? 0)
        });

        res.json({
            message: 'Like successful!',
            newLikesCount: Number(updatedItem.likes ?? 0),
        });
    } catch (error) {
        console.error('Error handling like:', error);
        logError('[Likes] Error handling like', error, { userEmail, profileId, itemId });
        res.status(500).json({ message: 'Server error while processing like.' });
    }
}

async function handleUnlike(req, res) {
    const { itemId, profileId } = req.body;
    const userEmail = req.session.user.email;

    if (!itemId || !profileId) {
        logInfo('[Likes] Unlike failed - missing parameters', { userEmail, itemId, profileId });
        return res.status(400).json({ message: 'Item ID and Profile ID are required.' });
    }

    if (!isValidObjectId(itemId)) {
        logInfo('[Likes] Unlike failed - invalid item ID', { userEmail, itemId });
        return res.status(400).json({ message: 'Invalid video identifier.' });
    }

    try {
        const updatedProfile = await userModel.removeLikeFromProfile(userEmail, profileId, itemId);
        const updatedItem = await catalogModel.decrementLikes(itemId);
        logInfo('[Likes] Attempting to unlike item', { userEmail, profileId, itemId });

        if (!updatedProfile || !updatedItem) {
            logInfo('[Likes] Unlike failed - profile or item not found', { userEmail, profileId, itemId });
            return res.status(404).json({ message: 'Profile or catalog item not found.' });
        }

        logInfo('[Likes] Unlike successful', {
            userEmail,
            profileId,
            itemId,
            newLikesCount: Number(updatedItem.likes ?? 0)
        });

        res.json({
            message: 'Unlike successful!',
            newLikesCount: Number(updatedItem.likes ?? 0),
        });

    } catch (error) {
        console.error('Error handling unlike:', error);
        logError('[Likes] Error handling unlike', error, { userEmail, profileId, itemId });
        res.status(500).json({ message: 'Server error while processing unlike.' });
    }
}

module.exports = { handleLike, handleUnlike };
