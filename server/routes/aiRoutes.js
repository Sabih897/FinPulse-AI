// server/routes/aiRoutes.js
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/chat', protect, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user?.id;

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is missing in environment variables!');
      return res.status(500).json({ success: false, error: 'Server configuration error: API key missing' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const user = await User.findById(userId);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 60 * 60 * 24 * 1000);
    
    const transactions = await Transaction.find({
      userId,
      date: { $gte: ninetyDaysAgo }
    }).sort({ date: -1 }).lean();

    const categoryTotals = {};
    let totalExpense = 0;
    let totalIncome = 0;

    transactions.forEach(t => {
      if (t.type === 'expense') {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
        totalExpense += t.amount;
      } else {
        totalIncome += t.amount;
      }
    });

    const systemContext = `
You are FinPulse AI, an expert financial advisor. Analyze the following 90-day financial summary for ${user?.name || 'User'}:
- Preferred Currency: ${user?.currency || 'INR'}
- Monthly Budget Target: ${user?.monthlyBudget ?? 0}
- Total 90-Day Income: ${totalIncome}
- Total 90-Day Expenses: ${totalExpense}
- Breakdown by Category: ${JSON.stringify(categoryTotals)}
- Recent 10 Transactions: ${JSON.stringify(transactions.slice(0, 10).map(t => ({ merchant: t.merchant, amount: t.amount, category: t.category, date: t.date, flagged: t.isFlagged })))}

Provide precise, actionable financial guidance. Keep answers concise, clear, and encouraging.
`;

  const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash', // Use the currently available Flash model
      contents: [
        { role: 'user', parts: [{ text: `${systemContext}\n\nUser Query: ${message}` }] }
      ]
    });

    const replyText = response.text || 'I analyzed your financial data, but could not formulate a response.';
    return res.json({ success: true, text: replyText });
  } catch (error) {
    // THIS WILL PRINT THE EXACT ERROR IN YOUR BACKEND CONSOLE
    console.error('DETAILED AI Chat Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'AI processing failed' });
  }
});

export default router;