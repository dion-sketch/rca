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
      alert('Error adding opportunity. Please try again.')
    }
  }

  const handleEditEntry = () => {
    setShowConfirm(false)
  }

  const handleViewInCart = () => {
    setShowAddManual(false)
    setSaveSuccess(false)
    setSavedOpportunity(null)
    setActiveTab('cart')
  }

  const handleAddAnother = () => {
    setSaveSuccess(false)
    setSavedOpportunity(null)
  }

  const handleStartNow = () => {
    if (savedOpportunity) {
      setSelectedOpportunity(savedOpportunity)
      setShowResponseBuilder(true)
      setShowAddManual(false)
      setSaveSuccess(false)
      setSavedOpportunity(null)
    }
  }

  const closeModal = () => {
    setShowAddManual(false)
    setSaveSuccess(false)
    setShowConfirm(false)
    setSavedOpportunity(null)
    setManualEntry({
      title: '',
      rfpNumber: '',
      agency: '',
      dueDate: '',
      source: '',
      estimatedValue: '',
      description: ''
    })
  }

  const startResponse = (opportunity) => {
    setSelectedOpportunity(opportunity)
    setShowResponseBuilder(true)
  }

  const getDaysUntilDue = (dueDate) => {
    const due = new Date(dueDate)
    const now = new Date()
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
    return diff
  }

  const handleDeleteOpportunity = async (e, id) => {
    e.stopPropagation() // Prevent card click
    if (confirm('Remove this opportunity from your cart?')) {
      try {
        await supabase
          .from('submissions')
          .update({ status: 'archived' })
          .eq('id', id)
        
        setAllSubmissions(allSubmissions.filter(s => s.id !== id))
      } catch (err) {
        console.error('Error deleting:', err)
        alert('Error removing opportunity. Please try again.')
      }
    }
  }

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

  // Response Builder View
  if (showResponseBuilder && selectedOpportunity) {
    return (
      <ResponseBuilder 
        opportunity={selectedOpportunity}
        session={session}
        profileData={profileData}
        onBack={() => {
          setShowResponseBuilder(false)
          setSelectedOpportunity(null)
          fetchSubmissions()
        }}
      />
    )
  }

  // Render an opportunity card
  const renderOpportunityCard = (sub) => {
    const daysLeft = getDaysUntilDue(sub.due_date)
    const isUrgent = daysLeft <= 7
    const isPastDue = daysLeft < 0
    const questionsCount = sub.questions?.length || 0
    const answeredCount = sub.questions?.filter(q => q.response)?.length || 0

    return (
      <div
        key={sub.id}
        onClick={() => startResponse(sub)}
        style={{
          backgroundColor: colors.card,
          borderRadius: '12px',
          padding: '20px',
          border: `1px solid ${isPastDue ? '#ff4444' : isUrgent ? colors.gold : colors.gray}30`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s'
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <h3 style={{ color: colors.white, margin: 0, fontSize: '16px' }}>{sub.title}</h3>
            {sub.rfp_number && (
              <span style={{ color: colors.gray, fontSize: '12px' }}>#{sub.rfp_number}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
            {sub.agency && <span style={{ color: colors.gray }}>🏢 {sub.agency}</span>}
            <span style={{ color: isPastDue ? '#ff4444' : isUrgent ? colors.gold : colors.gray }}>
              📅 {isPastDue ? 'Past Due' : `${daysLeft} days left`}
            </span>
            {questionsCount > 0 && (
              <span style={{ color: colors.gray }}>📝 {answeredCount}/{questionsCount} answered</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={(e) => handleDeleteOpportunity(e, sub.id)}
            style={{
              background: 'none',
              border: 'none',
              color: colors.gray,
              cursor: 'pointer',
              fontSize: '18px',
              padding: '5px',
              borderRadius: '4px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ff4444'}
            onMouseLeave={(e) => e.currentTarget.style.color = colors.gray}
            title="Remove from cart"
          >
            🗑️
          </button>
          <div style={{ color: colors.primary, fontSize: '20px' }}>→</div>
        </div>
      </div>
    )
  }

  // Empty state component
  const renderEmptyState = (emoji, title, subtitle, showAddButton = false) => (
    <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '40px', textAlign: 'center', border: `1px solid ${colors.gray}30` }}>
      <div style={{ fontSize: '48px', marginBottom: '15px' }}>{emoji}</div>
      <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>{title}</h3>
      <p style={{ color: colors.gray, margin: showAddButton ? '0 0 20px 0' : 0 }}>{subtitle}</p>
      {showAddButton && (
        <button onClick={() => setShowAddManual(true)} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
          + Add Opportunity
        </button>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Back</button>
            <h1 style={{ color: colors.white, margin: 0, fontSize: '24px' }}>🛒 My Cart</h1>
          </div>
          <button
            onClick={() => setShowAddManual(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: colors.primary,
              color: colors.background,
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            + Add Opportunity
          </button>
        </div>
        <p style={{ color: colors.gray, margin: '10px 0 0 0', fontSize: '13px', paddingLeft: '85px' }}>
          Opportunities you're pursuing — work on bids here before submitting.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: colors.card, padding: '0 30px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', gap: '30px' }}>
        {[
          { id: 'cart', label: `🛒 In Cart (${cartItems.length})`, subtitle: 'Considering' },
          { id: 'inprogress', label: `📝 In Progress (${inProgressItems.length})`, subtitle: 'Working on' },
          { id: 'ready', label: `✅ Ready (${readyItems.length})`, subtitle: 'To submit' },
          { id: 'submitted', label: `📬 Submitted (${submittedItems.length})`, subtitle: 'Waiting' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === tab.id ? colors.primary : colors.gray,
              padding: '15px 0',
              fontSize: '14px',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? `2px solid ${colors.primary}` : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* IN CART TAB - Opportunities you're considering */}
        {activeTab === 'cart' && (
          <div style={{ display: 'grid', gap: '15px' }}>
            <div style={{ marginBottom: '10px' }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                🛒 Opportunities you've saved. Click one to start bidding.
              </p>
            </div>
            {cartItems.length === 0 ? (
              renderEmptyState('🛒', 'Your cart is empty', 'Add opportunities you find to start bidding on them.', true)
            ) : (
              cartItems.map(sub => renderOpportunityCard(sub))
            )}
          </div>
        )}

        {/* IN PROGRESS TAB - Actively working on */}
        {activeTab === 'inprogress' && (
          <div style={{ display: 'grid', gap: '15px' }}>
            <div style={{ marginBottom: '10px' }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                📝 Bids you're actively writing. Not submitted yet.
              </p>
            </div>
            {inProgressItems.length === 0 ? (
              renderEmptyState('📝', 'Nothing in progress', 'When you start writing a bid, it moves here.')
            ) : (
              inProgressItems.map(sub => renderOpportunityCard(sub))
            )}
          </div>
        )}

        {/* READY TO SUBMIT TAB */}
        {activeTab === 'ready' && (
          <div style={{ display: 'grid', gap: '15px' }}>
            <div style={{ marginBottom: '10px' }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                ✅ Bids complete and ready to submit. Review and export.
              </p>
            </div>
            {readyItems.length === 0 ? (
              renderEmptyState('✅', 'Nothing ready yet', 'Complete your bids to move them here.')
            ) : (
              readyItems.map(sub => renderOpportunityCard(sub))
            )}
          </div>
        )}

        {/* SUBMITTED TAB */}
        {activeTab === 'submitted' && (
          <div style={{ display: 'grid', gap: '15px' }}>
            <div style={{ marginBottom: '10px' }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                📬 Bids you've submitted. Waiting to hear back.
              </p>
            </div>
            {submittedItems.length === 0 ? (
              renderEmptyState('📬', 'No submissions yet', 'Your submitted bids will appear here.')
            ) : (
              submittedItems.map(sub => renderOpportunityCard(sub))
            )}
          </div>
        )}
      </div>

      {/* Add Manual Modal */}
      {showAddManual && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '500px', width: '100%', border: `2px solid ${colors.primary}`, maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* SUCCESS STATE */}
            {saveSuccess && savedOpportunity ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: `${colors.primary}20`, border: `3px solid ${colors.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                  <span style={{ fontSize: '40px' }}>✓</span>
                </div>
                <h3 style={{ color: colors.primary, margin: '0 0 10px 0', fontSize: '24px' }}>Added to Your Cart!</h3>
                <p style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '18px', fontWeight: '600' }}>{savedOpportunity.title}</p>
                <p style={{ color: colors.gray, margin: '0 0 10px 0', fontSize: '14px' }}>Due {new Date(savedOpportunity.due_date).toLocaleDateString()}</p>
                
                <div style={{ backgroundColor: `${colors.gold}15`, borderRadius: '8px', padding: '12px', marginBottom: '25px', border: `1px solid ${colors.gold}30` }}>
                  <p style={{ color: colors.gold, margin: 0, fontSize: '13px' }}>
                    🛒 Your cart holds opportunities you're working on — not submitted yet.
                  </p>
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  <button onClick={handleStartNow} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
                    🚀 Start Bidding Now
                  </button>
                  <button onClick={handleViewInCart} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, fontSize: '14px', cursor: 'pointer' }}>
                    View in Cart
                  </button>
                  <button onClick={handleAddAnother} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, fontSize: '14px', cursor: 'pointer' }}>
                    + Add Another Opportunity
                  </button>
                </div>
              </div>
            ) : showConfirm ? (
              /* CONFIRMATION STATE - Is this the right one? */
              <div>
                <h3 style={{ color: colors.white, margin: '0 0 5px 0', textAlign: 'center' }}>🔍 Is this correct?</h3>
                <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '13px', textAlign: 'center' }}>Review the details before adding to your cart.</p>
                
                <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <h4 style={{ color: colors.primary, margin: '0 0 15px 0', fontSize: '18px' }}>{manualEntry.title}</h4>
                  
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {manualEntry.rfpNumber && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: colors.gray, fontSize: '13px' }}>RFP/Bid #</span>
                        <span style={{ color: colors.white, fontSize: '13px' }}>{manualEntry.rfpNumber}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: colors.gray, fontSize: '13px' }}>Due Date</span>
                      <span style={{ color: colors.white, fontSize: '13px' }}>{new Date(manualEntry.dueDate).toLocaleDateString()}</span>
                    </div>
                    {manualEntry.agency && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: colors.gray, fontSize: '13px' }}>Agency</span>
                        <span style={{ color: colors.white, fontSize: '13px' }}>{manualEntry.agency}</span>
                      </div>
                    )}
                    {manualEntry.estimatedValue && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: colors.gray, fontSize: '13px' }}>Value</span>
                        <span style={{ color: colors.white, fontSize: '13px' }}>{manualEntry.estimatedValue}</span>
                      </div>
                    )}
                    {manualEntry.source && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: colors.gray, fontSize: '13px' }}>Source</span>
                        <span style={{ color: colors.white, fontSize: '13px' }}>{manualEntry.source}</span>
                      </div>
                    )}
                  </div>

                  {manualEntry.description && (
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: `1px solid ${colors.gray}30` }}>
                      <p style={{ color: colors.gray, margin: '0 0 5px 0', fontSize: '12px' }}>NOTES</p>
                      <p style={{ color: colors.white, margin: 0, fontSize: '13px' }}>{manualEntry.description}</p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleEditEntry} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer', fontSize: '14px' }}>
                    ✏️ Edit
                  </button>
                  <button onClick={handleConfirmAdd} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                    ✓ Yes, Add to Cart
                  </button>
                </div>
              </div>
            ) : (
              /* ENTRY FORM */
              <>
                <h3 style={{ color: colors.white, margin: '0 0 5px 0' }}>🛒 Add to Cart</h3>
                <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '13px' }}>Found an opportunity? Add it here to start bidding.</p>
                <div style={{ display: 'grid', gap: '15px' }}>
                  <div>
                    <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Opportunity Title *</label>
                    <input type="text" value={manualEntry.title} onChange={(e) => setManualEntry({ ...manualEntry, title: e.target.value })} placeholder="e.g., Mental Health Services RFP" style={inputStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>RFP/Bid Number</label>
                      <input type="text" value={manualEntry.rfpNumber} onChange={(e) => setManualEntry({ ...manualEntry, rfpNumber: e.target.value })} placeholder="e.g., RFP-2024-001" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Due Date *</label>
                      <input type="date" value={manualEntry.dueDate} onChange={(e) => setManualEntry({ ...manualEntry, dueDate: e.target.value })} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Agency / Organization</label>
                    <input type="text" value={manualEntry.agency} onChange={(e) => setManualEntry({ ...manualEntry, agency: e.target.value })} placeholder="e.g., LA County Department of Mental Health" style={inputStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Where'd you find it?</label>
                      <select value={manualEntry.source} onChange={(e) => setManualEntry({ ...manualEntry, source: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">Select...</option>
                        <option value="SAM.gov">SAM.gov</option>
                        <option value="State Website">State Website</option>
                        <option value="County Website">County Website</option>
                        <option value="City Website">City Website</option>
                        <option value="Email/Newsletter">Email/Newsletter</option>
                        <option value="Referral">Referral</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Contract Value (if known)</label>
                      <input type="text" value={manualEntry.estimatedValue} onChange={(e) => setManualEntry({ ...manualEntry, estimatedValue: e.target.value })} placeholder="e.g., $500,000" style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Notes</label>
                    <textarea value={manualEntry.description} onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })} placeholder="Anything else you want to remember..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '25px' }}>
                  <button onClick={closeModal} style={{ padding: '12px 24px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                  <button onClick={handleShowConfirm} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Next →</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ==========================================
// RESPONSE BUILDER - WIZARD STYLE
// ==========================================
function ResponseBuilder({ opportunity, session, profileData, onBack }) {
  // Phases: 'overview' -> 'add-questions' -> 'answer' -> 'review'
  const [phase, setPhase] = useState('overview')
  const [questions, setQuestions] = useState(opportunity.questions || [])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [newQuestionText, setNewQuestionText] = useState('')
  const [bulkQuestions, setBulkQuestions] = useState('')
  const [generating, setGenerating] = useState(false)
  const [profile, setProfile] = useState(profileData || null)
  const [showWriteOwn, setShowWriteOwn] = useState(false)
  const [ownResponse, setOwnResponse] = useState('')

  useEffect(() => {
    if (!profile && session?.user?.id) {
      fetchProfile()
    }
  }, [session])

  // If there are already questions, skip to answer phase
  useEffect(() => {
    if (opportunity.questions?.length > 0) {
      setQuestions(opportunity.questions)
      // Find first unanswered question
      const firstUnanswered = opportunity.questions.findIndex(q => !q.response)
      if (firstUnanswered >= 0) {
        setCurrentQuestionIndex(firstUnanswered)
        setPhase('answer')
      } else {
        setPhase('review')
      }
    }
  }, [opportunity])

  const fetchProfile = async () => {
    try {
      const { data } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()
      if (data) setProfile(data)
    } catch (err) {
      console.error('Error fetching profile:', err)
    }
  }

  const getDaysUntilDue = (dueDate) => {
    const due = new Date(dueDate)
    const now = new Date()
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
  }

  const saveQuestions = async (qs) => {
    try {
      await supabase
        .from('submissions')
        .update({ questions: qs })
        .eq('id', opportunity.id)
    } catch (err) {
      console.error('Error saving:', err)
    }
  }

  const handleAddSingleQuestion = () => {
    if (!newQuestionText.trim()) return
    const newQ = { id: Date.now(), text: newQuestionText.trim(), response: '' }
    const updated = [...questions, newQ]
    setQuestions(updated)
    setNewQuestionText('')
    saveQuestions(updated)
  }

  const handleAddBulkQuestions = () => {
    if (!bulkQuestions.trim()) return
    const lines = bulkQuestions.split('\n').filter(line => line.trim())
    const newQs = lines.map((line, i) => ({
      id: Date.now() + i,
      text: line.trim(),
      response: ''
    }))
    const updated = [...questions, ...newQs]
    setQuestions(updated)
    setBulkQuestions('')
    saveQuestions(updated)
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
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.text,
          profile: profile,
          opportunityTitle: opportunity.title
        }),
      })

      if (!response.ok) throw new Error('Failed to generate')
      
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
      alert('CR-AI had trouble connecting. Try again or write your own.')
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
    try {
      await supabase
        .from('submissions')
        .update({ status: 'archived' })
        .eq('id', opportunity.id)
      onBack()
    } catch (err) {
      console.error('Error archiving:', err)
    }
  }

  const handleEditQuestion = (index) => {
    setCurrentQuestionIndex(index)
    setPhase('answer')
  }

  const daysLeft = getDaysUntilDue(opportunity.due_date)
  const isUrgent = daysLeft <= 7
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
  // PHASE 1: OVERVIEW
  // ==========================================
  if (phase === 'overview') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30` }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Back to Cart</button>
        </div>

        <div style={{ padding: '40px 30px', maxWidth: '600px', margin: '0 auto' }}>
          {/* Opportunity Card */}
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', border: `1px solid ${colors.gray}30`, marginBottom: '25px' }}>
            <h1 style={{ color: colors.white, margin: '0 0 20px 0', fontSize: '24px', lineHeight: '1.3' }}>{opportunity.title}</h1>
            
            <div style={{ display: 'grid', gap: '15px' }}>
              {opportunity.agency && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.gray }}>Agency</span>
                  <span style={{ color: colors.white }}>{opportunity.agency}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.gray }}>Due Date</span>
                <span style={{ color: isUrgent ? colors.gold : colors.white, fontWeight: '600' }}>
                  {new Date(opportunity.due_date).toLocaleDateString()} ({daysLeft} days)
                </span>
              </div>
              {opportunity.estimated_value && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.gray }}>Value</span>
                  <span style={{ color: colors.white }}>{opportunity.estimated_value}</span>
                </div>
              )}
              {opportunity.rfp_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.gray }}>RFP #</span>
                  <span style={{ color: colors.white }}>{opportunity.rfp_number}</span>
                </div>
              )}
            </div>

            {opportunity.description && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.gray}30` }}>
                <p style={{ color: colors.gray, margin: '0 0 5px 0', fontSize: '12px' }}>NOTES</p>
                <p style={{ color: colors.white, margin: 0, fontSize: '14px', lineHeight: '1.5' }}>{opportunity.description}</p>
              </div>
            )}
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
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              🚀 Go After This
            </button>
            <button
              onClick={handleArchive}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: `1px solid ${colors.gray}50`,
                backgroundColor: 'transparent',
                color: colors.gray,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Not a Fit — Remove from Cart
            </button>
          </div>
        </div>
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
            <h1 style={{ color: colors.white, margin: 0, fontSize: '18px' }}>{opportunity.title}</h1>
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
                      style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '12px' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Single Question */}
          <div style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.gray}30`, marginBottom: '15px' }}>
            <p style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>Add a question</p>
            <input
              type="text"
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddSingleQuestion()}
              placeholder="Type or paste a question..."
              style={inputStyle}
            />
            <button
              onClick={handleAddSingleQuestion}
              disabled={!newQuestionText.trim()}
              style={{
                marginTop: '10px',
                padding: '10px 20px',
                borderRadius: '8px',
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

          {/* Bulk Add */}
          <div style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.gray}30`, marginBottom: '25px' }}>
            <p style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>Or paste multiple questions</p>
            <p style={{ color: colors.gray, margin: '0 0 10px 0', fontSize: '12px' }}>One question per line</p>
            <textarea
              value={bulkQuestions}
              onChange={(e) => setBulkQuestions(e.target.value)}
              placeholder="Question 1&#10;Question 2&#10;Question 3"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <button
              onClick={handleAddBulkQuestions}
              disabled={!bulkQuestions.trim()}
              style={{
                marginTop: '10px',
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: bulkQuestions.trim() ? colors.primary : colors.gray,
                color: colors.background,
                fontSize: '14px',
                fontWeight: '600',
                cursor: bulkQuestions.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              + Add All Questions
            </button>
          </div>

          {/* Start Answering Button */}
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
              ✨ Start Answering with CR-AI
            </button>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 3: ANSWER (ONE AT A TIME)
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
                {generating ? '⏳ Pulling from your BUCKET...' : '✨ Generate with CR-AI'}
              </button>
              <p style={{ color: colors.gray, margin: '0', fontSize: '12px', textAlign: 'center' }}>
                🪣 CR-AI uses your BUCKET + online data to write responses
              </p>
              <button
                onClick={handleWriteOwn}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.gray}`,
                  backgroundColor: 'transparent',
                  color: colors.white,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                ✍️ Write My Own
              </button>
              <button
                onClick={handleSkip}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: colors.gray,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                ⏭️ Skip for Now
              </button>
            </div>
          )}

          {/* Navigation for answered questions */}
          {hasAnswer && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              {currentQuestionIndex > 0 && (
                <button
                  onClick={goToPrevQuestion}
                  style={{ flex: 1, padding: '14px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}
                >
                  ← Previous
                </button>
              )}
              <button
                onClick={goToNextQuestion}
                style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next →' : 'Review All →'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 4: REVIEW
  // ==========================================
  if (phase === 'review') {
    const handleExport = () => {
      // Build export text
      let exportText = `${opportunity.title}\n`
      exportText += `${opportunity.agency || 'No agency specified'}\n`
      exportText += `Due: ${new Date(opportunity.due_date).toLocaleDateString()}\n`
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
      if (confirm('Mark this as submitted? It will move to your Submitted tab.')) {
        try {
          await supabase
            .from('submissions')
            .update({ status: 'submitted' })
            .eq('id', opportunity.id)
          
          alert('🎉 Marked as submitted!\n\nWould you like to save your responses to your BUCKET for future bids?')
          onBack()
        } catch (err) {
          console.error('Error updating status:', err)
          alert('Error updating status. Please try again.')
        }
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

          {/* Action Buttons */}
          {answeredCount > 0 && (
            <div style={{ display: 'grid', gap: '12px' }}>
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
                <button
                  onClick={handleMarkSubmitted}
                  style={{
                    width: '100%',
                    padding: '18px',
                    borderRadius: '12px',
                    border: `2px solid ${colors.primary}`,
                    backgroundColor: 'transparent',
                    color: colors.primary,
                    fontSize: '18px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ✅ Mark as Submitted
                </button>
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
