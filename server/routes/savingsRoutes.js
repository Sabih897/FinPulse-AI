import express from 'express';
import { GoogleGenAI } from '@google/genai';
import Transaction from '../models/Transaction.js';
import SavingsRecommendation from '../models/SavingsRecommendation.js';
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
  const candidates = Object.entries(stats).map(([category, s]) => {
    const baseline = s.prior.reduce((a, b) => a + b, 0) / 3;
    const projected = day ? s.current / day * new Date(monthStart(following.year, following.month).getTime() - monthStart(year, month).getTime()).getTime() / 86400000 : 0;
    return { category, baseline: Math.round(baseline), current: Math.round(s.current), projected: Math.round(projected), excess: Math.round(projected - baseline) };
  }).filter(c => c.baseline > 0 && c.excess > Math.max(300, c.baseline * 0.1)).sort((a, b) => b.excess - a.excess).slice(0, 3);

  if (!candidates.length) return { created: [], due: false };
  let advice = [];
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Return ONLY a JSON array of up to 3 expense coaching objects. Use only these categories and exact baseline numbers. Fields: category, title, description, action, targetMonthlyAmount. Make realistic suggestions, don't recommend cutting necessary healthcare. Data: ${JSON.stringify(candidates)}`;
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      const raw = String(response.text || '').replace(/^```json/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) advice = parsed;
    } catch (err) {
      console.warn('Savings coach Gemini fallback:', err.message);
    }
  }

  const created = [];
  for (const c of candidates) {
    const rec = advice.find(a => a.category === c.category) || {};
    const target = Math.max(0, Math.min(c.baseline, Number(rec.targetMonthlyAmount) || Math.round(c.baseline * 0.9)));
    created.push(await SavingsRecommendation.create({
      userId, category: c.category,
      title: String(rec.title || `Review ${c.category.toLowerCase()} spending`).slice(0, 100),
      description: String(rec.description || `Your current-month pace is about ₹${c.projected}, versus a recent three-month average of ₹${c.baseline}. This is a trend, not proof that every increase is avoidable.`).slice(0, 1000),
      action: String(rec.action || `Review recent ${c.category.toLowerCase()} purchases and try a monthly target of ₹${target}.`).slice(0, 1000),
      baselineMonthlyAmount: c.baseline, targetMonthlyAmount: target,
      expectedMonthlyReduction: Math.max(0, c.baseline - target), generatedAt: now, observationDays: 14
    }));
  }
  return { created, due: false };
}

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

    const months = [];
    for (let offset = -5; offset <= 0; offset++) {
      const m = shiftMonth(year, month, offset);
      const monthTxs = txs.filter(tx => {
        const p = partsInIndia(new Date(tx.date));
        return p.year === m.year && p.month === m.month;
      });
      months.push({
        key: key(m.year, m.month),
        label: new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: TZ }).format(monthStart(m.year, m.month)),
        expenses: total(monthTxs, 'expense'),
        income: total(monthTxs, 'income'),
        categories: categories(monthTxs)
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

export default router;
