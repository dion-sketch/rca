// App.jsx - Main application with routing
// Date: December 28, 2025
// All components integrated with proper navigation

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Dashboard from './Dashboard';
import BusinessBuilder from './BusinessBuilder';
import ShopContracts from './ShopContracts';
import ResponseRoom from './ResponseRoom';

function App() {
  // Navigation state
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  
  // User & data state
  const [user, setUser] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize
  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null);
      });
    } catch (err) {
      console.error('Auth error:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load business profile
      const { data: profile } = await supabase
        .from('business_profiles')
        .select('*')
        .limit(1)
        .single();
      
      if (profile) {
        setBusinessProfile(profile);
      }

      // Load submissions
      const { data: subs } = await supabase
        .from('submissions')
        .select('*')
        .order('created_at', { ascending: false });
      
      setSubmissions(subs || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Navigation handler
  const handleNavigate = (view, submissionId = null) => {
    setCurrentView(view);
    if (submissionId) {
      setSelectedSubmissionId(submissionId);
    }
  };

  // When selecting an opportunity from ShopContracts
  const handleSelectOpportunity = (submission) => {
    setSubmissions(prev => [submission, ...prev]);
    setSelectedSubmissionId(submission.id);
    setCurrentView('response');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🎓</div>
          <p className="text-emerald-400 text-lg">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Render current view
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            businessProfile={businessProfile}
            submissions={submissions}
            onNavigate={handleNavigate}
          />
        );
      
      case 'bucket':
        return (
          <BusinessBuilder
            businessProfile={businessProfile}
            onUpdate={(profile) => setBusinessProfile(profile)}
            onBack={() => setCurrentView('dashboard')}
          />
        );
      
      case 'shop':
        return (
          <ShopContracts
            businessProfile={businessProfile}
            onSelectOpportunity={handleSelectOpportunity}
          />
        );
      
      case 'cart':
      case 'responses':
        // Show list of in-progress submissions
        return (
          <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="text-slate-400 hover:text-white"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold">
                {currentView === 'cart' ? '🛒 My Cart' : '📝 My Responses'}
              </h1>
            </div>
            
            {submissions.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/30 rounded-xl">
                <p className="text-4xl mb-4">🎯</p>
                <p className="text-slate-300 mb-4">No opportunities in your cart yet.</p>
                <button
                  onClick={() => setCurrentView('shop')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  Go Shopping →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setSelectedSubmissionId(sub.id);
                      setCurrentView('response');
                    }}
                    className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl p-6 text-left transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {sub.title || sub.contract_title}
                        </h3>
                        <p className="text-slate-400 text-sm">
                          {sub.agency || 'Agency'} • Due: {sub.due_date || 'TBD'}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            sub.status === 'submitted' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {sub.status === 'submitted' ? 'Submitted' : 'In Progress'}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs uppercase">
                            {sub.rfp_type || 'RFP'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-400">
                          {sub.cr_match_score || sub.match_score || '--'}%
                        </div>
                        <div className="text-xs text-slate-500">Match</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      
      case 'response':
        return (
          <ResponseRoom
            submissionId={selectedSubmissionId}
            businessProfile={businessProfile}
            onBack={() => {
              setSelectedSubmissionId(null);
              setCurrentView('responses');
              loadData(); // Refresh data
            }}
          />
        );
      
      default:
        return (
          <Dashboard
            businessProfile={businessProfile}
            submissions={submissions}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Top Navigation */}
      {currentView !== 'response' && (
        <nav className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <button 
                onClick={() => setCurrentView('dashboard')}
                className="flex items-center gap-2"
              >
                <span className="text-emerald-500 font-bold text-xl">RCA</span>
                <span className="text-slate-400 text-sm hidden sm:inline">
                  Rambo Contract Assistant
                </span>
              </button>
              
              {/* Nav Links */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentView === 'dashboard' 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🏠 Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('shop')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentView === 'shop' 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🛒 Go Shopping
                </button>
                <button
                  onClick={() => setCurrentView('cart')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentView === 'cart' 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🛒 My Cart
                  {submissions.filter(s => s.status === 'in_progress').length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                      {submissions.filter(s => s.status === 'in_progress').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setCurrentView('responses')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentView === 'responses' 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📝 Response Room
                </button>
                <button
                  onClick={() => setCurrentView('bucket')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentView === 'bucket' 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🪣 My BUCKET
                </button>
              </div>
              
              {/* User / Sign Out */}
              <div className="flex items-center gap-2">
                {user && (
                  <span className="text-slate-500 text-sm hidden md:inline">
                    {user.email}
                  </span>
                )}
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="px-3 py-2 text-slate-400 hover:text-white text-sm"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}
      
      {/* Main Content */}
      <main>
        {renderView()}
      </main>
    </div>
  );
}

export default App;
