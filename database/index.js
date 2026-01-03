import mongoose from 'mongoose';

const setupDatabase = async (url) => {
    try {
        // Connect to MongoDB with timeout and retry settings
        await mongoose.connect(url, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4 // Force IPv4
        });
        console.log('Connected to MongoDB');
        return mongoose.connection;
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        throw error;
    }
};

export default setupDatabase;
