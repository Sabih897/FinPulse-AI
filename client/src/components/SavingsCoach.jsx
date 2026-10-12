import React, { useCallback, useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Sparkles, TrendingDown, Wallet, PiggyBank, RefreshCw, CheckCircle2, XCircle, Clock3, Lightbulb, Save, History, Plus, X } from 'lucide-react';
import axios from '../api/axiosInstance';
import { formatINR } from '../utils/formatters';

const panel = 'bg-[#111827] border border-slate-800/80 p-5 sm:p-6 rounded-2xl';
const money = value => formatINR(Number(value || 0));

export default function SavingsCoach() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const previousMonth = new Date();
  previousMonth.setDate(1);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const monthValue = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
  const [historyForm, setHistoryForm] = useState({
    month: monthValue, income: '', expenses: '',
    categories: { Groceries: '', Utilities: '', Dining: '', Transport: '', Shopping: '', Healthcare: '', Entertainment: '', Subscriptions: '', Others: '' },
    notes: ''
  });
  const [historySaving, setHistorySaving] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      setError('');
      const response = await axios.get('/savings/overview');
      setData(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load savings analytics.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateRecommendations = useCallback(async (automatic = false) => {
    setGenerating(true);
    setNotice('');
    try {
      const response = await axios.post('/savings/recommendations/generate');
      setNotice(response.data.message || 'Recommendation check completed.');
      await loadOverview();
    } catch (err) {
      if (!automatic) setNotice(err.response?.data?.error || 'Could not generate recommendations.');
    } finally {
      setGenerating(false);
    }
  }, [loadOverview]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const overview = await loadOverview();
      if (alive && overview?.recommendationDue) await generateRecommendations(true);
    })();
    return () => { alive = false; };
  }, [loadOverview, generateRecommendations]);

  const saveHistory = async (event) => {
    event.preventDefault();
    setHistorySaving(true);
    setNotice('');
    try {
      const categories = Object.fromEntries(
        Object.entries(historyForm.categories)
          .filter(([, amount]) => amount !== '' && Number(amount) > 0)
          .map(([name, amount]) => [name, Number(amount)])
      );
      const response = await axios.post('/savings/history', {
        month: historyForm.month,
        income: Number(historyForm.income || 0),
        expenses: Number(historyForm.expenses || 0),
        categories,
        notes: historyForm.notes
      });
      setNotice('Month saved. Your spending overview has been updated.');
      setHistoryModalOpen(false);
      await loadOverview();
      // Refresh the recommendation list now that historical baseline data exists.
      await generateRecommendations(false);
    } catch (err) {
      setNotice(err.response?.data?.error || 'Could not save historical details.');
    } finally {
      setHistorySaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`/savings/recommendations/${id}/status`, { status });
      await loadOverview();
      setNotice(status === 'accepted' ? 'Recommendation marked as in progress.' : 'Recommendation dismissed.');
    } catch (err) {
      setNotice(err.response?.data?.error || 'Could not update recommendation.');
    }
  };

  if (loading) return <div className="py-20 text-center text-sm text-slate-400">Loading savings insights…</div>;
  if (error && !data) return <div className={panel}><p className="text-rose-300 text-sm">{error}</p><button onClick={loadOverview} className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Retry</button></div>;
  if (!data) return null;

  const month = data.currentMonth || {};
  const categories = Object.entries(data.categoryAnalysis || {}).sort((a, b) => (b[1].reductionVsBaseline || 0) - (a[1].reductionVsBaseline || 0));
  const improved = categories.filter(([, item]) => item.baselineMonthly > 0 && item.reductionVsBaseline > 0);
  const recommendations = data.recommendations || [];

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div><div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-widest"><Sparkles className="w-4 h-4" /> Smart Savings Coach</div><h2 className="text-2xl font-black text-white mt-2">Your spending, with a plan</h2><p className="text-sm text-slate-400 mt-1">See where your money goes and find small, realistic ways to save.</p></div>
      <button onClick={() => generateRecommendations(false)} disabled={generating || !data.recommendationDue} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold"><RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />{generating ? 'Analyzing…' : data.recommendationDue ? 'Check recommendations' : 'Recommendations up to date'}</button>
    </div>
    {notice && <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">{notice}</div>}
    {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

    <section className={panel}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><History className="w-5 h-5 text-indigo-300 mt-0.5" /><div><h3 className="font-bold text-white">Past months</h3><p className="text-sm text-slate-400 mt-1">Add totals from before you started using FinPulse, so comparisons are more useful.</p></div></div><button type="button" onClick={() => setHistoryModalOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"><Plus className="h-4 w-4" /> Add a month</button></div>
      {historyModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="history-modal-title"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#111827] p-5 sm:p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h3 id="history-modal-title" className="text-lg font-bold text-white">Add a past month</h3><p className="mt-1 text-sm text-slate-400">Enter what you earned and spent. Category amounts are optional.</p></div><button type="button" aria-label="Close" onClick={() => setHistoryModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button></div>
      <form onSubmit={saveHistory} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-slate-300">Month
            <input type="month" required value={historyForm.month} onChange={e => setHistoryForm(prev => ({ ...prev, month: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Total income (₹)
            <input type="number" min="0" step="0.01" value={historyForm.income} onChange={e => setHistoryForm(prev => ({ ...prev, income: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Total expenses (₹)
            <input type="number" min="0" step="0.01" required value={historyForm.expenses} onChange={e => setHistoryForm(prev => ({ ...prev, expenses: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          </label>
        </div>
        <div><p className="text-xs font-semibold text-slate-300 mb-2">Expense category totals (optional)</p><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(historyForm.categories).map(([name, amount]) => <label key={name} className="text-xs text-slate-400">{name}
            <input type="number" min="0" step="0.01" value={amount} onChange={e => setHistoryForm(prev => ({ ...prev, categories: { ...prev.categories, [name]: e.target.value } }))} placeholder="₹0" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          </label>)}
        </div></div>
        <label className="block text-xs text-slate-300">Notes (optional)
          <input value={historyForm.notes} maxLength={500} onChange={e => setHistoryForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="e.g. approximate figures from bank statement" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
        </label>
        <div className="flex justify-end gap-3"><button type="button" onClick={() => setHistoryModalOpen(false)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300">Cancel</button><button type="submit" disabled={historySaving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"><Save className="w-4 h-4" />{historySaving ? 'Saving…' : 'Save month'}</button></div>
      </form></div></div>}
    </section>

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className={panel}><div className="flex justify-between text-slate-400 text-xs"><span>Spent this month</span><Wallet className="w-4 h-4" /></div><p className="text-2xl font-black text-white mt-3">{money(month.expenses)}</p><p className="text-xs text-slate-500 mt-2">{month.label} · day {month.day} of {month.daysInMonth}</p></div>
      <div className={panel}><div className="flex justify-between text-slate-400 text-xs"><span>Spending less in</span><TrendingDown className="w-4 h-4 text-emerald-400" /></div><p className="text-2xl font-black text-emerald-300 mt-3">{improved.length}</p><p className="text-xs text-slate-500 mt-2">Compared with your recent average</p></div>
      <div className={panel}><div className="flex justify-between text-slate-400 text-xs"><span>Income this month</span><PiggyBank className="w-4 h-4" /></div><p className="text-2xl font-black text-white mt-3">{money(month.income)}</p><p className="text-xs text-slate-500 mt-2">Income minus spending: {money(month.net)}</p></div>
      <div className={panel}><div className="flex justify-between text-slate-400 text-xs"><span>Possible savings trend</span><Lightbulb className="w-4 h-4 text-amber-300" /></div><p className="text-2xl font-black text-white mt-3">{money(data.estimatedSixMonthSpendingReduction)}</p><p className="text-xs text-slate-500 mt-2">An estimate based on past spending</p></div>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <section className={panel}><h3 className="font-bold text-white">Your spending over six months</h3><p className="text-xs text-slate-400 mt-1 mb-5">See how your spending changes from month to month.</p>
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.sixMonthTrend || []} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#243044" /><XAxis dataKey="label" stroke="#94A3B8" fontSize={11} /><YAxis stroke="#94A3B8" fontSize={11} tickFormatter={v => `₹${v}`} /><Tooltip formatter={v => money(v)} contentStyle={{ background: '#0F172A', borderColor: '#334155', borderRadius: 10, color: '#fff' }} /><Legend /><Bar dataKey="expenses" name="Expenses" fill="#6366F1" radius={[5, 5, 0, 0]} /><Bar dataKey="baseline" name="Available baseline" fill="#10B981" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <p className="text-[11px] text-slate-500 mt-2">Previous transactions are retained. Only the current calendar month contributes to the current-month totals.</p>
      </section>
      <section className={panel}><h3 className="font-bold text-white">Spending by category</h3><p className="text-xs text-slate-400 mt-1 mb-5">Compare this month's pace with your recent average.</p>
        {categories.length ? <div className="space-y-4">{categories.map(([name, item]) => <div key={name}><div className="flex justify-between gap-3 text-sm"><span className="text-slate-200">{name}</span><span className={item.baselineMonthly > 0 && item.reductionVsBaseline > 0 ? 'text-emerald-300' : 'text-rose-300'}>{item.baselineMonthly > 0 ? item.reductionVsBaseline > 0 ? `↓ ${money(item.reductionVsBaseline)} projected` : item.reductionVsBaseline < 0 ? `↑ ${money(Math.abs(item.reductionVsBaseline))} projected` : 'On baseline' : 'Building baseline'}</span></div><div className="h-2 rounded-full bg-slate-800 mt-2 overflow-hidden"><div className={`h-full rounded-full ${item.reductionVsBaseline > 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, Math.max(0, item.baselineMonthly ? item.projectedMonthSpend / item.baselineMonthly * 100 : 0))}%` }} /></div><p className="text-[11px] text-slate-500 mt-1">Usual monthly spend: {money(item.baselineMonthly)} · spent so far: {money(item.currentSpend)} · estimated month total: {money(item.projectedMonthSpend)}</p></div>)}</div> : <p className="text-sm text-slate-500 py-8">Add expense transactions to build category analysis.</p>}
      </section>
    </div>

    <section className={panel}><div className="flex items-center gap-2 mb-2"><Lightbulb className="w-5 h-5 text-amber-300" /><h3 className="font-bold text-white">Simple ways to save</h3></div><p className="text-xs text-slate-400 mb-5">Practical ideas based on your spending. Pick what fits your life—there is no need to cut essentials.</p>
      {recommendations.length ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{recommendations.map(rec => <article key={rec._id} className="border border-slate-800 bg-[#0F172A] rounded-xl p-5"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] uppercase tracking-widest text-indigo-300">{rec.category}</span><h4 className="text-white font-semibold mt-1">{rec.title}</h4></div><span className="text-[10px] uppercase text-slate-400 border border-slate-700 rounded-full px-2 py-1">{rec.status}</span></div><p className="text-sm text-slate-300 mt-3">{rec.description}</p><p className="text-sm text-indigo-200 mt-3"><strong>Try this:</strong> {rec.action}</p><div className="grid grid-cols-2 gap-3 mt-4"><div className="bg-slate-800/50 rounded-lg p-3"><p className="text-[10px] text-slate-400">Usual monthly spend</p><p className="text-sm text-white font-bold mt-1">{money(rec.baselineMonthlyAmount)}</p></div><div className="bg-slate-800/50 rounded-lg p-3"><p className="text-[10px] text-slate-400">Try spending</p><p className="text-sm text-white font-bold mt-1">{money(rec.targetMonthlyAmount)}</p></div></div>{rec.impactReady ? <p className={`text-xs mt-3 ${rec.observedReduction >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>Estimated difference so far: {money(rec.observedReduction)} over the review period.</p> : <p className="text-xs text-slate-500 mt-3 flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> Review after 14 days ({Math.min(rec.elapsedDays || 0, 14)}/14 days elapsed)</p>}{rec.status === 'new' && <div className="flex gap-2 mt-4"><button onClick={() => updateStatus(rec._id, 'accepted')} className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-2 text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Try this</button><button onClick={() => updateStatus(rec._id, 'dismissed')} className="flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 px-3 py-2 text-xs"><XCircle className="w-3.5 h-3.5" /> Dismiss</button></div>}</article>)}</div> : <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center"><p className="text-sm text-slate-300">No recommendations yet.</p><p className="text-xs text-slate-500 mt-1">Add transactions or past-month totals to get suggestions that better fit your spending.</p></div>}
      <p className="text-[11px] text-slate-500 mt-5">These are estimates, not promises. You save money when you spend less and keep the difference.</p>
    </section>
  </div>;
}
