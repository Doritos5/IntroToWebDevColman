const path = require('path');
const express = require('express');

const authRoutes = require('./routes/authRoutes');
// const userRoutes = require('./routes/userRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const profileRoutes = require('./routes/profileRoutes');
const { logger } = require("./middleware/logger");

const app = express();
const PORT = process.env.PORT || 5555;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicPath = path.join(__dirname, '.', 'public');

app.use(express.static(publicPath));
app.use(express.json());
const cookieParser = require("cookie-parser");

app.use(cookieParser());
app.use(logger);
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));


app.use('/', authRoutes);
app.use('/catalog', catalogRoutes);
app.use('/api', profileRoutes);
// app.use("/home", homeViewRouter);
// app.use("/books", bookViewRouter);
// app.use("/api/books", apiBookRouter);


app.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
});