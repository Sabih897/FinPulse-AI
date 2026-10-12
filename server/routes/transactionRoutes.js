// server/routes/transactionRoutes.js
import express from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { checkAnomalies } from '../utils/anomalyDetector.js';
import { protect } from '../middleware/auth.js';
import Alert from '../models/Alert.js';
import User from '../models/User.js';
import { sendFinancialAlert } from '../utils/financialAlertNotifier.js';

const router = express.Router();

// Helper to escape regex special characters
const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @route   GET /api/transactions
 * @desc    Get filtered, searched, and paginated transactions for the logged-in user
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const { search, category, startDate, endDate, page = 1, limit = 10 } = req.query;
    const query = { userId: req.user.id };

    if (search && search.trim() !== '') {
      query.merchant = { $regex: escapeRegex(search.trim()), $options: 'i' };
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        // Date-only filters are interpreted as India calendar dates, matching the app's monthly dashboard.
        query.date.$gte = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
          ? new Date(`${startDate}T00:00:00+05:30`)
          : new Date(startDate);
      }
      if (endDate) {
        const eod = /^\d{4}-\d{2}-\d{2}$/.test(endDate)
          ? new Date(`${endDate}T23:59:59.999+05:30`)
          : new Date(endDate);
        query.date.$lte = eod;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const total = await Transaction.countDocuments(query);

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.json({
      success: true,
      transactions,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
      totalRecords: total
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ success: false, error: 'Server error while fetching transactions.' });
  }
});

/**
 * @route   POST /api/transactions
 * @desc    Create a new transaction (runs automated anomaly check)
 * @access  Private
 */
router.post('/', protect, async (req, res) => {
  try {
    const { merchant, amount, category, date, type, lineItems, receiptImageUrl } = req.body;

    if (!merchant || amount === undefined || amount === null || !category) {
      return res.status(400).json({ success: false, error: 'Please provide merchant, amount, and category.' });
    }

    const userId = req.user._id || req.user.id;

    let validDate = new Date();
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        validDate = parsed;
      }
    }

    const normalizedType = type || 'expense';
    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be a valid number greater than zero.' });
    }
    if (!['expense', 'income'].includes(normalizedType)) {
      return res.status(400).json({ success: false, error: 'Type must be either expense or income.' });
    }

    const txData = {
      userId,
      merchant: merchant.trim(),
      amount: normalizedAmount,
      category,
      date: validDate,
      type: normalizedType,
      lineItems: Array.isArray(lineItems) ? lineItems : [],
      receiptImageUrl: receiptImageUrl || null
    };

    if (txData.type === 'expense') {
      try {
        const anomalyResult = await checkAnomalies(userId, txData);
        txData.isFlagged = anomalyResult.isFlagged;
        txData.flagReason = anomalyResult.flagReason;
      } catch (anomalyErr) {
        console.warn('Anomaly detection check skipped:', anomalyErr.message);
      }
    }

    const transaction = await Transaction.create(txData);
    let alert = null;

    // Alert immediately on a large expense: at least ₹10,000 or more than 30%
    // of the user's configured monthly budget. Transaction saving must succeed
    // even if email/SMS delivery is not configured or a provider is unavailable.
    if (txData.type === 'expense') {
      try {
        const user = await User.findById(userId).select('name email monthlyBudget').lean();
        const exceedsBudgetRatio = user?.monthlyBudget > 0 && txData.amount / user.monthlyBudget >= 0.3;
        const isLargeExpense = txData.amount >= 10000 || exceedsBudgetRatio;
        if (isLargeExpense) {
          const severity = txData.amount >= 50000 || (user?.monthlyBudget > 0 && txData.amount >= user.monthlyBudget * 0.75)
            ? 'critical' : 'warning';
          const title = severity === 'critical' ? 'Very large transaction detected' : 'Large transaction detected';
          const reason = user?.monthlyBudget > 0
            ? `This expense is ${Math.round(txData.amount / user.monthlyBudget * 100)}% of your monthly budget.`
            : 'This expense meets FinPulse AI’s large-transaction threshold of ₹10,000.';
          const message = `${txData.merchant}: ₹${txData.amount.toLocaleString('en-IN')} on ${validDate.toISOString().slice(0, 10)}. ${reason} If you do not recognize it, contact your bank promptly.`;
          alert = await Alert.create({ userId, transactionId: transaction._id, title, message, severity });
          sendFinancialAlert({ user, title, message }).catch((err) => {
            console.error('Financial alert delivery failed:', err.message);
          });
        }
      } catch (alertError) {
        // A notification failure must not turn a successfully saved transaction into an API error.
        console.error('Could not create/deliver large transaction alert:', alertError.message);
      }
    }

    return res.status(201).json({ success: true, transaction, alert });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/transactions/:id
 * @desc    Get single transaction by ID
 * @access  Private
 */
router.get('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid transaction ID.' });
    }

    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found.' });
    }

    return res.json({ success: true, transaction });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   PUT /api/transactions/:id
 * @desc    Update an existing transaction & re-evaluate anomalies
 * @access  Private
 */
router.put('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid transaction ID.' });
    }

    let transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found.' });
    }

    const updates = { ...req.body };
    
    if ((updates.amount || updates.category) && (updates.type === 'expense' || transaction.type === 'expense')) {
      const updatedMock = {
        merchant: updates.merchant || transaction.merchant,
        amount: Number(updates.amount) || transaction.amount,
        category: updates.category || transaction.category,
        date: updates.date || transaction.date,
        type: 'expense'
      };
      
      const anomalyResult = await checkAnomalies(req.user.id, updatedMock);
      updates.isFlagged = anomalyResult.isFlagged;
      updates.flagReason = anomalyResult.flagReason;
    }

    transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return res.json({ success: true, transaction });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Delete a transaction
 * @access  Private
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid transaction ID.' });
    }

    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user.id });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found.' });
    }

    return res.json({ success: true, message: 'Transaction removed successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;