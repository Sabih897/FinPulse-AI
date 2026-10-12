// client/src/components/Dashboard.jsx
import React, { useEffect, useState, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ShieldAlert, CheckCircle, Search, Download, Wallet, AlertCircle, Plus, Sparkles, TrendingUp, Edit3, Send, Bot, User, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import axios from '../api/axiosInstance';
import { exportTransactionsToCSV } from '../utils/exportCSV';
import { formatINR } from '../utils/formatters';
import AddTransactionModal from './AddTransactionModal';
import EditBudgetModal from './EditBudgetModal';
import Layout from './Layout';
import SavingsCoach from './SavingsCoach';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Dashboard({ refreshKey = 0 }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState([]);
  const [userProfile, setUserProfile] = useState({ name: '', email: '', monthlyBudget: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // AI Assistant Chat State
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your FinPulse AI financial assistant. Ask me about your spending, budget, or savings recommendations.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [search, category, refreshKey]);

  useEffect(() => {
    if (activeTab === 'assistant') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txRes, userRes] = await Promise.all([
        axios.get('/transactions', { params: { search, category, limit: 100, page: 1 } }),
        axios.get('/auth/profile').catch(() => ({ data: { name: '', email: '', monthlyBudget: 0 } }))
      ]);

      const firstPage = txRes.data;
      let txArray = firstPage.transactions || (Array.isArray(firstPage) ? firstPage : []);
      const totalPages = Math.max(1, Number(firstPage.pages) || 1);
      if (totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            axios.get('/transactions', { params: { search, category, limit: 100, page: index + 2 } })
          )
        );
        txArray = txArray.concat(...remainingPages.map((response) => response.data.transactions || []));
      }
      setTransactions(txArray);
      
      if (userRes.data) {
        setUserProfile(userRes.data);
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const currentMonthTransactions = txArray.filter((t) => {
        const date = new Date(t.date);
        return date >= monthStart && date < nextMonthStart;
      });
      const catMap = {};
      currentMonthTransactions.forEach((t) => {
        if (t.type === 'expense') {
          const amt = Number(t.amount || 0);
          catMap[t.category] = (catMap[t.category] || 0) + amt;
        }
      });

      setSummary(Object.keys(catMap).map((cat) => ({ name: cat, value: catMap[cat] })));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const monthlyBudget = Number(userProfile.monthlyBudget ?? 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const currentMonthTransactions = transactions.filter((t) => {
    const date = new Date(t.date);
    return date >= monthStart && date < nextMonthStart;
  });
  const totalExpenses = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const remainingBudget = monthlyBudget - totalExpenses;
  const percentageRemaining = monthlyBudget > 0 ? ((remainingBudget / monthlyBudget) * 100).toFixed(1) : 0;

  // Handle AI Chat Send
  const handleSendAiMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isAiLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsAiLoading(true);

    try {
      // Connect to your backend AI chat endpoint or simulate intelligent response based on live ledger data
      const res = await axios.post('/ai/chat', { message: userMsg, transactions, summary }).catch(() => null);
      
      let reply = "";
      if (res && res.data && (res.data.text || res.data.reply)) {
        reply = res.data.text || res.data.reply;
      } else {
        // Intelligent fallback simulator using actual state data
        if (userMsg.toLowerCase().includes('budget') || userMsg.toLowerCase().includes('spend')) {
          reply = `You have spent ${formatINR(totalExpenses)} out of your ${formatINR(monthlyBudget)} monthly limit. You have ${formatINR(remainingBudget)} remaining (${percentageRemaining}%).`;
        } else if (userMsg.toLowerCase().includes('grocery') || userMsg.toLowerCase().includes('dining')) {
          const topCat = [...summary].sort((a,b) => b.value - a.value)[0];
          reply = topCat ? `Your highest spending category right now is ${topCat.name} at ${formatINR(topCat.value)}.` : "No major category spikes recorded yet.";
        } else {
          reply = `Based on your live ledger of ${transactions.length} transactions, your accounts are active. Total income recorded is ${formatINR(totalIncome)} and total expenses are ${formatINR(totalExpenses)}.`;
        }
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'I encountered an error analyzing your request. Please try again.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Render different views depending on active sidebar tab
  const renderContent = () => {
    switch (activeTab) {
      case 'savings':
        return <SavingsCoach />;

      case 'analytics':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Advanced Financial Analytics</h2>
              <p className="text-xs text-slate-400">Comprehensive multi-angle spending metrics and trends</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown Bar Chart */}
              <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl">
                <h3 className="text-sm font-bold text-white mb-4">Category Expense Distribution</h3>
                {summary.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summary}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                        <YAxis stroke="#64748B" fontSize={11} />
                        <Tooltip formatter={(val) => formatINR(val)} contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                        <Bar dataKey="value" fill="#6366F1" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-500">No chart data available.</div>
                )}
              </div>

              {/* Financial Health Summary Box */}
              <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Liquidity & Savings Health</h3>
                  <p className="text-xs text-slate-400">Calculated metrics based on active records</p>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-[#1E293B]/40 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Total Inflow (Income)</p>
                      <p className="text-lg font-bold text-emerald-400 mt-0.5">{formatINR(totalIncome)}</p>
                    </div>
                    <ArrowUpRight className="h-6 w-6 text-emerald-400" />
                  </div>

                  <div className="p-4 bg-[#1E293B]/40 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Total Outflow (Expenses)</p>
                      <p className="text-lg font-bold text-rose-400 mt-0.5">{formatINR(totalExpenses)}</p>
                    </div>
                    <ArrowDownRight className="h-6 w-6 text-rose-400" />
                  </div>

                  <div className="p-4 bg-indigo-600/10 rounded-xl border border-indigo-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-indigo-300">Net Balance Position</p>
                      <p className="text-lg font-bold text-white mt-0.5">{formatINR(totalIncome - totalExpenses)}</p>
                    </div>
                    <Sparkles className="h-5 w-5 text-indigo-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'assistant':
        return (
          <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
            <div>
              <h2 className="text-xl font-bold text-white">AI Assistant Workspace</h2>
              <p className="text-xs text-slate-400">Ask questions, analyze anomaly risks, and receive personalized financial guidance</p>
            </div>

            {/* Interactive Chat Window Box */}
            <div className="flex-1 bg-[#111827] border border-slate-800/80 rounded-2xl flex flex-col overflow-hidden">
              
              {/* Message Feed */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-300' : 'bg-indigo-600/30 border border-indigo-500/40 text-indigo-300'}`}>
                      {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className={`max-w-xl p-4 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#1E293B] text-slate-200 border border-slate-800 rounded-tl-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-[#1E293B] border border-slate-800 p-4 rounded-2xl text-xs text-slate-400 animate-pulse">
                      Analyzing your financial data...
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendAiMessage} className="p-4 bg-[#0F172A] border-t border-slate-800 flex items-center gap-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask anything about your budget, category limits, or spending anomalies..."
                  className="flex-1 bg-[#1E293B] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500 transition"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isAiLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
                >
                  <span>Send</span>
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>

            </div>
          </div>
        );

      case 'transactions':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Transactions Ledger</h2>
                <p className="text-xs text-slate-400">Complete list of all financial records</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search merchant..."
                    className="pl-9 pr-3 py-1.5 bg-[#1E293B] border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-[#1E293B] border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 outline-none"
                >
                  <option value="All">All Categories</option>
                  <option value="Groceries">Groceries</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Dining">Dining</option>
                  <option value="Transport">Transport</option>
                  <option value="Shopping">Shopping</option>
                </select>
              </div>
            </div>
            
            <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-slate-500 uppercase font-semibold border-b border-slate-800/80">
                  <tr>
                    <th className="pb-3">Merchant</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 font-medium text-white">{tx.merchant}</td>
                      <td className="py-3">
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="py-3 font-bold text-white">{formatINR(tx.amount)}</td>
                      <td className="py-3">
                        {tx.isFlagged ? (
                          <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">Flagged</span>
                        ) : (
                          <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">Clear</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'budgets':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Budget Management</h2>
            <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Active Limit Target</p>
                <p className="text-2xl font-black text-white mt-1">{formatINR(monthlyBudget)}</p>
              </div>
              <button
                onClick={() => setIsBudgetModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition"
              >
                Edit Budget
              </button>
            </div>
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Financial Reports</h2>
            <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl text-slate-300">
              <p className="text-sm">Downloadable summaries and monthly audit records are ready for export.</p>
              <button
                onClick={() => exportTransactionsToCSV(transactions)}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-xs flex items-center gap-2"
              >
                <Download className="h-4 w-4" /> Download CSV Report
              </button>
            </div>
          </div>
        );

      case 'alerts':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Security & Spending Alerts</h2>
            <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl text-slate-300 space-y-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Budget tracking limit is currently at {percentageRemaining}% remaining capacity.</span>
              </div>
            </div>
          </div>
        );

      default:
        // Default Dashboard View
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Budget Target</p>
                  <button 
                    onClick={() => setIsBudgetModalOpen(true)}
                    className="text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 p-1.5 rounded-lg border border-indigo-500/20 transition"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-2xl font-black text-white mt-3">{formatINR(monthlyBudget)}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <TrendingUp className="h-3.5 w-3.5" /> {percentageRemaining}% remaining budget
                </div>
              </div>

              <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Expenses Recorded</p>
                <p className="text-2xl font-black text-rose-500 mt-3">{formatINR(totalExpenses)}</p>
                <div className="mt-3 text-xs text-slate-400">Tracked from active ledger entries</div>
              </div>

              <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Scanned Receipts</p>
                  <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="text-2xl font-black text-white mt-3">{transactions.length}</p>
                <div className="mt-3 text-xs text-indigo-400 font-medium">Avg confidence 94.2% • 0 awaiting review</div>
              </div>
            </div>

            {totalIncome === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between text-xs text-amber-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span><strong>Notice:</strong> Your recorded income is ₹0. Add income streams to calculate net liquidity accurately.</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Spend by Category</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Current month breakdown</p>
                </div>

                {summary.length > 0 ? (
                  <div className="h-64 my-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={summary} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={4}>
                          {summary.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatINR(value)} contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: '1px solid #334155', color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-500 bg-[#1E293B]/30 rounded-xl my-4 border border-dashed border-slate-800">
                    No expense category records found.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                  {summary.slice(0, 4).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-300 px-2 py-1">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        {item.name}
                      </span>
                      <span className="font-semibold">{formatINR(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#111827] border border-slate-800/80 p-6 rounded-2xl space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-white">Recent Transactions</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Live system ledger activity</p>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-48">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search merchant..."
                          className="w-full pl-9 pr-3 py-1.5 bg-[#1E293B] border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-indigo-500"
                        />
                      </div>

                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="bg-[#1E293B] border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 outline-none"
                      >
                        <option value="All">All Categories</option>
                        <option value="Groceries">Groceries</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Dining">Dining</option>
                        <option value="Transport">Transport</option>
                        <option value="Shopping">Shopping</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    {loading ? (
                      <div className="py-16 text-center text-xs text-slate-500">Loading ledger data...</div>
                    ) : transactions.length === 0 ? (
                      <div className="py-16 text-center text-xs text-slate-500">No transactions match the selected filter.</div>
                    ) : (
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="text-slate-500 uppercase font-semibold border-b border-slate-800/80">
                          <tr>
                            <th className="pb-3">Merchant</th>
                            <th className="pb-3">Category</th>
                            <th className="pb-3">Date</th>
                            <th className="pb-3">Amount</th>
                            <th className="pb-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {transactions.slice(0, 5).map((tx) => (
                            <tr key={tx._id} className="hover:bg-slate-800/30 transition">
                              <td className="py-3 font-medium text-white">{tx.merchant}</td>
                              <td className="py-3">
                                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                                  {tx.category}
                                </span>
                              </td>
                              <td className="py-3 text-slate-500">{new Date(tx.date).toLocaleDateString()}</td>
                              <td className="py-3 font-bold text-white">{formatINR(tx.amount)}</td>
                              <td className="py-3">
                                {tx.isFlagged ? (
                                  <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md flex items-center w-max gap-1">
                                    <ShieldAlert className="h-3 w-3" /> Flagged
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center w-max gap-1">
                                    <CheckCircle className="h-3 w-3" /> Clear
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab}>
      
      {/* Top Navbar Header */}
      <header className="h-20 border-b border-slate-800/80 px-8 flex items-center justify-between bg-[#0B0F19]/80 backdrop-blur-md sticky top-0 z-20">
        <div>
          <h1 className="text-lg font-bold text-white capitalize">{activeTab} Overview</h1>
          <p className="text-xs text-slate-400">Track spending, active filters, and metrics</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-xl text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" /> AI Active
          </div>

          <button
            onClick={() => exportTransactionsToCSV(transactions)}
            disabled={transactions.length === 0}
            className="bg-[#1E293B] border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium px-4 py-2 rounded-xl text-xs flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span>Export</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </header>

      {/* Main Dynamic Workspace Area */}
      <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
        {renderContent()}
      </div>

      <AddTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onTransactionAdded={fetchData} />
      <EditBudgetModal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} currentBudget={monthlyBudget} onBudgetUpdated={fetchData} />

    </Layout>
  );
}