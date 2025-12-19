// ============================================
// ShopContracts.jsx - V2
// REAL BUCKET MATCHING - Sorted by Best Match
// ============================================

import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function ShopContracts({ session }) {
  const [profile, setProfile] = useState(null)
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [showLowMatches, setShowLowMatches] = useState(false)
  
  // Pagination
  const [displayCount, setDisplayCount] = useState(20)
  
  // Selected opportunity
  const [selectedOpp, setSelectedOpp] = useState(null)
  const [addingToCart, setAddingToCart] = useState(false)

  // Colors
  const colors = {
    primary: '#00FF00',
    gold: '#FFD700',
    background: '#000000',
    surface: '#0a0a0a',
    card: '#111111',
    text: '#FFFFFF',
    muted: '#888888',
    border: '#333333',
    lowMatch: '#FF6B6B',
    medMatch: '#FFD700',
    highMatch: '#00FF00'
  }

  // ==========================================
  // LOAD PROFILE ON MOUNT
  // ==========================================
  useEffect(() => {
    if (session?.user?.id) {
      loadProfile()
    }
  }, [session])

  const loadProfile = async () => {
    try {
      const { data } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()
      
      if (data) {
        setProfile(data)
        loadOpportunities(data)
      } else {
        // No profile yet - still load opps but with 0 scores
        loadOpportunities(null)
      }
    } catch (err) {
      console.error('Profile load error:', err)
      loadOpportunities(null)
    }
  }

  // ==========================================
  // LOAD & SCORE OPPORTUNITIES
  // ==========================================
  const loadOpportunities = async (userProfile) => {
    setLoading(true)
    setError(null)
    
    try {
      // Get active, non-expired opportunities
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('is_active', true)
        .gte('close_date', new Date().toISOString())
        .order('close_date', { ascending: true })
        .limit(1000)

      if (error) throw error
      
      if (!data || data.length === 0) {
        setOpportunities([])
        setLoading(false)
        return
      }

      // Score each opportunity against BUCKET
      const scored = data.map(opp => ({
        ...opp,
        matchScore: calculateMatchScore(opp, userProfile)
      }))

      // Sort by match score (HIGHEST FIRST)
      scored.sort((a, b) => b.matchScore.current - a.matchScore.current)

      setOpportunities(scored)
    } catch (err) {
      console.error('Load error:', err)
      setError('Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // REAL MATCH SCORING - Based on BUCKET
  // ==========================================
  const calculateMatchScore = (opp, userProfile) => {
    // No profile = 0% match
    if (!userProfile) {
      return { current: 0, potential: 40, breakdown: {}, matchLevel: 'none' }
    }

    let score = 0
    const breakdown = {}
    const oppText = `${opp.title || ''} ${opp.commodity_description || ''} ${opp.naics_code || ''}`.toLowerCase()

    // ============================================
    // 1. NAICS CODE MATCH (0-40 points)
    // Match on KEYWORDS from NAICS descriptions
    // ============================================
    const userNaics = userProfile.naics_codes || []
    let naicsMatched = false
    let matchedCode = null

    for (const naicsItem of userNaics) {
      const code = (naicsItem.code || naicsItem || '').toString()
      const description = (naicsItem.description || '').toLowerCase()
      if (!code) continue

      // First: Direct NAICS code match (if opp has naics_code field)
      if (opp.naics_code) {
        const oppNaics = opp.naics_code.toString()
        const code4 = code.substring(0, 4)
        if (oppNaics.startsWith(code4) || code.startsWith(oppNaics.substring(0, 4))) {
          naicsMatched = true
          matchedCode = description || code
          score += 40
          breakdown.naics = { points: 40, matched: description || code }
          break
        }
      }
      
      // Second: KEYWORD matching from NAICS description
      // Extract meaningful keywords from the NAICS description
      if (!naicsMatched && description) {
        const keywords = description.split(/[\s,]+/).filter(w => w.length > 4)
        for (const keyword of keywords) {
          if (oppText.includes(keyword)) {
            naicsMatched = true
            matchedCode = description
            score += 35
            breakdown.naics = { points: 35, matched: `${keyword} (${code})` }
            break
          }
        }
        if (naicsMatched) break
      }

      // Third: Check common industry keywords based on NAICS code prefix
      if (!naicsMatched) {
        const industryKeywords = getNaicsKeywords(code)
        for (const keyword of industryKeywords) {
          if (oppText.includes(keyword)) {
            naicsMatched = true
            matchedCode = keyword
            score += 30
            breakdown.naics = { points: 30, matched: keyword }
            break
          }
        }
        if (naicsMatched) break
      }
    }

    if (!naicsMatched && userNaics.length > 0) {
      breakdown.naics = { points: 0, matched: null }
    }

    // ============================================
    // 2. SERVICES/KEYWORDS MATCH (0-25 points)
    // Check if user's services appear in description
    // ============================================
    const userServices = userProfile.services || []
    let serviceMatched = false
    let matchedService = null

    // Create keyword list from services
    const serviceKeywords = []
    for (const svc of userServices) {
      const name = (svc.category || svc.name || svc || '').toLowerCase()
      if (name) {
        serviceKeywords.push(name)
        // Also add individual words
        name.split(/[\s,]+/).forEach(word => {
          if (word.length > 3) serviceKeywords.push(word)
        })
      }
    }

    // Check for matches
    for (const keyword of serviceKeywords) {
      if (keyword.length > 3 && oppText.includes(keyword)) {
        serviceMatched = true
        matchedService = keyword
        score += 25
        breakdown.services = { points: 25, matched: keyword }
        break
      }
    }

    if (!serviceMatched && userServices.length > 0) {
      breakdown.services = { points: 0, matched: null }
    }

    // ============================================
    // 3. LOCATION MATCH (0-20 points)
    // ============================================
    const userState = userProfile.state
    const oppState = opp.state

    if (userState && oppState) {
      if (userState === oppState) {
        score += 20
        breakdown.location = { points: 20, matched: oppState }
      } else {
        breakdown.location = { points: 0, matched: null, userState, oppState }
      }
    } else if (!oppState) {
      // No location requirement = available to all
      score += 10
      breakdown.location = { points: 10, matched: 'Open to all locations' }
    }

    // ============================================
    // 4. CERTIFICATIONS BONUS (0-10 points)
    // ============================================
    const userCerts = userProfile.certifications || []
    if (userCerts.length > 0) {
      // Check if any cert keywords in description
      const certKeywords = ['small business', 'minority', 'woman', 'veteran', 'dvbe', 'mbe', 'wbe', 'sbe', 'dbe', '8(a)', 'hubzone']
      for (const kw of certKeywords) {
        if (oppText.includes(kw)) {
          score += 10
          breakdown.certifications = { points: 10, matched: kw }
          break
        }
      }
    }

    // ============================================
    // 5. PAST PERFORMANCE BONUS (0-5 points)
    // ============================================
    const pastPerf = userProfile.past_performance || []
    if (pastPerf.length > 0) {
      score += 5
      breakdown.pastPerformance = { points: 5 }
    }

    // ============================================
    // DETERMINE MATCH LEVEL
    // ============================================
    let matchLevel = 'low'
    if (score >= 60) matchLevel = 'high'
    else if (score >= 35) matchLevel = 'medium'
    else if (score > 0) matchLevel = 'low'
    else matchLevel = 'none'

    // CR-AI potential boost (max +30)
    const potential = Math.min(score + 30, 95)

    return {
      current: Math.min(score, 100),
      potential,
      breakdown,
      matchLevel,
      naicsMatched,
      serviceMatched
    }
  }

  // ==========================================
  // FILTER OPPORTUNITIES
  // ==========================================
  const getFilteredOpportunities = () => {
    let filtered = [...opportunities]

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(opp => 
        (opp.title || '').toLowerCase().includes(term) ||
        (opp.commodity_description || '').toLowerCase().includes(term) ||
        (opp.contact_name || '').toLowerCase().includes(term)
      )
    }

    // State filter
    if (stateFilter) {
      filtered = filtered.filter(opp => opp.state === stateFilter)
    }

    // Hide low matches by default (unless toggled)
    if (!showLowMatches) {
      filtered = filtered.filter(opp => opp.matchScore.current >= 20)
    }

    return filtered
  }

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getDaysLeft = (dateStr) => {
    if (!dateStr) return null
    const due = new Date(dateStr)
    const now = new Date()
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getScoreColor = (score) => {
    if (score >= 60) return colors.highMatch
    if (score >= 35) return colors.medMatch
    if (score > 0) return colors.lowMatch
    return colors.muted
  }

  // Helper: Get industry keywords based on NAICS code prefix
  const getNaicsKeywords = (code) => {
    const prefix = code.substring(0, 4)
    const keywords = {
      // Professional Services
      '5411': ['legal', 'attorney', 'law'],
      '5412': ['accounting', 'bookkeeping', 'audit', 'tax'],
      '5413': ['architect', 'engineering', 'design'],
      '5414': ['graphic', 'design', 'interior'],
      '5415': ['computer', 'software', 'programming', 'IT', 'technology'],
      '5416': ['management', 'consulting', 'strategic', 'marketing'],
      '5417': ['research', 'scientific', 'laboratory'],
      '5418': ['advertising', 'public relations', 'media', 'marketing', 'communications'],
      '5419': ['veterinary', 'photography'],
      // Healthcare
      '6211': ['physician', 'doctor', 'medical'],
      '6212': ['dental', 'dentist'],
      '6213': ['mental health', 'behavioral', 'counseling', 'therapy', 'psychiatric', 'psychologist'],
      '6214': ['outpatient', 'clinic', 'health center', 'mental health'],
      '6215': ['laboratory', 'diagnostic'],
      '6216': ['home health', 'nursing'],
      '6219': ['ambulance', 'emergency'],
      // Social Services
      '6241': ['family', 'individual', 'social', 'community', 'youth', 'child', 'services'],
      '6242': ['emergency', 'relief', 'shelter'],
      '6243': ['vocational', 'rehabilitation', 'training', 'workforce'],
      '6244': ['child care', 'daycare', 'childcare'],
      // Arts/Entertainment
      '7111': ['performing arts', 'theater', 'theatre', 'concert'],
      '7112': ['spectator sports', 'sports'],
      '7113': ['promoter', 'event', 'arts', 'entertainment', 'concert', 'festival'],
      '7114': ['agent', 'manager', 'talent'],
      '7115': ['artist', 'writer', 'performer'],
      // Education
      '6111': ['elementary', 'secondary', 'school'],
      '6112': ['college', 'university'],
      '6113': ['college', 'junior'],
      '6114': ['business school', 'training'],
      '6115': ['trade school', 'technical'],
      '6116': ['education support', 'tutoring'],
      '6117': ['education support']
    }
    return keywords[prefix] || []
  }

  const getMatchLabel = (matchLevel) => {
    switch (matchLevel) {
      case 'high': return '🎯 Strong Match'
      case 'medium': return '✨ Good Potential'
      case 'low': return '📋 Review Needed'
      default: return '❌ Low Match'
    }
  }

  // Get unique states for filter
  const availableStates = [...new Set(opportunities.map(o => o.state).filter(Boolean))].sort()

  // ==========================================
  // START RESPONSE
  // ==========================================
  const startResponse = async (opportunity) => {
    if (!session?.user?.id) return
    
    setAddingToCart(true)
    
    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('submissions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('title', opportunity.title || opportunity.commodity_description)
        .single()
      
      if (existing) {
        alert('✅ Already in your Response Room!')
        setAddingToCart(false)
        setSelectedOpp(null)
        return
      }
      
      // Add to submissions
      const { error } = await supabase
        .from('submissions')
        .insert({
          user_id: session.user.id,
          title: opportunity.title || opportunity.commodity_description || 'Untitled',
          agency: opportunity.contact_name || 'Agency not specified',
          due_date: opportunity.close_date,
          status: 'in_progress',
          source_url: opportunity.source_url || '',
          description: opportunity.commodity_description || '',
          contact_email: opportunity.contact_email || '',
          contact_phone: opportunity.contact_phone || '',
          location: opportunity.state || '',
          match_score: opportunity.matchScore?.current || 0,
          created_at: new Date().toISOString()
        })
      
      if (error) throw error
      
      alert('✅ Added to Response Room! Go there to start your response.')
      setSelectedOpp(null)
      
    } catch (err) {
      console.error('Error:', err)
      alert('Failed to add. Please try again.')
    } finally {
      setAddingToCart(false)
    }
  }

  // ==========================================
  // RENDER
  // ==========================================
  const filtered = getFilteredOpportunities()
  const displayed = filtered.slice(0, displayCount)
  const hasMore = filtered.length > displayCount

  // Count matches by level
  const highMatches = opportunities.filter(o => o.matchScore.current >= 60).length
  const medMatches = opportunities.filter(o => o.matchScore.current >= 35 && o.matchScore.current < 60).length
  const lowMatches = opportunities.filter(o => o.matchScore.current > 0 && o.matchScore.current < 35).length

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: colors.background,
      paddingBottom: '100px'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '30px',
        borderBottom: `1px solid ${colors.border}`
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ color: colors.text, margin: '0 0 10px 0', fontSize: '28px' }}>
            🛍️ Go Shopping
          </h1>
          
          {/* BUCKET Status */}
          {profile ? (
            <div style={{ 
              backgroundColor: colors.card,
              padding: '15px 20px',
              borderRadius: '10px',
              border: `1px solid ${colors.primary}30`,
              marginBottom: '20px'
            }}>
              <p style={{ color: colors.primary, margin: 0, fontSize: '14px', fontWeight: '600' }}>
                🪣 YOUR BUCKET IS READY
              </p>
              <p style={{ color: colors.muted, margin: '5px 0 0 0', fontSize: '13px' }}>
                {profile.naics_codes?.length || 0} NAICS codes • 
                {profile.services?.length || 0} services • 
                {profile.state || 'No location set'}
              </p>
            </div>
          ) : (
            <div style={{ 
              backgroundColor: colors.card,
              padding: '15px 20px',
              borderRadius: '10px',
              border: `1px solid ${colors.gold}`,
              marginBottom: '20px'
            }}>
              <p style={{ color: colors.gold, margin: 0, fontSize: '14px', fontWeight: '600' }}>
                ⚠️ Build Your BUCKET First
              </p>
              <p style={{ color: colors.muted, margin: '5px 0 0 0', fontSize: '13px' }}>
                Add NAICS codes and services to see matched opportunities
              </p>
            </div>
          )}

          {/* Match Summary */}
          {profile && !loading && (
            <div style={{ 
              display: 'flex', 
              gap: '15px', 
              marginBottom: '20px',
              flexWrap: 'wrap'
            }}>
              <div style={{ 
                backgroundColor: colors.card,
                padding: '10px 15px',
                borderRadius: '8px',
                border: `1px solid ${colors.highMatch}50`
              }}>
                <span style={{ color: colors.highMatch, fontWeight: '700', fontSize: '18px' }}>{highMatches}</span>
                <span style={{ color: colors.muted, fontSize: '13px', marginLeft: '8px' }}>Strong Matches</span>
              </div>
              <div style={{ 
                backgroundColor: colors.card,
                padding: '10px 15px',
                borderRadius: '8px',
                border: `1px solid ${colors.medMatch}50`
              }}>
                <span style={{ color: colors.medMatch, fontWeight: '700', fontSize: '18px' }}>{medMatches}</span>
                <span style={{ color: colors.muted, fontSize: '13px', marginLeft: '8px' }}>Good Potential</span>
              </div>
              <div style={{ 
                backgroundColor: colors.card,
                padding: '10px 15px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`
              }}>
                <span style={{ color: colors.muted, fontWeight: '700', fontSize: '18px' }}>{lowMatches}</span>
                <span style={{ color: colors.muted, fontSize: '13px', marginLeft: '8px' }}>Low Match</span>
              </div>
            </div>
          )}

          {/* Search & Filters */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: '1',
                minWidth: '200px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.card,
                color: colors.text,
                fontSize: '14px'
              }}
            />
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.card,
                color: colors.text,
                fontSize: '14px',
                minWidth: '150px'
              }}
            >
              <option value="">All States</option>
              {availableStates.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              color: colors.muted,
              fontSize: '13px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={showLowMatches}
                onChange={(e) => setShowLowMatches(e.target.checked)}
              />
              Show low matches
            </label>
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <p style={{ color: colors.primary, fontSize: '18px' }}>Loading opportunities...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <p style={{ color: colors.lowMatch }}>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px',
            backgroundColor: colors.card,
            borderRadius: '16px',
            border: `1px solid ${colors.border}`
          }}>
            <p style={{ color: colors.text, fontSize: '18px', margin: '0 0 10px 0' }}>
              No matching opportunities found
            </p>
            <p style={{ color: colors.muted, margin: '0 0 20px 0' }}>
              {!showLowMatches ? 'Try enabling "Show low matches" or adjust your BUCKET' : 'Try adjusting your search or filters'}
            </p>
            {!showLowMatches && (
              <button
                onClick={() => setShowLowMatches(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.primary}`,
                  borderRadius: '8px',
                  color: colors.primary,
                  cursor: 'pointer'
                }}
              >
                Show All Opportunities
              </button>
            )}
          </div>
        ) : (
          <>
            <p style={{ color: colors.muted, marginBottom: '20px', fontSize: '14px' }}>
              Showing {displayed.length} of {filtered.length} opportunities (sorted by best match)
            </p>

            {/* Opportunity Cards */}
            <div style={{ display: 'grid', gap: '15px' }}>
              {displayed.map((opp, i) => {
                const score = opp.matchScore
                const daysLeft = getDaysLeft(opp.close_date)
                
                return (
                  <div
                    key={opp.id || i}
                    onClick={() => setSelectedOpp(opp)}
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: '12px',
                      padding: '20px',
                      border: `1px solid ${score.current >= 60 ? colors.highMatch + '50' : score.current >= 35 ? colors.medMatch + '30' : colors.border}`,
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '20px',
                      alignItems: 'center'
                    }}
                  >
                    {/* Left: Info */}
                    <div>
                      {/* Badges */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {daysLeft !== null && daysLeft <= 7 && (
                          <span style={{
                            backgroundColor: daysLeft <= 3 ? colors.lowMatch : colors.gold,
                            color: colors.background,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            ⏰ {daysLeft} days left
                          </span>
                        )}
                        <span style={{
                          backgroundColor: getScoreColor(score.current) + '20',
                          color: getScoreColor(score.current),
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {getMatchLabel(score.matchLevel)}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{ 
                        color: colors.text, 
                        margin: '0 0 8px 0',
                        fontSize: '16px',
                        lineHeight: '1.4'
                      }}>
                        {opp.title || opp.commodity_description || 'Untitled Opportunity'}
                      </h3>

                      {/* Meta */}
                      <p style={{ color: colors.muted, margin: 0, fontSize: '13px' }}>
                        {opp.contact_name || 'Agency not specified'} • {opp.state || 'Location not specified'}
                      </p>
                      <p style={{ color: colors.muted, margin: '4px 0 0 0', fontSize: '12px' }}>
                        📅 Due: {formatDate(opp.close_date)}
                      </p>
                    </div>

                    {/* Right: Score */}
                    <div style={{ textAlign: 'right', minWidth: '100px' }}>
                      <p style={{ color: colors.muted, margin: '0 0 4px 0', fontSize: '10px', textTransform: 'uppercase' }}>
                        YOUR SCORE
                      </p>
                      <p style={{ 
                        color: getScoreColor(score.current),
                        fontSize: '28px',
                        fontWeight: '700',
                        margin: '0 0 4px 0'
                      }}>
                        {score.current}%
                      </p>
                      <p style={{ color: colors.primary, margin: 0, fontSize: '11px' }}>
                        → {score.potential}% <span style={{ opacity: 0.7 }}>with CR-AI</span>
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Load More */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <button
                  onClick={() => setDisplayCount(displayCount + 20)}
                  style={{
                    padding: '12px 30px',
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.primary}`,
                    borderRadius: '8px',
                    color: colors.primary,
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Load More ({filtered.length - displayCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOpp && (
        <div
          onClick={() => setSelectedOpp(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderRadius: '16px',
              padding: '30px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              border: `1px solid ${colors.border}`
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: colors.text, margin: 0, fontSize: '20px', flex: 1, paddingRight: '20px', lineHeight: '1.4' }}>
                {selectedOpp.title || selectedOpp.commodity_description || 'Opportunity Details'}
              </h2>
              <button
                onClick={() => setSelectedOpp(null)}
                style={{ background: 'none', border: 'none', color: colors.muted, fontSize: '28px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Score Display */}
            {(() => {
              const score = selectedOpp.matchScore
              return (
                <div style={{
                  backgroundColor: colors.surface,
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '20px',
                  border: `1px solid ${getScoreColor(score.current)}30`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                    <div>
                      <p style={{ color: colors.muted, fontSize: '11px', margin: '0 0 5px 0' }}>YOUR SCORE</p>
                      <p style={{ color: getScoreColor(score.current), fontSize: '36px', fontWeight: '700', margin: 0 }}>
                        {score.current}%
                      </p>
                    </div>
                    <div style={{ color: colors.muted, fontSize: '24px', alignSelf: 'center' }}>→</div>
                    <div>
                      <p style={{ color: colors.muted, fontSize: '11px', margin: '0 0 5px 0' }}>WITH CR-AI</p>
                      <p style={{ color: colors.primary, fontSize: '36px', fontWeight: '700', margin: 0 }}>
                        {score.potential}% ✨
                      </p>
                    </div>
                  </div>
                  
                  {/* Match Breakdown */}
                  {score.breakdown && Object.keys(score.breakdown).length > 0 && (
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: `1px solid ${colors.border}` }}>
                      <p style={{ color: colors.muted, fontSize: '11px', margin: '0 0 8px 0' }}>MATCH BREAKDOWN:</p>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {score.breakdown.naics && (
                          <span style={{ 
                            backgroundColor: score.breakdown.naics.points > 0 ? colors.highMatch + '20' : colors.lowMatch + '20',
                            color: score.breakdown.naics.points > 0 ? colors.highMatch : colors.lowMatch,
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}>
                            NAICS: {score.breakdown.naics.points > 0 ? `+${score.breakdown.naics.points}` : 'No match'}
                          </span>
                        )}
                        {score.breakdown.services && (
                          <span style={{ 
                            backgroundColor: score.breakdown.services.points > 0 ? colors.highMatch + '20' : colors.lowMatch + '20',
                            color: score.breakdown.services.points > 0 ? colors.highMatch : colors.lowMatch,
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}>
                            Services: {score.breakdown.services.points > 0 ? `+${score.breakdown.services.points}` : 'No match'}
                          </span>
                        )}
                        {score.breakdown.location && (
                          <span style={{ 
                            backgroundColor: score.breakdown.location.points > 0 ? colors.highMatch + '20' : colors.medMatch + '20',
                            color: score.breakdown.location.points > 0 ? colors.highMatch : colors.medMatch,
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}>
                            Location: {score.breakdown.location.points > 0 ? `+${score.breakdown.location.points}` : 'Different state'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Empowering Message */}
                  <p style={{ 
                    color: colors.primary, 
                    textAlign: 'center', 
                    marginTop: '15px',
                    marginBottom: 0,
                    fontSize: '14px'
                  }}>
                    {score.current >= 60 
                      ? "🎯 Strong match! You're competitive for this one."
                      : score.current >= 35 
                        ? "✨ Good potential. BUCKET + CR-AI can help you win."
                        : score.current > 0
                          ? "📋 Worth reviewing. CR-AI can help identify gaps."
                          : "Consider updating your BUCKET with relevant NAICS codes."}
                  </p>
                </div>
              )
            })()}

            {/* Details */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <p style={{ color: colors.muted, fontSize: '11px', margin: '0 0 4px 0' }}>DUE DATE</p>
                  <p style={{ color: colors.text, margin: 0, fontWeight: '500' }}>{formatDate(selectedOpp.close_date)}</p>
                </div>
                <div>
                  <p style={{ color: colors.muted, fontSize: '11px', margin: '0 0 4px 0' }}>LOCATION</p>
                  <p style={{ color: colors.text, margin: 0, fontWeight: '500' }}>{selectedOpp.state || 'Not specified'}</p>
                </div>
              </div>
              
              {selectedOpp.commodity_description && (
                <div>
                  <p style={{ color: colors.muted, fontSize: '11px', margin: '0 0 8px 0' }}>DESCRIPTION</p>
                  <p style={{ color: colors.text, margin: 0, lineHeight: '1.6', fontSize: '14px' }}>
                    {selectedOpp.commodity_description}
                  </p>
                </div>
              )}

              {selectedOpp.contact_name && (
                <div style={{ marginTop: '15px' }}>
                  <p style={{ color: colors.muted, fontSize: '11px', margin: '0 0 4px 0' }}>CONTACT</p>
                  <p style={{ color: colors.text, margin: 0, fontSize: '14px' }}>
                    {selectedOpp.contact_name}
                    {selectedOpp.contact_email && ` • ${selectedOpp.contact_email}`}
                    {selectedOpp.contact_phone && ` • ${selectedOpp.contact_phone}`}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gap: '10px' }}>
              <button
                onClick={() => startResponse(selectedOpp)}
                disabled={addingToCart}
                style={{
                  padding: '14px',
                  backgroundColor: colors.primary,
                  border: 'none',
                  borderRadius: '8px',
                  color: colors.background,
                  cursor: addingToCart ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '700'
                }}
              >
                {addingToCart ? 'Adding...' : '📝 Start Response'}
              </button>
              <button
                onClick={() => setSelectedOpp(null)}
                style={{
                  padding: '14px',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.text,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
