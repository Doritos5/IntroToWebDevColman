const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { User } = require('./src/models/userModel');

async function migrateRoles() {
    try {
        const dbUri = process.env.MONGODB_URI;
        if (!dbUri) {
            throw new Error('MONGODB_URI is not defined in .env file');
        }
        await mongoose.connect(dbUri);
        console.log('[Migrate Roles] Connected to MongoDB.');

        const result = await User.updateMany(
            { role: { $exists: false } },
            { $set: { role: 'user' } }
        );

        console.log(`[Migrate Roles] Updated ${result.modifiedCount} users to set default role 'user'.`);

        const adminEmail = 'd@d.com';
        const adminResult = await User.updateOne(
            { email: adminEmail },
            { $set: { role: 'admin' } }
        );

        if (adminResult.modifiedCount > 0) {
            console.log(`[Migrate Roles] Successfully promoted ${adminEmail} to 'admin'.`);
        } else {
            console.log(`[Migrate Roles] Admin user ${adminEmail} not found or already admin.`);
        }

    } catch (error) {
        console.error('[Migrate Roles] Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('[Migrate Roles] Disconnected from MongoDB.');
    }
}

migrateRoles();