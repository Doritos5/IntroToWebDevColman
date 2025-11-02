const crypto = require('crypto')
const bcrypt = require('bcrypt')
const{
    createUser,
    getUserByEmail,
} = require('../models/userModel');
const { sanitizeUser } = require('../utils/sanitizers');
const {
    isValidEmail,
    isValidPassword,
    isValidUsername,
} = require('../utils/validators');

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`;
}

async function login (req, res) {
    const { email, password } = req.body || {};
    console.log(`[Auth] Login attempt for ${email || 'unknown email'}`);
    if (!email || !password) {
        console.log('[Auth] Login failed - missing credentials');
        return res.status(400).json({ message: 'Email and password are required.' });
    }
    try {
        const userRaw = await getUserByEmail(email); // (hydrate: false הוא ברירת מחדל)
        if (!userRaw) {
            return res.status(401).json({message: 'Invalid email or password.'});
        }
        const ok = await bcrypt.compare(password, userRaw.password);
        if (!ok) {
            return res.status(401).json({message: 'Invalid email or password.'});
        }
        req.session.user = {
            id: userRaw.id,
            email: userRaw.email,
            username: userRaw.username,
            role: userRaw.role || 'user',
        };
        const userForClient = sanitizeUser(await getUserByEmail(email, { hydrate: true }));
        return res.status(200).json({ message: 'Login successful.', user: userForClient });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        return res.status(500).json({ message: 'An unexpected error occurred.' });
    }
}

async function logout (req, res) {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return res.redirect('/');
    });
}

async function register (req, res) {
    const { email, username, password } = req.body || {};

    if (!email || !password || !username) {
        console.log('[Auth] Registration failed - missing credentials');
        return res.status(400).json({ message: 'Email, password and username are required.' });
    }

    if (!isValidEmail(email)) {
        console.log('[Auth] Registration failed - invalid email format.');
        return res.status(400).json({ message: 'Please provide a valid email address.' });
    }
    if (!isValidUsername(username)) {
        console.log('[Auth] Registration failed - invalid username.');
        return res.status(400).json({ message: 'Username must be at least 3 characters and contain only letters, numbers, spaces or underscores.' });
    }
    if (!isValidPassword(password)) {
        console.log('[Auth] Registration failed - weak password.');
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }



    try {
        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            console.log(`[Auth] Registration failed - email already in use: ${email}`);
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const userObj = {
            id: generateId(),
            email: email.toLowerCase(),
            username,
            password,
            profiles: [
                {
                    id: `profile-${Date.now()}`,
                    displayName: username,
                    avatar: '/images/netflix_profile.jpg',
                },
            ],
        };
        const newUserObj = await createUser(userObj);
        req.session.user = {
            id: newUserObj.id,
            email: newUserObj.email,
            username: newUserObj.username,
            role: newUserObj.role || 'user',
        };
        return res.status(201).json({ message: 'Registration successful.', user: sanitizeUser(newUserObj) });
    } catch (error) {
        console.error('[Auth] Registration error:', error);
        return res.status(500).json({ message: 'An unexpected error occurred.' });
    }
}

async function renderSettingsPage(req, res) {
    try {
        const userEmail = req.session.user.email;
        const user = await getUserByEmail(userEmail, { hydrate: true });
        res.render('settings', {
            profiles: user.profiles || []
        });
    } catch (error) {
        console.error('Error rendering settings page:', error);
        res.status(500).send('Server error');
    }
}

module.exports = {
    login,
    register,
    logout,
    renderSettingsPage,
}