const dotenv = require('dotenv');
const r = dotenv.config();


const path = require('path');
const express = require('express');

const authRoutes = require('./src/routes/authRoutes');
const catalogRoutes = require('./src/routes/catalogRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const likeRoutes = require('./src/routes/likeRoutes');
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


app.use('/', authRoutes);
app.use('/catalog', catalogRoutes);
app.use('/profiles', profileRoutes);
app.use('/likes', likeRoutes);


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
