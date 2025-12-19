// ============================================
// ShopContracts.jsx
// Search & Match Opportunities from Database
// SELF-CONTAINED - No external dependencies
// ============================================

import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// ============================================
// MAIN COMPONENT
// ============================================
export default function ShopContracts({ session }) {
  const [profile, setProfile] = useState(null)
  const [opportunities, setOpportunities] = useState([])
  const [filteredOpps, setFilteredOpps] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    level: 'all',
    state: '',
    showExpired: false
  })
  
  // Pagination
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const perPage = 20
  
  // Selected opportunity for detail view
  const [selectedOpp, setSelectedOpp] = useState(null)
  const [addingToCart, setAddingToCart] = useState(false)

  // Colors - ALL INLINE, no imports
  const colors = {
    primary: '#39FF14',
    gold: '#FFD700',
    background: '#000000',
    surface: '#111111',
    card: '#1a1a1a',
    text: '#FFFFFF',
    textMuted: '#888888',
    border: '#333333',
    error: '#FF4444',
    success: '#39FF14'
  }

  // ==========================================
  // LOAD PROFILE & INITIAL OPPORTUNITIES
  // ==========================================
  useEffect(() => {
    if (session?.user?.id) {
      loadProfile()
      loadOpportunities()
    }
  }, [session])

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()
      
      if (data) {
        setProfile(data)
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    }
  }

  const loadOpportunities = async () => {
    setLoading(true)
    setError(null)
    try {
      // Get total count first
      const { count, error: countError } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('close_date', new Date().toISOString())
      
      if (countError) {
        console.error('Count error:', countError)
      }
      
      setTotalCount(count || 0)

      // Get first page
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('is_active', true)
        .gte('close_date', new Date().toISOString())
        .order('close_date', { ascending: true })
        .range(0, perPage - 1)

      if (error) throw error
      
      setOpportunities(data || [])
      setFilteredOpps(data || [])
    } catch (err) {
      console.error('Error loading opportunities:', err)
      setError('Failed to load opportunities. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // SEARCH & FILTER
  // ==========================================
  const handleSearch = async () => {
    setSearching(true)
    setPage(1)
    setError(null)
    
    try {
      let query = supabase
        .from('opportunities')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
      
      // Don't show expired unless explicitly requested
      if (!filters.showExpired) {
        query = query.gte('close_date', new Date().toISOString())
      }
      
      // Search term - search multiple fields
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase()
        query = query.or(`title.ilike.%${term}%,commodity_description.ilike.%${term}%,contact_name.ilike.%${term}%`)
      }
      
      // State filter
      if (filters.state) {
        query = query.eq('state', filters.state)
      }
      
      // Order by close date (soonest first)
      query = query.order('close_date', { ascending: true })
      
      // Pagination
      query = query.range(0, perPage - 1)
      
      const { data, error, count } = await query

      if (error) throw error
      
      setFilteredOpps(data || [])
      setTotalCount(count || 0)
      
    } catch (err) {
      console.error('Search error:', err)
      setError('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  // ==========================================
  // BUCKET MATCH - Search by User's Profile
  // ==========================================
  const searchByBucket = async () => {
    if (!profile) {
      setError('Please complete your BUCKET first to use smart matching')
      return
    }
    
    setSearching(true)
    setPage(1)
    setError(null)
    
    try {
      let query = supabase
        .from('opportunities')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .gte('close_date', new Date().toISOString())
      
      // Match by state/location if user has one set
      if (profile.state) {
        query = query.eq('state', profile.state)
      }
      
      query = query.order('close_date', { ascending: true })
      query = query.range(0, perPage - 1)
      
      const { data, error, count } = await query

      if (error) throw error
      
      setFilteredOpps(data || [])
      setTotalCount(count || 0)
      setSearchTerm('')
      
    } catch (err) {
      console.error('BUCKET search error:', err)
      setError('Smart search failed. Showing all opportunities.')
      loadOpportunities()
    } finally {
      setSearching(false)
    }
  }

  // ==========================================
  // LOAD MORE (Pagination)
  // ==========================================
  const loadMore = async () => {
    const nextPage = page + 1
    const start = (nextPage - 1) * perPage
    
    try {
      let query = supabase
        .from('opportunities')
        .select('*')
        .eq('is_active', true)
        .gte('close_date', new Date().toISOString())
      
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase()
        query = query.or(`title.ilike.%${term}%,commodity_description.ilike.%${term}%`)
      }
      
      query = query.order('close_date', { ascending: true })
      query = query.range(start, start + perPage - 1)
      
      const { data, error } = await query
      
      if (error) throw error
      
      setFilteredOpps([...filteredOpps, ...(data || [])])
      setPage(nextPage)
      
    } catch (err) {
      console.error('Load more error:', err)
    }
  }

  // ==========================================
  // CALCULATE MATCH SCORE
  // ==========================================
  const calculateMatchScore = (opportunity) => {
    if (!profile) return { current: 30, potential: 65 }
    
    let score = 0
    
    // Location match (25 points)
    if (profile.state && opportunity.state) {
      if (profile.state === opportunity.state) {
        score += 25
      }
    } else {
      score += 15
    }
    
    // NAICS codes (25 points)
    if (profile.naics_codes?.length > 0) {
      score += 20
    }
    
    // Services (20 points)
    if (profile.services?.length > 0) {
      score += 15
    }
    
    // Certifications (15 points)
    if (profile.certifications?.length > 0) {
      score += Math.min(profile.certifications.length * 5, 15)
    }
    
    // Past performance (15 points)
    if (profile.past_performance?.length > 0) {
      score += Math.min(profile.past_performance.length * 5, 15)
    }
    
    const potential = Math.min(score + 35, 95)
    
    return {
      current: Math.min(score, 100),
      potential: potential
    }
  }

  // ==========================================
  // ADD TO CART
  // ==========================================
  const addToCart = async (opportunity) => {
    if (!session?.user?.id) return
    
    setAddingToCart(true)
    
    try {
      // Check if already in cart (using submissions table for now)
      const { data: existing } = await supabase
        .from('submissions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('title', opportunity.title || opportunity.commodity_description)
        .single()
      
      if (existing) {
        alert('This opportunity is already in your cart!')
        setAddingToCart(false)
        return
      }
      
      // Add to cart (submissions table with status 'considering')
      const { error } = await supabase
        .from('submissions')
        .insert({
          user_id: session.user.id,
          title: opportunity.title || opportunity.commodity_description || 'Untitled Opportunity',
          agency: opportunity.contact_name || 'Agency not specified',
          due_date: opportunity.close_date,
          status: 'considering',
          source_url: opportunity.source_url || '',
          created_at: new Date().toISOString()
        })
      
      if (error) throw error
      
      alert('✅ Added to your cart!')
      setSelectedOpp(null)
      
    } catch (err) {
      console.error('Add to cart error:', err)
      alert('Failed to add to cart. Please try again.')
    } finally {
      setAddingToCart(false)
    }
  }

  // ==========================================
  // FORMAT DATE
  // ==========================================
  const formatDate = (dateString) => {
    if (!dateString) return 'No deadline'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  // ==========================================
  // DAYS UNTIL DUE
  // ==========================================
  const getDaysUntil = (dateString) => {
    if (!dateString) return null
    const due = new Date(dateString)
    const now = new Date()
    const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
    return days
  }

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: colors.background, 
      color: colors.text,
      padding: '20px',
      paddingBottom: '80px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            margin: '0 0 10px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            🛍️ Go Shopping
          </h1>
          <p style={{ color: colors.textMuted, margin: 0 }}>
            {totalCount.toLocaleString()} active opportunities • Find contracts & grants matched to your BUCKET
          </p>
        </div>

        {/* BUCKET Match Banner */}
        {profile && (
          <div style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.primary}40`,
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '25px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '15px'
            }}>
              <div>
                <p style={{ 
                  color: colors.primary, 
                  fontWeight: '600', 
                  margin: '0 0 5px 0',
                  fontSize: '14px'
                }}>
                  🪣 YOUR BUCKET IS READY
                </p>
                <p style={{ color: colors.textMuted, margin: 0, fontSize: '14px' }}>
                  {profile.naics_codes?.length || 0} NAICS codes • {profile.services?.length || 0} services • {profile.state || 'No location set'}
                </p>
              </div>
              <button
                onClick={searchByBucket}
                disabled={searching}
                style={{
                  padding: '12px 24px',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: searching ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: searching ? 0.7 : 1
                }}
              >
                {searching ? '🔍 Searching...' : '✨ Find Matches for My BUCKET'}
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div style={{
          backgroundColor: colors.card,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '25px'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            <input
              type="text"
              placeholder="Search by keyword, agency, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{
                flex: 1,
                minWidth: '250px',
                padding: '12px 16px',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <select
              value={filters.state}
              onChange={(e) => setFilters({ ...filters, state: e.target.value })}
              style={{
                padding: '12px 16px',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                fontSize: '14px',
                minWidth: '140px'
              }}
            >
              <option value="">All States</option>
              <option value="CA">California</option>
              <option value="TX">Texas</option>
              <option value="NY">New York</option>
              <option value="FL">Florida</option>
              <option value="IL">Illinois</option>
              <option value="PA">Pennsylvania</option>
              <option value="OH">Ohio</option>
              <option value="GA">Georgia</option>
              <option value="NC">North Carolina</option>
              <option value="MI">Michigan</option>
            </select>
            <button
              onClick={handleSearch}
              disabled={searching}
              style={{
                padding: '12px 24px',
                backgroundColor: colors.primary,
                color: colors.background,
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: searching ? 'not-allowed' : 'pointer',
                opacity: searching ? 0.7 : 1
              }}
            >
              {searching ? 'Searching...' : '🔍 Search'}
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div style={{ 
          marginBottom: '20px', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <p style={{ color: colors.textMuted, margin: 0, fontSize: '14px' }}>
            Showing {filteredOpps.length} of {totalCount.toLocaleString()} opportunities
          </p>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilters({ level: 'all', state: '', showExpired: false })
              loadOpportunities()
            }}
            style={{
              background: 'none',
              border: 'none',
              color: colors.primary,
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Clear All Filters
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            backgroundColor: colors.card,
            borderRadius: '12px'
          }}>
            <p style={{ color: colors.primary, fontSize: '18px', margin: 0 }}>
              🔍 Loading opportunities from your database...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            backgroundColor: `${colors.error}15`,
            border: `1px solid ${colors.error}50`,
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px'
          }}>
            <p style={{ color: colors.error, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && filteredOpps.length === 0 && (
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '12px',
            padding: '60px 20px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '48px', margin: '0 0 15px 0' }}>🔍</p>
            <p style={{ color: colors.text, fontSize: '18px', margin: '0 0 10px 0' }}>
              No opportunities found
            </p>
            <p style={{ color: colors.textMuted, margin: '0 0 20px 0' }}>
              Try different search terms or clear your filters
            </p>
            <button
              onClick={() => {
                setSearchTerm('')
                setFilters({ level: 'all', state: '', showExpired: false })
                loadOpportunities()
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                cursor: 'pointer'
              }}
            >
              Show All Opportunities
            </button>
          </div>
        )}

        {/* Opportunity Cards */}
        {!loading && filteredOpps.length > 0 && (
          <div style={{ display: 'grid', gap: '15px' }}>
            {filteredOpps.map((opp) => {
              const matchScore = calculateMatchScore(opp)
              const daysUntil = getDaysUntil(opp.close_date)
              const isUrgent = daysUntil !== null && daysUntil <= 7 && daysUntil >= 0
              const isExpired = daysUntil !== null && daysUntil < 0
              
              return (
                <div
                  key={opp.id}
                  onClick={() => setSelectedOpp(opp)}
                  style={{
                    backgroundColor: colors.card,
                    border: `1px solid ${isUrgent ? colors.gold : colors.border}`,
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease',
                    opacity: isExpired ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = isUrgent ? colors.gold : colors.border}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                    {/* Left: Info */}
                    <div style={{ flex: 1 }}>
                      {/* Badges */}
                      <div style={{ marginBottom: '10px' }}>
                        {isUrgent && (
                          <span style={{
                            display: 'inline-block',
                            backgroundColor: `${colors.gold}20`,
                            color: colors.gold,
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600',
                            marginRight: '8px'
                          }}>
                            ⏰ {daysUntil} days left
                          </span>
                        )}
                        {isExpired && (
                          <span style={{
                            display: 'inline-block',
                            backgroundColor: `${colors.error}20`,
                            color: colors.error,
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            EXPIRED
                          </span>
                        )}
                      </div>
                      
                      {/* Title */}
                      <h3 style={{ 
                        margin: '0 0 8px 0', 
                        fontSize: '16px', 
                        fontWeight: '600',
                        color: colors.text,
                        lineHeight: '1.4'
                      }}>
                        {opp.title || opp.commodity_description || 'Untitled Opportunity'}
                      </h3>
                      
                      {/* Agency & Location */}
                      <p style={{ 
                        color: colors.textMuted, 
                        margin: '0 0 8px 0', 
                        fontSize: '14px' 
                      }}>
                        {opp.contact_name || 'Agency not specified'} 
                        {opp.state && ` • ${opp.state}`}
                        {opp.county && `, ${opp.county}`}
                      </p>
                      
                      {/* Due Date */}
                      <p style={{ 
                        color: colors.textMuted, 
                        margin: 0, 
                        fontSize: '13px' 
                      }}>
                        📅 Due: {formatDate(opp.close_date)}
                      </p>
                    </div>
                    
                    {/* Right: Match Score */}
                    <div style={{ 
                      textAlign: 'center',
                      minWidth: '100px'
                    }}>
                      <div style={{
                        backgroundColor: colors.surface,
                        borderRadius: '8px',
                        padding: '12px',
                        border: `1px solid ${colors.border}`
                      }}>
                        <p style={{ 
                          color: colors.textMuted, 
                          fontSize: '10px', 
                          margin: '0 0 4px 0',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Your Score
                        </p>
                        <p style={{ 
                          color: matchScore.current >= 60 ? colors.primary : colors.gold, 
                          fontSize: '24px', 
                          fontWeight: '700',
                          margin: '0 0 6px 0'
                        }}>
                          {matchScore.current}%
                        </p>
                        <p style={{ 
                          color: colors.primary, 
                          fontSize: '12px', 
                          margin: 0,
                          fontWeight: '600'
                        }}>
                          → {matchScore.potential}% ✨
                        </p>
                        <p style={{ 
                          color: colors.textMuted, 
                          fontSize: '9px', 
                          margin: '2px 0 0 0' 
                        }}>
                          with CR-AI
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Load More */}
        {filteredOpps.length > 0 && filteredOpps.length < totalCount && (
          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <button
              onClick={loadMore}
              style={{
                padding: '14px 32px',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Load More ({totalCount - filteredOpps.length} remaining)
            </button>
          </div>
        )}

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
              backgroundColor: 'rgba(0,0,0,0.85)',
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
              {/* Modal Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '20px'
              }}>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  <h2 style={{ 
                    margin: '0 0 10px 0', 
                    fontSize: '20px',
                    lineHeight: '1.4',
                    color: colors.text
                  }}>
                    {selectedOpp.title || selectedOpp.commodity_description || 'Opportunity Details'}
                  </h2>
                  <p style={{ color: colors.textMuted, margin: 0, fontSize: '14px' }}>
                    {selectedOpp.contact_name || 'Agency not specified'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOpp(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.textMuted,
                    fontSize: '28px',
                    cursor: 'pointer',
                    padding: '0',
                    lineHeight: '1'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Match Score Display */}
              {(() => {
                const score = calculateMatchScore(selectedOpp)
                return (
                  <div style={{
                    backgroundColor: colors.surface,
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px',
                    border: `1px solid ${colors.primary}30`
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-around',
                      textAlign: 'center',
                      alignItems: 'center'
                    }}>
                      <div>
                        <p style={{ color: colors.textMuted, fontSize: '11px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>
                          YOUR SCORE
                        </p>
                        <p style={{ 
                          color: score.current >= 60 ? colors.primary : colors.gold, 
                          fontSize: '36px', 
                          fontWeight: '700',
                          margin: 0
                        }}>
                          {score.current}%
                        </p>
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: '24px' }}>
                        →
                      </div>
                      <div>
                        <p style={{ color: colors.textMuted, fontSize: '11px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>
                          WITH CR-AI
                        </p>
                        <p style={{ 
                          color: colors.primary, 
                          fontSize: '36px', 
                          fontWeight: '700',
                          margin: 0
                        }}>
                          {score.potential}% ✨
                        </p>
                      </div>
                    </div>
                    
                    {/* Empowering Message */}
                    <p style={{ 
                      color: colors.primary, 
                      textAlign: 'center', 
                      marginTop: '15px',
                      marginBottom: 0,
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      {score.current >= 70 
                        ? "You're competitive! Time to go for it." 
                        : score.current >= 50 
                          ? "You're closer than you think. CR-AI can help." 
                          : "This is doable. Let CR-AI help you build a winning response."}
                    </p>
                  </div>
                )
              })()}

              {/* Details Grid */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '15px',
                  marginBottom: '15px'
                }}>
                  <div>
                    <p style={{ color: colors.textMuted, fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                      DUE DATE
                    </p>
                    <p style={{ color: colors.text, margin: 0, fontWeight: '500' }}>
                      {formatDate(selectedOpp.close_date)}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: colors.textMuted, fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                      LOCATION
                    </p>
                    <p style={{ color: colors.text, margin: 0, fontWeight: '500' }}>
                      {selectedOpp.state || 'Not specified'}
                      {selectedOpp.county && `, ${selectedOpp.county}`}
                    </p>
                  </div>
                </div>
                
                {selectedOpp.commodity_description && (
                  <div style={{ marginTop: '15px' }}>
                    <p style={{ color: colors.textMuted, fontSize: '11px', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                      DESCRIPTION
                    </p>
                    <p style={{ 
                      color: colors.text, 
                      margin: 0,
                      lineHeight: '1.6',
                      fontSize: '14px'
                    }}>
                      {selectedOpp.commodity_description}
                    </p>
                  </div>
                )}
                
                {/* Contact Info */}
                {(selectedOpp.contact_name || selectedOpp.contact_email || selectedOpp.contact_phone) && (
                  <div style={{ marginTop: '15px' }}>
                    <p style={{ color: colors.textMuted, fontSize: '11px', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                      CONTACT
                    </p>
                    <p style={{ color: colors.text, margin: 0, fontSize: '14px' }}>
                      {selectedOpp.contact_name && <span>{selectedOpp.contact_name}</span>}
                      {selectedOpp.contact_email && <span> • {selectedOpp.contact_email}</span>}
                      {selectedOpp.contact_phone && <span> • {selectedOpp.contact_phone}</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px' 
              }}>
                <button
                  onClick={() => setSelectedOpp(null)}
                  style={{
                    padding: '14px',
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.text,
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => addToCart(selectedOpp)}
                  disabled={addingToCart}
                  style={{
                    padding: '14px',
                    backgroundColor: colors.primary,
                    border: 'none',
                    borderRadius: '8px',
                    color: colors.background,
                    cursor: addingToCart ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '700',
                    opacity: addingToCart ? 0.7 : 1
                  }}
                >
                  {addingToCart ? 'Adding...' : '🛒 Add to My Cart'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
