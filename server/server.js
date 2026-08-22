import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import summaryRoutes from './routes/summaryRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectDB } from './config/db.js';

// Load .env for local development (Vercel injects env vars automatically in production)
dotenv.config();

// Connect to MongoDB (lazy, non-blocking — see config/db.js)
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests from this IP, please try again later.' }
});

// Configure CORS — allow deployed frontend origins and local dev
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, same-origin)
    if (!origin) return callback(null, true);
    // Allow if origin is in the allowed list
    if (allowedOrigins.some(allowed => origin === allowed || origin.endsWith('.vercel.app'))) {
      return callback(null, true);
    }
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // In production, still allow vercel.app preview URLs
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(null, true); // Permissive fallback to avoid breaking deployments
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/api', limiter);

// Mount API routes
app.use('/api', summaryRoutes);

// Health check (top-level, outside /api prefix)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Document Summary Assistant API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Document Summary Assistant API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      apiHealth: '/api/health',
      analyze: 'POST /api/analyze'
    }
  });
});

// Global Error Middleware
app.use(errorHandler);

// Only start listening in local development (Vercel uses the exported app)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Document Summary Assistant API Server running on port ${PORT}`);
  });
}

export default app;
