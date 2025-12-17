import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const colors = {
  primary: '#00FF00',
  gold: '#FFD700',
  background: '#000000',
  card: '#0A1F0A',
  white: '#FFFFFF',
  gray: '#888888',
}

function MyCart({ session, onBack, profileData }) {
  // Tabs: 'cart' (considering), 'inprogress' (working on), 'ready' (ready to submit), 'submitted'
  const [activeTab, setActiveTab] = useState('cart')
  const [showAddManual, setShowAddManual] = useState(false)
  const [showResponseBuilder, setShowResponseBuilder] = useState(false)
  const [selectedOpportunity, setSelectedOpportunity] = useState(null)
  const [allSubmissions, setAllSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Save states
  const [showConfirm, setShowConfirm] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [savedOpportunity, setSavedOpportunity] = useState(null)

  // Manual entry form
  const [manualEntry, setManualEntry] = useState({
    title: '',
    rfpNumber: '',
    agency: '',
    dueDate: '',
    source: '',
    estimatedValue: '',
    description: ''
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

  // Filter submissions by status
  const cartItems = allSubmissions.filter(s => s.status === 'draft' && (!s.questions || s.questions.length === 0))
  const inProgressItems = allSubmissions.filter(s => s.status === 'draft' && s.questions && s.questions.length > 0)
  const readyItems = allSubmissions.filter(s => s.status === 'ready')
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
          rfp_number: manualEntry.rfpNumber,
          agency: manualEntry.agency,
          due_date: manualEntry.dueDate,
          source: manualEntry.source || 'Manual Entry',
          estimated_value: manualEntry.estimatedValue,
          description: manualEntry.description,
          status: 'draft',
          questions: [],
          responses: []
        })
        .select()
        .single()

      if (error) throw error

      setAllSubmissions([data, ...allSubmissions])
      setSavedOpportunity(data)
      setShowConfirm(false)
      setSaveSuccess(true)
      setManualEntry({
        title: '',
        rfpNumber: '',
        agency: '',
        dueDate: '',
        source: '',
        estimatedValue: '',
        description: ''
      })
    } catch (err) {
      console.error('Error adding submission:', err)
      alert('Error saving opportunity. Please try again.')
    }
  }

  // Helper function to calculate BUCKET match
  const calculateBucketMatch = (profile) => {
    if (!profile) return { percentage: 0, hasItems: [], craiHelps: [] }
    
    const hasItems = []
    const craiHelps = []
    let score = 0
    const maxScore = 10

    // Check what they have
    if (profile.company_name) {
      hasItems.push(`${profile.company_name}`)
      score += 1
    }
    if (profile.naics_codes && profile.naics_codes.length > 0) {
      hasItems.push(`NAICS: ${profile.naics_codes.map(n => n.code).join(', ')}`)
      score += 1
    }
    if (profile.certifications && profile.certifications.length > 0) {
      hasItems.push(`${profile.certifications.map(c => c.name || c.id).join(', ')}`)
      score += 1
    }
    if (profile.year_established) {
      const years = new Date().getFullYear() - parseInt(profile.year_established)
      hasItems.push(`${years}+ years in business`)
      score += 1
    }
    if (profile.city && profile.state) {
      hasItems.push(`Based in ${profile.city}, ${profile.state}`)
      score += 0.5
    }
    if (profile.sam_registered) {
      hasItems.push('SAM.gov Registered')
      score += 1
    }
    if (profile.past_performance && profile.past_performance.length > 0) {
      hasItems.push(`${profile.past_performance.length} past performance record${profile.past_performance.length !== 1 ? 's' : ''}`)
      score += 1.5
    }
    if (profile.team_members && profile.team_members.length > 0) {
      hasItems.push(`${profile.team_members.length} key personnel on file`)
      score += 1
    }
    if (profile.services && profile.services.length > 0) {
      hasItems.push(`${profile.services.length} service area${profile.services.length !== 1 ? 's' : ''} defined`)
      score += 1
    }
    if (profile.mission) {
      score += 0.5
    }
    if (profile.elevator_pitch) {
      score += 0.5
    }

    // What CR-AI will help with (things that might be missing or need to be written)
    craiHelps.push('Tailored response narratives')
    craiHelps.push('Experience descriptions')
    
    if (!profile.past_performance || profile.past_performance.length === 0) {
      craiHelps.push('Past performance statements')
    }
    if (!profile.what_makes_you_different) {
      craiHelps.push('Differentiator highlights')
    }
    craiHelps.push('Budget justification language')
    craiHelps.push('Staffing & approach sections')

    const percentage = Math.min(Math.round((score / maxScore) * 100), 100)

    return { percentage, hasItems, craiHelps }
  }

  const openResponseBuilder = (opp) => {
    setSelectedOpportunity(opp)
    setShowResponseBuilder(true)
  }

  // ==========================================
  // RESPONSE BUILDER COMPONENT
  // ==========================================
  if (showResponseBuilder && selectedOpportunity) {
    return (
      <ResponseBuilder
        opportunity={selectedOpportunity}
        profile={profileData}
        session={session}
        onBack={() => {
          setShowResponseBuilder(false)
          setSelectedOpportunity(null)
          fetchSubmissions()
        }}
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

  // ==========================================
  // MAIN CART VIEW
  // ==========================================
  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Dashboard</button>
          <h1 style={{ color: colors.white, margin: 0, fontSize: '20px' }}>🛒 My Cart</h1>
          <button
            onClick={() => setShowAddManual(true)}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '20px 30px 0 30px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('cart')} style={tabStyle(activeTab === 'cart')}>
          🛒 Considering ({cartItems.length})
        </button>
        <button onClick={() => setActiveTab('inprogress')} style={tabStyle(activeTab === 'inprogress')}>
          ✏️ In Progress ({inProgressItems.length})
        </button>
        <button onClick={() => setActiveTab('submitted')} style={tabStyle(activeTab === 'submitted')}>
          ✅ Submitted ({submittedItems.length})
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 30px' }}>
        {loading ? (
          <p style={{ color: colors.gray, textAlign: 'center' }}>Loading...</p>
        ) : (
          <>
            {/* Cart Tab */}
            {activeTab === 'cart' && (
              cartItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: colors.card, borderRadius: '16px' }}>
                  <p style={{ color: colors.gray, fontSize: '18px', margin: '0 0 10px 0' }}>No opportunities yet</p>
                  <p style={{ color: colors.gray, fontSize: '14px', margin: '0 0 20px 0' }}>Add contracts you're considering</p>
                  <button
                    onClick={() => setShowAddManual(true)}
                    style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}
                  >
                    + Add Opportunity
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {cartItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => openResponseBuilder(item)}
                      style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.gray}30`, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '16px' }}>{item.title}</h3>
                          <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{item.agency || 'No agency'}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ color: colors.gold, margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600' }}>
                            Due: {new Date(item.due_date).toLocaleDateString()}
                          </p>
                          {item.estimated_value && (
                            <p style={{ color: colors.gray, margin: 0, fontSize: '12px' }}>{item.estimated_value}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* In Progress Tab */}
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
                      <div
                        key={item.id}
                        onClick={() => openResponseBuilder(item)}
                        style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.primary}30`, cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h3 style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '16px' }}>{item.title}</h3>
                            <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{item.agency || 'No agency'}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ color: colors.primary, margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600' }}>
                              {answered}/{total} Questions
                            </p>
                            <p style={{ color: colors.gold, margin: 0, fontSize: '12px' }}>
                              Due: {new Date(item.due_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div style={{ marginTop: '15px', height: '4px', backgroundColor: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${total > 0 ? (answered / total) * 100 : 0}%`, backgroundColor: colors.primary }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* Submitted Tab */}
            {activeTab === 'submitted' && (
              submittedItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: colors.card, borderRadius: '16px' }}>
                  <p style={{ color: colors.gray, fontSize: '18px', margin: '0 0 10px 0' }}>No submissions yet</p>
                  <p style={{ color: colors.gray, fontSize: '14px', margin: 0 }}>Your submitted bids will appear here</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {submittedItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => openResponseBuilder(item)}
                      style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.primary}50`, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                            <span style={{ color: colors.primary, fontSize: '14px' }}>✅</span>
                            <h3 style={{ color: colors.white, margin: 0, fontSize: '16px' }}>{item.title}</h3>
                          </div>
                          <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{item.agency || 'No agency'}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ color: colors.gray, margin: '0', fontSize: '12px' }}>
                            {item.questions?.length || 0} responses saved
                          </p>
                        </div>
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
                <input
                  type="text"
                  value={manualEntry.title}
                  onChange={(e) => setManualEntry({ ...manualEntry, title: e.target.value })}
                  placeholder="e.g., Mental Health Services RFP"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Due Date *</label>
                <input
                  type="date"
                  value={manualEntry.dueDate}
                  onChange={(e) => setManualEntry({ ...manualEntry, dueDate: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Agency / Organization</label>
                <input
                  type="text"
                  value={manualEntry.agency}
                  onChange={(e) => setManualEntry({ ...manualEntry, agency: e.target.value })}
                  placeholder="e.g., LA County DMH"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>RFP / Bid Number</label>
                <input
                  type="text"
                  value={manualEntry.rfpNumber}
                  onChange={(e) => setManualEntry({ ...manualEntry, rfpNumber: e.target.value })}
                  placeholder="e.g., RFP-2024-001"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Estimated Value</label>
                <input
                  type="text"
                  value={manualEntry.estimatedValue}
                  onChange={(e) => setManualEntry({ ...manualEntry, estimatedValue: e.target.value })}
                  placeholder="e.g., $50,000 - $100,000"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Notes</label>
                <textarea
                  value={manualEntry.description}
                  onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
                  placeholder="Any notes about this opportunity..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button
                onClick={() => setShowAddManual(false)}
                style={{ flex: 1, padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleShowConfirm}
                style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
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

      {/* Success Modal */}
      {saveSuccess && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '20px' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '400px', width: '100%', border: `2px solid ${colors.primary}`, textAlign: 'center' }}>
            <p style={{ fontSize: '50px', margin: '0 0 15px 0' }}>✅</p>
            <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>Added to Cart!</h3>
            <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '14px' }}>{savedOpportunity?.title}</p>
            <div style={{ display: 'grid', gap: '10px' }}>
              <button
                onClick={() => {
                  setSaveSuccess(false)
                  setShowAddManual(false)
                  if (savedOpportunity) {
                    openResponseBuilder(savedOpportunity)
                  }
                }}
                style={{ padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}
              >
                🚀 Start Working on It
              </button>
              <button
                onClick={() => {
                  setSaveSuccess(false)
                  setShowAddManual(false)
                }}
                style={{ padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, cursor: 'pointer' }}
              >
                Add Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ==========================================
// RESPONSE BUILDER COMPONENT (Separate component for clarity)
// ==========================================
function ResponseBuilder({ opportunity, profile, session, onBack, calculateBucketMatch }) {
  const [phase, setPhase] = useState('overview') // overview, add-questions, answer, review
  const [questions, setQuestions] = useState(opportunity.questions || [])
  const [newQuestion, setNewQuestion] = useState('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [showWriteOwn, setShowWriteOwn] = useState(false)
  const [ownResponse, setOwnResponse] = useState('')
  const [localOpportunity, setLocalOpportunity] = useState(opportunity)
  const [showEditDetails, setShowEditDetails] = useState(false)
  const [editForm, setEditForm] = useState({
    title: opportunity.title || '',
    dueDate: opportunity.due_date || '',
    agency: opportunity.agency || '',
    rfpNumber: opportunity.rfp_number || '',
    estimatedValue: opportunity.estimated_value || '',
    description: opportunity.description || ''
  })
  const [acknowledged, setAcknowledged] = useState(false)
  const [submissionNotes, setSubmissionNotes] = useState('')

  // Calculate days left
  const daysLeft = Math.ceil((new Date(localOpportunity.due_date) - new Date()) / (1000 * 60 * 60 * 24))
  const isUrgent = daysLeft <= 7

  // Calculate BUCKET match
  const bucketMatch = calculateBucketMatch(profile)

  // Save questions to database
  const saveQuestions = async (updatedQuestions) => {
    try {
      await supabase
        .from('submissions')
        .update({ questions: updatedQuestions })
        .eq('id', localOpportunity.id)
    } catch (err) {
      console.error('Error saving questions:', err)
    }
  }

  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return
    const updated = [...questions, { id: Date.now(), text: newQuestion.trim(), response: '' }]
    setQuestions(updated)
    saveQuestions(updated)
    setNewQuestion('')
  }

  const handleStartAnswering = () => {
    if (questions.length === 0) {
      alert('Add at least one question first')
      return
    }
    setCurrentQuestionIndex(0)
    setPhase('answer')
  }

  const handleGenerateResponse = async () => {
    const question = questions[currentQuestionIndex]
    if (!question) return

    setGenerating(true)
    try {
      // Get previous responses for consistency
      const previousResponses = questions.slice(0, currentQuestionIndex).filter(q => q.response)
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.text,
          profile: profile,
          opportunity: {
            title: localOpportunity.title,
            agency: localOpportunity.agency,
            due_date: localOpportunity.due_date,
            estimated_value: localOpportunity.estimated_value,
            description: localOpportunity.description
          },
          previousResponses: previousResponses
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate')
      }
      
      const data = await response.json()
      const updated = questions.map((q, i) => 
        i === currentQuestionIndex ? { ...q, response: data.response } : q
      )
      setQuestions(updated)
      saveQuestions(updated)
      
      // Auto advance after a brief pause
      setTimeout(() => {
        goToNextQuestion()
      }, 500)
    } catch (err) {
      console.error('Error generating:', err)
      alert('CR-AI had trouble connecting. Try again or write your own response.')
    } finally {
      setGenerating(false)
    }
  }

  const handleWriteOwn = () => {
    setOwnResponse(questions[currentQuestionIndex]?.response || '')
    setShowWriteOwn(true)
  }

  const handleSaveOwnResponse = () => {
    const updated = questions.map((q, i) => 
      i === currentQuestionIndex ? { ...q, response: ownResponse } : q
    )
    setQuestions(updated)
    saveQuestions(updated)
    setShowWriteOwn(false)
    setOwnResponse('')
    goToNextQuestion()
  }

  const handleSkip = () => {
    goToNextQuestion()
  }

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      setPhase('review')
    }
  }

  const goToPrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleArchive = async () => {
    if (confirm('Archive this opportunity? You can find it later if needed.')) {
      try {
        await supabase
          .from('submissions')
          .update({ status: 'archived' })
          .eq('id', localOpportunity.id)
        onBack()
      } catch (err) {
        console.error('Error archiving:', err)
      }
    }
  }

  const handleSaveForLater = async () => {
    alert('Saved! You can find this in your Cart when you\'re ready.')
    onBack()
  }

  const handleSaveEdit = async () => {
    try {
      await supabase
        .from('submissions')
        .update({
          title: editForm.title,
          due_date: editForm.dueDate,
          agency: editForm.agency,
          rfp_number: editForm.rfpNumber,
          estimated_value: editForm.estimatedValue,
          description: editForm.description
        })
        .eq('id', localOpportunity.id)
      
      setLocalOpportunity({
        ...localOpportunity,
        title: editForm.title,
        due_date: editForm.dueDate,
        agency: editForm.agency,
        rfp_number: editForm.rfpNumber,
        estimated_value: editForm.estimatedValue,
        description: editForm.description
      })
      setShowEditDetails(false)
    } catch (err) {
      console.error('Error updating:', err)
      alert('Error saving changes. Please try again.')
    }
  }

  const handleEditQuestion = (index) => {
    setCurrentQuestionIndex(index)
    setPhase('answer')
  }

  const answeredCount = questions.filter(q => q.response).length

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

  // ==========================================
  // PHASE 1: OVERVIEW (NEW DESIGN!)
  // ==========================================
  if (phase === 'overview') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30` }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Back to Cart</button>
        </div>

        <div style={{ padding: '30px', maxWidth: '650px', margin: '0 auto' }}>
          
          {/* Contract Title & Key Info */}
          <div style={{ marginBottom: '25px' }}>
            <h1 style={{ color: colors.white, margin: '0 0 15px 0', fontSize: '24px', lineHeight: '1.3' }}>
              {localOpportunity.title}
            </h1>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '15px' }}>
              {localOpportunity.agency && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🏛️</span>
                  <span style={{ color: colors.white, fontSize: '14px' }}>{localOpportunity.agency}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>📅</span>
                <span style={{ color: isUrgent ? colors.gold : colors.white, fontSize: '14px', fontWeight: '600' }}>
                  {daysLeft} days left
                </span>
              </div>
              {localOpportunity.estimated_value && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>💰</span>
                  <span style={{ color: colors.white, fontSize: '14px' }}>{localOpportunity.estimated_value}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              {localOpportunity.rfp_number && (
                <span style={{ color: colors.gray, fontSize: '13px' }}>RFP# {localOpportunity.rfp_number}</span>
              )}
              <button
                onClick={() => setShowEditDetails(true)}
                style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                ✏️ Edit Details
              </button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: `${colors.gray}30`, margin: '25px 0' }} />

          {/* BUCKET Match Score */}
          <div style={{ 
            backgroundColor: `${colors.primary}10`, 
            borderRadius: '12px', 
            padding: '20px',
            border: `1px solid ${colors.primary}30`,
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>🎯</span>
                <span style={{ color: colors.white, fontSize: '18px', fontWeight: '600' }}>BUCKET Match</span>
              </div>
              <div style={{ 
                backgroundColor: colors.primary, 
                color: colors.background,
                padding: '8px 16px',
                borderRadius: '20px',
                fontWeight: '700',
                fontSize: '18px'
              }}>
                {bucketMatch.percentage}%
              </div>
            </div>
            
            {/* Progress Bar */}
            <div style={{ height: '8px', backgroundColor: `${colors.gray}30`, borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${bucketMatch.percentage}%`,
                backgroundColor: colors.primary,
                borderRadius: '4px',
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>

          {/* YOUR BUCKET HAS Section */}
          {bucketMatch.hasItems.length > 0 && (
            <div style={{ 
              backgroundColor: '#0a1a0a', 
              borderRadius: '12px', 
              padding: '20px',
              border: `1px solid ${colors.primary}20`,
              marginBottom: '15px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <span style={{ fontSize: '20px' }}>🪣</span>
                <span style={{ color: colors.primary, fontSize: '16px', fontWeight: '600' }}>YOUR BUCKET HAS:</span>
              </div>
              
              <div style={{ display: 'grid', gap: '10px' }}>
                {bucketMatch.hasItems.slice(0, 5).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: colors.primary, fontSize: '16px' }}>✓</span>
                    <span style={{ color: colors.white, fontSize: '14px' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CR-AI WILL HELP YOU WITH Section */}
          <div style={{ 
            backgroundColor: `${colors.gold}08`, 
            borderRadius: '12px', 
            padding: '20px',
            border: `1px solid ${colors.gold}30`,
            marginBottom: '25px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <span style={{ fontSize: '20px' }}>🤖</span>
              <span style={{ color: colors.gold, fontSize: '16px', fontWeight: '600' }}>CR-AI WILL HELP YOU WITH:</span>
            </div>
            
            <div style={{ display: 'grid', gap: '10px', marginBottom: '15px' }}>
              {bucketMatch.craiHelps.slice(0, 5).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: colors.gold, fontSize: '14px' }}>✨</span>
                  <span style={{ color: colors.white, fontSize: '14px' }}>{item}</span>
                </div>
              ))}
            </div>

            <div style={{ 
              backgroundColor: `${colors.gold}15`,
              borderRadius: '8px',
              padding: '12px 15px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '16px' }}>💡</span>
              <span style={{ color: colors.gold, fontSize: '13px' }}>
                Completing these will boost your Contract Readiness score!
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gap: '12px' }}>
            <button
              onClick={() => setPhase('add-questions')}
              style={{
                width: '100%',
                padding: '18px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: colors.primary,
                color: colors.background,
                fontSize: '18px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              🚀 Go After This
            </button>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={handleArchive}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.gray}50`,
                  backgroundColor: 'transparent',
                  color: colors.gray,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                ❌ Not a Fit
              </button>
              <button
                onClick={handleSaveForLater}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.gold}50`,
                  backgroundColor: 'transparent',
                  color: colors.gold,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                🔖 Save for Later
              </button>
            </div>
          </div>
        </div>

        {/* Edit Details Modal */}
        {showEditDetails && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '500px', width: '100%', border: `2px solid ${colors.primary}`, maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ color: colors.white, margin: '0 0 20px 0' }}>✏️ Edit Details</h3>
              <div style={{ display: 'grid', gap: '15px' }}>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Title</label>
                  <input type="text" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Due Date</label>
                  <input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({...editForm, dueDate: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Agency</label>
                  <input type="text" value={editForm.agency} onChange={(e) => setEditForm({...editForm, agency: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>RFP/Bid Number</label>
                  <input type="text" value={editForm.rfpNumber} onChange={(e) => setEditForm({...editForm, rfpNumber: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Contract Value</label>
                  <input type="text" value={editForm.estimatedValue} onChange={(e) => setEditForm({...editForm, estimatedValue: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Notes</label>
                  <textarea value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} rows={3} style={{...inputStyle, resize: 'vertical'}} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                <button onClick={() => setShowEditDetails(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveEdit} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Save Changes</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==========================================
  // PHASE 2: ADD QUESTIONS
  // ==========================================
  if (phase === 'add-questions') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setPhase('overview')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Back</button>
            <h1 style={{ color: colors.white, margin: 0, fontSize: '18px' }}>{localOpportunity.title}</h1>
            <div style={{ width: '60px' }}></div>
          </div>
        </div>

        <div style={{ padding: '40px 30px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '24px' }}>Add the RFP Questions</h2>
            <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>Paste each question from the RFP. CR-AI will help you answer them.</p>
          </div>

          {/* Questions Added So Far */}
          {questions.length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <p style={{ color: colors.gray, margin: '0 0 10px 0', fontSize: '12px' }}>{questions.length} QUESTION{questions.length !== 1 ? 'S' : ''} ADDED</p>
              <div style={{ display: 'grid', gap: '10px' }}>
                {questions.map((q, i) => (
                  <div key={q.id} style={{ backgroundColor: colors.card, borderRadius: '8px', padding: '12px 15px', border: `1px solid ${colors.gray}30`, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ color: colors.primary, fontWeight: '600', minWidth: '25px' }}>Q{i + 1}</span>
                    <span style={{ color: colors.white, fontSize: '14px', flex: 1 }}>{q.text}</span>
                    <button
                      onClick={() => {
                        const updated = questions.filter((_, idx) => idx !== i)
                        setQuestions(updated)
                        saveQuestions(updated)
                      }}
                      style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Question Input */}
          <div style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.gray}30`, marginBottom: '20px' }}>
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Paste or type an RFP question here..."
              rows={4}
              style={{ ...inputStyle, marginBottom: '15px', resize: 'vertical' }}
            />
            <button
              onClick={handleAddQuestion}
              disabled={!newQuestion.trim()}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: newQuestion.trim() ? colors.primary : '#333',
                color: newQuestion.trim() ? colors.background : colors.gray,
                fontWeight: '600',
                cursor: newQuestion.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              + Add Question
            </button>
          </div>

          {/* Continue Button */}
          {questions.length > 0 && (
            <button
              onClick={handleStartAnswering}
              style={{
                width: '100%',
                padding: '18px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: colors.primary,
                color: colors.background,
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Continue to Answers →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 3: ANSWER QUESTIONS
  // ==========================================
  if (phase === 'answer') {
    const currentQuestion = questions[currentQuestionIndex]
    const hasAnswer = currentQuestion?.response

    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header with Progress */}
        <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <button onClick={() => setPhase('add-questions')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Questions</button>
            <span style={{ color: colors.white, fontSize: '14px' }}>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <button onClick={() => setPhase('review')} style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontSize: '14px' }}>Review All →</button>
          </div>
          {/* Progress Bar */}
          <div style={{ height: '4px', backgroundColor: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
              backgroundColor: colors.primary,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        <div style={{ padding: '40px 30px', maxWidth: '600px', margin: '0 auto' }}>
          {/* The Question */}
          <div style={{ marginBottom: '30px' }}>
            <p style={{ color: colors.primary, margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>QUESTION {currentQuestionIndex + 1}</p>
            <h2 style={{ color: colors.white, margin: 0, fontSize: '22px', lineHeight: '1.4' }}>{currentQuestion?.text}</h2>
          </div>

          {/* Write Own Modal */}
          {showWriteOwn ? (
            <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '25px', border: `2px solid ${colors.primary}` }}>
              <p style={{ color: colors.white, margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600' }}>Write your response</p>
              <textarea
                value={ownResponse}
                onChange={(e) => setOwnResponse(e.target.value)}
                placeholder="Type your response..."
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: '15px' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowWriteOwn(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOwnResponse}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}
                >
                  Save & Continue
                </button>
              </div>
            </div>
          ) : hasAnswer ? (
            /* Show existing answer */
            <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '25px', border: `1px solid ${colors.primary}50`, marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <p style={{ color: colors.primary, margin: 0, fontSize: '12px', fontWeight: '600' }}>YOUR RESPONSE</p>
                <button
                  onClick={() => {
                    setOwnResponse(currentQuestion.response)
                    setShowWriteOwn(true)
                  }}
                  style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '12px' }}
                >
                  ✏️ Edit
                </button>
              </div>
              <p style={{ color: colors.white, margin: 0, fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{currentQuestion.response}</p>
            </div>
          ) : (
            /* Action Buttons */
            <div style={{ display: 'grid', gap: '12px' }}>
              <button
                onClick={handleGenerateResponse}
                disabled={generating}
                style={{
                  width: '100%',
                  padding: '18px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  fontSize: '18px',
                  fontWeight: '600',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.7 : 1
                }}
              >
                {generating ? '⏳ Pulling from your BUCKET...' : '✨ Get CR-AI Suggestion'}
              </button>
              <p style={{ color: colors.gray, margin: '0', fontSize: '12px', textAlign: 'center' }}>
                🪣 CR-AI uses your BUCKET to write tailored responses
              </p>
              <button
                onClick={handleWriteOwn}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.gray}50`,
                  backgroundColor: 'transparent',
                  color: colors.white,
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                ✍️ Write My Own
              </button>
              <button
                onClick={handleSkip}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.gray,
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '10px'
                }}
              >
                Skip for now →
              </button>
            </div>
          )}

          {/* Navigation (when has answer) */}
          {hasAnswer && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              {currentQuestionIndex > 0 && (
                <button
                  onClick={goToPrevQuestion}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.gray}50`,
                    backgroundColor: 'transparent',
                    color: colors.white,
                    cursor: 'pointer'
                  }}
                >
                  ← Previous
                </button>
              )}
              <button
                onClick={goToNextQuestion}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next Question →' : 'Review All →'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 4: REVIEW (WITH ACKNOWLEDGMENT)
  // ==========================================
  if (phase === 'review') {
    const handleExport = () => {
      // Build export text
      let exportText = `${localOpportunity.title}\n`
      exportText += `${localOpportunity.agency || 'No agency specified'}\n`
      exportText += `Due: ${new Date(localOpportunity.due_date).toLocaleDateString()}\n`
      exportText += `${'='.repeat(50)}\n\n`
      
      questions.forEach((q, i) => {
        exportText += `Q${i + 1}: ${q.text}\n\n`
        exportText += `A: ${q.response || '[Not answered]'}\n\n`
        exportText += `${'-'.repeat(40)}\n\n`
      })
      
      exportText += `\nGenerated with Contract Ready • CR-AI Technology`
      
      // Copy to clipboard
      navigator.clipboard.writeText(exportText).then(() => {
        alert('✅ Responses copied to clipboard!\n\nPaste them into your proposal document.')
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = exportText
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        alert('✅ Responses copied to clipboard!\n\nPaste them into your proposal document.')
      })
    }

    const handleMarkSubmitted = async () => {
      if (!acknowledged) {
        alert('Please check the acknowledgment box before submitting.')
        return
      }
      
      try {
        await supabase
          .from('submissions')
          .update({ 
            status: 'submitted',
            submission_notes: submissionNotes
          })
          .eq('id', localOpportunity.id)
        
        alert('🎉 Marked as submitted!\n\nYour responses have been saved to your BUCKET for future bids.')
        onBack()
      } catch (err) {
        console.error('Error updating status:', err)
        alert('Error updating status. Please try again.')
      }
    }

    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setPhase('answer')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Back</button>
            <h1 style={{ color: colors.white, margin: 0, fontSize: '18px' }}>Review Responses</h1>
            <span style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>{answeredCount}/{questions.length} Complete</span>
          </div>
        </div>

        <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
          {/* Progress Summary */}
          <div style={{
            backgroundColor: answeredCount === questions.length ? `${colors.primary}15` : `${colors.gold}15`,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${answeredCount === questions.length ? colors.primary : colors.gold}30`,
            marginBottom: '25px',
            textAlign: 'center'
          }}>
            {answeredCount === questions.length ? (
              <>
                <p style={{ color: colors.primary, margin: 0, fontSize: '18px', fontWeight: '600' }}>🎉 All questions answered!</p>
                <p style={{ color: colors.gray, margin: '5px 0 0 0', fontSize: '14px' }}>Review below, then export when ready.</p>
              </>
            ) : (
              <>
                <p style={{ color: colors.gold, margin: 0, fontSize: '18px', fontWeight: '600' }}>{questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} still need answers</p>
                <p style={{ color: colors.gray, margin: '5px 0 0 0', fontSize: '14px' }}>Click on any question to answer it.</p>
              </>
            )}
          </div>

          {/* All Q&As */}
          <div style={{ display: 'grid', gap: '15px', marginBottom: '30px' }}>
            {questions.map((q, i) => (
              <div
                key={q.id}
                onClick={() => handleEditQuestion(i)}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${q.response ? colors.primary : colors.gold}30`,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <p style={{ color: q.response ? colors.primary : colors.gold, margin: 0, fontSize: '12px', fontWeight: '600' }}>
                    Q{i + 1} {q.response ? '✓' : '(needs answer)'}
                  </p>
                  <span style={{ color: colors.gray, fontSize: '12px' }}>Edit →</span>
                </div>
                <p style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '15px', fontWeight: '500' }}>{q.text}</p>
                {q.response ? (
                  <p style={{ color: colors.gray, margin: 0, fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {q.response.length > 200 ? q.response.substring(0, 200) + '...' : q.response}
                  </p>
                ) : (
                  <p style={{ color: colors.gold, margin: 0, fontSize: '14px', fontStyle: 'italic' }}>Click to answer this question</p>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons & Acknowledgment */}
          {answeredCount > 0 && (
            <div style={{ display: 'grid', gap: '15px' }}>
              <button
                onClick={handleExport}
                style={{
                  width: '100%',
                  padding: '18px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: colors.gold,
                  color: colors.background,
                  fontSize: '18px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📋 Copy All Responses
              </button>
              
              {answeredCount === questions.length && (
                <>
                  {/* Acknowledgment Box */}
                  <div style={{
                    backgroundColor: `${colors.primary}10`,
                    borderRadius: '12px',
                    padding: '20px',
                    border: `1px solid ${colors.primary}30`
                  }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: colors.primary }}
                      />
                      <span style={{ color: colors.white, fontSize: '14px', lineHeight: '1.5' }}>
                        I understand CR-AI is an assistant tool. I am responsible for reviewing and verifying all information before submission.
                      </span>
                    </label>
                  </div>

                  {/* Optional Notes */}
                  <div>
                    <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                      📝 Notes (optional) — Anything to remember for this bid?
                    </label>
                    <textarea
                      value={submissionNotes}
                      onChange={(e) => setSubmissionNotes(e.target.value)}
                      placeholder="e.g., Need to follow up on references, submitted via email..."
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>

                  <button
                    onClick={handleMarkSubmitted}
                    disabled={!acknowledged}
                    style={{
                      width: '100%',
                      padding: '18px',
                      borderRadius: '12px',
                      border: acknowledged ? 'none' : `2px solid ${colors.gray}50`,
                      backgroundColor: acknowledged ? colors.primary : 'transparent',
                      color: acknowledged ? colors.background : colors.gray,
                      fontSize: '18px',
                      fontWeight: '600',
                      cursor: acknowledged ? 'pointer' : 'not-allowed'
                    }}
                  >
                    ✅ Mark as Submitted
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tip */}
          <div style={{
            marginTop: '25px',
            backgroundColor: `${colors.primary}10`,
            borderRadius: '12px',
            padding: '15px 20px',
            border: `1px solid ${colors.primary}30`
          }}>
            <p style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>
              💡 <strong style={{ color: colors.white }}>Tip:</strong> Copy your responses and paste them into your official proposal. After you submit, mark it as "Submitted" to track it.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default MyCart
