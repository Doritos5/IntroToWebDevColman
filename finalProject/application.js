const dotenv = require('dotenv');
const r = dotenv.config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');

if (!process.env.SESSION_SECRET) {
    console.error('Missing SESSION_SECRET in .env'); process.exit(1);
}

const authRoutes = require('./src/routes/authRoutes');
const catalogRoutes = require('./src/routes/catalogRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const likeRoutes = require('./src/routes/likeRoutes');
const recommendationRoutes = require('./src/routes/recommendationRoutes');
const { logger } = require("./src/middleware/logger");
const { connectToDatabase } = require('./src/utils/db');

const app = express();
const PORT = process.env.PORT || 5555;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicPath = path.join(__dirname, 'src', 'public')

app.use(express.static(publicPath));
app.use(express.json());
const cookieParser = require("cookie-parser");

app.use(cookieParser());
app.use(logger);
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'src', 'views'));

const { MONGODB_URI, SESSION_SECRET, NODE_ENV } = process.env;

app.use(session({
    secret: SESSION_SECRET, // Signs the session ID cookie
    resave: false,  // Don't save session if unmodified
    saveUninitialized: false, // Don't create sessions for unauthenticated users
    store: MongoStore.create({ mongoUrl: MONGODB_URI }),   // Use MongoDB to store sessions
    cookie: {
        httpOnly: true,    // Prevents client-side JS from reading the cookie
        sameSite: 'lax',   // Helps prevent CSRF attacks
        secure: NODE_ENV === 'production',  // Ensures cookie is only sent over HTTPS in production
        maxAge: 1000 * 60 * 60 * 24  // Sets cookie expiration to 1 day
    }
}));

app.use('/', authRoutes);
app.use('/catalog', catalogRoutes);
app.use('/profiles', profileRoutes);
app.use('/likes', likeRoutes);
app.use('/api', recommendationRoutes);

async function startServer() {
    try {
        await connectToDatabase();

        app.listen(PORT, () => {
            console.log(`[Server] Listening on port ${PORT}`);
        });
    } catch (error) {
        console.error('[Server] Failed to start:', error);
        process.exit(1);
    }
}

startServer().then(r => "");
