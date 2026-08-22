import mongoose from 'mongoose';

/**
 * Cached connection promise for serverless environments.
 * Prevents creating multiple connections across function invocations.
 */
let cachedConnection = null;
let connectionPromise = null;

/**
 * Connect to MongoDB Database.
 * In serverless environments, reuses the cached connection.
 */
export async function connectDB() {
  const dbUri = process.env.MONGODB_URI;

  if (!dbUri || dbUri.trim() === '' || dbUri.includes('your_')) {
    console.warn(`[Database] MONGODB_URI is not defined in environment. Database storage is disabled.`);
    return false;
  }

  // If already connected, return immediately
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return true;
  }

  // If a connection attempt is already in progress, wait for it
  if (connectionPromise) {
    try {
      await connectionPromise;
      return mongoose.connection.readyState === 1;
    } catch {
      connectionPromise = null;
    }
  }

  // Start a new connection attempt
  connectionPromise = mongoose.connect(dbUri, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
    maxPoolSize: 5, // Limit pool size for serverless
    socketTimeoutMS: 30000,
    bufferCommands: false, // Don't queue commands if not connected
  });

  try {
    cachedConnection = await connectionPromise;
    console.log(`[Database] MongoDB connected: ${cachedConnection.connection.host}`);
    return true;
  } catch (error) {
    console.error(`[Database] MongoDB connection error: ${error.message}`);
    console.warn(`[Database] Continuing without database integration.`);
    connectionPromise = null;
    return false;
  }
}
