// ShopContracts.jsx - FIXED with correct field mappings & PhD voice
// Date: December 28, 2025
// Fixes: Agency field, match score calculation, NAICS pills, encouraging messages

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ShopContracts({ businessProfile, onSelectOpportunity }) {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    naics: '',
    agency: '',
    hideExpired: true,
    minMatch: 0
  });
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New opportunity form - FIXED field names
  const [newOpp, setNewOpp] = useState({
    title: '',
    agency: '',           // CORRECT: Agency name (e.g., "LA County DCFS")
    contact_name: '',     // SEPARATE: Contact person name
    contact_email: '',
    description: '',
    due_date: '',
    estimated_value: '',  // CORRECT: Use estimated_value not funding
    naics_codes: '',
    source_url: '',
    rfp_type: 'rfp'
  });

  useEffect(() => {
    loadOpportunities();
  }, [filters.hideExpired]);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('opportunities')
        .select('*')
        .order('due_date', { ascending: true });

      // Filter expired
      if (filters.hideExpired) {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('due_date', today);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Calculate match scores
      const scored = (data || []).map(opp => ({
        ...opp,
        calculatedMatch: calculateMatchScore(opp, businessProfile)
      }));
      
      // Sort by match score (highest first)
      scored.sort((a, b) => b.calculatedMatch - a.calculatedMatch);
      
      setOpportunities(scored);
    } catch (err) {
      console.error('Error loading opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // MATCH SCORE CALCULATION - REAL ALGORITHM
  // ============================================
  const calculateMatchScore = (opportunity, profile) => {
    if (!profile) return 50;
    
    let score = 0;
    let maxPossible = 0;

    // 1. NAICS Code Match (40 points max)
    maxPossible += 40;
    if (opportunity.naics_codes && profile.naics_codes) {
      const oppNaics = (opportunity.naics_codes || '').split(',').map(n => n.trim()).filter(Boolean);
      const profileNaics = Array.isArray(profile.naics_codes) ? profile.naics_codes : [];
      
      if (oppNaics.length > 0 && profileNaics.length > 0) {
        const matches = oppNaics.filter(n => 
          profileNaics.some(pn => pn.startsWith(n.substring(0, 4)) || n.startsWith(pn.substring(0, 4)))
        );
        score += Math.min(40, (matches.length / oppNaics.length) * 40);
      }
    }

    // 2. Keyword/Capability Match (30 points max)
    maxPossible += 30;
    if (opportunity.description && profile.capabilities) {
      const desc = (opportunity.description + ' ' + opportunity.title).toLowerCase();
      const caps = Array.isArray(profile.capabilities) ? profile.capabilities : [];
      const matchingCaps = caps.filter(cap => 
        desc.includes(cap.toLowerCase())
      );
      score += Math.min(30, (matchingCaps.length / Math.max(1, caps.length)) * 60);
    }

    // 3. Past Performance Relevance (20 points max)
    maxPossible += 20;
    if (profile.past_performance && profile.past_performance.length > 0) {
      const oppText = (opportunity.title + ' ' + opportunity.description).toLowerCase();
      const relevantPP = profile.past_performance.filter(pp => {
        const ppText = ((pp.project_name || '') + ' ' + (pp.description || '')).toLowerCase();
        // Check for keyword overlap
        const oppWords = oppText.split(/\s+/).filter(w => w.length > 4);
        const matches = oppWords.filter(w => ppText.includes(w));
        return matches.length > 2;
      });
      score += Math.min(20, relevantPP.length * 10);
    }

    // 4. Service Area Match (10 points max)
    maxPossible += 10;
    if (profile.service_areas) {
      const serviceAreas = (profile.service_areas || '').toLowerCase();
      const location = (opportunity.location || opportunity.agency || '').toLowerCase();
      if (
        serviceAreas.includes('los angeles') || 
        serviceAreas.includes('la county') ||
        location.includes('los angeles') ||
        serviceAreas.includes('california') ||
        serviceAreas.includes('nationwide')
      ) {
        score += 10;
      }
    }

    // Ensure minimum score of 25% and max of 98%
    const percentage = Math.round((score / maxPossible) * 100);
    return Math.min(98, Math.max(25, percentage));
  };

  // Filter opportunities
  const filteredOpportunities = opportunities.filter(opp => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches = 
        opp.title?.toLowerCase().includes(q) ||
        opp.agency?.toLowerCase().includes(q) ||
        opp.description?.toLowerCase().includes(q) ||
        opp.naics_codes?.toLowerCase().includes(q);
      if (!matches) return false;
    }

    if (filters.naics && !opp.naics_codes?.includes(filters.naics)) {
      return false;
    }

    if (filters.minMatch && opp.calculatedMatch < filters.minMatch) {
      return false;
    }

    return true;
  });

  // Start response - FIXED field mappings
  const startResponse = async (opportunity) => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          user_id: businessProfile?.id,
          opportunity_id: opportunity.id,
          title: opportunity.title,
          contract_title: opportunity.title,
          // FIXED: Use correct field names
          agency: opportunity.agency,                    // Agency name, NOT contact
          contact_name: opportunity.contact_name || '',  // Contact person (separate)
          contact_email: opportunity.contact_email || '',
          description: opportunity.description || '',
          due_date: opportunity.due_date,
          estimated_value: opportunity.estimated_value,  // FIXED: Use estimated_value
          naics_codes: opportunity.naics_codes,
          source_url: opportunity.source_url,
          // FIXED: Use cr_match_score
          cr_match_score: opportunity.calculatedMatch,
          rfp_type: opportunity.rfp_type || 'rfp',
          status: 'in_progress',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      onSelectOpportunity(data);
    } catch (err) {
      console.error('Error starting response:', err);
      alert('Something went wrong. Let\'s try that again.');
    }
  };

  // Add new opportunity - FIXED field mappings
  const handleAddOpportunity = async () => {
    if (!newOpp.title || !newOpp.agency) {
      alert('Please add at least a title and agency name.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .insert({
          title: newOpp.title,
          agency: newOpp.agency,                    // CORRECT field
          contact_name: newOpp.contact_name,        // SEPARATE field
          contact_email: newOpp.contact_email,
          description: newOpp.description,
          due_date: newOpp.due_date || null,
          estimated_value: newOpp.estimated_value ? parseInt(newOpp.estimated_value) : null,
          naics_codes: newOpp.naics_codes,
          source_url: newOpp.source_url,
          rfp_type: newOpp.rfp_type,
          created_by: businessProfile?.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      loadOpportunities();
      setShowAddModal(false);
      setNewOpp({
        title: '', agency: '', contact_name: '', contact_email: '',
        description: '', due_date: '', estimated_value: '',
        naics_codes: '', source_url: '', rfp_type: 'rfp'
      });

      if (window.confirm('Great! Want to start your response now?')) {
        startResponse({ ...data, calculatedMatch: calculateMatchScore(data, businessProfile) });
      }
    } catch (err) {
      console.error('Error adding opportunity:', err);
      alert('Something went wrong. Let\'s try that again.');
    }
  };

  // Helpers
  const formatCurrency = (val) => {
    if (!val) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric' 
    });
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getMatchColor = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-lime-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-slate-400';
  };

  const getMatchLabel = (score) => {
    if (score >= 80) return 'Strong Match';
    if (score >= 60) return 'Good Match';
    if (score >= 40) return 'Moderate Match';
    return 'Low Match';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header with PhD voice */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">🛒 Go Shopping</h1>
          <p className="text-slate-400">
            I've matched these opportunities to your Bucket. Higher percentages = better fit.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
        >
          + Add One I Found
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, agency, NAICS, or keywords..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500"
            />
          </div>
          <select
            value={filters.naics}
            onChange={(e) => setFilters({...filters, naics: e.target.value})}
            className="bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
          >
            <option value="">All NAICS</option>
            {businessProfile?.naics_codes?.map(code => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
          <select
            value={filters.minMatch}
            onChange={(e) => setFilters({...filters, minMatch: parseInt(e.target.value) || 0})}
            className="bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
          >
            <option value="0">Any match %</option>
            <option value="40">40%+ match</option>
            <option value="60">60%+ match</option>
            <option value="80">80%+ match</option>
          </select>
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hideExpired}
              onChange={(e) => setFilters({...filters, hideExpired: e.target.checked})}
              className="rounded border-slate-600 bg-slate-900 text-emerald-500"
            />
            Hide past due dates
          </label>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4 animate-pulse">🔍</div>
          <p className="text-slate-400">Finding opportunities that match your Bucket...</p>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/30 rounded-xl">
          <div className="text-4xl mb-4">🎯</div>
          <p className="text-slate-300 mb-2">No opportunities match your current filters.</p>
          <p className="text-slate-500 text-sm mb-4">
            Try adjusting your search, or add an opportunity you've found.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            + Add One I Found
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Results count */}
          <p className="text-slate-400 text-sm">
            {filteredOpportunities.length} opportunit{filteredOpportunities.length === 1 ? 'y' : 'ies'} found
          </p>
          
          {filteredOpportunities.map(opp => {
            const daysUntil = getDaysUntil(opp.due_date);
            const isUrgent = daysUntil !== null && daysUntil <= 7 && daysUntil >= 0;
            const isPast = daysUntil !== null && daysUntil < 0;
            
            return (
              <div
                key={opp.id}
                onClick={() => setSelectedOpp(selectedOpp?.id === opp.id ? null : opp)}
                className={`bg-slate-800/50 rounded-xl p-6 border-2 transition-all cursor-pointer ${
                  selectedOpp?.id === opp.id 
                    ? 'border-emerald-500' 
                    : isUrgent 
                      ? 'border-amber-500/50 hover:border-amber-500' 
                      : 'border-transparent hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Match Score */}
                  <div className="text-center min-w-[80px]">
                    <div className={`text-3xl font-bold ${getMatchColor(opp.calculatedMatch)}`}>
                      {opp.calculatedMatch}%
                    </div>
                    <div className="text-xs text-slate-500">{getMatchLabel(opp.calculatedMatch)}</div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          {isUrgent && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                              ⚡ {daysUntil} day{daysUntil !== 1 ? 's' : ''} left
                            </span>
                          )}
                          {isPast && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                              Past due
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded-full uppercase">
                            {opp.rfp_type || 'RFP'}
                          </span>
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-lg font-semibold text-white mb-1 line-clamp-2">
                          {opp.title}
                        </h3>
                        
                        {/* FIXED: Agency - shows actual agency, not contact name */}
                        <p className="text-slate-400 text-sm">
                          🏛️ {opp.agency || 'Agency not specified'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Meta info */}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
                      <span>📅 {formatDate(opp.due_date)}</span>
                      <span>💰 {formatCurrency(opp.estimated_value)}</span>
                      
                      {/* NAICS as pills - FIXED formatting */}
                      {opp.naics_codes && (
                        <div className="flex gap-1">
                          {opp.naics_codes.split(',').slice(0, 3).map((code, i) => (
                            <span 
                              key={i}
                              className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded"
                            >
                              {code.trim()}
                            </span>
                          ))}
                          {opp.naics_codes.split(',').length > 3 && (
                            <span className="text-slate-500 text-xs">+{opp.naics_codes.split(',').length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded content */}
                {selectedOpp?.id === opp.id && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    {opp.description && (
                      <p className="text-slate-300 text-sm mb-4 line-clamp-4">
                        {opp.description}
                      </p>
                    )}
                    
                    {opp.contact_name && (
                      <p className="text-slate-500 text-sm mb-2">
                        📧 Contact: {opp.contact_name} 
                        {opp.contact_email && ` (${opp.contact_email})`}
                      </p>
                    )}
                    
                    {opp.source_url && (
                      <a
                        href={opp.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-emerald-400 hover:text-emerald-300 text-sm inline-block mb-4"
                      >
                        🔗 View Original Posting →
                      </a>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startResponse(opp);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition-colors"
                    >
                      🚀 Start My Response
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Opportunity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Add an Opportunity</h2>
                <p className="text-slate-400 text-sm">Found something good? Let's add it to your list.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Opportunity Title <span className="text-emerald-400">REQUIRED</span>
                </label>
                <input
                  type="text"
                  value={newOpp.title}
                  onChange={(e) => setNewOpp({...newOpp, title: e.target.value})}
                  placeholder="e.g., Foster Care Placement Services RFP"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Agency/Organization <span className="text-emerald-400">REQUIRED</span>
                  </label>
                  <input
                    type="text"
                    value={newOpp.agency}
                    onChange={(e) => setNewOpp({...newOpp, agency: e.target.value})}
                    placeholder="e.g., LA County DCFS"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Solicitation Type</label>
                  <select
                    value={newOpp.rfp_type}
                    onChange={(e) => setNewOpp({...newOpp, rfp_type: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  >
                    <option value="rfp">RFP - Request for Proposal</option>
                    <option value="rfsq">RFSQ - Statement of Qualifications</option>
                    <option value="rfq">RFQ - Request for Quote</option>
                    <option value="ifb">IFB - Invitation for Bid</option>
                    <option value="grant">Grant Application</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={newOpp.contact_name}
                    onChange={(e) => setNewOpp({...newOpp, contact_name: e.target.value})}
                    placeholder="e.g., Jose Ramos"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={newOpp.contact_email}
                    onChange={(e) => setNewOpp({...newOpp, contact_email: e.target.value})}
                    placeholder="contact@agency.gov"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-300 mb-1">Description</label>
                <textarea
                  value={newOpp.description}
                  onChange={(e) => setNewOpp({...newOpp, description: e.target.value})}
                  placeholder="Brief description of what they're looking for..."
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white min-h-[100px]"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newOpp.due_date}
                    onChange={(e) => setNewOpp({...newOpp, due_date: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Estimated Value ($)</label>
                  <input
                    type="number"
                    value={newOpp.estimated_value}
                    onChange={(e) => setNewOpp({...newOpp, estimated_value: e.target.value})}
                    placeholder="e.g., 500000"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">NAICS Codes</label>
                  <input
                    type="text"
                    value={newOpp.naics_codes}
                    onChange={(e) => setNewOpp({...newOpp, naics_codes: e.target.value})}
                    placeholder="e.g., 624110, 624221"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Source URL</label>
                  <input
                    type="url"
                    value={newOpp.source_url}
                    onChange={(e) => setNewOpp({...newOpp, source_url: e.target.value})}
                    placeholder="https://..."
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddOpportunity}
                  disabled={!newOpp.title || !newOpp.agency}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Add Opportunity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
