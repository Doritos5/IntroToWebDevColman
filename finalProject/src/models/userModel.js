const mongoose = require('mongoose');
const profileModel = require('./profileModel');

const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
}, {
    timestamps: true,
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

function toPlain(userDoc) {
    if (!userDoc) {
        return null;
    }

    if (typeof userDoc.toObject === 'function') {
        const raw = userDoc.toObject();
        delete raw.__v;
        return raw;
    }

    const cloned = { ...userDoc };
    delete cloned.__v;
    return cloned;
}

async function hydrateUser(userDoc) {
    const plain = toPlain(userDoc);
    if (!plain) {
        return null;
    }

    const profiles = await profileModel.getProfilesByUserId(plain.id);
    return { ...plain, profiles };
}

async function getUsers() {
    const users = await User.find().lean();
    const userIds = users.map((user) => user.id);
    const profilesByUser = await profileModel.getProfilesByUserIds(userIds);

    return users.map((user) => {
        const plain = toPlain(user);
        return {
            ...plain,
            profiles: profilesByUser[plain.id] || [],
        };
    });
}

async function findUserByEmail(email) {
    if (!email) {
        return null;
    }

    const user = await User.findOne({email: email.toLowerCase()}).lean();
    return hydrateUser(user);
}




async function createUser(userData) {
    const { profiles = [], ...userFields } = userData;

    const user = await User.create(userFields);
    const plainUser = toPlain(user);

    if (profiles.length > 0) {
        const normalizedProfiles = profiles.map((profile) => ({
            ...profile,
            id: profile.id || generateProfileId(),
            userId: plainUser.id,
            likeContent: Array.isArray(profile.likeContent) ? profile.likeContent : [],
        }));

        const createdProfiles = await profileModel.createProfiles(normalizedProfiles);
        return { ...plainUser, profiles: createdProfiles };
    }

    return { ...plainUser, profiles: [] };
}

async function updateUser(updatedUser) {
    const { id, profiles, ...userFields } = updatedUser;
    if (!id) {
        return null;
    }

    const user = await User.findOneAndUpdate({ id }, userFields, { new: true });
    return hydrateUser(user);
}

async function getUserByEmail(email) {
    if (!email) {
        return null;
    }

    return User.findOne({ email: email.toLowerCase() }).lean();
}

async function updateProfile(email, profileId, updates) {
    const user = await getUserByEmail(email);
    if (!user) {
        return null;
    }

    return profileModel.updateProfile(user.id, profileId, updates);
}

async function addLikeToProfile(email, profileId, itemId) {
    const user = await getUserByEmail(email);
    if (!user) {
        return null;
    }

    return profileModel.addLikeToProfile(user.id, profileId, itemId);
}

async function removeLikeFromProfile(email, profileId, itemId) {
    const user = await getUserByEmail(email);
    if (!user) {
        return null;
    }

    return profileModel.removeLikeFromProfile(user.id, profileId, itemId);
}

function generateProfileId() {
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function addProfileToUser(email, profileName) {
    const user = await getUserByEmail(email);
    if (!user) {
        throw new Error('User not found');
    }

    const profileData = {
        id: generateProfileId(),
        userId: user.id,
        displayName: profileName,
        avatar: '/images/netflix_profile.jpg',
        likeContent: [],
    };

    return profileModel.createProfile(profileData);
}

module.exports = {
    User,
    getUsers,
    findUserByEmail,
    createUser,
    updateUser,
    updateProfile,
    addLikeToProfile,
    addProfileToUser,
    removeLikeFromProfile,
};