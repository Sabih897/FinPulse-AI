// server/server.js
import dotenv from 'dotenv';
dotenv.config(); // Must be at the very top line!

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import receiptRoutes from './routes/receiptRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import savingsRoutes, { runScheduledSavingsRecommendations } from './routes/savingsRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/finpulse')
  .then(() => {
    console.log('MongoDB Connected successfully');
    // Daily sweep; per-user cooldown prevents recommendations more often than every 3 days.
    runScheduledSavingsRecommendations().catch((err) => console.error('Initial savings sweep failed:', err.message));
    setInterval(() => {
      runScheduledSavingsRecommendations().catch((err) => console.error('Scheduled savings sweep failed:', err.message));
    }, 24 * 60 * 60 * 1000);
  })
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/savings', savingsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});