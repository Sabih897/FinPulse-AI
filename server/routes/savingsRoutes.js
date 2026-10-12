import express from 'express';
import { GoogleGenAI } from '@google/genai';
import Transaction from '../models/Transaction.js';
import SavingsRecommendation from '../models/SavingsRecommendation.js';
import User from '../models/User.js';
import HistoricalMonth from '../models/HistoricalMonth.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const TZ = 'Asia/Kolkata';

function partsInIndia(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const out = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { year: Number(out.year), month: Number(out.month), day: Number(out.day) };
}

function monthStart(year, month) {
  return new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+05:30`);
}

function shiftMonth(year, month, delta) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function key(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function total(txs, type) {
  return txs.reduce((sum, tx) => sum + (tx.type === type ? Number(tx.amount || 0) : 0), 0);
}

function categories(txs) {
  const result = {};
  for (const tx of txs) {
    if (tx.type === 'expense') result[tx.category] = (result[tx.category] || 0) + Number(tx.amount || 0);
  }
  return result;
}

async function makeRecommendations(userId) {
  const latest = await SavingsRecommendation.findOne({ userId }).sort({ generatedAt: -1 }).lean();
  if (latest && Date.now() - new Date(latest.generatedAt).getTime() < 3 * 86400000) {
    return { created: [], due: false };
  }

  const now = new Date();
  const { year, month, day } = partsInIndia(now);
  const previous = [1, 2, 3].map(n => shiftMonth(year, month, -n));
  const following = shiftMonth(year, month, 1);
  const start = monthStart(previous[2].year, previous[2].month);
  const txs = await Transaction.find({ userId, date: { $gte: start, $lt: new Date(now.getTime() + 1) } })
    .select('amount category date type').lean();
  const historyStart = monthStart(previous[2].year, previous[2].month);
  const historicalMonths = await HistoricalMonth.find({
    userId, month: { $gte: key(previous[2].year, previous[2].month), $lte: key(year, month) }
  }).lean();
  const transactionMonths = new Set(txs.filter(tx => tx.type === 'expense').map(tx => {
    const p = partsInIndia(new Date(tx.date));
    return key(p.year, p.month);
  }));
  const historicalByMonth = new Map(historicalMonths.map(item => [item.month, item]));
  const stats = {};
  for (const tx of txs) {
    if (tx.type !== 'expense') continue;
    const p = partsInIndia(new Date(tx.date));
    const category = tx.category;
    stats[category] ||= { current: 0, prior: [0, 0, 0] };
    if (p.year === year && p.month === month) stats[category].current += Number(tx.amount || 0);
    else {
      const i = previous.findIndex(m => m.year === p.year && m.month === p.month);
      if (i >= 0) stats[category].prior[i] += Number(tx.amount || 0);
    }
  }
  // Use manually entered month summaries as a baseline only where there are no
  // individual transactions for that month, avoiding double-counting imported data.
  for (const item of historicalMonths) {
    if (transactionMonths.has(item.month)) continue;
    const [histYear, histMonth] = item.month.split('-').map(Number);
    const priorIndex = previous.findIndex(m => m.year === histYear && m.month === histMonth);
    for (const [category, amount] of Object.entries(item.categories || {})) {
      stats[category] ||= { current: 0, prior: [0, 0, 0] };
      if (histYear === year && histMonth === month) stats[category].current = Number(amount || 0);
      else if (priorIndex >= 0) stats[category].prior[priorIndex] = Number(amount || 0);
    }
  }
  const candidates = Object.entries(stats).map(([category, s]) => {
    const baseline = s.prior.reduce((a, b) => a + b, 0) / 3;
    const projected = day ? s.current / day * (monthStart(following.year, following.month).getTime() - monthStart(year, month).getTime()) / 86400000 : 0;
    return { category, baseline: Math.round(baseline), current: Math.round(s.current), projected: Math.round(projected), excess: Math.round(projected - baseline) };
  });
  let actionable = candidates
    .filter(c => c.baseline > 0 && c.excess > Math.max(300, c.baseline * 0.1))
    .sort((a, b) => b.excess - a.excess)
    .slice(0, 3);

  // If this is a new account without historical baselines, provide clearly
  // labelled starter coaching from current spending instead of an empty panel.
  if (!actionable.length) {
    actionable = candidates
      .filter(c => c.current > 0 && c.baseline === 0)
      .sort((a, b) => b.projected - a.projected)
      .slice(0, 3)
      .map(c => ({ ...c, baseline: c.projected || c.current, starter: true }));
  }
  if (!actionable.length) return { created: [], due: false };
  let advice = [];
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Return ONLY a JSON array of up to 3 expense coaching objects. Use only these categories and exact baseline numbers. Fields: category, title, description, action, targetMonthlyAmount. Make realistic suggestions, don't recommend cutting necessary healthcare. Data: ${JSON.stringify(actionable)}`;
      const response = await ai.models.generateContent({ model: 'gemini-3.8-flash', contents: prompt });
      const raw = String(response.text || '').replace(/^```json/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) advice = parsed;
    } catch (err) {
      console.warn('Savings coach Gemini fallback:', err.message);
    }
  }

  const created = [];
  for (const c of actionable) {
    const rec = advice.find(a => a.category === c.category) || {};
    const target = Math.max(0, Math.min(c.baseline, Number(rec.targetMonthlyAmount) || Math.round(c.baseline * 0.9)));
    created.push(await SavingsRecommendation.create({
      userId, category: c.category,
      title: String(rec.title || (c.starter ? `Set a ${c.category.toLowerCase()} spending target` : `Review ${c.category.toLowerCase()} spending`)).slice(0, 100),
      description: String(rec.description || (c.starter ? `There is not enough prior-month data to compare this category yet. Your current spending pace is about ₹${c.projected}; use this as a starting estimate and adjust after you enter historical months.` : `Your current-month pace is about ₹${c.projected}, versus a recent three-month average of ₹${c.baseline}. This is a trend, not proof that every increase is avoidable.`)).slice(0, 1000),
      action: String(rec.action || (c.starter ? `Track ${c.category.toLowerCase()} purchases for the rest of this month and use ₹${target} as an initial target; revise it when you have more history.` : `Review recent ${c.category.toLowerCase()} purchases and try a monthly target of ₹${target}.`)).slice(0, 1000),
      baselineMonthlyAmount: c.baseline, targetMonthlyAmount: target,
      expectedMonthlyReduction: Math.max(0, c.baseline - target), generatedAt: now, observationDays: 14
    }));
  }
  return { created, due: false };
}

router.post('/history', protect, async (req, res) => {
  try {
    const { month, income = 0, expenses = 0, categories = {}, notes = '' } = req.body;
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ success: false, error: 'Month must use YYYY-MM format.' });
    }
    const [year, monthNumber] = month.split('-').map(Number);
    const nowParts = partsInIndia(new Date());
    const currentIndex = nowParts.year * 12 + nowParts.month;
    const requestedIndex = year * 12 + monthNumber;
    if (requestedIndex < currentIndex - 5 || requestedIndex > currentIndex) {
      return res.status(400).json({ success: false, error: 'You can enter history only for the current month and previous five months.' });
    }
    const normalizedIncome = Number(income);
    const normalizedExpenses = Number(expenses);
    if (![normalizedIncome, normalizedExpenses].every(v => Number.isFinite(v) && v >= 0)) {
      return res.status(400).json({ success: false, error: 'Income and expenses must be non-negative numbers.' });
    }
    if (!categories || typeof categories !== 'object' || Array.isArray(categories)) {
      return res.status(400).json({ success: false, error: 'Categories must be an object of category names and amounts.' });
    }
    const normalizedCategories = {};
    for (const [name, value] of Object.entries(categories)) {
      const amount = Number(value);
      if (!name.trim() || !Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ success: false, error: 'Every category needs a name and a non-negative amount.' });
      }
      normalizedCategories[name.trim()] = amount;
    }
    const categoryTotal = Object.values(normalizedCategories).reduce((sum, value) => sum + value, 0);
    if (categoryTotal > normalizedExpenses + 0.01) {
      return res.status(400).json({ success: false, error: 'Category totals cannot exceed total monthly expenses.' });
    }
    const record = await HistoricalMonth.findOneAndUpdate(
      { userId: req.user.id, month },
      { $set: { income: normalizedIncome, expenses: normalizedExpenses, categories: normalizedCategories, notes: String(notes || '').slice(0, 500) } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({ success: true, history: record, message: 'Historical month saved.' });
  } catch (error) {
    console.error('Save historical month error:', error);
    return res.status(500).json({ success: false, error: 'Unable to save historical month.' });
  }
});

router.get('/overview', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month, day } = partsInIndia(new Date());
    const currentStart = monthStart(year, month);
    const next = shiftMonth(year, month, 1);
    const currentEnd = monthStart(next.year, next.month);
    const oldest = shiftMonth(year, month, -5);
    const historyStart = monthStart(oldest.year, oldest.month);
    const txs = await Transaction.find({ userId, date: { $gte: historyStart, $lt: currentEnd } })
      .select('amount category date type').sort({ date: 1 }).lean();

    const historicalMonths = await HistoricalMonth.find({
      userId, month: { $gte: key(oldest.year, oldest.month), $lte: key(year, month) }
    }).lean();
    const historicalByMonth = new Map(historicalMonths.map(item => [item.month, item]));
    const months = [];
    for (let offset = -5; offset <= 0; offset++) {
      const m = shiftMonth(year, month, offset);
      const monthTxs = txs.filter(tx => {
        const p = partsInIndia(new Date(tx.date));
        return p.year === m.year && p.month === m.month;
      });
      const monthKey = key(m.year, m.month);
      const hasExpenseTransactions = monthTxs.some(tx => tx.type === 'expense');
      const hasIncomeTransactions = monthTxs.some(tx => tx.type === 'income');
      const historical = historicalByMonth.get(monthKey);
      const monthCategories = hasExpenseTransactions
        ? categories(monthTxs)
        : historical ? (historical.categories instanceof Map ? Object.fromEntries(historical.categories) : (historical.categories || {})) : {};
      months.push({
        key: monthKey,
        label: new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: TZ }).format(monthStart(m.year, m.month)),
        expenses: hasExpenseTransactions ? total(monthTxs, 'expense') : Number(historical?.expenses || 0),
        income: hasIncomeTransactions ? total(monthTxs, 'income') : Number(historical?.income || 0),
        categories: monthCategories,
        source: hasExpenseTransactions || hasIncomeTransactions ? 'transactions' : historical ? 'manual' : 'empty'
      });
    }

    const current = months[5];
    const prior = months.slice(2, 5);
    const names = new Set([...prior.flatMap(m => Object.keys(m.categories)), ...Object.keys(current.categories)]);
    const categoryAnalysis = {};
    for (const name of names) {
      const baseline = prior.reduce((sum, m) => sum + Number(m.categories[name] || 0), 0) / 3;
      const actual = Number(current.categories[name] || 0);
      const projected = day ? actual / day * (currentEnd.getTime() - currentStart.getTime()) / 86400000 : 0;
      categoryAnalysis[name] = {
        baselineMonthly: Math.round(baseline), currentSpend: actual,
        projectedMonthSpend: Math.round(projected),
        reductionVsBaseline: Math.round(baseline - projected),
        reductionPercent: baseline > 0 ? Math.round((baseline - projected) / baseline * 1000) / 10 : null
      };
    }

    const trend = months.map((m, i) => {
      const prev = months.slice(Math.max(0, i - 3), i);
      const baseline = prev.length === 3 ? prev.reduce((sum, item) => sum + item.expenses, 0) / 3 : null;
      const expensePace = i === 5 && day ? m.expenses / day * (currentEnd.getTime() - currentStart.getTime()) / 86400000 : m.expenses;
      return { ...m, baseline: baseline === null ? null : Math.round(baseline), spendingReduction: baseline === null ? null : Math.round(baseline - expensePace), isCurrentMonth: i === 5 };
    });

    const recent = await SavingsRecommendation.find({ userId }).sort({ generatedAt: -1 }).limit(12).lean();
    const recommendations = await Promise.all(recent.map(async rec => {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(rec.generatedAt).getTime()) / 86400000));
      const end = Math.min(Date.now(), new Date(rec.generatedAt).getTime() + rec.observationDays * 86400000);
      const observed = await Transaction.find({ userId, category: rec.category, type: 'expense', date: { $gte: rec.generatedAt, $lt: new Date(end) } }).select('amount').lean();
      const spent = observed.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const expected = rec.baselineMonthlyAmount * Math.min(elapsed, rec.observationDays) / 30;
      return { ...rec, elapsedDays: elapsed, actualObserved: Math.round(spent), observedReduction: elapsed >= rec.observationDays ? Math.round(expected - spent) : null, impactReady: elapsed >= rec.observationDays };
    }));
    const last = recent[0]?.generatedAt || null;
    res.json({
      success: true, timezone: TZ,
      currentMonth: { key: current.key, label: current.label, day, daysInMonth: Math.round((currentEnd - currentStart) / 86400000), expenses: current.expenses, income: current.income, net: current.income - current.expenses, categories: current.categories },
      sixMonthTrend: trend, categoryAnalysis,
      estimatedSixMonthSpendingReduction: trend.reduce((sum, m) => sum + Math.max(0, Number(m.spendingReduction || 0)), 0),
      recommendations, recommendationDue: !last || Date.now() - new Date(last).getTime() >= 3 * 86400000
    });
  } catch (error) {
    console.error('Savings overview error:', error);
    res.status(500).json({ success: false, error: 'Unable to load savings analytics.' });
  }
});

router.post('/recommendations/generate', protect, async (req, res) => {
  try {
    const result = await makeRecommendations(req.user.id);
    res.status(result.created.length ? 201 : 200).json({
      success: true, recommendations: result.created,
      message: result.created.length ? 'Recommendations generated.' : 'No actionable category increase found, or recommendations are still in cooldown.'
    });
  } catch (error) {
    console.error('Recommendation generation error:', error);
    res.status(500).json({ success: false, error: 'Unable to generate recommendations.' });
  }
});

router.patch('/recommendations/:id/status', protect, async (req, res) => {
  if (!['accepted', 'dismissed'].includes(req.body.status)) {
    return res.status(400).json({ success: false, error: 'Status must be accepted or dismissed.' });
  }
  try {
    const rec = await SavingsRecommendation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { status: req.body.status } }, { new: true, runValidators: true }
    );
    if (!rec) return res.status(404).json({ success: false, error: 'Recommendation not found.' });
    res.json({ success: true, recommendation: rec });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to update recommendation.' });
  }
});

export async function runScheduledSavingsRecommendations() {
  const users = await User.find({}).select('_id').lean();
  for (const user of users) {
    try {
      await makeRecommendations(user._id);
    } catch (error) {
      console.error('Scheduled savings recommendation failed for a user:', error.message);
    }
  }
}

export default router;
