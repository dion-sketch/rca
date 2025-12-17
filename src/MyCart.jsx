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
    description: '',
    budgetFloor: '',
    budgetCeiling: ''
  })

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
      const requirements = {
        budget_floor: manualEntry.budgetFloor ? parseInt(manualEntry.budgetFloor.replace(/\D/g, '')) : null,
        budget_ceiling: manualEntry.budgetCeiling ? parseInt(manualEntry.budgetCeiling.replace(/\D/g, '')) : null,
        required_elements: ['past_performance', 'qualifications']
      }

      const { data, error } = await supabase
        .from('submissions')
        .insert({
          user_id: session.user.id,
          title: manualEntry.title,
          rfp_number: manualEntry.rfpNumber,
          agency: manualEntry.agency,
          due_date: manualEntry.dueDate,
          source: manualEntry.source || 'Manual Entry',
          estimated_value: manualEntry.estimatedValue,
          description: manualEntry.description,
          status: 'draft',
          questions: [],
          responses: [],
          requirements: requirements
        })
        .select()
        .single()

      if (error) throw error

      setAllSubmissions([data, ...allSubmissions])
      setSavedOpportunity(data)
      setShowConfirm(false)
      setSaveSuccess(true)
      setManualEntry({
        title: '', rfpNumber: '', agency: '', dueDate: '',
        source: '', estimatedValue: '', description: '',
        budgetFloor: '', budgetCeiling: ''
      })
    } catch (err) {
      console.error('Error adding submission:', err)
      alert('Error saving opportunity. Please try again.')
    }
  }

  const calculateBucketMatch = (profile) => {
    if (!profile) return { percentage: 0, hasItems: [], craiHelps: [] }
    
    const hasItems = []
    const craiHelps = []
    let score = 0
    const maxScore = 10

    if (profile.company_name) { hasItems.push(`${profile.company_name}`); score += 1 }
    if (profile.naics_codes?.length > 0) { hasItems.push(`NAICS: ${profile.naics_codes.map(n => n.code).join(', ')}`); score += 1 }
    if (profile.certifications?.length > 0) { hasItems.push(`${profile.certifications.map(c => c.name || c.id).join(', ')}`); score += 1 }
    if (profile.year_established) { hasItems.push(`${new Date().getFullYear() - parseInt(profile.year_established)}+ years in business`); score += 1 }
    if (profile.city && profile.state) { hasItems.push(`Based in ${profile.city}, ${profile.state}`); score += 0.5 }
    if (profile.sam_registered) { hasItems.push('SAM.gov Registered'); score += 1 }
    if (profile.past_performance?.length > 0) { hasItems.push(`${profile.past_performance.length} past performance record${profile.past_performance.length !== 1 ? 's' : ''}`); score += 1.5 }
    if (profile.team_members?.length > 0) { hasItems.push(`${profile.team_members.length} key personnel on file`); score += 1 }
    if (profile.services?.length > 0) { hasItems.push(`${profile.services.length} service area${profile.services.length !== 1 ? 's' : ''} defined`); score += 1 }
    if (profile.mission) score += 0.5
    if (profile.elevator_pitch) score += 0.5

    craiHelps.push('Tailored response narratives')
    craiHelps.push('Experience descriptions')
    if (!profile.past_performance?.length) craiHelps.push('Past performance statements')
    if (!profile.what_makes_you_different) craiHelps.push('Differentiator highlights')
    craiHelps.push('Budget justification language')
    craiHelps.push('Staffing & approach sections')

    return { percentage: Math.min(Math.round((score / maxScore) * 100), 100), hasItems, craiHelps }
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
          <h1 style={{ color: colors.white, margin: 0, fontSize: '20px' }}>🛒 My Cart</h1>
          <button onClick={() => setShowAddManual(true)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>+ Add</button>
        </div>
      </div>

      <div style={{ padding: '20px 30px 0 30px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('cart')} style={tabStyle(activeTab === 'cart')}>🛒 Considering ({cartItems.length})</button>
        <button onClick={() => setActiveTab('inprogress')} style={tabStyle(activeTab === 'inprogress')}>✏️ In Progress ({inProgressItems.length})</button>
        <button onClick={() => setActiveTab('submitted')} style={tabStyle(activeTab === 'submitted')}>✅ Submitted ({submittedItems.length})</button>
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
                  <p style={{ color: colors.gray, fontSize: '14px', margin: '0 0 20px 0' }}>Add contracts you're considering</p>
                  <button onClick={() => setShowAddManual(true)} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>+ Add Opportunity</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {cartItems.map(item => (
                    <div key={item.id} onClick={() => openResponseBuilder(item)} style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.gray}30`, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '16px' }}>{item.title}</h3>
                          <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{item.agency || 'No agency'}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ color: colors.gold, margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600' }}>Due: {new Date(item.due_date).toLocaleDateString()}</p>
                          {item.estimated_value && <p style={{ color: colors.gray, margin: 0, fontSize: '12px' }}>{item.estimated_value}</p>}
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
                  <p style={{ color: colors.gray, fontSize: '14px', margin: 0 }}>Click "Go After This" on an opportunity to start</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {inProgressItems.map(item => {
                    const answered = item.questions?.filter(q => q.response).length || 0
                    const total = item.questions?.length || 0
                    return (
                      <div key={item.id} onClick={() => openResponseBuilder(item)} style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.primary}30`, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '11px', backgroundColor: `${colors.primary}20`, color: colors.primary, padding: '2px 8px', borderRadius: '4px', marginBottom: '5px', display: 'inline-block' }}>🪣+🤖 In Progress</span>
                            <h3 style={{ color: colors.white, margin: '5px 0', fontSize: '16px' }}>{item.title}</h3>
                            <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{item.agency || 'No agency'}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ color: colors.primary, margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600' }}>{answered}/{total} Answers</p>
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
                          <span style={{ color: colors.primary, fontSize: '14px' }}>✅</span>
                          <h3 style={{ color: colors.white, margin: '5px 0', fontSize: '16px' }}>{item.title}</h3>
                          <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{item.agency || 'No agency'}</p>
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

      {/* Add Manual Modal */}
      {showAddManual && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '500px', width: '100%', border: `2px solid ${colors.primary}`, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: colors.white, margin: '0 0 20px 0', fontSize: '22px' }}>Add Opportunity</h2>
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
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>RFP / Bid Number</label>
                <input type="text" value={manualEntry.rfpNumber} onChange={(e) => setManualEntry({ ...manualEntry, rfpNumber: e.target.value })} placeholder="e.g., RFP-2024-001" style={inputStyle} />
              </div>
              
              {/* Budget Requirements */}
              <div style={{ backgroundColor: `${colors.gold}10`, borderRadius: '10px', padding: '15px', border: `1px solid ${colors.gold}30` }}>
                <p style={{ color: colors.gold, fontSize: '13px', fontWeight: '600', margin: '0 0 10px 0' }}>💰 Budget Requirements (if known)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ color: colors.gray, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Floor (minimum)</label>
                    <input type="text" value={manualEntry.budgetFloor} onChange={(e) => setManualEntry({ ...manualEntry, budgetFloor: e.target.value })} placeholder="$100,000" style={{ ...inputStyle, fontSize: '14px', padding: '10px' }} />
                  </div>
                  <div>
                    <label style={{ color: colors.gray, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Ceiling (maximum)</label>
                    <input type="text" value={manualEntry.budgetCeiling} onChange={(e) => setManualEntry({ ...manualEntry, budgetCeiling: e.target.value })} placeholder="$500,000" style={{ ...inputStyle, fontSize: '14px', padding: '10px' }} />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Notes</label>
                <textarea value={manualEntry.description} onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })} placeholder="Any notes about this opportunity..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button onClick={() => setShowAddManual(false)} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleShowConfirm} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Add to Cart</button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '20px' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '400px', width: '100%', border: `2px solid ${colors.gold}`, textAlign: 'center' }}>
            <p style={{ fontSize: '40px', margin: '0 0 15px 0' }}>🛒</p>
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
            <p style={{ fontSize: '50px', margin: '0 0 15px 0' }}>✅</p>
            <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>Added to Cart!</h3>
            <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '14px' }}>{savedOpportunity?.title}</p>
            <div style={{ display: 'grid', gap: '10px' }}>
              <button onClick={() => { setSaveSuccess(false); setShowAddManual(false); if (savedOpportunity) openResponseBuilder(savedOpportunity) }} style={{ padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>🚀 Start Working on It</button>
              <button onClick={() => { setSaveSuccess(false); setShowAddManual(false) }} style={{ padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, cursor: 'pointer' }}>Add Another</button>
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
  const [phase, setPhase] = useState(opportunity.strategy_plan ? 'answers' : 'overview')
  const [localOpportunity, setLocalOpportunity] = useState(opportunity)
  const [showEditDetails, setShowEditDetails] = useState(false)
  const [showRequirements, setShowRequirements] = useState(false)
  const [editForm, setEditForm] = useState({
    title: opportunity.title || '',
    dueDate: opportunity.due_date || '',
    agency: opportunity.agency || '',
    rfpNumber: opportunity.rfp_number || '',
    estimatedValue: opportunity.estimated_value || '',
    description: opportunity.description || ''
  })

  // Requirements
  const [requirements, setRequirements] = useState(opportunity.requirements || {
    budget_floor: null,
    budget_ceiling: null,
    required_elements: []
  })

  // Strategy state
  const [generatingStrategy, setGeneratingStrategy] = useState(false)
  const [strategyPlan, setStrategyPlan] = useState(opportunity.strategy_plan || null)
  
  // Answers state
  const [questions, setQuestions] = useState(opportunity.questions || [])
  const [generatingAnswers, setGeneratingAnswers] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [shorteningIndex, setShorteningIndex] = useState(null)
  
  // Review state
  const [acknowledged, setAcknowledged] = useState(false)
  const [submissionNotes, setSubmissionNotes] = useState('')
  const [complianceIssues, setComplianceIssues] = useState([])

  const daysLeft = Math.ceil((new Date(localOpportunity.due_date) - new Date()) / (1000 * 60 * 60 * 24))
  const isUrgent = daysLeft <= 7
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

  // Check if answer is over limit
  const isOverLimit = (text, limit) => text && limit && text.length > limit
  const isNearLimit = (text, limit) => text && limit && text.length > limit * 0.9 && text.length <= limit

  // Run compliance check
  const runComplianceCheck = () => {
    const issues = []
    
    questions.forEach((q, i) => {
      if (isOverLimit(q.response, q.charLimit)) {
        issues.push({
          type: 'over_limit',
          question: i + 1,
          message: `Q${i + 1} is ${q.response.length - q.charLimit} characters over limit`,
          current: q.response.length,
          limit: q.charLimit
        })
      }
    })

    // Check budget if we have requirements
    if (requirements.budget_floor && localOpportunity.proposed_budget) {
      const budget = parseInt(localOpportunity.proposed_budget.replace(/\D/g, ''))
      if (budget < requirements.budget_floor) {
        issues.push({
          type: 'budget_low',
          message: `Budget is below minimum ($${requirements.budget_floor.toLocaleString()})`,
          current: budget,
          floor: requirements.budget_floor
        })
      }
    }

    if (requirements.budget_ceiling && localOpportunity.proposed_budget) {
      const budget = parseInt(localOpportunity.proposed_budget.replace(/\D/g, ''))
      if (budget > requirements.budget_ceiling) {
        issues.push({
          type: 'budget_high',
          message: `Budget exceeds maximum ($${requirements.budget_ceiling.toLocaleString()})`,
          current: budget,
          ceiling: requirements.budget_ceiling
        })
      }
    }

    setComplianceIssues(issues)
    return issues
  }

  // Save to database
  const saveToDatabase = async (updates) => {
    try {
      await supabase.from('submissions').update(updates).eq('id', localOpportunity.id)
    } catch (err) {
      console.error('Error saving:', err)
    }
  }

  useEffect(() => {
    if (questions.length > 0) {
      saveToDatabase({ questions })
      runComplianceCheck()
    }
  }, [questions])

  // Generate Strategy Plan
  const handleGenerateStrategy = async () => {
    setGeneratingStrategy(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Generate a strategic response plan for this government contract opportunity. Include:
1. A compelling PROGRAM TITLE (creative, memorable, aligned with their mission)
2. KEY THEMES to emphasize (3-4 bullet points)
3. APPROACH SUMMARY (2-3 sentences on how they should position themselves)
4. DIFFERENTIATORS to highlight

Contract: ${localOpportunity.title}
Agency: ${localOpportunity.agency || 'Not specified'}
${localOpportunity.description ? `Description: ${localOpportunity.description}` : ''}`,
          profile: profile,
          opportunity: { title: localOpportunity.title, agency: localOpportunity.agency, due_date: localOpportunity.due_date, estimated_value: localOpportunity.estimated_value, description: localOpportunity.description },
          isStrategyGeneration: true
        }),
      })

      if (!response.ok) throw new Error('Failed to generate strategy')
      const data = await response.json()
      const plan = { raw: data.response, generatedAt: new Date().toISOString() }
      setStrategyPlan(plan)
      await saveToDatabase({ strategy_plan: plan })
    } catch (err) {
      console.error('Error generating strategy:', err)
      alert('CR-AI had trouble generating the strategy. Please try again.')
    } finally {
      setGeneratingStrategy(false)
    }
  }

  // Generate All Answers
  const handleGenerateAllAnswers = async () => {
    setGeneratingAnswers(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Generate typical RFP questions and answers for this government contract. Create 6-8 common questions with comprehensive answers.

IMPORTANT: Each answer MUST stay under its character limit. Format:

Q1: [Question text]
A1: [Answer - MUST be under 500 characters]
LIMIT: 500

Q2: [Question text]  
A2: [Answer - MUST be under 750 characters]
LIMIT: 750

Continue for all questions.

Contract: ${localOpportunity.title}
Agency: ${localOpportunity.agency || 'Not specified'}
Strategy: ${strategyPlan?.raw || 'Not yet defined'}`,
          profile: profile,
          opportunity: { title: localOpportunity.title, agency: localOpportunity.agency, due_date: localOpportunity.due_date, estimated_value: localOpportunity.estimated_value, description: localOpportunity.description },
          requirements: requirements,
          isQAGeneration: true
        }),
      })

      if (!response.ok) throw new Error('Failed to generate answers')
      const data = await response.json()
      const parsedQuestions = parseQuestionsFromResponse(data.response)
      setQuestions(parsedQuestions)
    } catch (err) {
      console.error('Error generating answers:', err)
      alert('CR-AI had trouble generating answers. Please try again.')
    } finally {
      setGeneratingAnswers(false)
    }
  }

  const parseQuestionsFromResponse = (text) => {
    const questions = []
    const regex = /Q(\d+):\s*(.*?)\nA\1:\s*([\s\S]*?)(?=LIMIT:|Q\d+:|$)/gi
    let match
    
    while ((match = regex.exec(text)) !== null) {
      const limitMatch = text.substring(match.index).match(/LIMIT:\s*(\d+)/i)
      const charLimit = limitMatch ? parseInt(limitMatch[1]) : 500
      let answer = match[3].trim()
      
      // ENFORCE: Auto-truncate if over limit
      if (answer.length > charLimit) {
        answer = answer.substring(0, charLimit - 3) + '...'
      }
      
      questions.push({
        id: Date.now() + questions.length,
        text: match[2].trim(),
        response: answer,
        charLimit: charLimit,
        source: 'bucket-crai'
      })
    }
    
    if (questions.length === 0) {
      questions.push({
        id: Date.now(),
        text: 'Describe your organization\'s experience and qualifications.',
        response: text.substring(0, 497) + '...',
        charLimit: 500,
        source: 'bucket-crai'
      })
    }
    
    return questions
  }

  // Auto-shorten answer with CR-AI
  const handleAutoShorten = async (index) => {
    const question = questions[index]
    setShorteningIndex(index)
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Shorten this response to EXACTLY ${question.charLimit - 10} characters or less while keeping all key points. Current length: ${question.response.length}. Must be under ${question.charLimit}.

Original response:
${question.response}

Return ONLY the shortened response, nothing else.`,
          profile: profile,
          charLimit: question.charLimit,
          isShortening: true
        }),
      })

      if (!response.ok) throw new Error('Failed to shorten')
      const data = await response.json()
      
      let shortened = data.response.trim()
      // Final enforcement
      if (shortened.length > question.charLimit) {
        shortened = shortened.substring(0, question.charLimit - 3) + '...'
      }
      
      const updated = [...questions]
      updated[index] = { ...updated[index], response: shortened, source: 'bucket-crai' }
      setQuestions(updated)
    } catch (err) {
      console.error('Error shortening:', err)
      alert('CR-AI had trouble. Try editing manually.')
    } finally {
      setShorteningIndex(null)
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
          question: `Answer this question in UNDER ${question.charLimit} characters:

${question.text}

IMPORTANT: Response MUST be under ${question.charLimit} characters total.`,
          profile: profile,
          opportunity: { title: localOpportunity.title, agency: localOpportunity.agency },
          charLimit: question.charLimit,
          strategyPlan: strategyPlan?.raw
        }),
      })

      if (!response.ok) throw new Error('Failed to regenerate')
      const data = await response.json()
      
      let answer = data.response.trim()
      // ENFORCE limit
      if (answer.length > question.charLimit) {
        answer = answer.substring(0, question.charLimit - 3) + '...'
      }
      
      const updated = [...questions]
      updated[index] = { ...updated[index], response: answer, source: 'bucket-crai' }
      setQuestions(updated)
    } catch (err) {
      console.error('Error regenerating:', err)
      alert('CR-AI had trouble. Please try again.')
    } finally {
      setEditingIndex(null)
    }
  }

  // Save edited answer - BLOCKED if over limit
  const handleSaveEdit = (index) => {
    const question = questions[index]
    
    if (editingText.length > question.charLimit) {
      alert(`⛔ Cannot save. Your answer is ${editingText.length - question.charLimit} characters over the ${question.charLimit} limit.\n\nPlease shorten your response.`)
      return // BLOCKED
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

  const handleSaveExit = () => {
    alert('✅ Progress saved! You can continue later from "In Progress".')
    onBack()
  }

  const handleSaveEditDetails = async () => {
    await saveToDatabase({
      title: editForm.title, due_date: editForm.dueDate, agency: editForm.agency,
      rfp_number: editForm.rfpNumber, estimated_value: editForm.estimatedValue, description: editForm.description
    })
    setLocalOpportunity({ ...localOpportunity, ...editForm, due_date: editForm.dueDate, rfp_number: editForm.rfpNumber, estimated_value: editForm.estimatedValue })
    setShowEditDetails(false)
  }

  const handleExport = () => {
    const issues = runComplianceCheck()
    if (issues.length > 0) {
      alert(`⛔ Cannot export. ${issues.length} compliance issue(s) found.\n\n${issues.map(i => i.message).join('\n')}\n\nFix these before exporting.`)
      return // BLOCKED
    }

    let exportText = `${localOpportunity.title}\n${localOpportunity.agency || 'Agency not specified'}\nDue: ${new Date(localOpportunity.due_date).toLocaleDateString()}\n${'='.repeat(50)}\n\n`
    if (strategyPlan?.raw) exportText += `STRATEGY OVERVIEW:\n${strategyPlan.raw}\n\n${'='.repeat(50)}\n\n`
    questions.forEach((q, i) => { exportText += `Q${i + 1}: ${q.text}\n\nA: ${q.response || '[Not answered]'}\n\n${'-'.repeat(40)}\n\n` })
    exportText += `\n${'='.repeat(50)}\nPrepared with BUCKET + CR-AI Technology\nYour business data + AI assistance\nContract Ready © ${new Date().getFullYear()}`
    
    navigator.clipboard.writeText(exportText).then(() => alert('✅ Copied to clipboard!'))
  }

  const handleMarkSubmitted = async () => {
    const issues = runComplianceCheck()
    
    if (issues.length > 0) {
      alert(`⛔ Cannot submit. ${issues.length} compliance issue(s) must be fixed:\n\n${issues.map(i => i.message).join('\n')}`)
      return // BLOCKED
    }
    
    if (!acknowledged) {
      alert('Please check the acknowledgment box.')
      return
    }
    
    await saveToDatabase({ status: 'submitted', submission_notes: submissionNotes, submitted_at: new Date().toISOString() })
    alert('🎉 Marked as submitted! Your responses are saved to your BUCKET for future bids.')
    onBack()
  }

  const answeredCount = questions.filter(q => q.response).length
  const issueCount = questions.filter(q => isOverLimit(q.response, q.charLimit)).length

  // ==========================================
  // PHASE 1: OVERVIEW
  // ==========================================
  if (phase === 'overview') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Back to Cart</button>
          <button onClick={handleSaveExit} style={{ background: 'none', border: 'none', color: colors.gold, cursor: 'pointer', fontSize: '14px' }}>Save & Exit</button>
        </div>

        <div style={{ padding: '25px 20px', maxWidth: '650px', margin: '0 auto' }}>
          <h1 style={{ color: colors.white, margin: '0 0 15px 0', fontSize: '22px', lineHeight: '1.3' }}>{localOpportunity.title}</h1>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
            {localOpportunity.agency && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '14px' }}>🏛️</span><span style={{ color: colors.white, fontSize: '13px' }}>{localOpportunity.agency}</span></div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '14px' }}>📅</span><span style={{ color: isUrgent ? colors.gold : colors.white, fontSize: '13px', fontWeight: '600' }}>{daysLeft} days left</span></div>
            {localOpportunity.estimated_value && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '14px' }}>💰</span><span style={{ color: colors.white, fontSize: '13px' }}>{localOpportunity.estimated_value}</span></div>}
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <button onClick={() => setShowEditDetails(true)} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '12px', padding: 0 }}>✏️ Edit Details</button>
            <button onClick={() => setShowRequirements(true)} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '12px', padding: 0 }}>📋 Requirements</button>
          </div>

          <div style={{ height: '1px', backgroundColor: `${colors.gray}30`, margin: '20px 0' }} />

          {/* BUCKET Match */}
          <div style={{ backgroundColor: `${colors.primary}10`, borderRadius: '12px', padding: '18px', border: `1px solid ${colors.primary}30`, marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '20px' }}>🎯</span><span style={{ color: colors.white, fontSize: '16px', fontWeight: '600' }}>BUCKET Match</span></div>
              <div style={{ backgroundColor: colors.primary, color: colors.background, padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '16px' }}>{bucketMatch.percentage}%</div>
            </div>
          </div>

          {/* YOUR BUCKET HAS */}
          {bucketMatch.hasItems.length > 0 && (
            <div style={{ backgroundColor: '#0a1a0a', borderRadius: '12px', padding: '18px', border: `1px solid ${colors.primary}20`, marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><span style={{ fontSize: '18px' }}>🪣</span><span style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>YOUR BUCKET HAS:</span></div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {bucketMatch.hasItems.slice(0, 5).map((item, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: colors.primary, fontSize: '14px' }}>✓</span><span style={{ color: colors.white, fontSize: '13px' }}>{item}</span></div>)}
              </div>
            </div>
          )}

          {/* CR-AI WILL HELP */}
          <div style={{ backgroundColor: `${colors.gold}08`, borderRadius: '12px', padding: '18px', border: `1px solid ${colors.gold}30`, marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><span style={{ fontSize: '18px' }}>🤖</span><span style={{ color: colors.gold, fontSize: '14px', fontWeight: '600' }}>CR-AI WILL HELP YOU WITH:</span></div>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
              {bucketMatch.craiHelps.slice(0, 4).map((item, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: colors.gold, fontSize: '12px' }}>✨</span><span style={{ color: colors.white, fontSize: '13px' }}>{item}</span></div>)}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gap: '10px' }}>
            <button onClick={() => setPhase('strategy')} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>🚀 Go After This</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button onClick={handleArchive} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${colors.gray}50`, backgroundColor: 'transparent', color: colors.gray, fontSize: '13px', cursor: 'pointer' }}>❌ Not a Fit</button>
              <button onClick={handleSaveExit} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${colors.gold}50`, backgroundColor: 'transparent', color: colors.gold, fontSize: '13px', cursor: 'pointer' }}>🔖 Save for Later</button>
            </div>
          </div>
        </div>

        {/* Requirements Modal */}
        {showRequirements && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '25px', maxWidth: '450px', width: '100%', border: `2px solid ${colors.gold}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: colors.white, margin: 0, fontSize: '18px' }}>📋 Requirements</h3>
                <button onClick={() => setShowRequirements(false)} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '20px' }}>×</button>
              </div>
              
              <div style={{ display: 'grid', gap: '15px' }}>
                <div>
                  <p style={{ color: colors.gold, fontSize: '13px', fontWeight: '600', margin: '0 0 8px 0' }}>💰 Budget Range</p>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div><span style={{ color: colors.gray, fontSize: '12px' }}>Floor:</span><span style={{ color: colors.white, fontSize: '14px', marginLeft: '8px' }}>{requirements.budget_floor ? `$${requirements.budget_floor.toLocaleString()}` : 'Not set'}</span></div>
                    <div><span style={{ color: colors.gray, fontSize: '12px' }}>Ceiling:</span><span style={{ color: colors.white, fontSize: '14px', marginLeft: '8px' }}>{requirements.budget_ceiling ? `$${requirements.budget_ceiling.toLocaleString()}` : 'Not set'}</span></div>
                  </div>
                </div>
                
                {questions.length > 0 && (
                  <div>
                    <p style={{ color: colors.gold, fontSize: '13px', fontWeight: '600', margin: '0 0 8px 0' }}>📝 Character Limits</p>
                    <div style={{ display: 'grid', gap: '5px' }}>
                      {questions.map((q, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: colors.gray, fontSize: '12px' }}>Q{i + 1}</span>
                          <span style={{ color: isOverLimit(q.response, q.charLimit) ? colors.red : colors.primary, fontSize: '12px' }}>
                            {q.response?.length || 0}/{q.charLimit} {isOverLimit(q.response, q.charLimit) ? '⛔' : '✓'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <button onClick={() => setShowRequirements(false)} style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        )}

        {/* Edit Details Modal */}
        {showEditDetails && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '25px', maxWidth: '450px', width: '100%', border: `2px solid ${colors.primary}`, maxHeight: '85vh', overflowY: 'auto' }}>
              <h3 style={{ color: colors.white, margin: '0 0 15px 0', fontSize: '18px' }}>✏️ Edit Details</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div><label style={{ color: colors.gray, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Title</label><input type="text" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} style={inputStyle} /></div>
                <div><label style={{ color: colors.gray, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Due Date</label><input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({...editForm, dueDate: e.target.value})} style={inputStyle} /></div>
                <div><label style={{ color: colors.gray, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Agency</label><input type="text" value={editForm.agency} onChange={(e) => setEditForm({...editForm, agency: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => setShowEditDetails(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveEditDetails} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==========================================
  // PHASE 2: STRATEGY
  // ==========================================
  if (phase === 'strategy') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setPhase('overview')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Back</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '14px' }}>🪣+🤖</span><span style={{ color: colors.white, fontSize: '14px', fontWeight: '600' }}>BUCKET + CR-AI</span></div>
          <button onClick={handleSaveExit} style={{ background: 'none', border: 'none', color: colors.gold, cursor: 'pointer', fontSize: '14px' }}>Save & Exit</button>
        </div>

        <div style={{ padding: '25px 20px', maxWidth: '650px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: `${colors.primary}15`, padding: '8px 16px', borderRadius: '20px', marginBottom: '15px' }}><span style={{ fontSize: '16px' }}>🪣+🤖</span><span style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>BUCKET + CR-AI Response Plan</span></div>
            <h2 style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '22px' }}>Let's Build Your Strategy</h2>
            <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>CR-AI will create a tailored approach using your BUCKET</p>
          </div>

          {!strategyPlan ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', border: `1px solid ${colors.gray}30`, marginBottom: '20px' }}>
                <p style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '16px' }}>Ready to generate your response strategy?</p>
                <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '13px' }}>CR-AI will suggest a program title, key themes, and approach.</p>
                <button onClick={handleGenerateStrategy} disabled={generatingStrategy} style={{ padding: '16px 32px', borderRadius: '12px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '16px', fontWeight: '600', cursor: generatingStrategy ? 'not-allowed' : 'pointer', opacity: generatingStrategy ? 0.7 : 1 }}>
                  {generatingStrategy ? '⏳ Generating Strategy...' : '✨ Generate Strategy'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '20px', border: `1px solid ${colors.primary}30`, marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '16px' }}>📋</span><span style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>YOUR STRATEGY</span></div>
                  <span style={{ fontSize: '10px', backgroundColor: `${colors.primary}20`, color: colors.primary, padding: '3px 8px', borderRadius: '4px' }}>🪣+🤖 Generated</span>
                </div>
                <div style={{ color: colors.white, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{strategyPlan.raw}</div>
                <button onClick={handleGenerateStrategy} disabled={generatingStrategy} style={{ marginTop: '15px', padding: '8px 16px', borderRadius: '8px', border: `1px solid ${colors.gray}50`, backgroundColor: 'transparent', color: colors.gray, fontSize: '12px', cursor: 'pointer' }}>
                  {generatingStrategy ? '⏳ Regenerating...' : '🔄 Regenerate Strategy'}
                </button>
              </div>

              <button onClick={() => { if (questions.length === 0) handleGenerateAllAnswers(); setPhase('answers') }} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
                Continue to Answers →
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 3: ANSWERS
  // ==========================================
  if (phase === 'answers') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setPhase('strategy')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Strategy</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px' }}>🪣+🤖</span>
              <span style={{ color: colors.white, fontSize: '14px', fontWeight: '600' }}>{answeredCount}/{questions.length}</span>
              {issueCount > 0 && <span style={{ color: colors.red, fontSize: '12px' }}>⛔ {issueCount} over</span>}
            </div>
            <button onClick={handleSaveExit} style={{ background: 'none', border: 'none', color: colors.gold, cursor: 'pointer', fontSize: '14px' }}>Save & Exit</button>
          </div>
        </div>

        <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: `${colors.primary}15`, padding: '8px 16px', borderRadius: '20px', marginBottom: '10px' }}><span style={{ fontSize: '14px' }}>🪣+🤖</span><span style={{ color: colors.primary, fontSize: '13px', fontWeight: '600' }}>BUCKET + CR-AI Responses</span></div>
            <p style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>Review & edit. Auto-saves as you go.</p>
          </div>

          {generatingAnswers && (
            <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: colors.card, borderRadius: '16px', marginBottom: '20px' }}>
              <p style={{ color: colors.primary, fontSize: '18px', margin: '0 0 10px 0' }}>⏳ Generating all answers...</p>
              <p style={{ color: colors.gray, fontSize: '14px', margin: 0 }}>CR-AI is pulling from your BUCKET</p>
            </div>
          )}

          {!generatingAnswers && questions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: colors.card, borderRadius: '16px', marginBottom: '20px' }}>
              <p style={{ color: colors.gray, margin: '0 0 15px 0' }}>No answers generated yet</p>
              <button onClick={handleGenerateAllAnswers} style={{ padding: '14px 28px', borderRadius: '10px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>✨ Generate All Answers</button>
            </div>
          )}

          {!generatingAnswers && questions.map((q, index) => {
            const overLimit = isOverLimit(q.response, q.charLimit)
            const nearLimit = isNearLimit(q.response, q.charLimit)
            
            return (
              <div key={q.id} style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${overLimit ? colors.red : colors.gray}30`, marginBottom: '15px' }}>
                {/* Question Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span style={{ color: colors.primary, fontSize: '12px', fontWeight: '600' }}>Q{index + 1}</span>
                  <span style={{ fontSize: '10px', backgroundColor: q.source === 'user-edited' ? `${colors.gold}20` : `${colors.primary}20`, color: q.source === 'user-edited' ? colors.gold : colors.primary, padding: '3px 8px', borderRadius: '4px' }}>
                    {q.source === 'user-edited' ? '✍️ Edited' : '🪣+🤖 Generated'}
                  </span>
                </div>

                <p style={{ color: colors.white, margin: '0 0 15px 0', fontSize: '15px', fontWeight: '500', lineHeight: '1.4' }}>{q.text}</p>

                {editingIndex === index ? (
                  <div>
                    <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={6} style={{ ...inputStyle, marginBottom: '10px', resize: 'vertical', borderColor: editingText.length > q.charLimit ? colors.red : `${colors.gray}50` }} autoFocus />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: editingText.length > q.charLimit ? colors.red : colors.gray, fontSize: '12px', fontWeight: editingText.length > q.charLimit ? '600' : '400' }}>
                        {editingText.length}/{q.charLimit} {editingText.length > q.charLimit && `⛔ ${editingText.length - q.charLimit} over`}
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setEditingIndex(null); setEditingText('') }} style={{ padding: '8px 16px', borderRadius: '6px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => handleSaveEdit(index)} disabled={editingText.length > q.charLimit} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: editingText.length > q.charLimit ? colors.gray : colors.primary, color: colors.background, fontSize: '12px', fontWeight: '600', cursor: editingText.length > q.charLimit ? 'not-allowed' : 'pointer' }}>
                          {editingText.length > q.charLimit ? 'Over Limit' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ backgroundColor: '#0a0a0a', borderRadius: '8px', padding: '15px', marginBottom: '12px' }}>
                      <p style={{ color: colors.white, margin: 0, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{q.response || 'No response yet'}</p>
                    </div>
                    
                    {/* Character count - just numbers, turns red when over */}
                    {q.charLimit && (
                      <div style={{ marginBottom: '12px' }}>
                        <span style={{ color: overLimit ? colors.red : nearLimit ? colors.gold : colors.gray, fontSize: '12px', fontWeight: overLimit ? '600' : '400' }}>
                          {q.response?.length || 0}/{q.charLimit} characters
                          {overLimit && ` ⛔ ${q.response.length - q.charLimit} over limit`}
                        </span>
                      </div>
                    )}

                    {/* Over limit warning + auto-fix */}
                    {overLimit && (
                      <div style={{ backgroundColor: `${colors.red}15`, borderRadius: '8px', padding: '12px', marginBottom: '12px', border: `1px solid ${colors.red}30` }}>
                        <p style={{ color: colors.red, margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600' }}>
                          ⛔ This answer is {q.response.length - q.charLimit} characters over the limit
                        </p>
                        <p style={{ color: colors.gray, margin: '0 0 10px 0', fontSize: '12px' }}>
                          This will be rejected by the portal. CR-AI can shorten it for you.
                        </p>
                        <button onClick={() => handleAutoShorten(index)} disabled={shorteningIndex === index} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                          {shorteningIndex === index ? '⏳ Shortening...' : '✨ Auto-shorten with CR-AI'}
                        </button>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => handleRegenerateAnswer(index)} disabled={editingIndex === index} style={{ padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.primary}50`, backgroundColor: 'transparent', color: colors.primary, fontSize: '12px', cursor: 'pointer' }}>✨ Regenerate</button>
                      <button onClick={() => { setEditingIndex(index); setEditingText(q.response || '') }} style={{ padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.gray}50`, backgroundColor: 'transparent', color: colors.white, fontSize: '12px', cursor: 'pointer' }}>✍️ Edit</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}

          {questions.length > 0 && !generatingAnswers && (
            <button onClick={() => setPhase('review')} disabled={issueCount > 0} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: issueCount > 0 ? `2px solid ${colors.red}` : 'none', backgroundColor: issueCount > 0 ? 'transparent' : colors.primary, color: issueCount > 0 ? colors.red : colors.background, fontSize: '16px', fontWeight: '600', cursor: issueCount > 0 ? 'not-allowed' : 'pointer', marginTop: '10px' }}>
              {issueCount > 0 ? `⛔ Fix ${issueCount} issue${issueCount > 1 ? 's' : ''} to continue` : 'Review & Export →'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 4: REVIEW
  // ==========================================
  if (phase === 'review') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setPhase('answers')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Back</button>
            <span style={{ color: colors.white, fontSize: '14px', fontWeight: '600' }}>Review & Submit</span>
            <span style={{ color: colors.primary, fontSize: '14px' }}>{answeredCount}/{questions.length}</span>
          </div>
        </div>

        <div style={{ padding: '25px 20px', maxWidth: '650px', margin: '0 auto' }}>
          {/* Compliance Status */}
          <div style={{ backgroundColor: `${colors.primary}15`, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.primary}30`, marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ color: colors.primary, margin: 0, fontSize: '18px', fontWeight: '600' }}>🛡️ All compliance checks passed</p>
            <p style={{ color: colors.gray, margin: '5px 0 0 0', fontSize: '14px' }}>Your responses are within all limits</p>
          </div>

          <button onClick={handleExport} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: colors.gold, color: colors.background, fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginBottom: '20px' }}>📋 Copy All Responses</button>

          {/* Acknowledgment */}
          <div style={{ backgroundColor: `${colors.primary}10`, borderRadius: '12px', padding: '18px', border: `1px solid ${colors.primary}30`, marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: colors.primary }} />
              <span style={{ color: colors.white, fontSize: '13px', lineHeight: '1.5' }}>I understand CR-AI is an assistant tool. I am responsible for reviewing and verifying all information before submission.</span>
            </label>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: colors.gray, fontSize: '12px', display: 'block', marginBottom: '6px' }}>📝 Notes (optional)</label>
            <textarea value={submissionNotes} onChange={(e) => setSubmissionNotes(e.target.value)} placeholder="Anything to remember..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <button onClick={handleMarkSubmitted} disabled={!acknowledged} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: acknowledged ? 'none' : `2px solid ${colors.gray}50`, backgroundColor: acknowledged ? colors.primary : 'transparent', color: acknowledged ? colors.background : colors.gray, fontSize: '16px', fontWeight: '600', cursor: acknowledged ? 'pointer' : 'not-allowed' }}>
            ✅ Mark as Submitted
          </button>

          {/* Footer */}
          <div style={{ marginTop: '25px', textAlign: 'center', padding: '15px', backgroundColor: `${colors.primary}08`, borderRadius: '10px', border: `1px solid ${colors.primary}20` }}>
            <p style={{ color: colors.gray, margin: 0, fontSize: '12px' }}>Prepared with <strong style={{ color: colors.primary }}>BUCKET + CR-AI Technology</strong></p>
            <p style={{ color: colors.gray, margin: '4px 0 0 0', fontSize: '11px' }}>Your business data + AI assistance • Contract Ready © {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default MyCart
