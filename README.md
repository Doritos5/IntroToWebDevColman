# Streamix - Netflix-like Streaming Platform

A full-stack web application built with Node.js, Express, and MongoDB that simulates a streaming platform with user authentication, profiles, video catalog, recommendations, and analytics.

## 📋 Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Testing Credentials](#testing-credentials)
- [Project Structure](#project-structure)
- [Additional Information](#additional-information)

## Features

### User Management
- Secure user registration and login with bcrypt password hashing
- Session management with MongoDB session store
- Role-based access control (admin/user)
- Multiple profiles per user account (up to 5)

### Content Catalog
- Browse movies and TV series
- Dynamic genre-based navigation
- Search functionality across all content
- Advanced sorting (by name, popularity, rating)
- "Continue Watching" section with progress tracking
- "Most Popular" section based on likes
- Episode-level tracking for series

### Personalization
- Intelligent recommendation system based on:
  - Liked content genres
  - Watch history
  - Content ratings
- Like/unlike content functionality
- Personalized recommendations per profile

### Admin Features
- Add new content (movies/series) with OMDb API integration
- View analytics dashboard with charts
- User and content management

### Video Playback
- Custom HTML5 video player
- Resume playback from last position
- Episode navigation for series
- Progress tracking

## Prerequisites

Before running this application, ensure you have the following installed:

- **Node.js** (v14 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** (comes with Node.js)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd IntroToWebDevColman
   ```

2. **Navigate to the project directory**
   ```bash
   cd finalProject
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env and configure your settings (see Configuration section below)
   ```

## Configuration

Create a `.env` file in the `finalProject` directory with the following variables:

```env
# MongoDB Connection (required)
MONGODB_URI=mongodb://127.0.0.1:27017/streamix

# Session Secret (required) - Generate a secure random string
SESSION_SECRET=your-secure-secret-here-please-change-this

# Server Configuration
PORT=5555
NODE_ENV=development

# Content Pagination
ITEMS_PER_PAGE=10

# OMDb API Key (for fetching IMDb ratings)
OMDB_API_KEY=
```

**Important:** 
- Change `SESSION_SECRET` to a secure random string
- You can generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Running the Application

### Step 1: Start MongoDB

Ensure MongoDB is running on your system:

**Windows:**
```bash
# If MongoDB is installed as a service, it should start automatically
# Or manually start it:
mongod
```

**macOS/Linux:**
```bash
# If installed via homebrew:
brew services start mongodb-community

# Or manually:
mongod --config /usr/local/etc/mongod.conf
```

### Step 2: Seed the Database

Populate the database with sample data (users, profiles, movies, series):

```bash
npm run seed
```

This creates:
- 1 admin user: `admin@streamix.local` / `admin123`
- 3 regular users with multiple profiles
- ~20 series with multiple episodes each
- ~15 movies
- Sample likes and ratings

**Note:** Run `npm run seed:reset` to clear existing data first.

### Step 3: Start the Application

```bash
npm start
```

The server will start at `http://localhost:5555`

## Testing Credentials

After seeding the database, use these credentials to log in:

### Admin Account
- **Email:** `admin@streamix.local`
- **Password:** `admin123`
- **Features:** Full access including analytics and content management

### Regular Users
- **Email:** `alice@example.com` / **Password:** `alice123`
- **Email:** `bob@example.com` / **Password:** `bob123`
- **Email:** `charlie@example.com` / **Password:** `charlie123`

Each user has multiple profiles to test the multi-profile feature.

## Project Structure

```
finalProject/
├── application.js              # Main Express server
├── package.json               # Dependencies and scripts
├── .env.example              # Environment variables template
├── src/
│   ├── controllers/          # Request handlers
│   │   ├── authController.js
│   │   ├── catalogController.js
│   │   ├── profileController.js
│   │   ├── likeController.js
│   │   ├── recommendationController.js
│   │   └── ...
│   ├── models/              # Mongoose schemas
│   │   ├── userModel.js
│   │   ├── profileModel.js
│   │   ├── catalogModel.js
│   │   ├── viewingSessionModel.js
│   │   └── ...
│   ├── routes/              # Express routes
│   │   ├── authRoutes.js
│   │   ├── catalogRoutes.js
│   │   ├── analyticsRoutes.js
│   │   └── ...
│   ├── middleware/          # Custom middleware
│   │   ├── authMiddleware.js
│   │   └── logger.js
│   ├── views/              # EJS templates
│   │   ├── catalog.ejs
│   │   ├── login.ejs
│   │   ├── item.ejs
│   │   ├── analytics.ejs
│   │   └── ...
│   ├── public/            # Static assets
│   │   ├── catalog/
│   │   │   ├── app.js
│   │   │   └── styles.css
│   │   └── images/
│   └── utils/            # Utility scripts
│       ├── populateDB.js
│       ├── validators.js
│       └── ...
└── storage/             # Video storage directory
```

##  Additional Information

### Database Scripts

**Seed Database:**
```bash
npm run seed              # Populate with sample data
npm run seed:reset        # Clear and repopulate
```

**Migration Scripts:**
```bash
node src/utils/migratePasswords.js    # Migrate plain passwords to bcrypt
node src/utils/migrateRoles.js        # Set user roles
node src/utils/migrateRatings.js      # Calculate ratings from likes
```

### Development

```bash
npm run dev               # Start development server
npm start                 # Start production server
```

## 📝 Credits

- **Background Image:** [Unsplash](https://unsplash.com/photos/the-beatles-vinyl-record-sleeve-BQTHOGNHo08)
- **Icons:** [Bootstrap Icons](https://icons.getbootstrap.com/)
- **Placeholder Images:** [Picsum Photos](https://picsum.photos/)
---
