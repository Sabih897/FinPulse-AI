// client/src/components/Layout.jsx
import React from 'react';
import { LayoutDashboard, BarChart3, Receipt, Wallet, FileText, Bot, Bell, Settings, LogOut, Sparkles } from 'lucide-react';

export default function Layout({ children, userProfile, activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Overview' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, section: 'Overview' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, section: 'Finance', badge: '3' },
    { id: 'budgets', label: 'Budgets', icon: Wallet, section: 'Finance' },
    { id: 'reports', label: 'Reports', icon: FileText, section: 'Finance' },
    { id: 'assistant', label: 'AI Assistant', icon: Bot, section: 'Tools' },
    { id: 'alerts', label: 'Alerts', icon: Bell, section: 'Tools', badge: '2' },
  ];

  return (
    <div className="flex h-screen bg-[#0B0F19] text-slate-100 font-sans overflow-hidden">
      
      {/* Functional Sidebar */}
      <aside className="w-64 bg-[#0F172A] border-r border-slate-800/80 flex flex-col justify-between hidden md:flex">
        <div className="p-6 space-y-8">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">FinPulse AI</span>
          </div>

          {/* Navigation Links */}
          <div className="space-y-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
            
            {/* Overview Group */}
            <div>
              <p className="px-3 mb-2">Overview</p>
              <div className="space-y-1">
                {menuItems.filter(i => i.section === 'Overview').map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-3"><Icon className="h-4 w-4" /> {item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Finance Group */}
            <div>
              <p className="px-3 mb-2">Finance</p>
              <div className="space-y-1">
                {menuItems.filter(i => i.section === 'Finance').map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-3"><Icon className="h-4 w-4" /> {item.label}</span>
                      {item.badge && <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[10px]">{item.badge}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tools Group */}
            <div>
              <p className="px-3 mb-2">Tools</p>
              <div className="space-y-1">
                {menuItems.filter(i => i.section === 'Tools').map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-3"><Icon className="h-4 w-4" /> {item.label}</span>
                      {item.badge && <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[10px]">{item.badge}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-[#0B0F19]/50 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
              {userProfile?.name ? userProfile.name.substring(0, 2).toUpperCase() : 'MK'}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">{userProfile?.name || 'Marcus Kim'}</p>
              <p className="text-[11px] text-slate-400 truncate">{userProfile?.email || 'marcus@finpulse.ai'}</p>
            </div>
          </div>
          <button onClick={() => alert('Logged out successfully')} className="text-slate-400 hover:text-rose-400 transition p-1">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>

    </div>
  );
}