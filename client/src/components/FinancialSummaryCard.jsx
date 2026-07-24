// client/src/components/FinancialSummaryCard.jsx
import React, { useEffect, useState } from 'react';
import axios from '../api/axiosInstance';
import { Wallet, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

export default function FinancialSummaryCard() {
  const [summary, setSummary] = useState({
    budget: 0,
    totalExpense: 0,
    totalIncome: 0,
    categories: {},
    loading: true
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch user profile settings (budget target & currency)
        const userRes = await axios.get('/auth/profile'); // Adjust route if your user profile route differs
        // Fetch transactions to compute summary
        const txRes = await axios.get('/transactions'); // Adjust route based on your transaction API

        const transactions = txRes.data.transactions || txRes.data || [];
        const monthlyBudget = userRes.data.monthlyBudget || 50000;

        let totalExpense = 0;
        let totalIncome = 0;
        const categories = {};

        transactions.forEach(t => {
          if (t.type === 'expense') {
            totalExpense += t.amount;
            categories[t.category] = (categories[t.category] || 0) + t.amount;
          } else {
            totalIncome += t.amount;
          }
        });

        setSummary({
          budget: monthlyBudget,
          totalExpense,
          totalIncome,
          categories,
          loading: false
        });
      } catch (err) {
        console.error('Error loading dashboard summary:', err);
        setSummary(prev => ({ ...prev, loading: false }));
      }
    };

    fetchDashboardData();
  }, []);

  if (summary.loading) {
    return <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse">Loading financial snapshot...</div>;
  }

  const remainingBudget = summary.budget - summary.totalExpense;
  const percentageRemaining = summary.budget > 0 ? ((remainingBudget / summary.budget) * 100).toFixed(1) : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-indigo-600" />
          Financial Snapshot
        </h3>
        <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full">
          {percentageRemaining}% Budget Remaining
        </span>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Monthly Budget</p>
          <p className="text-xl font-bold text-gray-900 mt-1">₹{summary.budget.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Total Expenses</p>
          <p className="text-xl font-bold text-rose-600 mt-1">₹{summary.totalExpense.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Remaining Budget</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">₹{remainingBudget.toLocaleString()}</p>
        </div>
      </div>

      {/* Actionable Insights & Breakdown */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700">Key Insights & Actions</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <span>
              Expenses are well-controlled, leaving you with <strong>{percentageRemaining}%</strong> of your target.
            </span>
          </li>
          {summary.totalIncome === 0 && (
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <span>
                <strong>Log Your Income:</strong> Your recorded income is currently ₹0. Add your income source to track true cash flow.
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}