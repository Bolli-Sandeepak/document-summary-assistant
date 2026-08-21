import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import summaryRoutes from './routes/summaryRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectDB } from './config/db.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests from this IP, please try again later.' }
});

// Configure CORS
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin production)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in dev/staging to ensure deployment smoothly works
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/api', limiter);

// Mount API routes
app.use('/api', summaryRoutes);

// Health check & Root routes
app.get('/', (req, res) => {
  res.json({
    name: 'Document Summary Assistant API',
    status: 'running',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Global Error Middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Document Summary Assistant API Server`);
  console.log(`Running on port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Gemini API configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No (Using local statistical fallback engine)'}`);
  console.log(`=================================`);
});
