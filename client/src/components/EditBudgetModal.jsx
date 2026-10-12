// client/src/components/EditBudgetModal.jsx
import React, { useState, useEffect } from 'react';
import axios from '../api/axiosInstance';
import { X, Sliders } from 'lucide-react';

export default function EditBudgetModal({ isOpen, onClose, currentBudget, onBudgetUpdated }) {
  const [budget, setBudget] = useState(currentBudget ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setBudget(currentBudget ?? 0);
  }, [currentBudget]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Adjust endpoint if your profile route uses a different path (e.g., PUT /auth/profile or PUT /users/budget)
      await axios.put('/auth/profile', { monthlyBudget: Number(budget) });
      
      onBudgetUpdated(); // Refresh dashboard data
      onClose(); // Close modal
    } catch (err) {
      console.error('Error updating budget:', err);
      setError(err.response?.data?.error || 'Failed to update budget.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6 space-y-5 animate-in fade-in zoom-in-95 border border-slate-100">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="h-4 w-4 text-indigo-600" />
            Update Monthly Budget
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-medium border border-rose-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">New Budget Target (₹)</label>
            <input
              type="number"
              required
              min="1"
              step="any"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition shadow-md shadow-indigo-100 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}