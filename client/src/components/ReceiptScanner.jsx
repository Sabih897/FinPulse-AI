import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, DollarSign, Tag, Store } from 'lucide-react';
import axios from '../api/axiosInstance';

export default function ReceiptScanner({ onTransactionSaved }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scannedData, setScannedData] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleScan = async () => {
    if (!file) {
      setError('Please select a receipt image first.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const res = await axios.post('/receipts/scan-receipt', formData);

      if (res.data.success && res.data.data) {
        setScannedData(res.data.data);
      } else {
        setError('Could not read details from receipt.');
      }
    } catch (err) {
      console.error('Scan Error Details:', err);
      const status = err.response?.status;
      const backendError = err.response?.data?.error || err.response?.data?.message || err.message;

      if (status === 401) {
        setError('Session expired or unauthorized. Please log out and log back in.');
      } else if (status === 500) {
        setError(`Server Error (500): ${backendError}`);
      } else {
        setError(`Upload Failed (${status || 'Network Error'}): ${backendError}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!scannedData) return;

    setSaving(true);
    setError('');

    try {
      // Safely parse date to ISO string
      let parsedDate = new Date();
      if (scannedData.date) {
        const testDate = new Date(scannedData.date);
        if (!isNaN(testDate.getTime())) {
          parsedDate = testDate;
        }
      }

      const payload = {
        merchant: scannedData.merchant ? scannedData.merchant.trim() : 'Unknown Merchant',
        amount: Number(scannedData.amount),
        date: parsedDate.toISOString(),
        category: scannedData.category || 'Others',
        type: 'expense',
        lineItems: scannedData.lineItems || []
      };

      if (!payload.merchant || !Number.isFinite(payload.amount) || payload.amount <= 0) {
        setError('Please verify the merchant and enter a valid receipt amount greater than zero.');
        return;
      }
      const res = await axios.post('/transactions', payload);

      if (res.data.success || res.status === 201) {
        setScannedData(null);
        setFile(null);
        if (onTransactionSaved) onTransactionSaved();
      }
    } catch (err) {
      console.error('Save Transaction Failure:', err);
      const serverErrMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(`Failed to save: ${serverErrMsg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm max-w-lg w-full space-y-4">
      <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
        <FileText className="h-5 w-5 text-indigo-600" />
        <span>Scan Receipt with AI</span>
      </h2>

      {/* On-Screen Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <span className="break-words font-medium">{error}</span>
        </div>
      )}

      {!scannedData ? (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-indigo-500 transition cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="receipt-input"
            />
            <label htmlFor="receipt-input" className="cursor-pointer space-y-2 block">
              <Upload className="h-8 w-8 text-gray-400 mx-auto" />
              <div className="text-sm text-gray-600 font-medium">
                {file ? file.name : 'Click to upload receipt image'}
              </div>
              <div className="text-xs text-gray-400">PNG, JPG, or WEBP up to 5MB</div>
            </label>
          </div>

          <button
            onClick={handleScan}
            disabled={!file || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
                <span>Analyzing Receipt...</span>
              </>
            ) : (
              <span>Scan Receipt</span>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4 border-t pt-4">
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-3">
            <div className="text-xs font-semibold uppercase text-indigo-700 tracking-wider">
              AI Extracted Details
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 flex items-center gap-1">
                  <Store className="h-4 w-4" /> Merchant:
                </span>
                <input
                  type="text"
                  value={scannedData.merchant || ''}
                  onChange={(e) => setScannedData({ ...scannedData, merchant: e.target.value })}
                  className="font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 text-right text-sm bg-white"
                />
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 flex items-center gap-1">
                  <DollarSign className="h-4 w-4" /> Amount:
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={scannedData.amount || ''}
                  onChange={(e) => setScannedData({ ...scannedData, amount: e.target.value })}
                  className="font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 text-right text-sm bg-white"
                />
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 flex items-center gap-1">
                  <Tag className="h-4 w-4" /> Category:
                </span>
                <select
                  value={scannedData.category || 'Groceries'}
                  onChange={(e) => setScannedData({ ...scannedData, category: e.target.value })}
                  className="font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 text-right text-sm bg-white"
                >
                  <option value="Groceries">Groceries</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Dining">Dining</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Transport">Transport</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Subscriptions">Subscriptions</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Others">Others</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setScannedData(null)}
              className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg text-sm transition"
            >
              Re-scan
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-sm transition shadow-sm flex items-center justify-center space-x-1 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              <span>Confirm & Save</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}