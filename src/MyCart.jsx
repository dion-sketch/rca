import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const colors = {
  primary: '#00FF00',
  gold: '#FFD700',
  background: '#000000',
  card: '#0A1F0A',
  white: '#FFFFFF',
  gray: '#888888',
  red: '#FF4444',
}

function MyCart({ session, onBack, profileData }) {
  const [activeTab, setActiveTab] = useState('cart')
  const [showAddManual, setShowAddManual] = useState(false)
  const [showResponseBuilder, setShowResponseBuilder] = useState(false)
  const [selectedOpportunity, setSelectedOpportunity] = useState(null)
  const [allSubmissions, setAllSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showConfirm, setShowConfirm] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [savedOpportunity, setSavedOpportunity] = useState(null)

  const [manualEntry, setManualEntry] = useState({
    title: '',
    rfpNumber: '',
    agency: '',
    dueDate: '',
    source: '',
    estimatedValue: '',
    description: ''
  })

  // Smart Search Flow States
  const [searchMode, setSearchMode] = useState('input') // 'input' | 'searching' | 'results' | 'notfound' | 'manual' | 'shopping' | 'shopping-results'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchError, setSearchError] = useState(null)
  const [shoppingResults, setShoppingResults] = useState([]) // Results from "Go Shopping"

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (data) {
        setAllSubmissions(data.filter(s => s.status !== 'archived'))
      }
    } catch (err) {
      console.error('Error fetching submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  // REAL Contract Search - Searches DATABASE FIRST (instant), then web
  // Based on user location: Federal, State, County, City, everywhere
  const handleSmartSearch = async () => {
    if (!searchQuery.trim()) return
    
    setSearchMode('searching')
    setSearchError(null)
    
    try {
      // Get user's location from profile for location-aware search
      const userLocation = {
        city: profileData?.city || '',
        county: profileData?.county || 'Los Angeles', // Default to LA County
        state: profileData?.state || 'California'
      }

      // Use the new smart search API (database first, then web fallback)
      const response = await fetch('/api/search-opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: searchQuery.trim(),
          searchType: 'specific', // Looking for a specific contract
          userLocation: userLocation,
          geographicPreference: profileData?.geographic_preference || 'local',
          naicsCodes: profileData?.naics_codes || [],
          certifications: profileData?.certifications || [],
          sources: ['all'] // Search all sources
        })
      })
      
      const data = await response.json()
      
      if (data.success && data.opportunities?.length > 0) {
        // Found results - show the best match first
        const bestMatch = data.opportunities[0]
        setSearchResults({
          found: true,
          title: bestMatch.title,
          agency: bestMatch.agency,
          estimatedValue: bestMatch.estimatedValue,
          dueDate: bestMatch.dueDate,
          description: bestMatch.description,
          source: bestMatch.source,
          sourceUrl: bestMatch.sourceUrl,
          rfpNumber: bestMatch.rfpNumber,
          matchScore: bestMatch.matchScore,
          matchLevel: bestMatch.matchLevel,
          confidence: bestMatch.matchScore >= 80 ? 'high' : bestMatch.matchScore >= 60 ? 'medium' : 'low',
          allResults: data.opportunities, // Store all results in case user wants to see more
          searchMethod: data.searchMethod, // 'database' or 'web'
          fromDatabase: bestMatch.fromDatabase,
          contactName: bestMatch.contactName,
          contactPhone: bestMatch.contactPhone,
          contactEmail: bestMatch.contactEmail
        })
        setSearchMode('results')
      } else {
        setSearchMode('notfound')
      }
    } catch (err) {
      console.error('Search error:', err)
      setSearchError('Search failed. You can enter details manually or try again.')
      setSearchMode('notfound')
    }
  }

  // GO SHOPPING - Search for opportunities that match user's BUCKET
  const handleGoShopping = async () => {
    setSearchMode('shopping')
    setSearchError(null)
    
    try {
      const userLocation = {
        city: profileData?.city || '',
        county: profileData?.county || 'Los Angeles',
        state: profileData?.state || 'California'
      }

      const response = await fetch('/api/contract-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: '', // Empty - we're searching by profile
          searchType: 'shopping', // Find matches for my profile
          userLocation: userLocation,
          naicsCodes: profileData?.naics_codes || [],
          certifications: profileData?.certifications || [],
          serviceAreas: profileData?.service_areas || []
        })
      })
      
      const data = await response.json()
      
      if (data.success && data.opportunities?.length > 0) {
        setShoppingResults(data.opportunities)
        setSearchMode('shopping-results')
      } else {
        setSearchError('No matching opportunities found right now. Try again later or search manually.')
        setSearchMode('input')
      }
    } catch (err) {
      console.error('Shopping search error:', err)
      setSearchError('Search failed. Please try again.')
      setSearchMode('input')
    }
  }

  // Delete an item from cart
  const handleDeleteItem = async (itemId) => {
    if (!confirm('Delete this opportunity from your cart?')) return
    
    try {
      await supabase
        .from('submissions')
        .delete()
        .eq('id', itemId)
      
      // Refresh the list
      fetchSubmissions()
    } catch (err) {
      console.error('Error deleting item:', err)
    }
  }

  // Accept the search result and populate the form
  const handleAcceptResult = () => {
    setManualEntry({
      title: searchResults.title || searchQuery,
      rfpNumber: searchResults.rfpNumber || '',
      agency: searchResults.agency || '',
      dueDate: searchResults.dueDate || '',
      source: searchResults.source || 'Auto-detected',
      estimatedValue: searchResults.estimatedValue || '',
      description: searchResults.description || ''
    })
    setShowConfirm(true)
    setSearchMode('input')
    setSearchResults(null)
    setSearchQuery('')
  }

  // Reset search and try again
  const handleSearchAgain = () => {
    setSearchMode('input')
    setSearchResults(null)
    setSearchError(null)
  }

  // Switch to full manual entry
  const handleGoManual = () => {
    setManualEntry({
      ...manualEntry,
      title: searchQuery || manualEntry.title
    })
    setSearchMode('manual')
    setSearchResults(null)
  }

  // Close the add modal completely
  const handleCloseAddModal = () => {
    setShowAddManual(false)
    setSearchMode('input')
    setSearchQuery('')
    setSearchResults(null)
    setSearchError(null)
    setManualEntry({ title: '', rfpNumber: '', agency: '', dueDate: '', source: '', estimatedValue: '', description: '' })
  }

  const cartItems = allSubmissions.filter(s => s.status === 'draft' && (!s.strategy_plan))
  const inProgressItems = allSubmissions.filter(s => s.status === 'draft' && s.strategy_plan)
  const submittedItems = allSubmissions.filter(s => s.status === 'submitted')

  const handleShowConfirm = () => {
    if (!manualEntry.title || !manualEntry.dueDate) {
      alert('Please enter at least a title and due date')
      return
    }
    setShowConfirm(true)
  }

  const handleConfirmAdd = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          user_id: session.user.id,
          title: manualEntry.title,
          rfp_number: manualEntry.rfpNumber || null,
          agency: manualEntry.agency || null,
          due_date: manualEntry.dueDate || null,  // Convert empty string to null
          source: manualEntry.source || 'Manual Entry',
          estimated_value: manualEntry.estimatedValue || null,
          description: manualEntry.description || null,
          status: 'draft',
          questions: []
        })
        .select()
        .single()

      if (error) throw error

      setAllSubmissions([data, ...allSubmissions])
      setSavedOpportunity(data)
      setShowConfirm(false)
      setSaveSuccess(true)
      setManualEntry({ title: '', rfpNumber: '', agency: '', dueDate: '', source: '', estimatedValue: '', description: '' })
    } catch (err) {
      console.error('Error adding submission:', err)
      alert('Error saving opportunity. Please try again.')
    }
  }

  const calculateBucketMatch = (profile) => {
    if (!profile) return { percentage: 0, hasItems: [], submissionCount: 0 }
    
    const hasItems = []
    let score = 0
    const baseMax = 40  // Base score from profile

    // FOUNDATION (10 points)
    if (profile.company_name) { hasItems.push(profile.company_name); score += 2 }
    if (profile.city && profile.state) { hasItems.push(`Based in ${profile.city}, ${profile.state}`); score += 2 }
    if (profile.phone && profile.email) { score += 2 }
    
    // YOUR STORY (5 points)
    if (profile.mission) { score += 3 }
    if (profile.elevator_pitch) { score += 2 }

    // WHAT YOU DO (10 points)
    if (profile.services?.length > 0) { hasItems.push(`${profile.services.length} service area(s)`); score += 5 }
    if (profile.naics_codes?.length > 0) { hasItems.push(`NAICS codes on file`); score += 5 }

    // FEDERAL READY (5 points)
    if (profile.sam_registered) { hasItems.push('SAM.gov Registered'); score += 5 }

    // EXPERIENCE - Weighted higher! (8 points)
    if (profile.past_performance?.length > 0) { 
      hasItems.push(`${profile.past_performance.length} past performance record(s)`)
      score += 3
      if (profile.past_performance.length >= 3) score += 2  // Bonus
    }
    if (profile.year_established) { 
      const years = new Date().getFullYear() - parseInt(profile.year_established)
      if (years > 0) {
        hasItems.push(`${years}+ years in business`)
        score += 3
      }
    }

    // TEAM (3 points)
    if (profile.team_members?.length > 0) { 
      hasItems.push(`${profile.team_members.length} key personnel`)
      score += 2
      if (profile.team_members.length >= 3) score += 1
    }

    // CERTIFICATIONS - Nice to have (1 point)
    if (profile.certifications?.length > 0) { 
      hasItems.push(`${profile.certifications.length} certification(s)`)
      score += 1 
    }

    // SUBMISSION BONUS - Grows with every submission!
    const submissionCount = profile.submission_count || 0
    if (submissionCount > 0) {
      hasItems.push(`${submissionCount} submission(s) completed`)
      score += submissionCount * 3  // +3 per submission
    }

    // Calculate percentage (can exceed 100% for active users)
    const percentage = Math.round((score / baseMax) * 100)

    return { percentage, hasItems, submissionCount }
  }

  const openResponseBuilder = (opp) => {
    setSelectedOpportunity(opp)
    setShowResponseBuilder(true)
  }

  if (showResponseBuilder && selectedOpportunity) {
    return (
      <ResponseBuilder
        opportunity={selectedOpportunity}
        profile={profileData}
        session={session}
        onBack={() => { setShowResponseBuilder(false); setSelectedOpportunity(null); fetchSubmissions() }}
        calculateBucketMatch={calculateBucketMatch}
      />
    )
  }

  const tabStyle = (isActive) => ({
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: isActive ? colors.primary : 'transparent',
    color: isActive ? colors.background : colors.gray,
    fontWeight: isActive ? '600' : '400',
    cursor: 'pointer',
    fontSize: '14px'
  })

  const inputStyle = {
    width: '100%',
    padding: '12px 15px',
    borderRadius: '8px',
    border: `1px solid ${colors.gray}50`,
    backgroundColor: '#1a1a1a',
    color: colors.white,
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box'
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Dashboard</button>
          <h1 style={{ color: colors.white, margin: 0, fontSize: '20px' }}>My Cart</h1>
          <button onClick={() => setShowAddManual(true)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>+ Add</button>
        </div>
      </div>

      <div style={{ padding: '20px 30px 0 30px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('cart')} style={tabStyle(activeTab === 'cart')}>Considering ({cartItems.length})</button>
        <button onClick={() => setActiveTab('inprogress')} style={tabStyle(activeTab === 'inprogress')}>In Progress ({inProgressItems.length})</button>
        <button onClick={() => setActiveTab('submitted')} style={tabStyle(activeTab === 'submitted')}>Submitted ({submittedItems.length})</button>
      </div>

      <div style={{ padding: '20px 30px' }}>
        {loading ? (
          <p style={{ color: colors.gray, textAlign: 'center' }}>Loading...</p>
        ) : (
          <>
            {activeTab === 'cart' && (
              cartItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: colors.card, borderRadius: '16px' }}>
                  <p style={{ color: colors.gray, fontSize: '18px', margin: '0 0 10px 0' }}>No opportunities yet</p>
                  <p style={{ color: colors.gray, fontSize: '14px', margin: '0 0 20px 0' }}>Add contracts you are considering</p>
                  <button onClick={() => setShowAddManual(true)} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>+ Add Opportunity</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {cartItems.map(item => (
                    <div key={item.id} style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.gray}30`, position: 'relative' }}>
                      {/* DELETE BUTTON - TOP RIGHT */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                        style={{ 
                          position: 'absolute', 
                          top: '12px', 
                          right: '12px', 
                          background: '#ff4444',
                          border: 'none', 
                          color: 'white', 
                          cursor: 'pointer', 
                          fontSize: '14px',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontWeight: '600'
                        }}
                        title="Delete this opportunity"
                      >
                        ✕ Delete
                      </button>
                      
                      <div onClick={() => openResponseBuilder(item)} style={{ cursor: 'pointer', paddingRight: '80px' }}>
                        {/* Source indicator */}
                        {item.source && (
                          <span style={{ 
                            fontSize: '11px', 
                            backgroundColor: `${colors.primary}20`, 
                            color: colors.primary, 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            marginBottom: '8px', 
                            display: 'inline-block' 
                          }}>
                            📍 {item.source}
                          </span>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '16px' }}>{item.title}</h3>
                            <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{item.agency || 'No agency specified'}</p>
                            {item.description && (
                              <p style={{ color: colors.gray, margin: '8px 0 0 0', fontSize: '13px', lineHeight: '1.4' }}>
                                {item.description.substring(0, 100)}{item.description.length > 100 ? '...' : ''}
                              </p>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', marginLeft: '20px' }}>
                            <p style={{ color: colors.gold, margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600' }}>Due: {new Date(item.due_date).toLocaleDateString()}</p>
                            {item.estimated_value && <p style={{ color: colors.gray, margin: 0, fontSize: '12px' }}>{item.estimated_value}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'inprogress' && (
              inProgressItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: colors.card, borderRadius: '16px' }}>
                  <p style={{ color: colors.gray, fontSize: '18px', margin: '0 0 10px 0' }}>Nothing in progress</p>
                  <p style={{ color: colors.gray, fontSize: '14px', margin: 0 }}>Click Go After This on an opportunity to start</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {inProgressItems.map(item => {
                    const answered = item.questions?.filter(q => q.response).length || 0
                    const total = item.questions?.length || 0
                    const percent = total > 0 ? Math.round((answered / total) * 100) : 0
                    return (
                      <div key={item.id} onClick={() => openResponseBuilder(item)} style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.primary}30`, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '11px', backgroundColor: `${colors.primary}20`, color: colors.primary, padding: '2px 8px', borderRadius: '4px', marginBottom: '5px', display: 'inline-block' }}>{percent}% complete</span>
                            <h3 style={{ color: colors.white, margin: '5px 0', fontSize: '16px' }}>{item.title}</h3>
                            <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{item.agency || 'No agency specified'}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ color: colors.primary, margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600' }}>{answered} of {total}</p>
                            <p style={{ color: colors.gold, margin: 0, fontSize: '12px' }}>Due: {new Date(item.due_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {activeTab === 'submitted' && (
              submittedItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: colors.card, borderRadius: '16px' }}>
                  <p style={{ color: colors.gray, fontSize: '18px', margin: '0 0 10px 0' }}>No submissions yet</p>
                  <p style={{ color: colors.gray, fontSize: '14px', margin: 0 }}>Your submitted bids will appear here</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {submittedItems.map(item => (
                    <div key={item.id} onClick={() => openResponseBuilder(item)} style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.primary}50`, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ color: colors.primary, fontSize: '12px', fontWeight: '600' }}>SUBMITTED</span>
                          <h3 style={{ color: colors.white, margin: '5px 0', fontSize: '16px' }}>{item.title}</h3>
                          <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{item.agency || 'No agency specified'}</p>
                        </div>
                        <p style={{ color: colors.gray, margin: '0', fontSize: '12px' }}>{item.questions?.length || 0} responses</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Smart Add Opportunity Modal */}
      {showAddManual && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '550px', width: '100%', border: `2px solid ${colors.primary}`, maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* STEP 1: Search Input */}
            {searchMode === 'input' && (
              <>
                <h2 style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '22px' }}>🔍 Find Opportunity</h2>
                <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '14px' }}>Enter the contract or grant name — we'll find the details for you</p>
                
                <div style={{ marginBottom: '20px' }}>
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
                    placeholder="e.g., LA County ARISE Community Grant Program" 
                    style={{ ...inputStyle, fontSize: '16px', padding: '16px' }}
                    autoFocus
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleCloseAddModal} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleSmartSearch} disabled={!searchQuery.trim()} style={{ flex: 2, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: searchQuery.trim() ? colors.primary : colors.gray, color: colors.background, fontWeight: '600', cursor: searchQuery.trim() ? 'pointer' : 'not-allowed' }}>Search Public Sources</button>
                </div>
                
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.gray}30` }}>
                  <button onClick={handleGoManual} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px dashed ${colors.gray}50`, backgroundColor: 'transparent', color: colors.gray, cursor: 'pointer', fontSize: '13px' }}>
                    Or enter details manually →
                  </button>
                </div>
              </>
            )}

            {/* STEP 2: Searching... */}
            {searchMode === 'searching' && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔍</div>
                <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>Searching...</h3>
                <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '14px' }}>Checking SAM.gov, Grants.gov, and agency websites</p>
                <p style={{ color: colors.gold, margin: '0 0 20px 0', fontSize: '13px', fontStyle: 'italic' }}>⏱️ This may take 10-20 seconds — CR-AI is searching the web for you</p>
                <div style={{ marginTop: '10px' }}>
                  <div style={{ width: '200px', height: '4px', backgroundColor: colors.gray + '30', borderRadius: '2px', margin: '0 auto', overflow: 'hidden' }}>
                    <div style={{ width: '50%', height: '100%', backgroundColor: colors.primary, animation: 'pulse 1.5s infinite', borderRadius: '2px' }} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Results Found - Confirm */}
            {searchMode === 'results' && searchResults && (
              <>
                <h2 style={{ color: colors.primary, margin: '0 0 5px 0', fontSize: '20px' }}>✓ Found It!</h2>
                <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '14px' }}>Is this the opportunity you're looking for?</p>
                
                <div style={{ backgroundColor: colors.background, borderRadius: '12px', padding: '20px', marginBottom: '20px', border: `1px solid ${colors.primary}50` }}>
                  <h3 style={{ color: colors.white, margin: '0 0 15px 0', fontSize: '18px' }}>{searchResults.title}</h3>
                  
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {searchResults.agency && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ color: colors.gray, minWidth: '80px', fontSize: '13px' }}>Agency:</span>
                        <span style={{ color: colors.white, fontSize: '14px' }}>{searchResults.agency}</span>
                      </div>
                    )}
                    {searchResults.estimatedValue && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ color: colors.gray, minWidth: '80px', fontSize: '13px' }}>Value:</span>
                        <span style={{ color: colors.gold, fontSize: '14px', fontWeight: '600' }}>{searchResults.estimatedValue}</span>
                      </div>
                    )}
                    {searchResults.dueDate && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ color: colors.gray, minWidth: '80px', fontSize: '13px' }}>Due Date:</span>
                        <span style={{ color: colors.white, fontSize: '14px' }}>{searchResults.dueDate}</span>
                      </div>
                    )}
                    {searchResults.rfpNumber && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ color: colors.gray, minWidth: '80px', fontSize: '13px' }}>RFP #:</span>
                        <span style={{ color: colors.white, fontSize: '14px' }}>{searchResults.rfpNumber}</span>
                      </div>
                    )}
                    {searchResults.description && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${colors.gray}30` }}>
                        <span style={{ color: colors.gray, fontSize: '13px', display: 'block', marginBottom: '5px' }}>Description:</span>
                        <p style={{ color: colors.white, fontSize: '14px', margin: 0, lineHeight: '1.5' }}>{searchResults.description}</p>
                      </div>
                    )}
                    
                    {/* Contact Info */}
                    {(searchResults.contactName || searchResults.contactEmail || searchResults.contactPhone) && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${colors.gray}30` }}>
                        <span style={{ color: colors.gray, fontSize: '13px', display: 'block', marginBottom: '8px' }}>Contact:</span>
                        {searchResults.contactName && <p style={{ color: colors.white, fontSize: '14px', margin: '0 0 4px 0' }}>{searchResults.contactName}</p>}
                        {searchResults.contactPhone && <p style={{ color: colors.primary, fontSize: '13px', margin: '0 0 4px 0' }}>📞 {searchResults.contactPhone}</p>}
                        {searchResults.contactEmail && <p style={{ color: colors.primary, fontSize: '13px', margin: 0 }}>✉️ {searchResults.contactEmail}</p>}
                      </div>
                    )}
                    
                    {searchResults.source && (
                      <div style={{ marginTop: '5px' }}>
                        <span style={{ color: colors.gray, fontSize: '11px' }}>Source: {searchResults.source}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleSearchAgain} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}>No, Search Again</button>
                  <button onClick={handleAcceptResult} style={{ flex: 2, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Yes, This Is It</button>
                </div>
              </>
            )}

            {/* STEP 4: Not Found */}
            {searchMode === 'notfound' && (
              <>
                <h2 style={{ color: colors.gold, margin: '0 0 8px 0', fontSize: '20px' }}>⚠️ Not Found</h2>
                <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '14px' }}>
                  We couldn't find "{searchQuery}" in public databases. This might be a new posting, agency-specific, or spelled differently.
                </p>
                
                {searchError && (
                  <p style={{ color: colors.red, fontSize: '13px', marginBottom: '15px' }}>{searchError}</p>
                )}
                
                <div style={{ display: 'grid', gap: '10px' }}>
                  <button onClick={handleSearchAgain} style={{ padding: '14px', borderRadius: '8px', border: `1px solid ${colors.primary}`, backgroundColor: 'transparent', color: colors.primary, cursor: 'pointer' }}>🔍 Try Different Search</button>
                  <button onClick={handleGoManual} style={{ padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Enter Details Manually</button>
                  <button onClick={handleCloseAddModal} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                </div>
              </>
            )}

            {/* STEP 5: Manual Entry (fallback) */}
            {searchMode === 'manual' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ color: colors.white, margin: 0, fontSize: '22px' }}>Add Opportunity</h2>
                  <button onClick={handleSearchAgain} style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${colors.gray}50`, backgroundColor: 'transparent', color: colors.gray, cursor: 'pointer', fontSize: '12px' }}>← Back to Search</button>
                </div>
                
                <div style={{ display: 'grid', gap: '15px' }}>
                  <div>
                    <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Title / Contract Name *</label>
                    <input type="text" value={manualEntry.title} onChange={(e) => setManualEntry({ ...manualEntry, title: e.target.value })} placeholder="e.g., Mental Health Services RFP" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Due Date *</label>
                    <input type="date" value={manualEntry.dueDate} onChange={(e) => setManualEntry({ ...manualEntry, dueDate: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Agency / Organization</label>
                    <input type="text" value={manualEntry.agency} onChange={(e) => setManualEntry({ ...manualEntry, agency: e.target.value })} placeholder="e.g., LA County DMH" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Estimated Value</label>
                    <input type="text" value={manualEntry.estimatedValue} onChange={(e) => setManualEntry({ ...manualEntry, estimatedValue: e.target.value })} placeholder="e.g., $50,000 - $100,000" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>What is this contract asking for?</label>
                    <textarea value={manualEntry.description} onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })} placeholder="Describe what the agency is looking for, the scope of work, key requirements..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                  <button onClick={handleCloseAddModal} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleShowConfirm} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Add to Cart</button>
                </div>
              </>
            )}
            
          </div>
        </div>
      )}

      {showConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '20px' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '400px', width: '100%', border: `2px solid ${colors.gold}`, textAlign: 'center' }}>
            <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>Add to Cart?</h3>
            <p style={{ color: colors.gray, margin: '0 0 5px 0', fontSize: '16px' }}>{manualEntry.title}</p>
            <p style={{ color: colors.gold, margin: '0 0 20px 0', fontSize: '14px' }}>Due: {new Date(manualEntry.dueDate).toLocaleDateString()}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConfirmAdd} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '20px' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '400px', width: '100%', border: `2px solid ${colors.primary}`, textAlign: 'center' }}>
            <h3 style={{ color: colors.primary, margin: '0 0 10px 0' }}>Added to Cart</h3>
            <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '14px' }}>{savedOpportunity?.title}</p>
            <div style={{ display: 'grid', gap: '10px' }}>
              <button onClick={() => { setSaveSuccess(false); handleCloseAddModal(); if (savedOpportunity) openResponseBuilder(savedOpportunity) }} style={{ padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Start Working on It</button>
              <button onClick={() => { setSaveSuccess(false); handleCloseAddModal() }} style={{ padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, cursor: 'pointer' }}>Add Another</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ==========================================
// RESPONSE BUILDER
// ==========================================
function ResponseBuilder({ opportunity, profile, session, onBack, calculateBucketMatch }) {
  // Determine starting phase based on what's already done
  const getStartingPhase = () => {
    if (opportunity.questions?.length > 0) return 'answers'
    if (opportunity.strategy_plan) return 'questions'
    return 'overview'
  }
  
  const [phase, setPhase] = useState(getStartingPhase())
  const [localOpportunity, setLocalOpportunity] = useState(opportunity)
  
  // New question entry state
  const [newQuestionText, setNewQuestionText] = useState('')
  const [newQuestionLimit, setNewQuestionLimit] = useState('2000')
  
  // Save status
  const [saveStatus, setSaveStatus] = useState('saved')

  // Edit Details modal
  const [showEditDetails, setShowEditDetails] = useState(false)
  const [editDetails, setEditDetails] = useState({
    title: opportunity.title || '',
    agency: opportunity.agency || '',
    estimatedValue: opportunity.estimated_value || '',
    description: opportunity.description || ''
  })

  // Strategy state
  const [generatingStrategy, setGeneratingStrategy] = useState(false)
  const [programTitle, setProgramTitle] = useState(opportunity.strategy_plan?.title || '')
  const [approach, setApproach] = useState(opportunity.strategy_plan?.approach || '')
  const [originalTitle, setOriginalTitle] = useState('')
  const [originalApproach, setOriginalApproach] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingApproach, setEditingApproach] = useState(false)
  const [newDirection, setNewDirection] = useState('')
  
  // Answers state
  const [questions, setQuestions] = useState(opportunity.questions || [])
  const [generatingAnswers, setGeneratingAnswers] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [shorteningIndex, setShorteningIndex] = useState(null)
  
  // Review state
  const [acknowledged, setAcknowledged] = useState(false)
  const [showAddToBucket, setShowAddToBucket] = useState(false)

  const daysLeft = Math.ceil((new Date(localOpportunity.due_date) - new Date()) / (1000 * 60 * 60 * 24))
  const bucketMatch = calculateBucketMatch(profile)

  const inputStyle = {
    width: '100%',
    padding: '12px 15px',
    borderRadius: '8px',
    border: `1px solid ${colors.gray}50`,
    backgroundColor: '#1a1a1a',
    color: colors.white,
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box'
  }

  // Save to database
  const saveToDatabase = async (updates) => {
    setSaveStatus('saving')
    try {
      await supabase.from('submissions').update(updates).eq('id', localOpportunity.id)
      setSaveStatus('saved')
      // Update local state
      setLocalOpportunity(prev => ({ ...prev, ...updates }))
    } catch (err) {
      console.error('Error saving:', err)
      setSaveStatus('error')
    }
  }

  // Save edited details
  const handleSaveDetails = async () => {
    await saveToDatabase({
      title: editDetails.title,
      agency: editDetails.agency,
      estimated_value: editDetails.estimatedValue,
      description: editDetails.description
    })
    setShowEditDetails(false)
  }

  // Auto-save questions
  useEffect(() => {
    if (questions.length > 0) {
      const timer = setTimeout(() => {
        saveToDatabase({ questions })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [questions])

  // Clean text - remove markdown/asterisks/emojis
  const cleanText = (text) => {
    if (!text) return ''
    return text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^#+\s/gm, '')
      .replace(/^[-•]\s/gm, '')
      .replace(/^\d+\.\s/gm, '')
      .trim()
  }

  // Generate Strategy
  const handleGenerateStrategy = async (direction = '') => {
    setGeneratingStrategy(true)
    try {
      const prompt = direction 
        ? `Generate a program title and 1-2 sentence approach for this contract based on this direction: "${direction}"`
        : `Generate a program title and 1-2 sentence approach for this contract`

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `${prompt}

Contract: ${localOpportunity.title}
Agency: ${localOpportunity.agency || 'Not specified'}
${localOpportunity.description ? `Description: ${localOpportunity.description}` : ''}

Return ONLY in this exact format (plain text, no asterisks, no bullets, no emojis):
TITLE: [creative program title here]
APPROACH: [1-2 sentence approach here]`,
          profile: profile,
          opportunity: { title: localOpportunity.title, agency: localOpportunity.agency },
          isStrategyGeneration: true
        }),
      })

      if (!response.ok) throw new Error('Failed to generate')
      const data = await response.json()
      
      const text = cleanText(data.response)
      const titleMatch = text.match(/TITLE:\s*(.+?)(?=APPROACH:|$)/is)
      const approachMatch = text.match(/APPROACH:\s*(.+)/is)
      
      const newTitle = cleanText(titleMatch ? titleMatch[1] : 'Community Initiative Program')
      const newApproach = cleanText(approachMatch ? approachMatch[1] : text.substring(0, 150))
      
      if (!originalTitle) {
        setOriginalTitle(newTitle)
        setOriginalApproach(newApproach)
      }
      
      setProgramTitle(newTitle)
      setApproach(newApproach)
      
      await saveToDatabase({ 
        strategy_plan: { title: newTitle, approach: newApproach, generatedAt: new Date().toISOString() }
      })
      
    } catch (err) {
      console.error('Error generating strategy:', err)
      alert('BUCKET + CR-AI had trouble. Please try again.')
    } finally {
      setGeneratingStrategy(false)
    }
  }

  // Generate All Answers
  const handleGenerateAllAnswers = async () => {
    if (questions.length === 0) {
      alert('Add at least one question first')
      return
    }
    
    setGeneratingAnswers(true)
    try {
      // Generate answers for each question the user entered
      const updatedQuestions = [...questions]
      
      for (let i = 0; i < updatedQuestions.length; i++) {
        const q = updatedQuestions[i]
        
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: `Answer this question in plain text, no formatting, no asterisks, no emojis.

QUESTION: ${q.text}

Program Title: ${programTitle}
Approach: ${approach}
Contract: ${localOpportunity.title}
Agency: ${localOpportunity.agency || 'Not specified'}
${localOpportunity.description ? `Contract Description: ${localOpportunity.description}` : ''}

CRITICAL: Stay under ${q.charLimit} characters. Aim for ${Math.floor(q.charLimit * 0.9)} characters.`,
            profile: profile,
            opportunity: { title: localOpportunity.title, agency: localOpportunity.agency },
            strategyPlan: `Title: ${programTitle}\nApproach: ${approach}`,
            charLimit: q.charLimit,
            previousResponses: updatedQuestions.slice(0, i).filter(prev => prev.response)
          }),
        })

        if (response.ok) {
          const data = await response.json()
          updatedQuestions[i] = { 
            ...q, 
            response: cleanText(data.response), 
            source: 'bucket-crai' 
          }
        }
      }
      
      setQuestions(updatedQuestions)
      saveToDatabase({ questions: updatedQuestions })
      
    } catch (err) {
      console.error('Error generating answers:', err)
      alert('CR-AI had trouble. Please try again.')
    } finally {
      setGeneratingAnswers(false)
    }
  }

  // Regenerate single answer
  const handleRegenerateAnswer = async (index) => {
    const question = questions[index]
    setEditingIndex(index)
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Answer this question in plain text, no formatting, no emojis, under ${question.charLimit} characters:

${question.text}

Program: ${programTitle}
Approach: ${approach}`,
          profile: profile,
          charLimit: question.charLimit
        }),
      })

      if (!response.ok) throw new Error('Failed to regenerate')
      const data = await response.json()
      
      let answer = cleanText(data.response)
      if (answer.length > question.charLimit) answer = answer.substring(0, question.charLimit - 3) + '...'
      
      const updated = [...questions]
      updated[index] = { ...updated[index], response: answer, source: 'bucket-crai' }
      setQuestions(updated)
    } catch (err) {
      console.error('Error regenerating:', err)
    } finally {
      setEditingIndex(null)
    }
  }

  // Auto-shorten
  const handleAutoShorten = async (index) => {
    const question = questions[index]
    setShorteningIndex(index)
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Shorten this to under ${question.charLimit - 10} characters. Keep key points. Plain text only, no formatting, no emojis:

${question.response}`,
          charLimit: question.charLimit,
          isShortening: true
        }),
      })

      if (!response.ok) throw new Error('Failed to shorten')
      const data = await response.json()
      
      let shortened = cleanText(data.response)
      if (shortened.length > question.charLimit) shortened = shortened.substring(0, question.charLimit - 3) + '...'
      
      const updated = [...questions]
      updated[index] = { ...updated[index], response: shortened, source: 'bucket-crai' }
      setQuestions(updated)
    } catch (err) {
      console.error('Error shortening:', err)
    } finally {
      setShorteningIndex(null)
    }
  }

  const handleSaveEdit = (index) => {
    const question = questions[index]
    if (editingText.length > question.charLimit) {
      alert(`Cannot save. ${editingText.length - question.charLimit} characters over limit.`)
      return
    }
    const updated = [...questions]
    updated[index] = { ...updated[index], response: editingText, source: 'user-edited' }
    setQuestions(updated)
    setEditingIndex(null)
    setEditingText('')
  }

  const handleArchive = async () => {
    if (confirm('Archive this opportunity?')) {
      await saveToDatabase({ status: 'archived' })
      onBack()
    }
  }

  const handleExport = () => {
    const overLimit = questions.some(q => q.response?.length > q.charLimit)
    if (overLimit) {
      alert('Fix answers over the character limit before exporting.')
      return
    }

    let exportText = `${localOpportunity.title}\n`
    if (localOpportunity.agency) exportText += `${localOpportunity.agency}\n`
    exportText += `Due: ${new Date(localOpportunity.due_date).toLocaleDateString()}\n\n`
    exportText += `Program Title: ${programTitle}\n`
    exportText += `Approach: ${approach}\n\n`
    exportText += `${'='.repeat(50)}\n\n`
    
    questions.forEach((q, i) => { 
      exportText += `Question ${i + 1} of ${questions.length}:\n${q.text}\n\n`
      exportText += `Answer:\n${q.response || '[Not answered]'}\n\n`
      exportText += `${'-'.repeat(40)}\n\n`
    })
    
    exportText += `\nPrepared with BUCKET + CR-AI Technology\nContract Ready`
    
    navigator.clipboard.writeText(exportText).then(() => alert('Copied to clipboard!'))
  }

  const handleMarkSubmitted = async () => {
    const overLimit = questions.some(q => q.response?.length > q.charLimit)
    if (overLimit) {
      alert('Fix answers over the character limit before submitting.')
      return
    }
    if (!acknowledged) {
      alert('Please check the acknowledgment box.')
      return
    }
    
    await saveToDatabase({ status: 'submitted', submitted_at: new Date().toISOString() })
    setShowAddToBucket(true)
  }

  const handleAddToBucket = async () => {
    try {
      // 1. Save each answer to saved_answers table for reuse
      const savedAnswers = questions.map(q => ({
        user_id: session.user.id,
        question_text: q.text,
        answer_text: q.response,
        char_limit: q.charLimit,
        source_submission_id: localOpportunity.id,
        source_contract_title: localOpportunity.title,
        source_agency: localOpportunity.agency,
        program_title: programTitle,
        created_at: new Date().toISOString()
      }))

      // Insert saved answers (will create table if using Supabase)
      const { error: answersError } = await supabase
        .from('saved_answers')
        .insert(savedAnswers)

      if (answersError) {
        console.log('Note: saved_answers table may not exist yet:', answersError.message)
      }

      // 2. Update submission count in business_profiles
      const { data: profileData } = await supabase
        .from('business_profiles')
        .select('submission_count')
        .eq('user_id', session.user.id)
        .single()

      const currentCount = profileData?.submission_count || 0

      await supabase
        .from('business_profiles')
        .update({ 
          submission_count: currentCount + 1,
          last_submission_at: new Date().toISOString()
        })
        .eq('user_id', session.user.id)

      // 3. Mark the submission as added to bucket
      await supabase
        .from('submissions')
        .update({ added_to_bucket: true })
        .eq('id', localOpportunity.id)

      // Success!
      setShowAddToBucket(false)
      onBack()
      
    } catch (err) {
      console.error('Error saving to BUCKET:', err)
      // Still close and go back even if save fails
      setShowAddToBucket(false)
      onBack()
    }
  }

  const handleSkipAddToBucket = () => {
    setShowAddToBucket(false)
    onBack()
  }

  const answeredCount = questions.filter(q => q.response).length
  const totalQuestions = questions.length
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
  const issueCount = questions.filter(q => q.response?.length > q.charLimit).length

  // Progress Stepper Component
  const ProgressStepper = () => {
    const steps = [
      { id: 'overview', label: 'Overview', num: 1 },
      { id: 'strategy', label: 'Strategy', num: 2 },
      { id: 'questions', label: 'Questions', num: 3 },
      { id: 'answers', label: 'Answers', num: 4 },
      { id: 'review', label: 'Review', num: 5 }
    ]
    
    const currentIndex = steps.findIndex(s => s.id === phase || (phase === 'change-approach' && s.id === 'strategy'))
    
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '15px 20px', backgroundColor: colors.card, borderBottom: `1px solid ${colors.gray}20` }}>
        {steps.map((step, i) => {
          const isActive = i === currentIndex
          const isComplete = i < currentIndex
          const isFuture = i > currentIndex
          
          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '28px', 
                height: '28px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: isComplete ? colors.primary : isActive ? colors.gold : 'transparent',
                border: `2px solid ${isComplete ? colors.primary : isActive ? colors.gold : colors.gray}50`,
                color: isComplete || isActive ? colors.background : colors.gray,
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {isComplete ? '✓' : step.num}
              </div>
              <span style={{ 
                color: isActive ? colors.white : isComplete ? colors.primary : colors.gray, 
                fontSize: '12px',
                fontWeight: isActive ? '600' : '400',
                display: window.innerWidth > 500 ? 'inline' : 'none'
              }}>
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <div style={{ width: '20px', height: '2px', backgroundColor: isComplete ? colors.primary : `${colors.gray}30` }} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Add a new question from RFP
  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) {
      alert('Please enter the question text')
      return
    }
    
    const newQuestion = {
      id: `q-${Date.now()}`,
      text: newQuestionText.trim(),
      charLimit: parseInt(newQuestionLimit) || 2000,
      response: '',
      source: ''
    }
    
    const updated = [...questions, newQuestion]
    setQuestions(updated)
    saveToDatabase({ questions: updated })
    setNewQuestionText('')
    setNewQuestionLimit('2000')
  }

  // Remove a question
  const handleRemoveQuestion = (index) => {
    const updated = questions.filter((_, i) => i !== index)
    setQuestions(updated)
    saveToDatabase({ questions: updated })
  }

  // Save status display
  const SaveIndicator = () => (
    <span style={{ color: saveStatus === 'saved' ? colors.primary : saveStatus === 'saving' ? colors.gold : colors.red, fontSize: '12px' }}>
      {saveStatus === 'saved' && 'Saved'}
      {saveStatus === 'saving' && 'Saving...'}
      {saveStatus === 'error' && 'Error saving'}
    </span>
  )

  // ==========================================
  // PHASE 1: OVERVIEW
  // Small business owner clicks here to decide: Should I pursue this?
  // They need to see: What is this contract? Who is it from? What do they want?
  // ==========================================
  if (phase === 'overview') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Back to Cart</button>
          <SaveIndicator />
        </div>
        
        <ProgressStepper />

        <div style={{ padding: '25px 20px', maxWidth: '600px', margin: '0 auto' }}>
          
          {/* Contract Title */}
          <h1 style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '22px' }}>{localOpportunity.title}</h1>
          
          {/* Agency */}
          <p style={{ color: colors.primary, margin: '0 0 20px 0', fontSize: '16px' }}>
            {localOpportunity.agency || 'No agency specified'}
          </p>
          
          {/* Key Details Row */}
          <div style={{ display: 'flex', gap: '25px', marginBottom: '25px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: colors.gray, margin: '0 0 4px 0', fontSize: '12px' }}>DUE DATE</p>
              <p style={{ color: colors.gold, margin: 0, fontSize: '18px', fontWeight: '600' }}>{daysLeft} days left</p>
            </div>
            <div>
              <p style={{ color: colors.gray, margin: '0 0 4px 0', fontSize: '12px' }}>VALUE</p>
              <p style={{ color: colors.white, margin: 0, fontSize: '18px', fontWeight: '600' }}>
                {localOpportunity.estimated_value || 'Not specified'}
              </p>
            </div>
          </div>

          {/* ABOUT THIS OPPORTUNITY - Always visible */}
          <div style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.gray}30`, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '12px', fontWeight: '600' }}>ABOUT THIS OPPORTUNITY</p>
              <button 
                onClick={() => setShowEditDetails(true)} 
                style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontSize: '13px' }}
              >
                Edit
              </button>
            </div>
            {localOpportunity.description ? (
              <p style={{ color: colors.white, margin: 0, fontSize: '15px', lineHeight: '1.6' }}>{localOpportunity.description}</p>
            ) : (
              <div>
                <p style={{ color: colors.gray, margin: '0 0 12px 0', fontSize: '14px', fontStyle: 'italic' }}>
                  No description added yet. Add details about what this contract is asking for to help CR-AI generate better responses.
                </p>
                <button 
                  onClick={() => setShowEditDetails(true)} 
                  style={{ padding: '10px 20px', borderRadius: '8px', border: `1px solid ${colors.primary}`, backgroundColor: 'transparent', color: colors.primary, cursor: 'pointer', fontSize: '14px' }}
                >
                  + Add Description
                </button>
              </div>
            )}
          </div>

          {/* BUCKET Match - ENCOURAGING messaging */}
          <div style={{ backgroundColor: `${colors.primary}10`, borderRadius: '12px', padding: '18px', border: `1px solid ${colors.primary}30`, marginBottom: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: colors.white, fontSize: '16px', fontWeight: '600' }}>Your BUCKET</span>
              <span style={{ backgroundColor: colors.primary, color: colors.background, padding: '6px 14px', borderRadius: '20px', fontWeight: '700' }}>{bucketMatch.percentage}%</span>
            </div>
            
            {/* Encouraging message based on score */}
            <p style={{ color: colors.white, margin: '0 0 12px 0', fontSize: '14px', fontWeight: '500' }}>
              {bucketMatch.percentage >= 80 
                ? "You're ready! CR-AI has what it needs to help you win this." 
                : bucketMatch.percentage >= 50 
                  ? "You have a strong foundation. CR-AI can fill in the gaps."
                  : "You can still go after this! CR-AI will help you build as you go."
              }
            </p>
            
            {bucketMatch.hasItems.length > 0 && (
              <div style={{ display: 'grid', gap: '4px', marginBottom: '12px' }}>
                {bucketMatch.hasItems.slice(0, 4).map((item, i) => (
                  <p key={i} style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>✓ {item}</p>
                ))}
              </div>
            )}
            
            {bucketMatch.percentage < 80 && (
              <p style={{ color: colors.gold, margin: 0, fontSize: '12px', fontStyle: 'italic' }}>
                💡 Remember: You're a contract manager — CR-AI helps you hire the team and fill the gaps.
              </p>
            )}
          </div>

          {/* Actions */}
          <button 
            onClick={() => { setPhase('strategy'); if (!programTitle) handleGenerateStrategy() }} 
            style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '16px', fontWeight: '700', cursor: 'pointer', marginBottom: '10px' }}
          >
            Go After This
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button onClick={handleArchive} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${colors.gray}50`, backgroundColor: 'transparent', color: colors.gray, fontSize: '13px', cursor: 'pointer' }}>Not a Fit</button>
            <button onClick={onBack} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${colors.gold}50`, backgroundColor: 'transparent', color: colors.gold, fontSize: '13px', cursor: 'pointer' }}>Save for Later</button>
          </div>
        </div>

        {/* Edit Details Modal */}
        {showEditDetails && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '500px', width: '100%', border: `2px solid ${colors.primary}`, maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ color: colors.white, margin: '0 0 20px 0', fontSize: '20px' }}>Edit Opportunity Details</h2>
              <div style={{ display: 'grid', gap: '15px' }}>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Title</label>
                  <input 
                    type="text" 
                    value={editDetails.title} 
                    onChange={(e) => setEditDetails({ ...editDetails, title: e.target.value })} 
                    style={inputStyle} 
                  />
                </div>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Agency / Organization</label>
                  <input 
                    type="text" 
                    value={editDetails.agency} 
                    onChange={(e) => setEditDetails({ ...editDetails, agency: e.target.value })} 
                    placeholder="e.g., LA County DMH"
                    style={inputStyle} 
                  />
                </div>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Estimated Value</label>
                  <input 
                    type="text" 
                    value={editDetails.estimatedValue} 
                    onChange={(e) => setEditDetails({ ...editDetails, estimatedValue: e.target.value })} 
                    placeholder="e.g., $50,000 - $100,000"
                    style={inputStyle} 
                  />
                </div>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>What is this contract asking for?</label>
                  <textarea 
                    value={editDetails.description} 
                    onChange={(e) => setEditDetails({ ...editDetails, description: e.target.value })} 
                    placeholder="Describe the scope of work, key requirements, what the agency is looking for..."
                    rows={5} 
                    style={{ ...inputStyle, resize: 'vertical' }} 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                <button onClick={() => setShowEditDetails(false)} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveDetails} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==========================================
  // PHASE 2: STRATEGY
  // CR-AI generates a title and approach based on their BUCKET and the contract
  // ==========================================
  if (phase === 'strategy') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setPhase('overview')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Back</button>
          <span style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>CR-AI</span>
          <SaveIndicator />
        </div>
        
        <ProgressStepper />

        <div style={{ padding: '25px 20px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ marginBottom: '25px' }}>
            <h1 style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '20px' }}>{localOpportunity.title}</h1>
            <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
              {daysLeft} days left {localOpportunity.estimated_value && ` •  ${localOpportunity.estimated_value}`}
            </p>
          </div>

          {generatingStrategy ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: colors.primary, fontSize: '18px', margin: '0 0 10px 0' }}>CR-AI is thinking...</p>
              <p style={{ color: colors.gray, fontSize: '14px', margin: 0 }}>Creating a strategy based on your BUCKET</p>
            </div>
          ) : (
            <>
              {/* Explanation for first-timers */}
              <div style={{ backgroundColor: `${colors.gold}15`, borderRadius: '10px', padding: '15px', marginBottom: '20px', border: `1px solid ${colors.gold}30` }}>
                <p style={{ color: colors.white, margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
                  💡 <strong>What's happening:</strong> CR-AI looked at your BUCKET and this opportunity to suggest a program title and approach. You can edit these or ask for a different direction.
                </p>
              </div>
              
              {/* Program Title */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{ color: colors.gray, fontSize: '12px', margin: '0 0 8px 0' }}>PROGRAM TITLE</p>
                {editingTitle ? (
                  <div>
                    <input type="text" value={programTitle} onChange={(e) => setProgramTitle(e.target.value)} style={inputStyle} autoFocus />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button onClick={() => { setEditingTitle(false); saveToDatabase({ strategy_plan: { title: programTitle, approach } }) }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '13px', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => { setProgramTitle(originalTitle || programTitle); setEditingTitle(false) }} style={{ padding: '8px 16px', borderRadius: '6px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ backgroundColor: colors.card, borderRadius: '10px', padding: '15px', border: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ color: colors.white, margin: 0, fontSize: '16px', fontWeight: '500' }}>{programTitle || 'Generating...'}</p>
                    <button onClick={() => setEditingTitle(true)} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>Edit</button>
                  </div>
                )}
              </div>

              {/* Approach */}
              <div style={{ marginBottom: '25px' }}>
                <p style={{ color: colors.gray, fontSize: '12px', margin: '0 0 8px 0' }}>APPROACH</p>
                {editingApproach ? (
                  <div>
                    <textarea value={approach} onChange={(e) => setApproach(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} autoFocus />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button onClick={() => { setEditingApproach(false); saveToDatabase({ strategy_plan: { title: programTitle, approach } }) }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '13px', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => { setApproach(originalApproach || approach); setEditingApproach(false) }} style={{ padding: '8px 16px', borderRadius: '6px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ backgroundColor: colors.card, borderRadius: '10px', padding: '15px', border: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
                    <p style={{ color: colors.white, margin: 0, fontSize: '14px', lineHeight: '1.5' }}>{approach || 'Generating...'}</p>
                    <button onClick={() => setEditingApproach(true)} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>Edit</button>
                  </div>
                )}
              </div>

              <button onClick={() => setPhase('change-approach')} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${colors.gray}50`, backgroundColor: 'transparent', color: colors.gray, fontSize: '14px', cursor: 'pointer', marginBottom: '15px' }}>
                Try a Different Direction
              </button>

              <button onClick={() => setPhase('questions')} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>
                Continue to Questions
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 2B: CHANGE APPROACH
  // User wants a different direction - they tell us what they want
  // ==========================================
  if (phase === 'change-approach') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30` }}>
          <button onClick={() => setPhase('strategy')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Go Back</button>
        </div>
        
        <ProgressStepper />

        <div style={{ padding: '25px 20px', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '20px' }}>What direction do you want to go?</h2>
          <p style={{ color: colors.gray, margin: '0 0 25px 0', fontSize: '14px' }}>
            Tell CR-AI what angle you want to take. It will create a new title and approach based on your direction.
          </p>

          <textarea
            value={newDirection}
            onChange={(e) => setNewDirection(e.target.value)}
            placeholder="e.g., Focus on mobile mental health services for college students using our TeleHealth vans..."
            rows={4}
            style={{ ...inputStyle, marginBottom: '20px', resize: 'vertical' }}
            autoFocus
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={async () => {
                if (!newDirection.trim()) {
                  alert('Please describe the direction you want to go')
                  return
                }
                await handleGenerateStrategy(newDirection)
                setNewDirection('')
                setPhase('strategy')
              }}
              disabled={generatingStrategy}
              style={{ flex: 1, padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              {generatingStrategy ? 'Generating...' : 'Ask CR-AI'}
            </button>
            <button onClick={() => { setNewDirection(''); setPhase('strategy') }} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, fontSize: '14px', cursor: 'pointer' }}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 3: QUESTIONS ENTRY (NEW - CRITICAL)
  // User copy/pastes questions from the RFP
  // This is where they tell us WHAT to answer
  // ==========================================
  if (phase === 'questions') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setPhase('strategy')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Strategy</button>
          <span style={{ color: colors.white, fontSize: '14px', fontWeight: '600' }}>{questions.length} question{questions.length !== 1 ? 's' : ''} added</span>
          <SaveIndicator />
        </div>
        
        <ProgressStepper />

        <div style={{ padding: '25px 20px', maxWidth: '600px', margin: '0 auto' }}>
          
          {/* Instructions */}
          <div style={{ marginBottom: '25px' }}>
            <h1 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '20px' }}>Add Questions from the RFP</h1>
            <p style={{ color: colors.gray, margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
              Open your RFP document and copy/paste each question you need to answer. CR-AI will generate responses based on your BUCKET.
            </p>
          </div>

          {/* Helper tip */}
          <div style={{ backgroundColor: `${colors.gold}15`, borderRadius: '10px', padding: '15px', marginBottom: '25px', border: `1px solid ${colors.gold}30` }}>
            <p style={{ color: colors.white, margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
              💡 <strong>Tip:</strong> Look for questions like "Describe your approach to..." or "How will you..." in the RFP. Each one becomes a question here. Include the character limit if the RFP shows one.
            </p>
          </div>

          {/* Add Question Form */}
          <div style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.primary}30`, marginBottom: '20px' }}>
            <p style={{ color: colors.gray, fontSize: '12px', margin: '0 0 10px 0', fontWeight: '600' }}>ADD A QUESTION</p>
            
            <textarea
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="Paste or type a question from the RFP here..."
              rows={3}
              style={{ ...inputStyle, marginBottom: '15px', resize: 'vertical' }}
            />
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: colors.gray, fontSize: '12px', display: 'block', marginBottom: '5px' }}>Character Limit</label>
                <input
                  type="number"
                  value={newQuestionLimit}
                  onChange={(e) => setNewQuestionLimit(e.target.value)}
                  placeholder="2000"
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <p style={{ color: colors.gray, fontSize: '11px', flex: 2, margin: 0 }}>
                Check the RFP for limits. If none shown, 2000 is a safe default.
              </p>
            </div>
            
            <button 
              onClick={handleAddQuestion}
              disabled={!newQuestionText.trim()}
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '10px', 
                border: 'none', 
                backgroundColor: newQuestionText.trim() ? colors.primary : colors.gray, 
                color: colors.background, 
                fontSize: '14px', 
                fontWeight: '600', 
                cursor: newQuestionText.trim() ? 'pointer' : 'not-allowed' 
              }}
            >
              + Add Question
            </button>
          </div>

          {/* Questions List */}
          {questions.length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <p style={{ color: colors.gray, fontSize: '12px', margin: '0 0 15px 0', fontWeight: '600' }}>YOUR QUESTIONS ({questions.length})</p>
              
              {questions.map((q, index) => (
                <div key={q.id} style={{ backgroundColor: colors.card, borderRadius: '10px', padding: '15px', border: `1px solid ${colors.gray}30`, marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: colors.primary, fontSize: '11px', fontWeight: '600' }}>Q{index + 1}</span>
                      <p style={{ color: colors.white, margin: '5px 0 0 0', fontSize: '14px', lineHeight: '1.4' }}>{q.text}</p>
                      <p style={{ color: colors.gray, margin: '8px 0 0 0', fontSize: '11px' }}>{q.charLimit} character limit</p>
                    </div>
                    <button 
                      onClick={() => handleRemoveQuestion(index)}
                      style={{ background: 'none', border: 'none', color: colors.red, cursor: 'pointer', fontSize: '12px', padding: '5px' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {questions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: colors.card, borderRadius: '12px', marginBottom: '20px' }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>No questions added yet. Add at least one question from the RFP to continue.</p>
            </div>
          )}

          {/* Continue Button */}
          <button 
            onClick={() => { handleGenerateAllAnswers(); setPhase('answers') }}
            disabled={questions.length === 0}
            style={{ 
              width: '100%', 
              padding: '16px', 
              borderRadius: '12px', 
              border: questions.length === 0 ? `2px solid ${colors.gray}50` : 'none', 
              backgroundColor: questions.length === 0 ? 'transparent' : colors.primary, 
              color: questions.length === 0 ? colors.gray : colors.background, 
              fontSize: '16px', 
              fontWeight: '700', 
              cursor: questions.length === 0 ? 'not-allowed' : 'pointer' 
            }}
          >
            {questions.length === 0 ? 'Add questions to continue' : `Generate Answers for ${questions.length} Question${questions.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 4: ANSWERS
  // CR-AI generates answers from BUCKET, user reviews and edits
  // ==========================================
  if (phase === 'answers') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <button onClick={() => setPhase('questions')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Questions</button>
            <span style={{ color: colors.white, fontSize: '14px', fontWeight: '600' }}>{answeredCount} of {totalQuestions} done</span>
            <SaveIndicator />
          </div>
          <div style={{ height: '4px', backgroundColor: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: colors.primary, transition: 'width 0.3s' }} />
          </div>
        </div>
        
        <ProgressStepper />

        <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
          {/* Strategy reminder */}
          <div style={{ backgroundColor: colors.card, borderRadius: '10px', padding: '15px', marginBottom: '20px', border: `1px solid ${colors.gray}30` }}>
            <p style={{ color: colors.primary, margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600' }}>{programTitle}</p>
            <p style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>{approach}</p>
          </div>

          {generatingAnswers && (
            <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: colors.card, borderRadius: '16px', marginBottom: '20px' }}>
              <p style={{ color: colors.primary, fontSize: '18px', margin: '0 0 10px 0' }}>CR-AI is writing your answers...</p>
              <p style={{ color: colors.gray, fontSize: '14px', margin: 0 }}>Pulling from your BUCKET to create personalized responses</p>
            </div>
          )}

          {!generatingAnswers && questions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: colors.card, borderRadius: '16px' }}>
              <p style={{ color: colors.gray, margin: '0 0 15px 0' }}>No questions found. Go back and add questions from the RFP.</p>
              <button onClick={() => setPhase('questions')} style={{ padding: '14px 28px', borderRadius: '10px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Add Questions</button>
            </div>
          )}

          {!generatingAnswers && questions.map((q, index) => {
            const overLimit = q.response?.length > q.charLimit
            
            return (
              <div key={q.id} style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${overLimit ? colors.red : colors.gray}30`, marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <span style={{ color: colors.primary, fontSize: '12px', fontWeight: '600' }}>Question {index + 1} of {totalQuestions}</span>
                  <span style={{ fontSize: '10px', backgroundColor: `${colors.primary}20`, color: colors.primary, padding: '3px 8px', borderRadius: '4px' }}>CR-AI</span>
                </div>

                <p style={{ color: colors.white, margin: '0 0 15px 0', fontSize: '15px', fontWeight: '500' }}>{q.text}</p>

                {editingIndex === index ? (
                  <div>
                    <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={5} style={{ ...inputStyle, marginBottom: '10px', resize: 'vertical' }} autoFocus />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: editingText.length > q.charLimit ? colors.red : colors.gray, fontSize: '12px' }}>
                        {editingText.length}/{q.charLimit} characters
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setEditingIndex(null); setEditingText('') }} style={{ padding: '8px 16px', borderRadius: '6px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => handleSaveEdit(index)} disabled={editingText.length > q.charLimit} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: editingText.length > q.charLimit ? colors.gray : colors.primary, color: colors.background, fontSize: '12px', cursor: editingText.length > q.charLimit ? 'not-allowed' : 'pointer' }}>Save</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ backgroundColor: '#0a0a0a', borderRadius: '8px', padding: '15px', marginBottom: '10px' }}>
                      <p style={{ color: colors.white, margin: 0, fontSize: '14px', lineHeight: '1.6' }}>{q.response || 'Generating answer...'}</p>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: overLimit ? colors.red : colors.gray, fontSize: '12px' }}>
                        {q.response?.length || 0}/{q.charLimit} characters {overLimit && '⚠️ over limit'}
                      </span>
                    </div>

                    {overLimit && (
                      <div style={{ backgroundColor: `${colors.red}15`, borderRadius: '8px', padding: '12px', marginBottom: '12px', border: `1px solid ${colors.red}30` }}>
                        <p style={{ color: colors.red, margin: '0 0 10px 0', fontSize: '13px' }}>This answer is {q.response.length - q.charLimit} characters over the limit.</p>
                        <button onClick={() => handleAutoShorten(index)} disabled={shorteningIndex === index} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '12px', cursor: 'pointer' }}>
                          {shorteningIndex === index ? 'Shortening...' : 'Auto-shorten with CR-AI'}
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleRegenerateAnswer(index)} style={{ padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.primary}50`, backgroundColor: 'transparent', color: colors.primary, fontSize: '12px', cursor: 'pointer' }}>Try Again</button>
                      <button onClick={() => { setEditingIndex(index); setEditingText(q.response || '') }} style={{ padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.gray}50`, backgroundColor: 'transparent', color: colors.white, fontSize: '12px', cursor: 'pointer' }}>Edit</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}

          {questions.length > 0 && !generatingAnswers && (
            <button onClick={() => setPhase('review')} disabled={issueCount > 0} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: issueCount > 0 ? `2px solid ${colors.red}` : 'none', backgroundColor: issueCount > 0 ? 'transparent' : colors.primary, color: issueCount > 0 ? colors.red : colors.background, fontSize: '16px', fontWeight: '600', cursor: issueCount > 0 ? 'not-allowed' : 'pointer', marginTop: '10px' }}>
              {issueCount > 0 ? `Fix ${issueCount} issue${issueCount > 1 ? 's' : ''} to continue` : 'Review and Export'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 5: REVIEW
  // Final check before submission - CELEBRATE their work!
  // ==========================================
  if (phase === 'review') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setPhase('answers')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Back to Answers</button>
          <span style={{ color: colors.white, fontSize: '14px', fontWeight: '600' }}>Final Review</span>
          <SaveIndicator />
        </div>
        
        <ProgressStepper />

        <div style={{ padding: '25px 20px', maxWidth: '600px', margin: '0 auto' }}>
          
          {/* Celebration header */}
          <div style={{ backgroundColor: `${colors.primary}15`, borderRadius: '12px', padding: '25px', marginBottom: '25px', textAlign: 'center', border: `1px solid ${colors.primary}30` }}>
            <p style={{ fontSize: '32px', margin: '0 0 10px 0' }}>🎉</p>
            <p style={{ color: colors.primary, margin: 0, fontSize: '20px', fontWeight: '700' }}>All {totalQuestions} answers complete!</p>
            <p style={{ color: colors.gray, margin: '10px 0 0 0', fontSize: '14px' }}>You're almost there. Review your work and submit.</p>
          </div>

          {/* Quick summary */}
          <div style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', marginBottom: '20px', border: `1px solid ${colors.gray}30` }}>
            <p style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>{localOpportunity.title}</p>
            <p style={{ color: colors.gray, margin: '0 0 5px 0', fontSize: '13px' }}>{localOpportunity.agency || 'No agency'}</p>
            <p style={{ color: colors.gold, margin: 0, fontSize: '13px' }}>Due: {new Date(localOpportunity.due_date).toLocaleDateString()}</p>
          </div>

          {/* Copy all button */}
          <button onClick={handleExport} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: colors.gold, color: colors.background, fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginBottom: '20px' }}>
            📋 Copy All Responses to Clipboard
          </button>

          {/* Disclaimer */}
          <div style={{ backgroundColor: `${colors.primary}10`, borderRadius: '12px', padding: '18px', border: `1px solid ${colors.primary}30`, marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: colors.primary }} />
              <span style={{ color: colors.white, fontSize: '13px', lineHeight: '1.5' }}>I understand CR-AI is an assistant tool. I've reviewed all answers and I'm responsible for my submission.</span>
            </label>
          </div>

          {/* Submit button */}
          <button onClick={handleMarkSubmitted} disabled={!acknowledged} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: acknowledged ? 'none' : `2px solid ${colors.gray}50`, backgroundColor: acknowledged ? colors.primary : 'transparent', color: acknowledged ? colors.background : colors.gray, fontSize: '16px', fontWeight: '600', cursor: acknowledged ? 'pointer' : 'not-allowed' }}>
            ✓ Mark as Submitted
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center', padding: '15px', backgroundColor: `${colors.primary}08`, borderRadius: '10px' }}>
            <p style={{ color: colors.gray, margin: 0, fontSize: '12px' }}>Your BUCKET + CR-AI • Contract Ready</p>
          </div>
        </div>

        {/* Put into my BUCKET Modal */}
        {showAddToBucket && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '450px', width: '100%', border: `2px solid ${colors.primary}`, textAlign: 'center' }}>
              <p style={{ fontSize: '48px', margin: '0 0 15px 0' }}>🏆</p>
              <h3 style={{ color: colors.primary, margin: '0 0 15px 0', fontSize: '22px' }}>Another One in the Books!</h3>
              <p style={{ color: colors.white, margin: '0 0 20px 0', fontSize: '15px' }}>Great work completing this submission.</p>
              
              <div style={{ backgroundColor: colors.background, borderRadius: '10px', padding: '15px', marginBottom: '20px', textAlign: 'left' }}>
                <p style={{ color: colors.gray, margin: '0 0 10px 0', fontSize: '12px', fontWeight: '600' }}>PUT THIS INTO MY BUCKET?</p>
                <p style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '13px' }}>✓ {totalQuestions} answers saved for reuse</p>
                <p style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '13px' }}>✓ Program title: "{programTitle}"</p>
                <p style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '13px' }}>✓ Your approach for {localOpportunity.agency || 'this agency'}</p>
                <p style={{ color: colors.white, margin: 0, fontSize: '13px' }}>✓ +1 submission to your experience</p>
              </div>
              
              <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '13px' }}>Your BUCKET grows with every submission. CR-AI uses this to help you win.</p>
              
              <div style={{ display: 'grid', gap: '10px' }}>
                <button onClick={handleAddToBucket} style={{ padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Yes, Put Into My BUCKET</button>
                <button onClick={handleSkipAddToBucket} style={{ padding: '14px', borderRadius: '10px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, fontSize: '14px', cursor: 'pointer' }}>Skip for Now</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}

export default MyCart
