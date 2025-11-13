# IntroToWebDevColman
## External Ratings (OMDb)
The admin Add Content form auto-fetches IMDb rating via the OMDb API if `OMDB_API_KEY` is set in `.env`:

```
OMDB_API_KEY=your_key_here
```

If missing, videos default to rating 0 and a warning is logged.

Background image taken from: https://unsplash.com/photos/the-beatles-vinyl-record-sleeve-BQTHOGNHo08
Icons from: https://icons.getbootstrap.com/icons/

## Seeding the Streamix database

The Streamix app uses the MongoDB database named `streamix` by default. A populate script is included to generate fake data:

- Series with multiple episodes
- Movies
- Users (one admin, multiple regular users)
- Profiles linked to those users, with random liked content

How to run:

1. Ensure MongoDB is running locally on `mongodb://127.0.0.1:27017`.
2. From the `finalProject` folder, run one of the following:

```
npm run seed               # populate (overwrites catalog/users)
node src/utils/populateDB.js --reset   # clear collections, then populate
node src/utils/populateDB.js --force   # always regenerate even if data exists
```

Environment:

- DB connection: `MONGODB_URI` in `finalProject/.env` now defaults to `mongodb://127.0.0.1:27017/streamix`.
- The app session store uses the same URI.
