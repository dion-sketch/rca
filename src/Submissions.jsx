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

function Submissions({ session, onBack, profileData }) {
  const [activeTab, setActiveTab] = useState('find') // 'find', 'active', 'completed'
  const [showAddManual, setShowAddManual] = useState(false)
  const [showResponseBuilder, setShowResponseBuilder] = useState(false)
  const [selectedOpportunity, setSelectedOpportunity] = useState(null)
  const [opportunities, setOpportunities] = useState([])
  const [activeSubmissions, setActiveSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

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
        setActiveSubmissions(data.filter(s => s.status !== 'completed'))
      }
    } catch (err) {
      console.error('Error fetching submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddManual = async () => {
    if (!manualEntry.title || !manualEntry.dueDate) {
      alert('Please enter at least a title and due date')
      return
    }

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

      setActiveSubmissions([data, ...activeSubmissions])
      setShowAddManual(false)
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Back</button>
          <h1 style={{ color: colors.white, margin: 0, fontSize: '24px' }}>📋 Submissions</h1>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: colors.card, padding: '0 30px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', gap: '30px' }}>
        {[
          { id: 'find', label: '🔍 Find Opportunities' },
          { id: 'active', label: `📝 Active (${activeSubmissions.length})` },
          { id: 'completed', label: '✅ Completed' }
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
        
        {/* FIND OPPORTUNITIES TAB */}
        {activeTab === 'find' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <h2 style={{ color: colors.white, margin: '0 0 10px 0' }}>How do you want to find contracts?</h2>
            
            {/* 3 Options */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              
              {/* Option 1: Auto-Delivered */}
              <div style={{
                backgroundColor: colors.card,
                borderRadius: '16px',
                padding: '25px',
                border: `1px solid ${colors.primary}30`,
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '15px',
                  backgroundColor: colors.gold,
                  color: colors.background,
                  padding: '4px 10px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  COMING SOON
                </div>
                <div style={{ fontSize: '40px', marginBottom: '15px' }}>📬</div>
                <h3 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '18px' }}>Auto-Delivered</h3>
                <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '14px', lineHeight: '1.5' }}>
                  Every 1st Monday, RCA searches for contracts matching your profile. They appear here automatically.
                </p>
                <button
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: colors.gray,
                    color: colors.background,
                    fontSize: '14px',
                    cursor: 'not-allowed',
                    opacity: 0.5
                  }}
                >
                  Coming Soon
                </button>
              </div>

              {/* Option 2: Go Shopping */}
              <div style={{
                backgroundColor: colors.card,
                borderRadius: '16px',
                padding: '25px',
                border: `1px solid ${colors.primary}30`,
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '15px',
                  backgroundColor: colors.gold,
                  color: colors.background,
                  padding: '4px 10px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  COMING SOON
                </div>
                <div style={{ fontSize: '40px', marginBottom: '15px' }}>🛒</div>
                <h3 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '18px' }}>Go Shopping</h3>
                <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '14px', lineHeight: '1.5' }}>
                  Click to search now. RCA knows where to look based on your NAICS codes and certifications.
                </p>
                <button
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: colors.gray,
                    color: colors.background,
                    fontSize: '14px',
                    cursor: 'not-allowed',
                    opacity: 0.5
                  }}
                >
                  Coming Soon
                </button>
              </div>

              {/* Option 3: Add Manually */}
              <div style={{
                backgroundColor: colors.card,
                borderRadius: '16px',
                padding: '25px',
                border: `2px solid ${colors.primary}`,
                boxShadow: `0 0 20px ${colors.primary}30`
              }}>
                <div style={{ fontSize: '40px', marginBottom: '15px' }}>✍️</div>
                <h3 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '18px' }}>Add Manually</h3>
                <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '14px', lineHeight: '1.5' }}>
                  Found an RFP yourself? Enter the details and start building your response.
                </p>
                <button
                  onClick={() => setShowAddManual(true)}
                  style={{
                    width: '100%',
                    padding: '12px',
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
            </div>

            {/* Info Box */}
            <div style={{
              backgroundColor: `${colors.primary}10`,
              borderRadius: '12px',
              padding: '15px 20px',
              border: `1px solid ${colors.primary}30`,
              marginTop: '10px'
            }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                💡 <strong style={{ color: colors.white }}>Tip:</strong> Start by adding an opportunity manually. Once you add the questions, RCA will help you generate responses using your Business Builder profile.
              </p>
            </div>
          </div>
        )}

        {/* ACTIVE SUBMISSIONS TAB */}
        {activeTab === 'active' && (
          <div style={{ display: 'grid', gap: '15px' }}>
            {activeSubmissions.length === 0 ? (
              <div style={{
                backgroundColor: colors.card,
                borderRadius: '16px',
                padding: '40px',
                textAlign: 'center',
                border: `1px solid ${colors.gray}30`
              }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>📭</div>
                <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>No active submissions</h3>
                <p style={{ color: colors.gray, margin: '0 0 20px 0' }}>
                  Find an opportunity and start building your response!
                </p>
                <button
                  onClick={() => setActiveTab('find')}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: colors.primary,
                    color: colors.background,
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Find Opportunities
                </button>
              </div>
            ) : (
              activeSubmissions.map((sub) => {
                const daysLeft = getDaysUntilDue(sub.due_date)
                const isUrgent = daysLeft <= 7
                const isPastDue = daysLeft < 0

                return (
                  <div
                    key={sub.id}
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: '12px',
                      padding: '20px',
                      border: `1px solid ${isPastDue ? '#ff4444' : isUrgent ? colors.gold : colors.gray}30`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
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
                        {sub.agency && (
                          <span style={{ color: colors.gray }}>🏢 {sub.agency}</span>
                        )}
                        <span style={{ color: isPastDue ? '#ff4444' : isUrgent ? colors.gold : colors.gray }}>
                          📅 {isPastDue ? 'Past Due' : `${daysLeft} days left`}
                        </span>
                        <span style={{ color: colors.gray }}>
                          📝 {sub.responses?.length || 0} / {sub.questions?.length || 0} questions
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => startResponse(sub)}
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
                      {sub.responses?.length > 0 ? 'Continue' : 'Start Response'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* COMPLETED TAB */}
        {activeTab === 'completed' && (
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            border: `1px solid ${colors.gray}30`
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎯</div>
            <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>No completed submissions yet</h3>
            <p style={{ color: colors.gray, margin: 0 }}>
              Your submitted proposals will appear here.
            </p>
          </div>
        )}
      </div>

      {/* Add Manual Modal */}
      {showAddManual && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '500px',
            width: '100%',
            border: `2px solid ${colors.primary}`,
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ color: colors.white, margin: '0 0 20px 0' }}>✍️ Add Opportunity</h3>

            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                  Opportunity Title *
                </label>
                <input
                  type="text"
                  value={manualEntry.title}
                  onChange={(e) => setManualEntry({ ...manualEntry, title: e.target.value })}
                  placeholder="e.g., Mental Health Services RFP"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                    RFP/Bid Number
                  </label>
                  <input
                    type="text"
                    value={manualEntry.rfpNumber}
                    onChange={(e) => setManualEntry({ ...manualEntry, rfpNumber: e.target.value })}
                    placeholder="e.g., RFP-2024-001"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={manualEntry.dueDate}
                    onChange={(e) => setManualEntry({ ...manualEntry, dueDate: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                  Agency / Organization
                </label>
                <input
                  type="text"
                  value={manualEntry.agency}
                  onChange={(e) => setManualEntry({ ...manualEntry, agency: e.target.value })}
                  placeholder="e.g., LA County Department of Mental Health"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                    Source
                  </label>
                  <select
                    value={manualEntry.source}
                    onChange={(e) => setManualEntry({ ...manualEntry, source: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
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
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                    Estimated Value
                  </label>
                  <input
                    type="text"
                    value={manualEntry.estimatedValue}
                    onChange={(e) => setManualEntry({ ...manualEntry, estimatedValue: e.target.value })}
                    placeholder="e.g., $500,000"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                  Description / Notes
                </label>
                <textarea
                  value={manualEntry.description}
                  onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
                  placeholder="Any notes about this opportunity..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '25px' }}>
              <button
                onClick={() => setShowAddManual(false)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.gray}`,
                  backgroundColor: 'transparent',
                  color: colors.white,
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddManual}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Add & Start Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Response Builder Component
function ResponseBuilder({ opportunity, session, profileData, onBack }) {
  const [phase, setPhase] = useState('overview') // 'overview', 'questions'
  const [questions, setQuestions] = useState(opportunity.questions || [])
  const [responses, setResponses] = useState(opportunity.responses || [])
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [generating, setGenerating] = useState({})
  const [saving, setSaving] = useState(false)
  const [scopeItems, setScopeItems] = useState(opportunity.scope_items || [])
  const [newScopeItem, setNewScopeItem] = useState('')

  // Calculate CR Match Grade based on profile completeness
  const getCRMatchGrade = () => {
    // This would be smarter in production - comparing NAICS, services, past work to opportunity
    const score = opportunity.cr_match_score || 75 // Default to B range
    
    if (score >= 90) return { grade: 'A', color: colors.primary, message: "Your bucket is ready for this!" }
    if (score >= 75) return { grade: 'B', color: colors.primary, message: "Strong match — you got this!" }
    if (score >= 60) return { grade: 'C', color: colors.gold, message: "Ready to bid — add a few things to strengthen" }
    return { grade: 'D', color: colors.gold, message: "You can do this — CR-AI will help fill the gaps" }
  }

  const matchGrade = getCRMatchGrade()

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

  const addScopeItem = () => {
    if (!newScopeItem.trim()) return
    const updated = [...scopeItems, newScopeItem]
    setScopeItems(updated)
    setNewScopeItem('')
    saveScopeItems(updated)
  }

  const removeScopeItem = (index) => {
    const updated = scopeItems.filter((_, i) => i !== index)
    setScopeItems(updated)
    saveScopeItems(updated)
  }

  const saveScopeItems = async (items) => {
    try {
      await supabase
        .from('submissions')
        .update({ scope_items: items })
        .eq('id', opportunity.id)
    } catch (err) {
      console.error('Error saving scope:', err)
    }
  }

  const addQuestion = () => {
    if (!newQuestion.trim()) return
    const updated = [...questions, { id: Date.now(), text: newQuestion, response: '' }]
    setQuestions(updated)
    setNewQuestion('')
    setShowAddQuestion(false)
    saveQuestions(updated)
  }

  const removeQuestion = (id) => {
    const updated = questions.filter(q => q.id !== id)
    setQuestions(updated)
    saveQuestions(updated)
  }

  const updateResponse = (id, response) => {
    const updated = questions.map(q => q.id === id ? { ...q, response } : q)
    setQuestions(updated)
  }

  const saveQuestions = async (qs) => {
    setSaving(true)
    try {
      await supabase
        .from('submissions')
        .update({ 
          questions: qs,
          responses: qs.filter(q => q.response).map(q => ({ questionId: q.id, response: q.response }))
        })
        .eq('id', opportunity.id)
    } catch (err) {
      console.error('Error saving:', err)
    } finally {
      setSaving(false)
    }
  }

  const generateResponse = async (questionId) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) return

    setGenerating({ ...generating, [questionId]: true })

    try {
      // For now, generate a placeholder response
      // In production, this would call Claude API with the user's profile data
      const mockResponse = `Based on your profile, here's a suggested response for: "${question.text}"\n\n[This is where RCA will generate a tailored response using your Business Builder profile. The response will pull from your mission, services, past work, and team information to create a compelling answer.]`
      
      const updated = questions.map(q => 
        q.id === questionId ? { ...q, response: mockResponse } : q
      )
      setQuestions(updated)
      saveQuestions(updated)
    } catch (err) {
      console.error('Error generating:', err)
    } finally {
      setGenerating({ ...generating, [questionId]: false })
    }
  }

  const answeredCount = questions.filter(q => q.response).length

  // OVERVIEW PHASE
  if (phase === 'overview') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Back</button>
              <h1 style={{ color: colors.white, margin: 0, fontSize: '20px' }}>📋 Opportunity Overview</h1>
            </div>
          </div>
        </div>

        <div style={{ padding: '30px', maxWidth: '900px', margin: '0 auto' }}>
          {/* Opportunity Details Card */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.gray}30`,
            marginBottom: '25px'
          }}>
            <h2 style={{ color: colors.white, margin: '0 0 20px 0', fontSize: '22px' }}>{opportunity.title}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <p style={{ color: colors.gray, margin: '0 0 5px 0', fontSize: '12px' }}>AGENCY</p>
                <p style={{ color: colors.white, margin: 0, fontSize: '16px' }}>{opportunity.agency || 'Not specified'}</p>
              </div>
              <div>
                <p style={{ color: colors.gray, margin: '0 0 5px 0', fontSize: '12px' }}>DUE DATE</p>
                <p style={{ color: colors.gold, margin: 0, fontSize: '16px', fontWeight: '600' }}>
                  {opportunity.due_date ? new Date(opportunity.due_date).toLocaleDateString() : 'Not set'}
                </p>
              </div>
              <div>
                <p style={{ color: colors.gray, margin: '0 0 5px 0', fontSize: '12px' }}>ESTIMATED VALUE</p>
                <p style={{ color: colors.white, margin: 0, fontSize: '16px' }}>{opportunity.estimated_value || 'Not specified'}</p>
              </div>
              <div>
                <p style={{ color: colors.gray, margin: '0 0 5px 0', fontSize: '12px' }}>RFP NUMBER</p>
                <p style={{ color: colors.white, margin: 0, fontSize: '16px' }}>{opportunity.rfp_number || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* CR Match Grade */}
          <div style={{
            backgroundColor: `${matchGrade.color}15`,
            borderRadius: '16px',
            padding: '25px',
            border: `2px solid ${matchGrade.color}50`,
            marginBottom: '25px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: `${matchGrade.color}20`,
              border: `3px solid ${matchGrade.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span style={{ color: matchGrade.color, fontSize: '36px', fontWeight: '700' }}>{matchGrade.grade}</span>
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ color: matchGrade.color, margin: '0 0 8px 0', fontSize: '20px' }}>
                CR Match: {matchGrade.grade}
              </h3>
              <p style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '16px' }}>
                {matchGrade.message}
              </p>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
                🚀 <strong style={{ color: colors.primary }}>Your Bucket + CR-AI = We Got This!</strong> 
                <br/>Missing a skill? You're the contract manager — hire the team. CR-AI helps find local workers and build budgets.
              </p>
            </div>
          </div>

          {/* Key Scope Items */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.gray}30`,
            marginBottom: '25px'
          }}>
            <h3 style={{ color: colors.white, margin: '0 0 15px 0', fontSize: '18px' }}>
              📌 Key Scope Items
            </h3>
            <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '14px' }}>
              Add the main deliverables or requirements from the RFP. This helps RCA understand what you need to address.
            </p>

            {scopeItems.length > 0 && (
              <div style={{ display: 'grid', gap: '10px', marginBottom: '15px' }}>
                {scopeItems.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#1a1a1a',
                      borderRadius: '8px',
                      padding: '12px 15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: colors.primary, fontWeight: '600' }}>{index + 1}.</span>
                      <span style={{ color: colors.white }}>{item}</span>
                    </div>
                    <button
                      onClick={() => removeScopeItem(index)}
                      style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={newScopeItem}
                onChange={(e) => setNewScopeItem(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addScopeItem()}
                placeholder="e.g., Provide mental health services to 500 students"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={addScopeItem}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Encouragement Box */}
          <div style={{
            backgroundColor: `${colors.gold}10`,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${colors.gold}30`,
            marginBottom: '25px'
          }}>
            <h4 style={{ color: colors.gold, margin: '0 0 10px 0' }}>🚀 Your Bucket + CR-AI = We Got This!</h4>
            <ul style={{ color: colors.gray, margin: 0, paddingLeft: '20px', lineHeight: '1.8', fontSize: '14px' }}>
              <li>CR-AI writes responses using your profile</li>
              <li>Missing team members? We help find local workers</li>
              <li>Need a budget? CR-AI builds it with you</li>
              <li>Every answer saves to your bucket for next time</li>
            </ul>
          </div>

          {/* Continue Button */}
          <button
            onClick={() => setPhase('questions')}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: colors.primary,
              color: colors.background,
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Continue to Questions →
          </button>
        </div>
      </div>
    )
  }

  // QUESTIONS PHASE
  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={() => setPhase('overview')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Overview</button>
            <div>
              <h1 style={{ color: colors.white, margin: 0, fontSize: '20px' }}>{opportunity.title}</h1>
              <p style={{ color: colors.gray, margin: '5px 0 0 0', fontSize: '13px' }}>
                {opportunity.agency} • Due: {new Date(opportunity.due_date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{
              backgroundColor: `${matchGrade.color}20`,
              padding: '6px 12px',
              borderRadius: '20px',
              border: `1px solid ${matchGrade.color}`
            }}>
              <span style={{ color: matchGrade.color, fontWeight: '600', fontSize: '14px' }}>
                CR Match: {matchGrade.grade}
              </span>
            </div>
            <span style={{ color: colors.gray, fontSize: '14px' }}>
              {answeredCount}/{questions.length} answered
            </span>
            <div style={{
              backgroundColor: `${colors.primary}20`,
              padding: '8px 16px',
              borderRadius: '20px',
              border: `1px solid ${colors.primary}`
            }}>
              <span style={{ color: colors.primary, fontWeight: '600' }}>
                {questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}% Complete
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '30px', maxWidth: '900px', margin: '0 auto' }}>
        {/* Instructions */}
        {questions.length === 0 && (
          <div style={{
            backgroundColor: `${colors.gold}10`,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${colors.gold}30`,
            marginBottom: '25px'
          }}>
            <h3 style={{ color: colors.gold, margin: '0 0 10px 0', fontSize: '16px' }}>🎯 How to use Response Builder</h3>
            <ol style={{ color: colors.gray, margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>Add the questions from the RFP (copy/paste or type them)</li>
              <li>Click "Generate with RCA" to get a response using your profile</li>
              <li>Edit and refine each response</li>
              <li>Export when ready to submit</li>
            </ol>
          </div>
        )}

        {/* Scope Summary */}
        {scopeItems.length > 0 && (
          <div style={{
            backgroundColor: `${colors.primary}10`,
            borderRadius: '12px',
            padding: '15px 20px',
            border: `1px solid ${colors.primary}30`,
            marginBottom: '25px'
          }}>
            <p style={{ color: colors.gray, margin: '0 0 8px 0', fontSize: '12px' }}>KEY SCOPE ITEMS</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {scopeItems.map((item, i) => (
                <span key={i} style={{
                  backgroundColor: `${colors.primary}20`,
                  color: colors.primary,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  {i + 1}. {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Questions List */}
        <div style={{ display: 'grid', gap: '20px' }}>
          {questions.map((q, index) => (
            <div
              key={q.id}
              style={{
                backgroundColor: colors.card,
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${q.response ? colors.primary : colors.gray}30`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                  <span style={{ 
                    color: q.response ? colors.primary : colors.gold, 
                    fontWeight: '600',
                    fontSize: '14px',
                    minWidth: '30px'
                  }}>
                    Q{index + 1}
                  </span>
                  <p style={{ color: colors.white, margin: 0, fontSize: '15px', lineHeight: '1.5' }}>
                    {q.text}
                  </p>
                </div>
                <button
                  onClick={() => removeQuestion(q.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff4444',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '5px'
                  }}
                >
                  🗑️
                </button>
              </div>

              <textarea
                value={q.response || ''}
                onChange={(e) => updateResponse(q.id, e.target.value)}
                onBlur={() => saveQuestions(questions)}
                placeholder="Enter your response or click 'Generate with RCA'..."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: '10px' }}
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => generateResponse(q.id)}
                  disabled={generating[q.id]}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: colors.primary,
                    color: colors.background,
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: generating[q.id] ? 'not-allowed' : 'pointer',
                    opacity: generating[q.id] ? 0.7 : 1
                  }}
                >
                  {generating[q.id] ? '⏳ Generating...' : '✨ Generate with RCA'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Question */}
        {showAddQuestion ? (
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '12px',
            padding: '20px',
            border: `2px solid ${colors.primary}`,
            marginTop: '20px'
          }}>
            <h4 style={{ color: colors.white, margin: '0 0 15px 0' }}>Add Question</h4>
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Paste or type the question from the RFP..."
              rows={3}
              style={{ ...inputStyle, marginBottom: '15px' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddQuestion(false)
                  setNewQuestion('')
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.gray}`,
                  backgroundColor: 'transparent',
                  color: colors.white,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={addQuestion}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Add Question
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddQuestion(true)}
            style={{
              width: '100%',
              padding: '20px',
              borderRadius: '12px',
              border: `2px dashed ${colors.gray}50`,
              backgroundColor: 'transparent',
              color: colors.gray,
              fontSize: '16px',
              cursor: 'pointer',
              marginTop: '20px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.primary
              e.currentTarget.style.color = colors.primary
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${colors.gray}50`
              e.currentTarget.style.color = colors.gray
            }}
          >
            + Add Question from RFP
          </button>
        )}

        {/* Encouragement reminder */}
        <div style={{
          backgroundColor: `${colors.primary}10`,
          borderRadius: '12px',
          padding: '15px 20px',
          marginTop: '25px',
          border: `1px solid ${colors.primary}30`
        }}>
          <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
            🚀 <strong style={{ color: colors.primary }}>Your Bucket + CR-AI = We Got This!</strong> 
            Every answer gets saved to your bucket for future bids.
          </p>
        </div>

        {/* Export Button */}
        {questions.length > 0 && answeredCount > 0 && (
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '12px',
            padding: '20px',
            marginTop: '30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: `1px solid ${colors.primary}30`
          }}>
            <div>
              <h4 style={{ color: colors.white, margin: '0 0 5px 0' }}>Ready to submit?</h4>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                Export your responses to copy into your proposal.
              </p>
            </div>
            <button
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: colors.gold,
                color: colors.background,
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              📄 Export Responses
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Submissions
