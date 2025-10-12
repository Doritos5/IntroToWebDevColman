const mongoose = require('mongoose');

const userModel = require('../models/userModel');
const catalogModel = require('../models/catalogModel');

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

async function handleLike(req, res) {
    const { itemId, profileId } = req.body;
    const userEmail = req.email;

    if (!itemId || !profileId) {
        return res.status(400).json({ message: 'Item ID and Profile ID are required.' });
    }

    if (!isValidObjectId(itemId)) {
        return res.status(400).json({ message: 'Invalid video identifier.' });
    }

    try {
        const updatedProfile = await userModel.addLikeToProfile(userEmail, profileId, itemId);
        const updatedItem = await catalogModel.incrementLikes(itemId);

        if (!updatedProfile || !updatedItem) {
            return res.status(404).json({ message: 'Profile or catalog item not found.' });
        }

        res.json({
            message: 'Like successful!',
            newLikesCount: Number(updatedItem.likes ?? 0),
        });
    } catch (error) {
        console.error('Error handling like:', error);
        res.status(500).json({ message: 'Server error while processing like.' });
    }
}

async function handleUnlike(req, res) {
    const { itemId, profileId } = req.body;
    const userEmail = req.email;

    if (!itemId || !profileId) {
        return res.status(400).json({ message: 'Item ID and Profile ID are required.' });
    }

    if (!isValidObjectId(itemId)) {
        return res.status(400).json({ message: 'Invalid video identifier.' });
    }

    try {
        const updatedProfile = await userModel.removeLikeFromProfile(userEmail, profileId, itemId);
        const updatedItem = await catalogModel.decrementLikes(itemId);


        if (!updatedProfile || !updatedItem) {
            return res.status(404).json({ message: 'Profile or catalog item not found.' });
        }

        res.json({
            message: 'Unlike successful!',
            newLikesCount: Number(updatedItem.likes ?? 0),
        });

    } catch (error) {
        console.error('Error handling unlike:', error);
        res.status(500).json({ message: 'Server error while processing unlike.' });
    }
}

module.exports = { handleLike, handleUnlike };
