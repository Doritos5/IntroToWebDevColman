const fs = require('fs/promises');
const path = require('path');

const userModel = require('../models/userModel');
const catalogModel = require('../models/catalogModel');

async function bumpCatalogLikes(itemId) {
    const modelFilePath = require.resolve('../models/catalogModel');
    const modelDir = path.dirname(modelFilePath);

    const CATALOG_PATH = path.join(modelDir, 'data', 'catalog.json');

    await fs.mkdir(path.dirname(CATALOG_PATH), { recursive: true });

    let parsed;
    try {
        const raw = await fs.readFile(CATALOG_PATH, 'utf8');
        parsed = JSON.parse(raw);
    } catch (e) {
        if (e.code === 'ENOENT') {
            parsed = { items: [] };
        } else {
            throw e;
        }
    }

    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [];

    const idx = items.findIndex(x => String(x.id) === String(itemId));
    if (idx === -1) return null;

    const current = items[idx];
    const newLikes = Number(current.likes ?? 0) + 1;
    const updated = { ...current, likes: newLikes };
    items[idx] = updated;

    const payload = Array.isArray(parsed) ? items : { ...parsed, items };
    await fs.writeFile(CATALOG_PATH, JSON.stringify(payload, null, 2), 'utf8');

    return updated;
}

async function handleLike(req, res) {
    const { itemId, profileId } = req.body;
    const userEmail = req.email;

    if (!itemId || !profileId) {
        return res.status(400).json({ message: 'Item ID and Profile ID are required.' });
    }

    try {
        const updateCatalogLikes =
            typeof catalogModel.incrementLikes === 'function'
                ? () => catalogModel.incrementLikes(Number(itemId))
                : () => bumpCatalogLikes(Number(itemId));

        const [updatedProfile, updatedItem] = await Promise.all([
            userModel.addLikeToProfile(userEmail, profileId, Number(itemId)),
            updateCatalogLikes(),
        ]);

        if (!updatedProfile || !updatedItem) {
            return res.status(404).json({ message: 'Profile or Catalog item not found.' });
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

    try {
        const [updatedProfile, updatedItem] = await Promise.all([
            userModel.removeLikeFromProfile(userEmail, profileId, Number(itemId)),
            catalogModel.decrementLikes(Number(itemId)) // Assumes this function exists in your partner's model
        ]);

        if (!updatedProfile || !updatedItem) {
            return res.status(404).json({ message: 'Profile or Catalog item not found.' });
        }

        res.json({
            message: 'Unlike successful!',
            newLikesCount: updatedItem.likes
        });

    } catch (error) {
        console.error('Error handling unlike:', error);
        res.status(500).json({ message: 'Server error while processing unlike.' });
    }
}

module.exports = { handleLike, handleUnlike };
