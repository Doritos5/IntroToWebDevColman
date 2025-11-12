const mongoose = require('mongoose');

async function connectToDatabase() {

    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/streamix';
    try{
        await mongoose.connect(uri, {
            autoIndex: true,
        });
        console.log(`[Database] Connected to MongoDB at ${uri}`);

    }
    catch (error){
        console.error('[Database] MongoDB connection failed:', error);
        throw error;
    }
}

module.exports = {
    connectToDatabase,
};