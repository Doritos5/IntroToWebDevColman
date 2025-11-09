const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { Video } = require('../models/catalogModel');

async function migrateRatings() {
    try {
        const dbUri = process.env.MONGODB_URI;
        if (!dbUri) {
            throw new Error('MONGODB_URI is not defined in .env file');
        }
        await mongoose.connect(dbUri);
        console.log('[Migrate Ratings] Connected to MongoDB.');

        // Update all videos without rating field to have a default rating
        const result = await Video.updateMany(
            { rating: { $exists: false } },
            { $set: { rating: 0.0 } }
        );

        console.log(`[Migrate Ratings] Updated ${result.modifiedCount} videos to set default rating 0.0.`);

        const videos = await Video.find({ rating: 0.0 });
        
        for (const video of videos) {
            // Calculate rating based on likes (higher likes = higher rating)
            const maxLikes = 400; // Assume max likes for normalization
            const minRating = 1.0;
            const maxRating = 10.0;
            
            let calculatedRating;
            if (video.likes === 0) {
                calculatedRating = minRating;
            } else {
                // Normalize likes to rating scale with some randomness
                const normalizedLikes = Math.min(video.likes / maxLikes, 1.0);
                calculatedRating = minRating + (normalizedLikes * (maxRating - minRating));
                
                // Add some randomness (±1.5 points) to make it more realistic
                const randomFactor = (Math.random() - 0.5) * 3.0;
                calculatedRating += randomFactor;
                
                // Ensure rating stays within bounds
                calculatedRating = Math.max(minRating, Math.min(maxRating, calculatedRating));
                
                // Round to 1 decimal place
                calculatedRating = Math.round(calculatedRating * 10) / 10;
            }
            
            await Video.updateOne(
                { _id: video._id },
                { $set: { rating: calculatedRating } }
            );
        }

        console.log(`[Migrate Ratings] Calculated and set ratings for ${videos.length} videos based on likes.`);

    } catch (error) {
        console.error('[Migrate Ratings] Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('[Migrate Ratings] Disconnected from MongoDB.');
    }
}

if (require.main === module) {
    migrateRatings();
}

module.exports = { migrateRatings };