// ShopContracts.jsx - With Solicitation Type Detection
// Handles RFSQ, RFQ, IFB differently than RFP/Grant
// Date: December 28, 2025

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ShopContracts({ businessProfile, onSelectOpportunity }) {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    naics: '',
    hideExpired: true,
    minMatch: 0
  });
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newOpp, setNewOpp] = useState({
    title: '',
    agency: '',
    contact_name: '',
    contact_email: '',
    description: '',
    due_date: '',
    estimated_value: '',
    naics_codes: '',
    source_url: '',
    bid_type: 'rfp'
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

      if (filters.hideExpired) {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('due_date', today);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const scored = (data || []).map(opp => ({
        ...opp,
        calculatedMatch: calculateMatchScore(opp, businessProfile),
        detectedType: detectSolicitationType(opp)
      }));
      
      scored.sort((a, b) => b.calculatedMatch - a.calculatedMatch);
      setOpportunities(scored);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // DETECT SOLICITATION TYPE
  // ============================================
  const detectSolicitationType = (opp) => {
    const title = (opp.title || '').toLowerCase();
    const desc = (opp.description || '').toLowerCase();
    const bidType = (opp.bid_type || '').toLowerCase();
    
    // Check bid_type field first
    if (bidType) {
      if (bidType.includes('rfsq') || bidType === 'statement of qualifications') return 'rfsq';
      if (bidType.includes('rfq') || bidType === 'request for quote') return 'rfq';
      if (bidType.includes('ifb') || bidType === 'invitation for bid') return 'ifb';
      if (bidType.includes('grant')) return 'grant';
      if (bidType.includes('rfp')) return 'rfp';
    }
    
    // Check title
    if (title.includes('rfsq') || title.includes('statement of qualifications')) return 'rfsq';
    if (title.includes('rfq') || title.includes('request for quote')) return 'rfq';
    if (title.includes('ifb') || title.includes('invitation for bid')) return 'ifb';
    if (title.includes('grant')) return 'grant';
    
    // Check description
    if (desc.includes('statement of qualifications')) return 'rfsq';
    if (desc.includes('seek a pool of qualified contractors')) return 'rfsq';
    
    // Default to RFP
    return 'rfp';
  };

  // Get type info for display
  const getTypeInfo = (type) => {
    const types = {
      rfsq: {
        label: 'RFSQ',
        name: 'Statement of Qualifications',
        color: 'bg-purple-500/20 text-purple-400',
        requiresNarrative: false,
        description: 'This requires forms and documents - not written proposals.',
        action: 'Complete qualification forms from the source link.',
        icon: '📋'
      },
      rfq: {
        label: 'RFQ',
        name: 'Request for Quote',
        color: 'bg-blue-500/20 text-blue-400',
        requiresNarrative: false,
        description: 'They need your pricing - not a written proposal.',
        action: 'Submit your pricing/quote.',
        icon: '💰'
      },
      ifb: {
        label: 'IFB',
        name: 'Invitation for Bid',
        color: 'bg-orange-500/20 text-orange-400',
        requiresNarrative: false,
        description: 'Lowest price that meets specs wins.',
        action: 'Submit your bid price.',
        icon: '🏷️'
      },
      rfp: {
        label: 'RFP',
        name: 'Request for Proposal',
        color: 'bg-emerald-500/20 text-emerald-400',
        requiresNarrative: true,
        description: 'Requires written narrative responses.',
        action: 'Use Response Room to craft your proposal.',
        icon: '📝'
      },
      grant: {
        label: 'Grant',
        name: 'Grant Application',
        color: 'bg-amber-500/20 text-amber-400',
        requiresNarrative: true,
        description: 'Requires narrative about outcomes and impact.',
        action: 'Use Response Room to write your application.',
        icon: '🎁'
      }
    };
    return types[type] || types.rfp;
  };

  const calculateMatchScore = (opportunity, profile) => {
    if (!profile) return 50;
    
    let score = 0;
    let maxPossible = 0;

    // NAICS Match (40 points)
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

    // Keyword Match (30 points)
    maxPossible += 30;
    if (opportunity.description && profile.capabilities) {
      const desc = (opportunity.description + ' ' + opportunity.title).toLowerCase();
      const caps = Array.isArray(profile.capabilities) ? profile.capabilities : [];
      const matchingCaps = caps.filter(cap => desc.includes(cap.toLowerCase()));
      score += Math.min(30, (matchingCaps.length / Math.max(1, caps.length)) * 60);
    }

    // Past Performance (20 points)
    maxPossible += 20;
    if (profile.past_performance && profile.past_performance.length > 0) {
      score += Math.min(20, profile.past_performance.length * 5);
    }

    // Service Area (10 points)
    maxPossible += 10;
    if (profile.service_areas) {
      const serviceAreas = (profile.service_areas || '').toLowerCase();
      if (
        serviceAreas.includes('los angeles') || 
        serviceAreas.includes('california') ||
        serviceAreas.includes('nationwide')
      ) {
        score += 10;
      }
    }

    const percentage = Math.round((score / maxPossible) * 100);
    return Math.min(98, Math.max(25, percentage));
  };

  const filteredOpportunities = opportunities.filter(opp => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches = 
        opp.title?.toLowerCase().includes(q) ||
        opp.agency?.toLowerCase().includes(q) ||
        opp.description?.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (filters.minMatch && opp.calculatedMatch < filters.minMatch) return false;
    return true;
  });

  const startResponse = async (opportunity) => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          user_id: businessProfile?.id,
          opportunity_id: opportunity.id,
          title: opportunity.title,
          contract_title: opportunity.title,
          agency: opportunity.agency,
          contact_name: opportunity.contact_name || '',
          contact_email: opportunity.contact_email || '',
          description: opportunity.description || '',
          due_date: opportunity.due_date,
          estimated_value: opportunity.estimated_value,
          naics_codes: opportunity.naics_codes,
          source_url: opportunity.source_url,
          cr_match_score: opportunity.calculatedMatch,
          rfp_type: opportunity.detectedType || 'rfp',
          status: 'in_progress',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      onSelectOpportunity(data);
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to start response. Please try again.');
    }
  };

  const trackOpportunity = async (opportunity) => {
    // Save to user_opportunities for tracking without starting response
    try {
      await supabase
        .from('user_opportunities')
        .insert({
          user_id: businessProfile?.id,
          opportunity_id: opportunity.id,
          status: 'tracking',
          notes: '',
          created_at: new Date().toISOString()
        });
      alert('Opportunity saved to your tracking list.');
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleAddOpportunity = async () => {
    if (!newOpp.title || !newOpp.agency) {
      alert('Title and Agency are required.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .insert({
          title: newOpp.title,
          agency: newOpp.agency,
          contact_name: newOpp.contact_name,
          contact_email: newOpp.contact_email,
          description: newOpp.description,
          due_date: newOpp.due_date || null,
          estimated_value: newOpp.estimated_value ? parseInt(newOpp.estimated_value) : null,
          naics_codes: newOpp.naics_codes,
          source_url: newOpp.source_url,
          bid_type: newOpp.bid_type,
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
        naics_codes: '', source_url: '', bid_type: 'rfp'
      });

    } catch (err) {
      console.error('Error:', err);
      alert('Failed to add opportunity.');
    }
  };

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
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  };

  // ============================================
  // RFSQ/RFQ/IFB DETAIL VIEW (No Response Room)
  // ============================================
  const renderNonNarrativeDetail = (opp) => {
    const typeInfo = getTypeInfo(opp.detectedType);
    
    // Check what's in their Bucket for forms
    const bucketChecklist = [
      { label: 'Company Name & Address', done: !!businessProfile?.company_name },
      { label: 'EIN / Tax ID', done: !!businessProfile?.ein },
      { label: 'DUNS Number', done: !!businessProfile?.duns },
      { label: 'SAM.gov UEI', done: !!businessProfile?.sam_uei },
      { label: 'Business Licenses', done: businessProfile?.licenses?.length > 0 },
      { label: 'Insurance Certificates', done: businessProfile?.insurance?.length > 0 },
      { label: 'References (3+)', done: (businessProfile?.references?.length || 0) >= 3 },
      { label: 'Past Performance', done: (businessProfile?.past_performance?.length || 0) > 0 },
      { label: 'Key Personnel', done: (businessProfile?.key_personnel?.length || 0) > 0 },
      { label: 'Certifications (MBE, SBE, etc.)', done: businessProfile?.certifications?.length > 0 }
    ];
    
    const bucketComplete = bucketChecklist.filter(i => i.done).length;
    const bucketTotal = bucketChecklist.length;
    
    return (
      <div className="mt-4 pt-4 border-t border-slate-700">
        {/* Type Alert */}
        <div className={`${typeInfo.color} rounded-lg p-4 mb-4`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{typeInfo.icon}</span>
            <div>
              <p className="font-semibold text-white">
                This is a {typeInfo.name} ({typeInfo.label})
              </p>
              <p className="text-sm mt-1 opacity-90">{typeInfo.description}</p>
            </div>
          </div>
        </div>
        
        {/* What to do */}
        <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
          <p className="text-white font-medium mb-2">What you need to do:</p>
          <p className="text-slate-300 text-sm">{typeInfo.action}</p>
          
          {opp.source_url && (
            <a
              href={opp.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-block mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
            >
              Download Forms from Source →
            </a>
          )}
        </div>
        
        {/* Bucket Checklist for RFSQ */}
        {opp.detectedType === 'rfsq' && (
          <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
            <p className="text-white font-medium mb-2">
              Your Bucket can help ({bucketComplete}/{bucketTotal} ready)
            </p>
            <p className="text-slate-400 text-sm mb-3">
              This info from your Bucket goes on their forms:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {bucketChecklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className={item.done ? 'text-emerald-400' : 'text-slate-500'}>
                    {item.done ? '✓' : '○'}
                  </span>
                  <span className={item.done ? 'text-slate-300' : 'text-slate-500'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            {bucketComplete < bucketTotal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Navigate to bucket
                  window.location.hash = '#bucket';
                }}
                className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm"
              >
                Complete your Bucket →
              </button>
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              trackOpportunity(opp);
            }}
            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Track This Opportunity
          </button>
          {opp.source_url && (
            <a
              href={opp.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-center rounded-lg transition-colors"
            >
              Go to Source
            </a>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // RFP/GRANT DETAIL VIEW (Response Room)
  // ============================================
  const renderNarrativeDetail = (opp) => {
    const typeInfo = getTypeInfo(opp.detectedType);
    
    return (
      <div className="mt-4 pt-4 border-t border-slate-700">
        {opp.description && (
          <p className="text-slate-300 text-sm mb-4">{opp.description}</p>
        )}
        
        {opp.contact_name && (
          <p className="text-slate-500 text-sm mb-2">
            Contact: {opp.contact_name} {opp.contact_email && `(${opp.contact_email})`}
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
            View Original Posting →
          </a>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            startResponse(opp);
          }}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors"
        >
          Start Response
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Go Shopping</h1>
          <p className="text-slate-400 text-sm">Opportunities matched to your profile</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
        >
          + Add Opportunity
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500"
            />
          </div>
          <select
            value={filters.minMatch}
            onChange={(e) => setFilters({...filters, minMatch: parseInt(e.target.value) || 0})}
            className="bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
          >
            <option value="0">Any match</option>
            <option value="40">40%+</option>
            <option value="60">60%+</option>
            <option value="80">80%+</option>
          </select>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={filters.hideExpired}
              onChange={(e) => setFilters({...filters, hideExpired: e.target.checked})}
              className="rounded border-slate-600 bg-slate-900 text-emerald-500"
            />
            Hide expired
          </label>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-400">Loading...</p>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/30 rounded-xl">
          <p className="text-slate-300 mb-4">No opportunities found.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg"
          >
            + Add Opportunity
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">{filteredOpportunities.length} results</p>
          
          {filteredOpportunities.map(opp => {
            const daysUntil = getDaysUntil(opp.due_date);
            const isUrgent = daysUntil !== null && daysUntil <= 7 && daysUntil >= 0;
            const typeInfo = getTypeInfo(opp.detectedType);
            
            return (
              <div
                key={opp.id}
                onClick={() => setSelectedOpp(selectedOpp?.id === opp.id ? null : opp)}
                className={`bg-slate-800/50 rounded-xl p-6 border transition-all cursor-pointer ${
                  selectedOpp?.id === opp.id ? 'border-emerald-500' : 'border-transparent hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Match Score */}
                  <div className="text-center min-w-[70px]">
                    <div className={`text-2xl font-bold ${
                      opp.calculatedMatch >= 70 ? 'text-emerald-400' : 
                      opp.calculatedMatch >= 50 ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                      {opp.calculatedMatch}%
                    </div>
                    <div className="text-xs text-slate-500">Match</div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      {/* Type Badge */}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      
                      {isUrgent && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                          {daysUntil} days left
                        </span>
                      )}
                      
                      {/* Show if NOT narrative-based */}
                      {!typeInfo.requiresNarrative && (
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">
                          Forms Required
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-white mb-1">{opp.title}</h3>
                    
                    {/* FIXED: Agency field */}
                    <p className="text-slate-400 text-sm">{opp.agency || 'Agency not specified'}</p>
                    
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                      <span>Due: {formatDate(opp.due_date)}</span>
                      <span>{formatCurrency(opp.estimated_value)}</span>
                      
                      {/* NAICS as pills */}
                      {opp.naics_codes && (
                        <div className="flex gap-1">
                          {opp.naics_codes.split(',').slice(0, 2).map((code, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">
                              {code.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Detail */}
                {selectedOpp?.id === opp.id && (
                  typeInfo.requiresNarrative 
                    ? renderNarrativeDetail(opp)
                    : renderNonNarrativeDetail(opp)
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Add Opportunity</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={newOpp.title}
                  onChange={(e) => setNewOpp({...newOpp, title: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Agency *</label>
                  <input
                    type="text"
                    value={newOpp.agency}
                    onChange={(e) => setNewOpp({...newOpp, agency: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Solicitation Type</label>
                  <select
                    value={newOpp.bid_type}
                    onChange={(e) => setNewOpp({...newOpp, bid_type: e.target.value})}
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
                  <label className="block text-sm text-slate-300 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newOpp.contact_name}
                    onChange={(e) => setNewOpp({...newOpp, contact_name: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={newOpp.contact_email}
                    onChange={(e) => setNewOpp({...newOpp, contact_email: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-300 mb-1">Description</label>
                <textarea
                  value={newOpp.description}
                  onChange={(e) => setNewOpp({...newOpp, description: e.target.value})}
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
                  <label className="block text-sm text-slate-300 mb-1">Estimated Value</label>
                  <input
                    type="number"
                    value={newOpp.estimated_value}
                    onChange={(e) => setNewOpp({...newOpp, estimated_value: e.target.value})}
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
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddOpportunity}
                  disabled={!newOpp.title || !newOpp.agency}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-lg"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
