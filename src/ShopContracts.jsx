// ============================================
// ShopContracts.jsx - V3
// STRICT BUCKET MATCHING - PHRASES ONLY
// No single-word matching. No external imports.
// ============================================

import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// ============================================
// EMBEDDED CONFIG - DO NOT LOOSEN THESE RULES
// ============================================
const NAICS_PHRASES = {
  // Mental Health Practitioners (621330)
  '6213': [
    'mental health',
    'behavioral health', 
    'psychiatric services',
    'psychologist',
    'counseling services',
    'therapy services',
    'substance abuse',
    'addiction treatment',
    'crisis intervention',
    'mental illness',
    'psychological services'
  ],
  // Outpatient Mental Health (621420)
  '6214': [
    'mental health center',
    'behavioral health center',
    'outpatient mental health',
    'outpatient behavioral'
  ],
  // Family/Youth Services (624190)
  '6241': [
    'youth program',
    'youth services',
    'child welfare',
    'foster care',
    'family preservation',
    'child protective',
    'permanency',
    'at-risk youth',
    'family reunification',
    'adoption services',
    'juvenile services'
  ],
  // PR/Advertising (541820, 541810)
  '5418': [
    'public relations',
    'advertising agency',
    'media campaign',
    'marketing campaign',
    'PR services',
    'communications campaign',
    'advertising campaign'
  ],
  // Marketing Consulting (541613)
  '5416': [
    'marketing consulting',
    'marketing strategy',
    'brand strategy'
  ],
  // Performing Arts (711310, 711320)
  '7113': [
    'concert',
    'music festival',
    'performing arts',
    'entertainment event',
    'cultural event',
    'live event',
    'event promotion',
    'arts festival'
  ],
  '7111': [
    'performing arts',
    'theater production',
    'theatre production',
    'symphony',
    'ballet',
    'opera',
    'live performance'
  ],
  // Admin Management Consulting (541611)
  '5416': [
    'management consulting',
    'strategic consulting',
    'organizational consulting'
  ]
}

