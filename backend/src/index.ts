import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Load Environment Variables
dotenv.config();

// Imports
import authRouter from './routes/auth';
import chatsRouter from './routes/chats';
import profileRouter from './routes/profile';
import artifactsRouter from './routes/artifacts';
import adminRouter from './routes/admin';
import { startKeyRecoveryDaemon } from './services/keyManager';
import ApiKey from './models/ApiKey';
import { encryptKey } from './services/keyManager';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

// Parse JSON Body
app.use(express.json());

// Set up Global Rate Limiting
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10);
const limiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Register API Routes
app.use('/api/auth', authRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/artifacts', artifactsRouter);
app.use('/api/admin', adminRouter);

// Basic Ping
app.get('/health', (req, res) => {
  res.json({ status: 'OK', environment: process.env.NODE_ENV });
});

// Seed Initial API Keys if none exist (for local testing demo)
async function seedDefaultKeys() {
  const keyCount = await ApiKey.countDocuments({});
  if (keyCount === 0) {
    console.log('Seeding demo API keys for local model families...');
    const demoKey = 'nvapi-demo-key-placeholder-replace-with-real-key';
    const encrypted = encryptKey(demoKey);

    const families = ['DeepSeek', 'Llama', 'Qwen', 'Mistral', 'Nemotron', 'MiniMax', 'GLM'];
    const groups = ['group-A', 'group-B', 'group-C'];

    const seedDocs = [];
    for (const family of families) {
      for (const group of groups) {
        seedDocs.push({
          key: encrypted,
          modelFamily: family,
          groupArea: group,
          isActive: true,
          statusState: 'Active',
          usageCount: 0
        });
      }
    }
    await ApiKey.insertMany(seedDocs);
    console.log('Demo API keys successfully seeded.');
  }
}

// Connect to MongoDB & Start Server
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/notokenlimit';

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB.');
    
    // Seed Keys
    await seedDefaultKeys();

    // Start Cooldown revival Daemon
    startKeyRecoveryDaemon();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
    });
  })
  .catch((err) => {
    console.error('Failed database connection:', err);
    process.exit(1);
  });
