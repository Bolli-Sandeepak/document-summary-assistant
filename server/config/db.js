import mongoose from 'mongoose';

/**
 * Connect to MongoDB Database
 */
export async function connectDB() {
  const dbUri = process.env.MONGODB_URI;

  if (!dbUri || dbUri.trim() === '') {
    console.warn(`[Database] MONGODB_URI is not defined in environment. Database storage is disabled.`);
    return false;
  }

  try {
    const conn = await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of hanging
    });
    console.log(`[Database] MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`[Database] MongoDB connection error: ${error.message}`);
    console.warn(`[Database] Continuing server startup without database integration.`);
    return false;
  }
}
