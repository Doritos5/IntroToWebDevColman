const { Profile } = require('../models/profileModel');
const { User } = require('../models/userModel');
async function ensureAuth(req, res, next) {
    const userId = req.session?.user?.id;
    if (!userId) {
        return res.status(401).json({ message: 'login required' });
    }
    try {
        const user = await User.findOne({ id: userId }).lean();
        if (!user) {
            return req.session.destroy(() => {
                res.clearCookie('connect.sid');
                res.status(401).json({ message: 'Session invalid. User not found.' });
            });
        }
        return next();
    } catch (error) {
        console.error('Error in ensureAuth middleware:', error);
        return res.status(500).json({ message: 'Server error during authentication.' });
    }
}

function ensureAdmin(req, res, next) {
    if (req.session?.user?.role === 'admin') return next();
    return res.status(403).json({ message: 'admins only' });
}

function ensureOwnerOrAdmin(param = 'userId') {
    return (req, res, next) => {
        const user = req.session?.user;
        if (!user) return res.status(401).json({ message: 'login required' });
        if (user.role === 'admin' || String(user.id) === String(req.params[param])) return next();
        return res.status(403).json({ message: 'forbidden' });
    };
}

async function ensureProfileOwner(req, res, next) {
    try {
        const u = req.session?.user;
        if (!u) return res.status(401).json({ message: 'login required' });

        const profileId = req.params.profileId;
        if (!profileId) return res.status(400).json({ message: 'missing profileId' });

        const profile = await Profile.findOne({ id: profileId, userId: u.id }).lean();
        if (!profile) return res.status(403).json({ message: 'forbidden' });
        next();
    } catch (e) {
        return res.status(500).json({ message: 'server error' });
    }
}

module.exports = { ensureAuth, ensureAdmin, ensureOwnerOrAdmin, ensureProfileOwner };