export default function ShopContracts({ session }) {
  const [profile, setProfile] = useState(null)
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [showLowMatches, setShowLowMatches] = useState(false)
  const [displayCount, setDisplayCount] = useState(20)
  const [selectedOpp, setSelectedOpp] = useState(null)
  const [addingToCart, setAddingToCart] = useState(false)

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
        loadOpportunities(null)
      }
    } catch (err) {
      console.error('Profile load error:', err)
      loadOpportunities(null)
    }
  }

  const loadOpportunities = async (userProfile) => {
    setLoading(true)
    setError(null)
    
    try {
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

      const scored = data.map(opp => ({
        ...opp,
        matchScore: calculateMatchScore(opp, userProfile)
      }))

      // Sort by: matches first, then by score, then by date
      scored.sort((a, b) => {
        // Matches first
        if (a.matchScore.naicsMatched && !b.matchScore.naicsMatched) return -1
        if (!a.matchScore.naicsMatched && b.matchScore.naicsMatched) return 1
        // Then by score
        return b.matchScore.current - a.matchScore.current
      })
      
      setOpportunities(scored)
    } catch (err) {
      console.error('Load error:', err)
      setError('Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // STRICT MATCHING - EXACT PHRASES ONLY
  // ============================================
  const calculateMatchScore = (opp, userProfile) => {
    if (!userProfile) {
      return { current: 0, potential: 20, breakdown: {}, matchLevel: 'none', naicsMatched: false }
    }

    let score = 0
    const breakdown = {}
    const oppText = `${opp.title || ''} ${opp.commodity_description || ''}`.toLowerCase()

    // ============================================
    // 1. NAICS PHRASE MATCHING (0-50 points)
    // ONLY matches if EXACT PHRASE found
    // ============================================
    const userNaics = userProfile.naics_codes || []
    let naicsMatched = false
    let matchedPhrase = null

    for (const naicsItem of userNaics) {
      const code = (naicsItem.code || naicsItem || '').toString()
      if (!code) continue

      const prefix = code.substring(0, 4)
      const phrases = NAICS_PHRASES[prefix] || []

      for (const phrase of phrases) {
        if (oppText.includes(phrase.toLowerCase())) {
          naicsMatched = true
          matchedPhrase = phrase
          score += 50
          breakdown.naics = { points: 50, matched: phrase }
          break
        }
      }
      if (naicsMatched) break
    }

    if (!naicsMatched) {
      breakdown.naics = { points: 0, matched: null }
    }

    // ============================================
    // 2. LOCATION MATCH (0-20 points)
    // ============================================
    const userState = userProfile.state
    const oppState = opp.state

    if (userState && oppState) {
      if (userState === oppState) {
        score += 20
        breakdown.location = { points: 20, matched: oppState }
      }
    } else if (!oppState) {
      score += 10
      breakdown.location = { points: 10, matched: 'Open to all' }
    }

    // ============================================
    // MATCH LEVEL - STRICT
    // ============================================
    let matchLevel = 'none'
    
    if (naicsMatched) {
      if (score >= 60) matchLevel = 'high'
      else matchLevel = 'medium'
    } else if (score > 0) {
      matchLevel = 'low'
    }

    const potential = Math.min(score + 20, 95)

    return {
      current: Math.min(score, 100),
      potential,
      breakdown,
      matchLevel,
      naicsMatched,
      matchedPhrase
    }
  }

  // ============================================
  // FILTER - ONLY SHOW TRUE MATCHES
  // ============================================
  const getFilteredOpportunities = () => {
    let filtered = [...opportunities]

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(opp => 
        (opp.title || '').toLowerCase().includes(term) ||
        (opp.commodity_description || '').toLowerCase().includes(term)
      )
    }

    if (stateFilter) {
      filtered = filtered.filter(opp => opp.state === stateFilter)
    }

    // DEFAULT: Only show real NAICS matches
    if (!showLowMatches) {
      filtered = filtered.filter(opp => opp.matchScore.naicsMatched === true)
    }

    return filtered
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getDaysLeft = (dateStr) => {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  }

  const getScoreColor = (score, matched) => {
    if (matched) return colors.highMatch
    if (score >= 30) return colors.medMatch
    return colors.muted
  }

  const availableStates = [...new Set(opportunities.map(o => o.state).filter(Boolean))].sort()

  const startResponse = async (opportunity) => {
    if (!session?.user?.id) return
    setAddingToCart(true)
    
    try {
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
      
      const { error } = await supabase
        .from('submissions')
        .insert({
          user_id: session.user.id,
          title: opportunity.title || opportunity.commodity_description || 'Untitled',
          agency: opportunity.contact_name || 'Agency not specified',
          due_date: opportunity.close_date,
          status: 'in_progress',
          description: opportunity.commodity_description || '',
          location: opportunity.state || '',
          match_score: opportunity.matchScore?.current || 0,
          created_at: new Date().toISOString()
        })
      
      if (error) throw error
      alert('✅ Added to Response Room!')
      setSelectedOpp(null)
    } catch (err) {
      console.error('Error:', err)
      alert('Failed to add.')
    } finally {
      setAddingToCart(false)
    }
  }

  const filtered = getFilteredOpportunities()
  const displayed = filtered.slice(0, displayCount)
  const hasMore = filtered.length > displayCount
  const matchCount = opportunities.filter(o => o.matchScore.naicsMatched).length

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ padding: '30px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ color: colors.text, margin: '0 0 10px 0', fontSize: '28px' }}>
            🛍️ Go Shopping
          </h1>
          
          {profile ? (
            <div style={{ 
              backgroundColor: colors.card,
              padding: '15px 20px',
              borderRadius: '10px',
              border: `1px solid ${colors.primary}30`,
              marginBottom: '20px'
            }}>
              <p style={{ color: colors.primary, margin: 0, fontSize: '14px', fontWeight: '600' }}>
                🪣 BUCKET: {profile.naics_codes?.length || 0} NAICS • {profile.state || 'No state'}
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
              <p style={{ color: colors.gold, margin: 0 }}>⚠️ Build Your BUCKET First</p>
            </div>
          )}

          {/* Match Count */}
          {!loading && (
            <div style={{ 
              backgroundColor: matchCount > 0 ? colors.highMatch + '20' : colors.card,
              padding: '15px 20px',
              borderRadius: '10px',
              border: `1px solid ${matchCount > 0 ? colors.highMatch : colors.border}`,
              marginBottom: '20px'
            }}>
              <p style={{ color: matchCount > 0 ? colors.highMatch : colors.muted, margin: 0, fontSize: '16px', fontWeight: '600' }}>
                {matchCount > 0 
                  ? `🎯 ${matchCount} opportunities match your BUCKET` 
                  : '📋 No exact matches found - try "Show all" to browse'}
              </p>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: '1',
                minWidth: '200px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.card,
                color: colors.text
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
                color: colors.text
              }}
            >
              <option value="">All States</option>
              {availableStates.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.muted, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showLowMatches}
                onChange={(e) => setShowLowMatches(e.target.checked)}
              />
              Show all opportunities
            </label>
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? (
          <p style={{ color: colors.primary, textAlign: 'center', padding: '60px' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', backgroundColor: colors.card, borderRadius: '16px' }}>
            <p style={{ color: colors.text, fontSize: '18px' }}>
              {showLowMatches ? 'No opportunities found' : 'No BUCKET matches found'}
            </p>
            {!showLowMatches && (
              <button
                onClick={() => setShowLowMatches(true)}
                style={{
                  marginTop: '20px',
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
            <p style={{ color: colors.muted, marginBottom: '20px' }}>
              {filtered.length} {showLowMatches ? 'total' : 'matching'} opportunities
            </p>

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
                      border: `2px solid ${score.naicsMatched ? colors.highMatch : colors.border}`,
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '20px'
                    }}
                  >
                    <div>
                      {/* Badges */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {score.naicsMatched && (
                          <span style={{
                            backgroundColor: colors.highMatch,
                            color: colors.background,
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            🎯 MATCHES YOUR BUCKET
                          </span>
                        )}
                        {daysLeft !== null && daysLeft <= 7 && (
                          <span style={{
                            backgroundColor: daysLeft <= 3 ? colors.lowMatch : colors.gold,
                            color: colors.background,
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {daysLeft} days left
                          </span>
                        )}
                      </div>

                      <h3 style={{ color: colors.text, margin: '0 0 8px 0', fontSize: '16px' }}>
                        {opp.title || opp.commodity_description}
                      </h3>
                      <p style={{ color: colors.muted, margin: 0, fontSize: '13px' }}>
                        {opp.contact_name || 'Agency'} • {opp.state || 'N/A'} • Due: {formatDate(opp.close_date)}
                      </p>
                      
                      {score.matchedPhrase && (
                        <p style={{ color: colors.primary, margin: '8px 0 0 0', fontSize: '12px' }}>
                          ✓ Matched: "{score.matchedPhrase}"
                        </p>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: colors.muted, margin: '0 0 4px 0', fontSize: '10px' }}>SCORE</p>
                      <p style={{ 
                        color: getScoreColor(score.current, score.naicsMatched),
                        fontSize: '28px',
                        fontWeight: '700',
                        margin: 0
                      }}>
                        {score.current}%
                      </p>
                      <p style={{ color: colors.muted, margin: '4px 0 0 0', fontSize: '11px' }}>
                        → {score.potential}%
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

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
                    cursor: 'pointer'
                  }}
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {selectedOpp && (
        <div
          onClick={() => setSelectedOpp(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', zIndex: 1000
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
              overflow: 'auto'
            }}
          >
            <h2 style={{ color: colors.text, margin: '0 0 20px 0' }}>
              {selectedOpp.title || selectedOpp.commodity_description}
            </h2>

            {selectedOpp.matchScore.naicsMatched ? (
              <div style={{ backgroundColor: colors.highMatch + '20', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
                <p style={{ color: colors.highMatch, margin: 0, fontWeight: '600' }}>
                  🎯 {selectedOpp.matchScore.current}% Match — "{selectedOpp.matchScore.matchedPhrase}"
                </p>
              </div>
            ) : (
              <div style={{ backgroundColor: colors.gold + '20', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
                <p style={{ color: colors.gold, margin: 0 }}>
                  ⚠️ This doesn't match your BUCKET NAICS codes
                </p>
              </div>
            )}

            <p style={{ color: colors.muted, marginBottom: '5px', fontSize: '12px' }}>Due Date</p>
            <p style={{ color: colors.text, marginBottom: '15px' }}>{formatDate(selectedOpp.close_date)}</p>

            {selectedOpp.commodity_description && (
              <>
                <p style={{ color: colors.muted, marginBottom: '5px', fontSize: '12px' }}>Description</p>
                <p style={{ color: colors.text, marginBottom: '20px', lineHeight: '1.6' }}>
                  {selectedOpp.commodity_description}
                </p>
              </>
            )}

            <button
              onClick={() => startResponse(selectedOpp)}
              disabled={addingToCart}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: colors.primary,
                border: 'none',
                borderRadius: '8px',
                color: colors.background,
                cursor: 'pointer',
                fontWeight: '700',
                marginBottom: '10px'
              }}
            >
              {addingToCart ? 'Adding...' : '📝 Start Response'}
            </button>
            <button
              onClick={() => setSelectedOpp(null)}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'transparent',
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
      )}
    </div>
  )
}
