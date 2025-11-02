require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('../models/userModel');

const SALT_ROUNDS = 12;

async function migratePasswords() {
    try {
        const dbUri = process.env.MONGODB_URI;
        if (!dbUri) {
            throw new Error('MONGODB_URI is missing in .env');
        }
        await mongoose.connect(dbUri);
        console.log('Connected to MongoDB for migration.');

        const usersToUpdate = await User.find({
            password: { $not: /^\$2[aby]\$/ }
        });

        if (usersToUpdate.length === 0) {
            console.log('No plain-text passwords found. Migration not needed.');
            await mongoose.disconnect();
            return;
        }

        console.log(`Found ${usersToUpdate.length} users with plain-text passwords. Starting migration...`);

        let successCount = 0;
        for (const user of usersToUpdate) {
            try {
                if (!user.password) {
                    console.warn(`Skipping user ${user.email} (no password field).`);
                    continue;
                }

                const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);

                await User.updateOne({ _id: user._id }, { password: hashedPassword });

                console.log(`Migrated password for: ${user.email}`);
                successCount++;
            } catch (err) {
                console.error(`Failed to migrate ${user.email}:`, err.message);
            }
        }

        console.log('--- Migration Complete ---');
        console.log(`Successfully migrated ${successCount} / ${usersToUpdate.length} users.`);

    } catch (error) {
        console.error('Migration fatal error:', error);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log('Disconnected from MongoDB.');
        }
    }
}

migratePasswords();