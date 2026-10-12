// client/src/components/AddTransactionModal.jsx
import React, { useState } from 'react';
import axios from '../api/axiosInstance';
import { X, PlusCircle } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Groceries',
  'Utilities',
  'Dining',
  'Entertainment',
  'Transport',
  'Healthcare',
  'Subscriptions',
  'Shopping',
  'Others'
];

const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Gift',
  'Rental',
  'Refunds',
  'Others'
];

export default function AddTransactionModal({ isOpen, onClose, onTransactionAdded }) {
  const [formData, setFormData] = useState({
    merchant: '',
    amount: '',
    type: 'expense',
    category: 'Groceries',
    date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Handle type change and reset category to the first available option of that type
  const handleTypeChange = (newType) => {
    setFormData({
      ...formData,
      type: newType,
      category: newType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/transactions', {
        ...formData,
        amount: Number(formData.amount),
        type: formData.type,
        category: formData.category,
        date: new Date(`${formData.date}T12:00:00+05:30`).toISOString()
      });
      
      onTransactionAdded(); // Refresh dashboard data
      setFormData({ merchant: '', amount: '', type: 'expense', category: 'Groceries', date: new Date().toISOString().split('T')[0] });
      onClose(); // Close modal
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError(err.response?.data?.error || 'Failed to add transaction.');
    } finally {
      setLoading(false);
    }
  };

  const currentCategories = formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 relative animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-indigo-600" />
            Add Manual Transaction
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selector (Expense vs Income) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2 text-sm font-semibold rounded-lg border transition ${
                formData.type === 'expense'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2 text-sm font-semibold rounded-lg border transition ${
                formData.type === 'income'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              Income
            </button>
          </div>

          {/* Merchant Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {formData.type === 'income' ? 'Source / Payer' : 'Merchant / Vendor'}
            </label>
            <input
              type="text"
              required
              placeholder={formData.type === 'income' ? 'e.g. Employer, Client, Family' : 'e.g. Amazon, Supermarket'}
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              required
              min="0.01"
              step="any"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {currentCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Submit Action */}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}