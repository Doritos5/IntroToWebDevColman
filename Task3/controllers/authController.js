const crypto = require('crypto');
const {
    findUserByEmail,
    createUser,
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
        const user = await findUserByEmail(email);
        if (!user || user.password !== password) {
            console.log(`[Auth] Login failed for ${email}`);
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // return res.json({
        //     ok: true,
        //     redirect: "/navbar_page/mainDisplay.html",
        //     user: sanitizeUser(user)
        // });
        res.cookie('loggedInUser', user.email, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        return res.status(200).json({ message: 'Login successful.', user: sanitizeUser(user) });


    } catch (error) {
        console.error('[Auth] Login error:', error);
        return res.status(500).json({ message: 'An unexpected error occurred.' });
    }
}

async function logout (req, res) {
    const { email } = req.body || {};
    if (email) {
        // console.log(`[Auth] ${email} logged out.`);
    } else {
        // console.log('[Auth] Logout requested without email.');
    }
    try { localStorage.removeItem('selectedProfile'); } catch {}

    return res.json({ message: 'Logout successful.' });
}

async function register (req, res) {
    const { email, username, password } = req.body || {};

    if (!email || !password || !username) {
        console.log('[Auth] Login failed - missing credentials');
        return res.status(400).json({ message: 'Email, password and username are required.' });
    }

    if (!isValidEmail(email)) {
        // console.log('[Auth] Registration failed - invalid email format.');
        return res.status(400).json({ message: 'Please provide a valid email address.' });
    }
    if (!isValidUsername(username)) {
        // console.log('[Auth] Registration failed - invalid username.');
        return res.status(400).json({ message: 'Username must be at least 3 characters and contain only letters, numbers, spaces or underscores.' });
    }
    if (!isValidPassword(password)) {
        // console.log('[Auth] Registration failed - weak password.');
        return res.status(400).json({ message: 'Password must be at least 3 characters long.' });
    }



    try {
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            // console.log(`[Auth] Registration failed - email already in use: ${email}`);
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const newUser = {
            id: generateId(),
            email,
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

        await createUser(newUser);

        return res.status(201).json({ message: 'Registration successful.', user: sanitizeUser(newUser) });
    } catch (error) {
        console.error('[Auth] Registration error:', error);
        return res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

module.exports = {
    login,
    register,
    logout
}