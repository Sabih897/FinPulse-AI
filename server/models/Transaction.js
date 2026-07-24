// server/models/Transaction.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  merchant: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['Groceries', 'Utilities', 'Dining', 'Entertainment', 'Transport', 'Healthcare', 'Subscriptions', 'Shopping', 'Others'] 
  },
  date: { type: Date, default: Date.now, index: true },
  type: { type: String, enum: ['expense', 'income'], default: 'expense' },
  receiptImageUrl: { type: String, default: null },
  lineItems: [{ name: String, price: Number }],
  isFlagged: { type: Boolean, default: false },
  flagReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Transaction', transactionSchema);