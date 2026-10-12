// client/src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Wallet, LogOut, MessageSquare, PlusCircle, LayoutDashboard } from 'lucide-react';

import Dashboard from './components/Dashboard';
import ReceiptScanner from './components/ReceiptScanner';
import AIChatDrawer from './components/AIChatDrawer';
import Login from './components/Login';
import Register from './components/Register';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
  };

  const handleAuthSuccess = () => {
    setToken(localStorage.getItem('token'));
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        
        {/* Navigation Header */}
        {token && (
          <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              
              <Link to="/" className="flex items-center space-x-3">
                <div className="bg-indigo-600 text-white p-2 rounded-xl">
                  <Wallet className="h-6 w-6" />
                </div>
                <span className="font-bold text-xl text-gray-900 tracking-tight">
                  FinPulse<span className="text-indigo-600">AI</span>
                </span>
              </Link>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowScanner(!showScanner)}
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium px-4 py-2 rounded-lg text-sm flex items-center space-x-2 transition"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>{showScanner ? 'Close Scanner' : 'Scan Receipt'}</span>
                </button>

                <button
                  onClick={() => setIsChatOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center space-x-2 transition shadow-sm"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Ask AI</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-red-600 p-2 rounded-lg transition"
                  title="Log out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>

            </div>
          </header>
        )}

        {/* Main Content Area */}
        <main className="flex-1">
          {token && showScanner && (
            <div className="max-w-7xl mx-auto p-6 flex justify-center">
              <ReceiptScanner onTransactionSaved={() => { setShowScanner(false); setTransactionRefreshKey((key) => key + 1); }} />
            </div>
          )}

          <Routes>
            {/* Public Auth Routes */}
            <Route 
              path="/login" 
              element={!token ? <Login onLoginSuccess={handleAuthSuccess} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/register" 
              element={!token ? <Register onLoginSuccess={handleAuthSuccess} /> : <Navigate to="/" />} 
            />

            {/* Protected Routes */}
            <Route 
              path="/" 
              element={token ? <Dashboard refreshKey={transactionRefreshKey} /> : <Navigate to="/login" />} 
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        {/* Slide-Out AI Assistant Drawer */}
        {token && (
          <AIChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        )}

      </div>
    </Router>
  );
}

export default App;