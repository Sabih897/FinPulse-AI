// server/utils/anomalyDetector.js
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

export async function checkAnomalies(userId, newTx) {
  const flags = [];

  // 1. Duplicate Transaction Check (Within last 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const duplicate = await Transaction.findOne({
    userId,
    merchant: newTx.merchant,
    amount: newTx.amount,
    date: { $gte: twentyFourHoursAgo }
  });

  if (duplicate) {
    flags.push(`Possible duplicate: identical charge of ${newTx.amount} at ${newTx.merchant} in the last 24h.`);
  }

  // 2. Budget Threshold Check (>30% of monthly budget in one charge)
  const user = await User.findById(userId);
  if (user && user.monthlyBudget > 0) {
    const budgetRatio = newTx.amount / user.monthlyBudget;
    if (budgetRatio > 0.3) {
      flags.push(`High Single Expense: Accounts for ${Math.round(budgetRatio * 100)}% of your monthly budget.`);
    }
  }

  // 3. Price Surge Check (>50% higher than 3-month moving average for category)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 60 * 60 * 24 * 1000);
  const categoryStats = await Transaction.aggregate([
    {
      $match: {
        userId: user._id,
        category: newTx.category,
        type: 'expense',
        date: { $gte: ninetyDaysAgo }
      }
    },
    {
      $group: {
        _id: '$category',
        totalSpent: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  if (categoryStats.length > 0 && categoryStats[0].count >= 3) {
    // Calculate average transaction size for this category over last 90 days
    const avgTxAmount = categoryStats[0].totalSpent / categoryStats[0].count;
    if (newTx.amount > avgTxAmount * 1.5) {
      const percentageIncrease = Math.round(((newTx.amount - avgTxAmount) / avgTxAmount) * 100);
      flags.push(`Price Surge: ${percentageIncrease}% higher than your average ${newTx.category} spending (${avgTxAmount.toFixed(2)}).`);
    }
  }

  return {
    isFlagged: flags.length > 0,
    flagReason: flags.length > 0 ? flags.join(' | ') : null
  };
}