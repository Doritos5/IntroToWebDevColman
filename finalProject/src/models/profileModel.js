const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    avatar: { type: String, default: '/images/netflix_profile.jpg' },
    likeContent: { type: [String], default: [] },
}, {
    timestamps: true,
});

profileSchema.set('toJSON', { virtuals: true });
profileSchema.set('toObject', { virtuals: true });

const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);

function toPlain(profileDoc) {
    if (!profileDoc) {
        return null;
    }

    if (typeof profileDoc.toObject === 'function') {
        const raw = profileDoc.toObject();
        delete raw.__v; // remove mongo default things
        return raw;
    }

    const cloned = { ...profileDoc };
    delete cloned.__v;  // remove mongo default things
    return cloned;
}

async function createProfile(profileData) {
    const profile = await Profile.create(profileData);
    return toPlain(profile);
}

async function createProfiles(profiles) {
    if (!Array.isArray(profiles) || profiles.length === 0) {
        return [];
    }

    const docs = await Profile.insertMany(profiles);
    return docs.map(toPlain);
}

async function getProfilesByUserId(userId) {
    if (!userId) {
        return [];
    }

    const profiles = await Profile.find({ userId }).lean();
    return profiles.map((profile) => {
        const plain = { ...profile };
        delete plain.__v;
        return plain;
    });
}

async function getProfilesByUserIds(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return {};
    }

    const profiles = await Profile.find({ userId: { $in: userIds } }).lean();
    return profiles.reduce((acc, profile) => {
        const plain = { ...profile };
        delete plain.__v;
        if (!acc[plain.userId]) {
            acc[plain.userId] = [];
        }
        acc[plain.userId].push(plain);
        return acc;
    }, {});
}

async function updateProfile(userId, profileId, updates) {
    const profile = await Profile.findOneAndUpdate(
        { userId, id: profileId },
        { $set: updates },
        { new: true }
    );

    return toPlain(profile);
}

async function addLikeToProfile(userId, profileId, itemId) {
    const profile = await Profile.findOneAndUpdate(
        { userId, id: profileId },
        { $addToSet: { likeContent: itemId } },
        { new: true }
    );

    return toPlain(profile);
}

async function removeLikeFromProfile(userId, profileId, itemId) {
    const profile = await Profile.findOneAndUpdate(
        { userId, id: profileId },
        { $pull: { likeContent: itemId } },
        { new: true }
    );

    return toPlain(profile);
}

module.exports = {
    Profile,
    toPlain,
    createProfile,
    createProfiles,
    getProfilesByUserId,
    getProfilesByUserIds,
    updateProfile,
    addLikeToProfile,
    removeLikeFromProfile,
};