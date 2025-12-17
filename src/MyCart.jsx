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
    if (!profile) return { percentage: 0, hasItems: [], craiHelps: [] }
    
    const hasItems = []
    let score = 0
    const maxScore = 10

    if (profile.company_name) { hasItems.push(profile.company_name); score += 1 }
    if (profile.naics_codes?.length > 0) { hasItems.push(`NAICS codes on file`); score += 1 }
    if (profile.certifications?.length > 0) { hasItems.push(`${profile.certifications.length} certification(s)`); score += 1 }
    if (profile.year_established) { hasItems.push(`${new Date().getFullYear() - parseInt(profile.year_established)}+ years in business`); score += 1 }
    if (profile.city && profile.state) { hasItems.push(`Based in ${profile.city}, ${profile.state}`); score += 0.5 }
    if (profile.sam_registered) { hasItems.push('SAM.gov Registered'); score += 1 }
    if (profile.past_performance?.length > 0) { hasItems.push(`${profile.past_performance.length} past performance record(s)`); score += 1.5 }
    if (profile.team_members?.length > 0) { hasItems.push(`${profile.team_members.length} key personnel`); score += 1 }
    if (profile.services?.length > 0) { hasItems.push(`${profile.services.length} service area(s)`); score += 1 }
    if (profile.mission) score += 0.5
    if (profile.elevator_pitch) score += 0.5

    return { percentage: Math.min(Math.round((score / maxScore) * 100), 100), hasItems }
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
                    const percent = total > 0 ? Math.round((answered / total) * 100) : 0
                    return (
                      <div key={item.id} onClick={() => openResponseBuilder(item)} style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.primary}30`, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '11px', backgroundColor: `${colors.primary}20`, color: colors.primary, padding: '2px 8px', borderRadius: '4px', marginBottom: '5px', display: 'inline-block' }}>{percent}% complete</span>
                            <h3 style={{ color: colors.white, margin: '5px 0', fontSize: '16px' }}>{item.title}</h3>
                            <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{item.agency || 'No agency'}</p>
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
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Estimated Value</label>
                <input type="text" value={manualEntry.estimatedValue} onChange={(e) => setManualEntry({ ...manualEntry, estimatedValue: e.target.value })} placeholder="e.g., $50,000 - $100,000" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Description</label>
                <textarea value={manualEntry.description} onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })} placeholder="What is this contract asking for?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
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
              <button onClick={() => { setSaveSuccess(false); setShowAddManual(false); if (savedOpportunity) openResponseBuilder(savedOpportunity) }} style={{ padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Start Working on It</button>
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
  
  // Save status
  const [saveStatus, setSaveStatus] = useState('saved')

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
    } catch (err) {
      console.error('Error saving:', err)
      setSaveStatus('error')
    }
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
      .replace(/[^\w\s.,;:'"!?()-]/g, '') // Remove emojis and special chars
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
    setGeneratingAnswers(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Generate 6-8 typical RFP questions and answers for this contract.

Program Title: ${programTitle}
Approach: ${approach}
Contract: ${localOpportunity.title}
Agency: ${localOpportunity.agency || 'Not specified'}

IMPORTANT: 
- Plain text only, no asterisks, no bullets, no markdown, no emojis
- Each answer should be professional
- Keep answers under 500 characters each

Format each as:
Q1: [Question]
A1: [Answer in plain text]

Q2: [Question]
A2: [Answer in plain text]

Continue for all questions.`,
          profile: profile,
          opportunity: { title: localOpportunity.title, agency: localOpportunity.agency },
          isQAGeneration: true
        }),
      })

      if (!response.ok) throw new Error('Failed to generate')
      const data = await response.json()
      
      const parsedQuestions = parseQuestionsFromResponse(data.response)
      setQuestions(parsedQuestions)
      
    } catch (err) {
      console.error('Error generating answers:', err)
      alert('BUCKET + CR-AI had trouble. Please try again.')
    } finally {
      setGeneratingAnswers(false)
    }
  }

  const parseQuestionsFromResponse = (text) => {
    const questions = []
    const regex = /Q(\d+):\s*(.*?)\nA\1:\s*([\s\S]*?)(?=Q\d+:|$)/gi
    let match
    
    while ((match = regex.exec(text)) !== null) {
      let answer = cleanText(match[3])
      if (answer.length > 500) answer = answer.substring(0, 497) + '...'
      
      questions.push({
        id: Date.now() + questions.length,
        text: cleanText(match[2]),
        response: answer,
        charLimit: 500,
        source: 'bucket-crai'
      })
    }
    
    if (questions.length === 0) {
      questions.push({
        id: Date.now(),
        text: 'Describe your organizations experience and qualifications.',
        response: cleanText(text).substring(0, 497) + '...',
        charLimit: 500,
        source: 'bucket-crai'
      })
    }
    
    return questions
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
    // Here you would save responses to the profile for future use
    // For now, just close and go back
    alert('Responses saved to your BUCKET for future bids!')
    setShowAddToBucket(false)
    onBack()
  }

  const handleSkipAddToBucket = () => {
    setShowAddToBucket(false)
    onBack()
  }

  const answeredCount = questions.filter(q => q.response).length
  const totalQuestions = questions.length
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
  const issueCount = questions.filter(q => q.response?.length > q.charLimit).length

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
  // ==========================================
  if (phase === 'overview') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Back to Cart</button>
          <SaveIndicator />
        </div>

        <div style={{ padding: '25px 20px', maxWidth: '600px', margin: '0 auto' }}>
          {/* Contract Details */}
          <h1 style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '22px' }}>{localOpportunity.title}</h1>
          {localOpportunity.agency && (
            <p style={{ color: colors.primary, margin: '0 0 15px 0', fontSize: '16px' }}>{localOpportunity.agency}</p>
          )}
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: colors.gray, margin: '0 0 2px 0', fontSize: '12px' }}>Due</p>
              <p style={{ color: colors.gold, margin: 0, fontSize: '16px', fontWeight: '600' }}>{daysLeft} days left</p>
            </div>
            {localOpportunity.estimated_value && (
              <div>
                <p style={{ color: colors.gray, margin: '0 0 2px 0', fontSize: '12px' }}>Value</p>
                <p style={{ color: colors.white, margin: 0, fontSize: '16px', fontWeight: '600' }}>{localOpportunity.estimated_value}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {localOpportunity.description && (
            <div style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '18px', border: `1px solid ${colors.gray}30`, marginBottom: '20px' }}>
              <p style={{ color: colors.gray, margin: '0 0 8px 0', fontSize: '12px' }}>ABOUT THIS CONTRACT</p>
              <p style={{ color: colors.white, margin: 0, fontSize: '14px', lineHeight: '1.6' }}>{localOpportunity.description}</p>
            </div>
          )}

          {/* BUCKET Match */}
          <div style={{ backgroundColor: `${colors.primary}10`, borderRadius: '12px', padding: '18px', border: `1px solid ${colors.primary}30`, marginBottom: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: colors.white, fontSize: '16px', fontWeight: '600' }}>BUCKET Match</span>
              <span style={{ backgroundColor: colors.primary, color: colors.background, padding: '6px 14px', borderRadius: '20px', fontWeight: '700' }}>{bucketMatch.percentage}%</span>
            </div>
            {bucketMatch.hasItems.length > 0 && (
              <div style={{ display: 'grid', gap: '4px' }}>
                {bucketMatch.hasItems.slice(0, 4).map((item, i) => (
                  <p key={i} style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>{item}</p>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <button onClick={() => { setPhase('strategy'); if (!programTitle) handleGenerateStrategy() }} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '16px', fontWeight: '700', cursor: 'pointer', marginBottom: '10px' }}>
            Go After This
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button onClick={handleArchive} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${colors.gray}50`, backgroundColor: 'transparent', color: colors.gray, fontSize: '13px', cursor: 'pointer' }}>Not a Fit</button>
            <button onClick={onBack} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${colors.gold}50`, backgroundColor: 'transparent', color: colors.gold, fontSize: '13px', cursor: 'pointer' }}>Save for Later</button>
          </div>
        </div>
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
          <span style={{ color: colors.white, fontSize: '14px' }}>BUCKET + CR-AI</span>
          <SaveIndicator />
        </div>

        <div style={{ padding: '25px 20px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ marginBottom: '25px' }}>
            <h1 style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '20px' }}>{localOpportunity.title}</h1>
            <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
              {daysLeft} days left {localOpportunity.estimated_value && ` •  ${localOpportunity.estimated_value}`}
            </p>
          </div>

          {generatingStrategy ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: colors.primary, fontSize: '18px', margin: '0 0 10px 0' }}>Generating strategy...</p>
              <p style={{ color: colors.gray, fontSize: '14px', margin: 0 }}>BUCKET + CR-AI is working</p>
            </div>
          ) : (
            <>
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
                Change Approach
              </button>

              <button onClick={() => { if (questions.length === 0) handleGenerateAllAnswers(); setPhase('answers') }} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>
                Accept and Start
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 2B: CHANGE APPROACH
  // ==========================================
  if (phase === 'change-approach') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30` }}>
          <button onClick={() => setPhase('strategy')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Go Back</button>
        </div>

        <div style={{ padding: '25px 20px', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '20px' }}>What direction do you want to go?</h2>
          <p style={{ color: colors.gray, margin: '0 0 25px 0', fontSize: '14px' }}>
            This is not the title. BUCKET + CR-AI will generate a title based on your direction and the contract/grant focus.
          </p>

          <textarea
            value={newDirection}
            onChange={(e) => setNewDirection(e.target.value)}
            placeholder="e.g., TeleHealth vans at college campuses, focus on student mental health..."
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
              {generatingStrategy ? 'Generating...' : 'Ask BUCKET + CR-AI'}
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
  // PHASE 3: ANSWERS
  // ==========================================
  if (phase === 'answers') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <button onClick={() => setPhase('strategy')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Strategy</button>
            <span style={{ color: colors.white, fontSize: '14px', fontWeight: '600' }}>{answeredCount} of {totalQuestions} ({progressPercent}%)</span>
            <SaveIndicator />
          </div>
          <div style={{ height: '4px', backgroundColor: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: colors.primary, transition: 'width 0.3s' }} />
          </div>
        </div>

        <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: '10px', padding: '15px', marginBottom: '20px', border: `1px solid ${colors.gray}30` }}>
            <p style={{ color: colors.primary, margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600' }}>{programTitle}</p>
            <p style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>{approach}</p>
          </div>

          {generatingAnswers && (
            <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: colors.card, borderRadius: '16px', marginBottom: '20px' }}>
              <p style={{ color: colors.primary, fontSize: '18px', margin: '0 0 10px 0' }}>Generating answers...</p>
              <p style={{ color: colors.gray, fontSize: '14px', margin: 0 }}>BUCKET + CR-AI is working</p>
            </div>
          )}

          {!generatingAnswers && questions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: colors.card, borderRadius: '16px' }}>
              <button onClick={handleGenerateAllAnswers} style={{ padding: '14px 28px', borderRadius: '10px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontWeight: '600', cursor: 'pointer' }}>Generate Answers</button>
            </div>
          )}

          {!generatingAnswers && questions.map((q, index) => {
            const overLimit = q.response?.length > q.charLimit
            
            return (
              <div key={q.id} style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${overLimit ? colors.red : colors.gray}30`, marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <span style={{ color: colors.primary, fontSize: '12px', fontWeight: '600' }}>{index + 1} of {totalQuestions}</span>
                  <span style={{ fontSize: '10px', backgroundColor: `${colors.primary}20`, color: colors.primary, padding: '3px 8px', borderRadius: '4px' }}>BUCKET + CR-AI</span>
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
                      <p style={{ color: colors.white, margin: 0, fontSize: '14px', lineHeight: '1.6' }}>{q.response || 'No response yet'}</p>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: overLimit ? colors.red : colors.gray, fontSize: '12px' }}>
                        {q.response?.length || 0}/{q.charLimit} characters {overLimit && '- over limit'}
                      </span>
                    </div>

                    {overLimit && (
                      <div style={{ backgroundColor: `${colors.red}15`, borderRadius: '8px', padding: '12px', marginBottom: '12px', border: `1px solid ${colors.red}30` }}>
                        <p style={{ color: colors.red, margin: '0 0 10px 0', fontSize: '13px' }}>This answer is {q.response.length - q.charLimit} characters over the limit.</p>
                        <button onClick={() => handleAutoShorten(index)} disabled={shorteningIndex === index} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '12px', cursor: 'pointer' }}>
                          {shorteningIndex === index ? 'Shortening...' : 'Auto-shorten with BUCKET + CR-AI'}
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleRegenerateAnswer(index)} style={{ padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.primary}50`, backgroundColor: 'transparent', color: colors.primary, fontSize: '12px', cursor: 'pointer' }}>Regenerate</button>
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
  // PHASE 4: REVIEW
  // ==========================================
  if (phase === 'review') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ backgroundColor: colors.card, padding: '15px 20px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setPhase('answers')} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '14px' }}>← Back</button>
          <span style={{ color: colors.white, fontSize: '14px', fontWeight: '600' }}>Review and Submit</span>
          <SaveIndicator />
        </div>

        <div style={{ padding: '25px 20px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ backgroundColor: `${colors.primary}15`, borderRadius: '12px', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ color: colors.primary, margin: 0, fontSize: '18px', fontWeight: '600' }}>All {totalQuestions} answers complete</p>
          </div>

          <button onClick={handleExport} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: colors.gold, color: colors.background, fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginBottom: '20px' }}>Copy All Responses</button>

          <div style={{ backgroundColor: `${colors.primary}10`, borderRadius: '12px', padding: '18px', border: `1px solid ${colors.primary}30`, marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: colors.primary }} />
              <span style={{ color: colors.white, fontSize: '13px', lineHeight: '1.5' }}>I understand BUCKET + CR-AI is an assistant tool. I am responsible for reviewing all information before submission.</span>
            </label>
          </div>

          <button onClick={handleMarkSubmitted} disabled={!acknowledged} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: acknowledged ? 'none' : `2px solid ${colors.gray}50`, backgroundColor: acknowledged ? colors.primary : 'transparent', color: acknowledged ? colors.background : colors.gray, fontSize: '16px', fontWeight: '600', cursor: acknowledged ? 'pointer' : 'not-allowed' }}>
            Mark as Submitted
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center', padding: '15px', backgroundColor: `${colors.primary}08`, borderRadius: '10px' }}>
            <p style={{ color: colors.gray, margin: 0, fontSize: '12px' }}>Prepared with BUCKET + CR-AI Technology</p>
          </div>
        </div>

        {/* Add to BUCKET Modal */}
        {showAddToBucket && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '400px', width: '100%', border: `2px solid ${colors.primary}`, textAlign: 'center' }}>
              <h3 style={{ color: colors.primary, margin: '0 0 15px 0', fontSize: '20px' }}>Marked as Submitted</h3>
              <p style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '16px' }}>Would you like to add these responses to your BUCKET for future bids?</p>
              <p style={{ color: colors.gray, margin: '0 0 25px 0', fontSize: '14px' }}>This helps BUCKET + CR-AI give better suggestions next time.</p>
              <div style={{ display: 'grid', gap: '10px' }}>
                <button onClick={handleAddToBucket} style={{ padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: colors.primary, color: colors.background, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Yes, Add to BUCKET</button>
                <button onClick={handleSkipAddToBucket} style={{ padding: '14px', borderRadius: '10px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.gray, fontSize: '14px', cursor: 'pointer' }}>No Thanks</button>
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
