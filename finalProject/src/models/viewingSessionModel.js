const mongoose = require('mongoose');

const viewingSessionSchema = new mongoose.Schema({
    userEmail: { type: String, required: true, lowercase: true, index: true },
    profileId: { type: String, required: true, index: true },
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    positionSeconds: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
}, {
    timestamps: true,
});

viewingSessionSchema.index({ userEmail: 1, profileId: 1, videoId: 1 }, { unique: true });
viewingSessionSchema.index({ userEmail: 1, profileId: 1, updatedAt: -1 });
const ViewingSession = mongoose.models.ViewingSession || mongoose.model('ViewingSession', viewingSessionSchema);

async function updateProgress({ userEmail, profileId, videoId, positionSeconds, durationSeconds }) {
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        return null;
    }

    const payload = {
        positionSeconds: Math.max(Number(positionSeconds) || 0, 0),
        durationSeconds: Math.max(Number(durationSeconds) || 0, 0),
        updatedAt: new Date(),
    };

    const filter = {
        userEmail: userEmail.toLowerCase(),
        profileId,
        videoId,
    };

    const session = await ViewingSession.findOneAndUpdate(
        filter,
        { $set: payload, $setOnInsert: filter },
        { upsert: true, new: true, lean: true }
    );

    return session;
}

async function getProgress({ userEmail, profileId, videoId }) {
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        return null;
    }

    return ViewingSession.findOne({
        userEmail: userEmail.toLowerCase(),
        profileId,
        videoId,
    }).lean();
}

async function getAllProgressForProfile({ userEmail, profileId }) {
    return ViewingSession.find({
        userEmail: userEmail.toLowerCase(),
        profileId,
    }).lean();
}

async function deleteHistoryByProfileId(profileId) {
    if (!profileId) {
        console.warn('[DB] deleteHistoryByProfileId was called without a profileId');
        return null;
    }
    try {
        const result = await ViewingSession.deleteMany({ profileId: profileId });
        console.log(`[DB] Deleted ${result.deletedCount} viewing sessions for profile ${profileId}`);
        return result;
    } catch (error) {
        console.error(`[DB] Error deleting viewing history for profile ${profileId}:`, error);
        throw error;
    }
}

module.exports = {
    ViewingSession,
    updateProgress,
    getProgress,
    getAllProgressForProfile,
    deleteHistoryByProfileId,
};