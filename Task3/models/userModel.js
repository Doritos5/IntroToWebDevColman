const fs = require('fs/promises');
const path = require('path');

const USERS_PATH = path.join(__dirname, 'data', 'users.json');

async function readUsersFile() {
    try {
        const data = await fs.readFile(USERS_PATH, 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed.users) ? parsed.users : [];
    } catch (error) {
        if (error.code === 'ENOENT') {
            await writeUsersFile([]);
            return [];
        }
        throw error;
    }
}

async function writeUsersFile(users) {
    const payload = { users };
    await fs.writeFile(USERS_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

async function getUsers() {
    return readUsersFile();
}

async function findUserByEmail(email) {
    if (!email) return undefined;
    const normalizedEmail = email.toLowerCase();
    const users = await readUsersFile();
    return users.find((user) => user.email.toLowerCase() === normalizedEmail);
}

async function createUser(user) {
    const users = await readUsersFile();
    users.push(user);
    await writeUsersFile(users);
    return user;
}

async function updateUser(updatedUser) {
    const users = await readUsersFile();
    const index = users.findIndex((user) => user.id === updatedUser.id);
    if (index === -1) return null;
    users[index] = { ...users[index], ...updatedUser };
    await writeUsersFile(users);
    return users[index];
}

async function updateProfile(email, profileId, updates) {
    const users = await readUsersFile();
    const normalizedEmail = email.toLowerCase();
    const userIndex = users.findIndex((user) => user.email.toLowerCase() === normalizedEmail);
    if (userIndex === -1) return null;

    const profileIndex = users[userIndex].profiles.findIndex((profile) => profile.id === profileId);
    if (profileIndex === -1) return null;

    users[userIndex].profiles[profileIndex] = {
        ...users[userIndex].profiles[profileIndex],
        ...updates,
    };

    await writeUsersFile(users);
    return users[userIndex].profiles[profileIndex];
}

async function addLikeToProfile(email, profileId, itemId) {
    const users = await readUsersFile();
    const userIndex = users.findIndex(user => user.email.toLowerCase() === email.toLowerCase());
    if (userIndex === -1) return null;

    const profileIndex = users[userIndex].profiles.findIndex(p => p.id === profileId);
    if (profileIndex === -1) return null;

    if (!users[userIndex].profiles[profileIndex].likeContent) {
        users[userIndex].profiles[profileIndex].likeContent = [];
    }

    const likedContent = users[userIndex].profiles[profileIndex].likeContent;
    if (!likedContent.includes(itemId)) {
        likedContent.push(itemId);
    }

    await writeUsersFile(users);
    return users[userIndex].profiles[profileIndex];
}

async function addProfileToUser(email, newProfileName) {
    const users = await readUsersFile();
    const userIndex = users.findIndex(user => user.email.toLowerCase() === email.toLowerCase());
    if (userIndex === -1) {
        throw new Error('User not found');
    }

    const newProfile = {
        id: `profile-${Date.now()}`,
        displayName: newProfileName,
        avatar: '/images/netflix_profile.jpg', // Default avatar
        likeContent: []
    };

    users[userIndex].profiles.push(newProfile);
    await writeUsersFile(users);
    return newProfile;
}

async function removeLikeFromProfile(email, profileId, itemId) {
    const users = await readUsersFile();
    const userIndex = users.findIndex(user => user.email.toLowerCase() === email.toLowerCase());
    if (userIndex === -1) return null;

    const profileIndex = users[userIndex].profiles.findIndex(p => p.id === profileId);
    if (profileIndex === -1) return null;

    const likedContent = users[userIndex].profiles[profileIndex].likeContent || [];
    const itemIndexInLikes = likedContent.indexOf(itemId);

    if (itemIndexInLikes > -1) {
        likedContent.splice(itemIndexInLikes, 1);
    }

    await writeUsersFile(users);
    return users[userIndex].profiles[profileIndex];
}


module.exports = {
    getUsers,
    findUserByEmail,
    createUser,
    updateUser,
    updateProfile,
    addLikeToProfile,
    addProfileToUser,
    removeLikeFromProfile
};