// ============================================
// ShopContracts.jsx - V4
// SMART SCORING - Varied & Accurate
// ============================================

import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// ============================================
// NAICS PHRASES - What we match on
// ============================================
const NAICS_PHRASES = {
  '6213': ['mental health', 'behavioral health', 'psychiatric', 'psychologist', 'counseling', 'therapist', 'therapy', 'substance abuse', 'addiction', 'crisis intervention'],
  '6214': ['mental health center', 'behavioral health center', 'outpatient mental', 'outpatient behavioral'],
  '6241': ['youth program', 'youth services', 'child welfare', 'foster care', 'foster family', 'family preservation', 'child protective', 'permanency', 'at-risk youth', 'family reunification', 'adoption services', 'juvenile'],
  '5418': ['public relations', 'advertising agency', 'media campaign', 'marketing campaign', 'PR services', 'communications campaign'],
  '5416': ['marketing consulting', 'marketing strategy', 'management consulting'],
  '7113': ['concert', 'music festival', 'performing arts', 'entertainment event', 'cultural event', 'live event', 'event promotion'],
  '7111': ['performing arts', 'theater', 'theatre', 'symphony', 'ballet', 'opera'],
  '5411': ['administrative', 'admin services']
}

// Strength of each phrase (some are more specific than others)
const PHRASE_STRENGTH = {
  'mental health': 95,
  'behavioral health': 95,
  'foster care': 95,
  'foster family': 95,
  'youth services': 90,
  'youth program': 90,
  'child welfare': 90,
  'permanency': 88,
  'family preservation': 88,
  'at-risk youth': 88,
  'psychiatric': 85,
  'counseling': 80,
  'therapy': 80,
  'therapist': 80,
  'psychologist': 85,
  'crisis intervention': 85,
  'substance abuse': 85,
  'addiction': 80,
  'juvenile': 75,
  'family reunification': 85,
  'child protective': 90,
  'adoption services': 85,
  'public relations': 80,
  'advertising agency': 80,
  'marketing campaign': 75,
  'concert': 85,
  'music festival': 85,
  'performing arts': 80,
  'entertainment event': 75,
  'cultural event': 75
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
    if (session?.user?.id) loadProfile()
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
      loadOpportunities(null)
    }
  }

  const loadOpportunities = async (userProfile) => {
    setLoading(true)
    
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
        matchScore: calculateSmartScore(opp, userProfile)
      }))

      scored.sort((a, b) => {
        if (a.matchScore.isMatch && !b.matchScore.isMatch) return -1
        if (!a.matchScore.isMatch && b.matchScore.isMatch) return 1
        return b.matchScore.current - a.matchScore.current
      })
      
      setOpportunities(scored)
    } catch (err) {
      setError('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // SMART SCORING - Varied & Accurate
  // ============================================
  const calculateSmartScore = (opp, userProfile) => {
    if (!userProfile) {
      return { current: 0, potential: 20, isMatch: false, matchedPhrase: null, matchStrength: null }
    }

    const title = (opp.title || '').toLowerCase()
    const description = (opp.commodity_description || '').toLowerCase()
    const fullText = `${title} ${description}`
    
    const userNaics = userProfile.naics_codes || []
    const userState = userProfile.state

    let bestMatch = null
    let bestScore = 0
    let matchLocation = null

    // Check each user NAICS code
    for (const naicsItem of userNaics) {
      const code = (naicsItem.code || naicsItem || '').toString()
      if (!code) continue

      const prefix = code.substring(0, 4)
      const phrases = NAICS_PHRASES[prefix] || []

      for (const phrase of phrases) {
        const phraseLower = phrase.toLowerCase()
        
        // Check if phrase is in TITLE (strongest) or DESCRIPTION (weaker)
        const inTitle = title.includes(phraseLower)
        const inDescription = description.includes(phraseLower)
        
        if (inTitle || inDescription) {
          // Get base strength of this phrase
          let baseStrength = PHRASE_STRENGTH[phraseLower] || 70
          
          // BONUS: In title = stronger match
          if (inTitle) {
            baseStrength += 5
          }
          
          // PENALTY: Only in description = weaker
          if (!inTitle && inDescription) {
            baseStrength -= 10
          }
          
          // Check if this is the best match so far
          if (baseStrength > bestScore) {
            bestScore = baseStrength
            bestMatch = phrase
            matchLocation = inTitle ? 'title' : 'description'
          }
        }
      }
    }

    // No phrase match = no real match
    if (!bestMatch) {
      // Location-only score
      let locationScore = 0
      if (userState && opp.state && userState === opp.state) {
        locationScore = 15
      }
      return { 
        current: locationScore, 
        potential: locationScore + 15, 
        isMatch: false, 
        matchedPhrase: null,
        matchStrength: null
      }
    }

    // ============================================
    // BUILD FINAL SCORE with variance
    // ============================================
    let finalScore = bestScore

    // Location bonus
    if (userState && opp.state) {
      if (userState === opp.state) {
        finalScore += 5  // Small bonus for same state
      } else {
        finalScore -= 5  // Small penalty for different state
      }
    }

    // Multiple phrase matches bonus (check if more than one phrase matches)
    let matchCount = 0
    for (const naicsItem of userNaics) {
      const code = (naicsItem.code || naicsItem || '').toString()
      const prefix = code.substring(0, 4)
      const phrases = NAICS_PHRASES[prefix] || []
      for (const phrase of phrases) {
        if (fullText.includes(phrase.toLowerCase())) {
          matchCount++
        }
      }
    }
    if (matchCount > 1) {
      finalScore += Math.min(matchCount * 2, 8)  // Up to +8 for multiple matches
    }

    // Add small random variance (-2 to +2) to prevent identical scores
    const variance = Math.floor(Math.random() * 5) - 2
    finalScore += variance

    // Clamp between 40 and 95
    finalScore = Math.max(40, Math.min(95, finalScore))

    // Calculate CR-AI potential (always higher, but varied)
    const potentialBoost = 8 + Math.floor(Math.random() * 7)  // +8 to +15
    const potential = Math.min(finalScore + potentialBoost, 98)

    return {
      current: finalScore,
      potential: potential,
      isMatch: true,
      matchedPhrase: bestMatch,
      matchLocation: matchLocation,
      matchStrength: bestScore >= 85 ? 'strong' : bestScore >= 70 ? 'good' : 'partial'
    }
  }

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

    if (!showLowMatches) {
      filtered = filtered.filter(opp => opp.matchScore.isMatch === true)
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

  const getScoreColor = (score) => {
    if (score >= 80) return colors.highMatch
    if (score >= 60) return colors.medMatch
    if (score >= 40) return colors.gold
    return colors.muted
  }

  const getMatchBadge = (matchStrength) => {
    if (matchStrength === 'strong') return '🎯 STRONG MATCH'
    if (matchStrength === 'good') return '✅ GOOD MATCH'
    return '📋 PARTIAL MATCH'
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
      alert('Failed to add.')
    } finally {
      setAddingToCart(false)
    }
  }

  const filtered = getFilteredOpportunities()
  const displayed = filtered.slice(0, displayCount)
  const hasMore = filtered.length > displayCount
  const matchCount = opportunities.filter(o => o.matchScore.isMatch).length

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ padding: '30px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ color: colors.text, margin: '0 0 15px 0', fontSize: '28px' }}>
            🛍️ Go Shopping
          </h1>
          
          {profile ? (
            <div style={{ 
              backgroundColor: colors.card,
              padding: '15px 20px',
              borderRadius: '10px',
              border: `1px solid ${colors.primary}30`,
              marginBottom: '15px'
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
              marginBottom: '15px'
            }}>
              <p style={{ color: colors.gold, margin: 0 }}>⚠️ Build Your BUCKET First</p>
            </div>
          )}

          {!loading && (
            <div style={{ 
              backgroundColor: matchCount > 0 ? colors.highMatch + '20' : colors.card,
              padding: '15px 20px',
              borderRadius: '10px',
              border: `1px solid ${matchCount > 0 ? colors.highMatch : colors.border}`,
              marginBottom: '15px'
            }}>
              <p style={{ color: matchCount > 0 ? colors.highMatch : colors.muted, margin: 0, fontSize: '16px', fontWeight: '600' }}>
                {matchCount > 0 
                  ? `🎯 ${matchCount} opportunities match your BUCKET` 
                  : '📋 No matches found - check "Show all" to browse'}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: '1', minWidth: '200px', padding: '12px 16px', borderRadius: '8px',
                border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.text
              }}
            />
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              style={{
                padding: '12px 16px', borderRadius: '8px',
                border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.text
              }}
            >
              <option value="">All States</option>
              {availableStates.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.muted, cursor: 'pointer' }}>
              <input type="checkbox" checked={showLowMatches} onChange={(e) => setShowLowMatches(e.target.checked)} />
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
                  marginTop: '20px', padding: '10px 20px', backgroundColor: colors.card,
                  border: `1px solid ${colors.primary}`, borderRadius: '8px', color: colors.primary, cursor: 'pointer'
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
                      border: `2px solid ${score.isMatch ? getScoreColor(score.current) : colors.border}`,
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '20px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {score.isMatch && (
                          <span style={{
                            backgroundColor: getScoreColor(score.current),
                            color: colors.background,
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            {getMatchBadge(score.matchStrength)}
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
                          ✓ Matched: "{score.matchedPhrase}" {score.matchLocation === 'title' ? '(in title)' : ''}
                        </p>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: colors.muted, margin: '0 0 4px 0', fontSize: '10px' }}>SCORE</p>
                      <p style={{ 
                        color: getScoreColor(score.current),
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
                    padding: '12px 30px', backgroundColor: colors.card,
                    border: `1px solid ${colors.primary}`, borderRadius: '8px', color: colors.primary, cursor: 'pointer'
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
              backgroundColor: colors.card, borderRadius: '16px', padding: '30px',
              maxWidth: '600px', width: '100%', maxHeight: '85vh', overflow: 'auto'
            }}
          >
            <h2 style={{ color: colors.text, margin: '0 0 20px 0' }}>
              {selectedOpp.title || selectedOpp.commodity_description}
            </h2>

            {selectedOpp.matchScore.isMatch ? (
              <div style={{ 
                backgroundColor: getScoreColor(selectedOpp.matchScore.current) + '20', 
                padding: '15px', 
                borderRadius: '10px', 
                marginBottom: '20px',
                border: `1px solid ${getScoreColor(selectedOpp.matchScore.current)}`
              }}>
                <p style={{ color: getScoreColor(selectedOpp.matchScore.current), margin: 0, fontWeight: '600', fontSize: '18px' }}>
                  {selectedOpp.matchScore.current}% Match
                </p>
                <p style={{ color: colors.text, margin: '8px 0 0 0', fontSize: '14px' }}>
                  Matched: "{selectedOpp.matchScore.matchedPhrase}"
                  {selectedOpp.matchScore.matchLocation === 'title' && ' (found in title)'}
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
                width: '100%', padding: '14px', backgroundColor: colors.primary, border: 'none',
                borderRadius: '8px', color: colors.background, cursor: 'pointer', fontWeight: '700', marginBottom: '10px'
              }}
            >
              {addingToCart ? 'Adding...' : '📝 Start Response'}
            </button>
            <button
              onClick={() => setSelectedOpp(null)}
              style={{
                width: '100%', padding: '14px', backgroundColor: 'transparent',
                border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text, cursor: 'pointer'
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
