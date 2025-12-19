// ============================================
// ResponseRoom.jsx - Phase 1: Overview
// Approved design from preview
// ============================================

import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function ResponseRoom({ session, profileData, onBack, autoSelectLatest = false }) {
  const [submissions, setSubmissions] = useState([])
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPhase, setCurrentPhase] = useState(1) // 1=Overview, 2=Strategy (future)
  
  // Phase 2 Strategy state
  const [userAngle, setUserAngle] = useState('')
  const [generatingStrategy, setGeneratingStrategy] = useState(false)
  const [generatedStrategy, setGeneratedStrategy] = useState(null)

  // Phase 3 Answers state
  const [sections, setSections] = useState([])
  const [generatingAnswers, setGeneratingAnswers] = useState(false)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)

  // RFP Content state - THE DNA
  const [rfpContent, setRfpContent] = useState(null)
  const [loadingRfp, setLoadingRfp] = useState(false)
  const [rfpError, setRfpError] = useState(null)

  // Colors
  const colors = {
    primary: '#00FF00',
    gold: '#FFD700',
    background: '#000000',
    card: '#111111',
    text: '#FFFFFF',
    muted: '#888888',
    border: '#333333',
    danger: '#FF6B6B'
  }

  // Load submissions on mount
  useEffect(() => {
    if (session?.user?.id) {
      loadSubmissions()
    }
  }, [session])

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', session.user.id)
        .neq('status', 'submitted')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSubmissions(data || [])
      
      // Auto-select the most recent submission when coming from Go Shopping
      if (data && data.length > 0 && !selectedSubmission) {
        setSelectedSubmission(data[0])
      }
    } catch (err) {
      console.error('Error loading submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate days left
  const getDaysLeft = (dateStr) => {
    if (!dateStr) return null
    const days = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
    return days
  }

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date'
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  // Format short date for list
  const formatShortDate = (dateStr) => {
    if (!dateStr) return 'No date'
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })
  }

  // Calculate potential score with RCA help (consistent based on submission ID)
  const getPotentialScore = (submission) => {
    const currentScore = submission?.cr_match_score || 50
    // Use submission ID to generate consistent boost (not random each render)
    const idSum = (submission?.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const boost = 15 + (idSum % 8) // Consistent boost between 15-22
    return Math.min(currentScore + boost, 95)
  }

  // Get score from submission (use cr_match_score column)
  const getScore = (sub) => {
    return sub.cr_match_score || 50
  }

  // Generate strategy with RCA
  const generateStrategy = async (quickPick = null) => {
    setGeneratingStrategy(true)
    try {
      const response = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity: selectedSubmission,
          profile: profileData,
          userAngle: quickPick || userAngle,
          rfpContent: rfpContent // Pass the loaded RFP content
        })
      })
      
      if (!response.ok) throw new Error('Failed to generate')
      
      const data = await response.json()
      setGeneratedStrategy(data.strategy)
    } catch (err) {
      console.error('Strategy generation error:', err)
      // Fallback strategy if API fails
      setGeneratedStrategy({
        suggestedTitle: `${profileData?.company_name || 'Our'} Partnership Proposal`,
        angle: 'Position as experienced local provider with proven track record',
        fromBucket: [
          profileData?.company_name || 'Your company',
          profileData?.city ? `${profileData.city} based` : 'Local presence',
          'Relevant experience'
        ],
        keyPoints: [
          'Emphasize relevant past performance',
          'Highlight certifications and qualifications',
          'Show understanding of agency needs',
          'Demonstrate capacity to deliver'
        ]
      })
    } finally {
      setGeneratingStrategy(false)
    }
  }

  // ==========================================
  // RFP CONTENT FUNCTIONS - THE DNA
  // ==========================================
  
  // Handle PDF upload
  const handlePdfUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setRfpError('Please upload a PDF file')
      return
    }

    setLoadingRfp(true)
    setRfpError(null)

    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Send to API
      const response = await fetch('/api/read-rfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_base64: base64 })
      })

      if (!response.ok) throw new Error('Failed to read PDF')

      const data = await response.json()
      setRfpContent({
        source: 'upload',
        fileName: file.name,
        ...data
      })
    } catch (err) {
      console.error('PDF upload error:', err)
      setRfpError('Failed to read PDF. Please try again.')
    } finally {
      setLoadingRfp(false)
    }
  }

  // Fetch RFP from source URL
  const fetchRfpFromUrl = async (sourceUrl) => {
    if (!sourceUrl) {
      setRfpError('No source URL available')
      return
    }

    setLoadingRfp(true)
    setRfpError(null)

    try {
      const response = await fetch('/api/fetch-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: sourceUrl })
      })

      if (!response.ok) throw new Error('Failed to fetch listing')

      const data = await response.json()
      setRfpContent({
        source: 'url',
        sourceUrl,
        ...data
      })
    } catch (err) {
      console.error('Fetch listing error:', err)
      setRfpError('Could not fetch listing. Try uploading the PDF directly.')
    } finally {
      setLoadingRfp(false)
    }
  }

  // ==========================================
  // PHASE 3: ANSWERS FUNCTIONS
  // ==========================================

  // Default sections for grant/contract responses
  const defaultSections = [
    { 
      id: 'narrative', 
      title: 'Project Narrative / Approach', 
      prompt: 'Describe your approach to delivering this project or service.',
      charLimit: 2000,
      answer: '',
      status: 'pending' // pending, generating, complete
    },
    { 
      id: 'qualifications', 
      title: 'Qualifications & Experience', 
      prompt: 'Describe your relevant qualifications and past experience.',
      charLimit: 1500,
      answer: '',
      status: 'pending'
    },
    { 
      id: 'team', 
      title: 'Team & Capacity', 
      prompt: 'Describe your team and organizational capacity to perform this work.',
      charLimit: 1000,
      answer: '',
      status: 'pending'
    },
    { 
      id: 'timeline', 
      title: 'Timeline & Deliverables', 
      prompt: 'Provide a timeline and key deliverables for the project.',
      charLimit: 800,
      answer: '',
      status: 'pending'
    }
  ]

  // Initialize sections from RFP questions or use defaults
  const initializeSections = () => {
    if (rfpContent?.questions && rfpContent.questions.length > 0) {
      // Use extracted RFP questions
      const rfpSections = rfpContent.questions.map((q, i) => ({
        id: `q${i}`,
        title: `Question ${i + 1}`,
        prompt: q,
        charLimit: 1500,
        answer: '',
        status: 'pending'
      }))
      setSections(rfpSections)
    } else {
      // Use default sections
      setSections(defaultSections)
    }
    setCurrentSectionIndex(0)
  }

  // Generate answer for a section
  const generateAnswer = async (sectionIndex) => {
    const section = sections[sectionIndex]
    
    // Update status to generating
    setSections(prev => prev.map((s, i) => 
      i === sectionIndex ? { ...s, status: 'generating' } : s
    ))

    try {
      const response = await fetch('/api/generate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: section,
          opportunity: selectedSubmission,
          profile: profileData,
          strategy: generatedStrategy,
          rfpContent: rfpContent,
          charLimit: section.charLimit
        })
      })

      if (!response.ok) throw new Error('Failed to generate')

      const data = await response.json()
      
      setSections(prev => prev.map((s, i) => 
        i === sectionIndex ? { ...s, answer: data.answer, status: 'complete' } : s
      ))
    } catch (err) {
      console.error('Answer generation error:', err)
      // Set fallback
      setSections(prev => prev.map((s, i) => 
        i === sectionIndex ? { 
          ...s, 
          answer: 'Unable to generate. Please write your response manually.',
          status: 'complete' 
        } : s
      ))
    }
  }

  // Update answer manually
  const updateAnswer = (sectionIndex, newAnswer) => {
    setSections(prev => prev.map((s, i) => 
      i === sectionIndex ? { ...s, answer: newAnswer, status: 'complete' } : s
    ))
  }

  // ==========================================
  // LOADING STATE
  // ==========================================
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ color: colors.primary, fontSize: '18px' }}>Loading...</p>
      </div>
    )
  }

  // ==========================================
  // EMPTY STATE - No submissions yet
  // ==========================================
  if (submissions.length === 0) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.background, 
        padding: '40px 30px',
        paddingBottom: '100px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <p 
            onClick={onBack}
            style={{ 
              color: colors.muted, 
              fontSize: '16px', 
              marginBottom: '20px',
              cursor: 'pointer'
            }}
          >
            ← Back
          </p>

          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '60px', marginBottom: '15px' }}>📝</div>
            <h1 style={{ color: colors.text, margin: '0 0 10px 0' }}>Response Room</h1>
            <p style={{ color: colors.muted, margin: 0 }}>Where BUCKET + RCA write winning responses together</p>
          </div>

          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '40px',
            border: `2px dashed ${colors.gold}`,
            textAlign: 'center'
          }}>
            <p style={{ color: colors.text, fontSize: '18px', margin: '0 0 15px 0' }}>
              No active responses yet
            </p>
            <p style={{ color: colors.muted, margin: '0 0 25px 0' }}>
              Go Shopping to find opportunities, then click "Start Response"
            </p>
            <button
              onClick={onBack}
              style={{
                padding: '14px 28px',
                backgroundColor: colors.gold,
                border: 'none',
                borderRadius: '12px',
                color: colors.background,
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              🛍️ Go Shopping
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 2 - Strategy Screen
  // ==========================================
  if (selectedSubmission && currentPhase === 2) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.background, 
        padding: '40px 30px',
        paddingBottom: '100px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Back Button */}
          <p 
            onClick={() => {
              setCurrentPhase(1)
              setGeneratedStrategy(null)
              setUserAngle('')
            }}
            style={{ 
              color: colors.muted, 
              fontSize: '16px', 
              marginBottom: '20px',
              cursor: 'pointer'
            }}
          >
            ← Back to Overview
          </p>

          {/* Phase Progress Bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '30px' }}>
            {['Overview', 'Strategy', 'Answers', 'Review', 'Submit'].map((phase, i) => (
              <div key={phase} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: '4px',
                  backgroundColor: i === 0 ? colors.primary : i === 1 ? colors.gold : colors.border,
                  borderRadius: '2px',
                  marginBottom: '8px'
                }} />
                <span style={{ 
                  color: i === 0 ? colors.primary : i === 1 ? colors.gold : colors.muted, 
                  fontSize: '11px',
                  fontWeight: i === 1 ? '600' : '400'
                }}>
                  {i + 1}. {phase}
                </span>
              </div>
            ))}
          </div>

          {/* Title */}
          <h1 style={{ color: colors.text, fontSize: '20px', marginBottom: '30px' }}>
            {selectedSubmission.title}
          </h1>

          {/* Show generated strategy OR input form */}
          {generatedStrategy ? (
            // GENERATED STRATEGY DISPLAY - GAME PLAN FORMAT
            <div style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.primary}40`,
              borderRadius: '16px',
              padding: '25px',
              marginBottom: '25px'
            }}>
              {/* Header */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                marginBottom: '20px',
                paddingBottom: '15px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                <span style={{ fontSize: '24px' }}>🎯</span>
                <span style={{ color: colors.primary, fontSize: '13px', fontWeight: '600' }}>
                  YOUR GAME PLAN
                </span>
              </div>
              
              {/* Suggested Title - BIG at top */}
              <div style={{ 
                backgroundColor: `${colors.primary}15`, 
                padding: '20px', 
                borderRadius: '12px', 
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <p style={{ color: colors.muted, fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Suggested Program Title
                </p>
                <p style={{ color: colors.primary, fontSize: '22px', fontWeight: '700', margin: 0 }}>
                  "{generatedStrategy.suggestedTitle}"
                </p>
              </div>
              
              {/* Angle - One liner */}
              {generatedStrategy.angle && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '6px' }}>YOUR ANGLE</p>
                  <p style={{ color: colors.gold, fontSize: '15px', fontStyle: 'italic', margin: 0 }}>
                    "{generatedStrategy.angle}"
                  </p>
                </div>
              )}
              
              {/* From Bucket - What to use */}
              {generatedStrategy.fromBucket && generatedStrategy.fromBucket.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '10px' }}>
                    🪣 FROM YOUR BUCKET - HIGHLIGHT THESE
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {generatedStrategy.fromBucket.map((item, i) => (
                      <span key={i} style={{
                        backgroundColor: `${colors.gold}20`,
                        color: colors.gold,
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '13px'
                      }}>
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Key Points */}
              {generatedStrategy.keyPoints && generatedStrategy.keyPoints.length > 0 && (
                <div style={{ marginBottom: '25px' }}>
                  <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '10px' }}>
                    📋 KEY POINTS TO HIT
                  </p>
                  <ul style={{ 
                    margin: 0, 
                    paddingLeft: '20px', 
                    color: '#ccc', 
                    fontSize: '14px',
                    lineHeight: '1.8'
                  }}>
                    {generatedStrategy.keyPoints.map((point, i) => (
                      <li key={i} style={{ marginBottom: '6px' }}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Fallback for old format */}
              {generatedStrategy.approach && !generatedStrategy.angle && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '8px' }}>APPROACH</p>
                  <p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.7' }}>
                    {generatedStrategy.approach}
                  </p>
                </div>
              )}
              
              {/* Action Buttons */}
              <div style={{ display: 'grid', gap: '12px' }}>
                <button
                  onClick={() => {
                    // Initialize sections and go to Phase 3
                    initializeSections()
                    setCurrentPhase(3)
                  }}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: colors.gold,
                    border: 'none',
                    borderRadius: '10px',
                    color: colors.background,
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ✅ Use This → Continue to Answers
                </button>
                <button
                  onClick={() => {
                    setGeneratedStrategy(null)
                    generateStrategy()
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '10px',
                    color: '#ccc',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Regenerate
                </button>
              </div>
            </div>
          ) : generatingStrategy ? (
            // LOADING STATE
            <div style={{
              backgroundColor: colors.card,
              borderRadius: '16px',
              padding: '60px 30px',
              textAlign: 'center',
              marginBottom: '25px'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '20px' }}>🤖</div>
              <p style={{ color: colors.gold, fontSize: '18px', marginBottom: '10px' }}>
                RCA is thinking...
              </p>
              <p style={{ color: colors.muted, fontSize: '14px' }}>
                Pulling from your BUCKET to create a winning strategy
              </p>
            </div>
          ) : (
            // INPUT FORM
            <>
              <div style={{
                backgroundColor: colors.card,
                border: `2px solid ${colors.gold}`,
                borderRadius: '16px',
                padding: '30px',
                textAlign: 'center',
                marginBottom: '25px'
              }}>
                <p style={{ color: colors.gold, fontSize: '20px', marginBottom: '25px' }}>
                  What's your angle for this one?
                </p>
                
                <textarea
                  value={userAngle}
                  onChange={(e) => setUserAngle(e.target.value)}
                  placeholder="Example: Focus on our 10 years of experience and community partnerships..."
                  style={{
                    width: '100%',
                    backgroundColor: '#1a1a1a',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    padding: '15px',
                    color: colors.text,
                    fontSize: '14px',
                    resize: 'none',
                    minHeight: '80px',
                    marginBottom: '20px'
                  }}
                />
                
                <p style={{ color: colors.muted, fontSize: '12px', marginBottom: '15px' }}>
                  Or pick a quick approach:
                </p>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                  {['🎯 Experience-focused', '🤝 Community partnerships', '📊 Data-driven', '💰 Cost-effective'].map(pick => (
                    <button 
                      key={pick} 
                      onClick={() => generateStrategy(pick)}
                      style={{
                        backgroundColor: '#1a1a1a',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '20px',
                        padding: '8px 16px',
                        color: '#ccc',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {pick}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={() => generateStrategy()}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: colors.gold,
                  border: 'none',
                  borderRadius: '12px',
                  color: colors.background,
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  marginBottom: '12px'
                }}
              >
                🤖 Generate Strategy with RCA
              </button>
            </>
          )}

        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 3: ANSWERS SCREEN
  // ==========================================
  if (selectedSubmission && currentPhase === 3) {
    const currentSection = sections[currentSectionIndex]
    const completedCount = sections.filter(s => s.status === 'complete').length

    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.background, 
        padding: '40px 30px',
        paddingBottom: '100px'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          
          {/* Header */}
          <p 
            onClick={() => setCurrentPhase(2)}
            style={{ color: colors.muted, fontSize: '16px', marginBottom: '20px', cursor: 'pointer' }}
          >
            ← Back to Strategy
          </p>

          {/* Progress Bar */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '30px' 
          }}>
            {[1, 2, 3, 4, 5].map(phase => (
              <div 
                key={phase}
                style={{
                  flex: 1,
                  height: '4px',
                  backgroundColor: phase <= 3 ? colors.primary : colors.border,
                  borderRadius: '2px'
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '12px', color: colors.muted }}>
            <span>1. Overview</span>
            <span>2. Strategy</span>
            <span style={{ color: colors.primary, fontWeight: '600' }}>3. Answers</span>
            <span>4. Review</span>
            <span>5. Submit</span>
          </div>

          {/* Title */}
          <h2 style={{ color: colors.text, fontSize: '20px', marginBottom: '5px' }}>
            {selectedSubmission.title}
          </h2>
          <p style={{ color: colors.muted, fontSize: '13px', marginBottom: '30px' }}>
            {completedCount} of {sections.length} sections complete
          </p>

          {/* Section Navigation */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '25px',
            overflowX: 'auto',
            paddingBottom: '10px'
          }}>
            {sections.map((section, i) => (
              <button
                key={section.id}
                onClick={() => setCurrentSectionIndex(i)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: i === currentSectionIndex ? colors.card : 'transparent',
                  border: `1px solid ${i === currentSectionIndex ? colors.primary : colors.border}`,
                  borderRadius: '8px',
                  color: section.status === 'complete' ? colors.primary : (i === currentSectionIndex ? colors.text : colors.muted),
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {section.status === 'complete' && '✓'} {section.title}
              </button>
            ))}
          </div>

          {/* Current Section */}
          {currentSection && (
            <div style={{
              backgroundColor: colors.card,
              borderRadius: '16px',
              padding: '25px',
              border: `1px solid ${colors.border}`,
              marginBottom: '20px'
            }}>
              {/* Section Header */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: colors.text, fontSize: '18px', margin: '0 0 8px 0' }}>
                  {currentSection.title}
                </h3>
                <p style={{ color: colors.muted, fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
                  {currentSection.prompt}
                </p>
              </div>

              {/* Answer Area */}
              {currentSection.status === 'generating' ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p style={{ color: colors.gold, fontSize: '16px' }}>🤖 RCA is writing...</p>
                  <p style={{ color: colors.muted, fontSize: '13px' }}>Crafting your response based on the strategy</p>
                </div>
              ) : (
                <>
                  <textarea
                    value={currentSection.answer}
                    onChange={(e) => updateAnswer(currentSectionIndex, e.target.value)}
                    placeholder="Click 'Generate with RCA' or write your response here..."
                    style={{
                      width: '100%',
                      backgroundColor: '#1a1a1a',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '15px',
                      color: colors.text,
                      fontSize: '14px',
                      lineHeight: '1.7',
                      resize: 'vertical',
                      minHeight: '200px',
                      marginBottom: '15px'
                    }}
                  />

                  {/* Character Count */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '20px'
                  }}>
                    <span style={{ 
                      color: currentSection.answer.length > currentSection.charLimit ? colors.danger : colors.muted,
                      fontSize: '12px'
                    }}>
                      {currentSection.answer.length} / {currentSection.charLimit} characters
                    </span>
                    {currentSection.answer.length > currentSection.charLimit && (
                      <span style={{ color: colors.danger, fontSize: '12px' }}>
                        ⚠️ Over limit
                      </span>
                    )}
                  </div>

                  {/* Generate Button */}
                  {!currentSection.answer && (
                    <button
                      onClick={() => generateAnswer(currentSectionIndex)}
                      style={{
                        width: '100%',
                        padding: '14px',
                        backgroundColor: colors.gold,
                        border: 'none',
                        borderRadius: '10px',
                        color: colors.background,
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginBottom: '10px'
                      }}
                    >
                      🤖 Generate with RCA
                    </button>
                  )}

                  {/* Regenerate if has answer */}
                  {currentSection.answer && (
                    <button
                      onClick={() => generateAnswer(currentSectionIndex)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: 'transparent',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '10px',
                        color: colors.muted,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      🔄 Regenerate this section
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {currentSectionIndex > 0 && (
              <button
                onClick={() => setCurrentSectionIndex(currentSectionIndex - 1)}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '10px',
                  color: colors.muted,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                ← Previous
              </button>
            )}
            
            {currentSectionIndex < sections.length - 1 ? (
              <button
                onClick={() => setCurrentSectionIndex(currentSectionIndex + 1)}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: currentSection?.answer ? colors.primary : colors.card,
                  border: 'none',
                  borderRadius: '10px',
                  color: currentSection?.answer ? colors.background : colors.muted,
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Next Section →
              </button>
            ) : (
              <button
                onClick={() => setCurrentPhase(4)}
                disabled={completedCount < sections.length}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: completedCount === sections.length ? colors.gold : colors.card,
                  border: 'none',
                  borderRadius: '10px',
                  color: completedCount === sections.length ? colors.background : colors.muted,
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: completedCount === sections.length ? 'pointer' : 'not-allowed'
                }}
              >
                {completedCount === sections.length ? 'Continue to Review →' : `Complete all sections (${completedCount}/${sections.length})`}
              </button>
            )}
          </div>

        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 4: REVIEW SCREEN (Placeholder)
  // ==========================================
  if (selectedSubmission && currentPhase === 4) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.background, 
        padding: '40px 30px',
        paddingBottom: '100px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          <p 
            onClick={() => setCurrentPhase(3)}
            style={{ color: colors.muted, fontSize: '16px', marginBottom: '20px', cursor: 'pointer' }}
          >
            ← Back to Answers
          </p>

          {/* Progress Bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '30px' }}>
            {[1, 2, 3, 4, 5].map(phase => (
              <div 
                key={phase}
                style={{
                  flex: 1,
                  height: '4px',
                  backgroundColor: phase <= 4 ? colors.primary : colors.border,
                  borderRadius: '2px'
                }}
              />
            ))}
          </div>

          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '60px 30px',
            textAlign: 'center',
            border: `1px solid ${colors.border}`
          }}>
            <span style={{ fontSize: '48px', marginBottom: '20px', display: 'block' }}>📋</span>
            <h2 style={{ color: colors.text, fontSize: '24px', marginBottom: '15px' }}>
              Review Your Response
            </h2>
            <p style={{ color: colors.muted, fontSize: '14px', marginBottom: '30px', lineHeight: '1.6' }}>
              You've completed {sections.filter(s => s.status === 'complete').length} sections.<br/>
              Review & Download coming soon.
            </p>
            
            {/* Show sections summary */}
            <div style={{ textAlign: 'left', maxWidth: '500px', margin: '0 auto' }}>
              {sections.map((section, i) => (
                <div 
                  key={section.id}
                  style={{
                    padding: '12px',
                    borderBottom: i < sections.length - 1 ? `1px solid ${colors.border}` : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ color: colors.text, fontSize: '14px' }}>{section.title}</span>
                  <span style={{ color: section.status === 'complete' ? colors.primary : colors.muted, fontSize: '12px' }}>
                    {section.status === 'complete' ? `✓ ${section.answer.length} chars` : 'Pending'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setCurrentPhase(3)}
              style={{
                marginTop: '30px',
                padding: '14px 30px',
                backgroundColor: colors.gold,
                border: 'none',
                borderRadius: '10px',
                color: colors.background,
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ← Edit Answers
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ==========================================
  // DETAIL VIEW - Overview Screen (Phase 1)
  // ==========================================
  if (selectedSubmission && currentPhase === 1) {
    const currentScore = getScore(selectedSubmission)
    const potentialScore = getPotentialScore(selectedSubmission)
    const daysLeft = getDaysLeft(selectedSubmission.due_date)

    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.background, 
        padding: '40px 30px',
        paddingBottom: '100px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Back Button */}
          <p 
            onClick={() => setSelectedSubmission(null)}
            style={{ 
              color: colors.muted, 
              fontSize: '16px', 
              marginBottom: '20px',
              cursor: 'pointer'
            }}
          >
            ← Back to List
          </p>

          {/* Opportunity Card */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.border}`,
            marginBottom: '20px'
          }}>
            <p style={{ 
              color: colors.muted, 
              fontSize: '11px', 
              textTransform: 'uppercase', 
              marginBottom: '8px' 
            }}>
              Opportunity
            </p>
            
            <h2 style={{ 
              color: colors.text, 
              fontSize: '22px', 
              margin: '0 0 15px 0',
              lineHeight: '1.4'
            }}>
              {selectedSubmission.title}
            </h2>

            {/* Only show description if it's actually descriptive (not just a category like "Construction") */}
            {selectedSubmission.description && selectedSubmission.description.length > 30 && (
              <p style={{
                color: '#ccc',
                fontSize: '14px',
                lineHeight: '1.6',
                marginBottom: '20px',
                paddingBottom: '20px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                {selectedSubmission.description}
              </p>
            )}

            {/* Show category as a tag if description is short */}
            {selectedSubmission.description && selectedSubmission.description.length <= 30 && (
              <div style={{ marginBottom: '15px' }}>
                <span style={{
                  backgroundColor: `${colors.primary}20`,
                  color: colors.primary,
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}>
                  {selectedSubmission.description}
                </span>
              </div>
            )}

            {/* Meta Info */}
            <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
              {selectedSubmission.estimated_value && (
                <div>
                  <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '4px' }}>Funding</p>
                  <p style={{ color: colors.primary, fontSize: '14px', fontWeight: '600', margin: 0 }}>
                    {selectedSubmission.estimated_value}
                  </p>
                </div>
              )}
              <div>
                <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '4px' }}>Due Date</p>
                <p style={{ color: colors.text, fontSize: '14px', margin: 0 }}>
                  {formatDate(selectedSubmission.due_date)}
                </p>
              </div>
              <div>
                <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '4px' }}>Agency</p>
                <p style={{ color: colors.text, fontSize: '14px', margin: 0 }}>
                  {selectedSubmission.agency || 'Not specified'}
                </p>
              </div>
            </div>
          </div>

          {/* Match Score Bar */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.border}`,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <p style={{ color: colors.muted, fontSize: '12px', marginBottom: '4px' }}>
                Your BUCKET Match
              </p>
              <p style={{ 
                color: colors.primary, 
                fontSize: '42px', 
                fontWeight: '700', 
                margin: 0 
              }}>
                {currentScore}%
              </p>
            </div>
            
            <div style={{ color: colors.muted, fontSize: '28px' }}>→</div>
            
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: colors.muted, fontSize: '12px', marginBottom: '4px' }}>
                With RCA
              </p>
              <p style={{ 
                color: colors.gold, 
                fontSize: '42px', 
                fontWeight: '700', 
                margin: 0 
              }}>
                {potentialScore}%
              </p>
            </div>
          </div>

          {/* RFP INFO SECTION */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.border}`,
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <span style={{ fontSize: '24px' }}>📋</span>
              <div>
                <p style={{ color: colors.text, fontSize: '16px', fontWeight: '600', margin: 0 }}>
                  What We Know
                </p>
                <p style={{ color: colors.muted, fontSize: '12px', margin: 0 }}>
                  From {selectedSubmission.source === 'grants_gov' ? 'Grants.gov' : 'the source listing'}
                </p>
              </div>
            </div>

            {/* Show the description we have */}
            {selectedSubmission.description && selectedSubmission.description.length > 30 ? (
              <div style={{ marginBottom: '15px' }}>
                <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '5px' }}>DESCRIPTION</p>
                <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.6' }}>
                  {selectedSubmission.description}
                </p>
              </div>
            ) : (
              <p style={{ color: colors.muted, fontSize: '13px', fontStyle: 'italic' }}>
                Limited details available. RCA will use the title and your BUCKET to generate strategy.
              </p>
            )}

            {/* Optional: Let advanced users upload if they want better results */}
            {!rfpContent && (
              <details style={{ marginTop: '15px' }}>
                <summary style={{ color: colors.muted, fontSize: '12px', cursor: 'pointer' }}>
                  Have the RFP PDF? Upload for better results (optional)
                </summary>
                <div style={{ marginTop: '10px' }}>
                  <label style={{
                    display: 'inline-block',
                    padding: '10px 16px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.muted,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}>
                    📎 Upload PDF
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </details>
            )}

            {/* Show if PDF was uploaded */}
            {rfpContent && (
              <div style={{ 
                marginTop: '15px', 
                padding: '10px', 
                backgroundColor: `${colors.primary}10`, 
                borderRadius: '8px' 
              }}>
                <p style={{ color: colors.primary, fontSize: '13px', margin: 0 }}>
                  ✅ {rfpContent.fileName ? `Uploaded: ${rfpContent.fileName}` : 'Additional details loaded'}
                </p>
              </div>
            )}

            {/* Loading state */}
            {loadingRfp && (
              <div style={{ textAlign: 'center', padding: '15px' }}>
                <p style={{ color: colors.gold, fontSize: '14px' }}>🔄 Reading document...</p>
              </div>
            )}

            {/* Error - but don't block them */}
            {rfpError && (
              <p style={{ color: colors.muted, fontSize: '12px', marginTop: '10px' }}>
                Note: {rfpError}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <button
            onClick={() => {
              // Go to Phase 2 - Strategy
              setCurrentPhase(2)
            }}
            style={{
              width: '100%',
              padding: '18px',
              backgroundColor: colors.gold,
              border: 'none',
              borderRadius: '12px',
              color: colors.background,
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
          >
            📝 Start Draft
          </button>

          <button
            onClick={() => setSelectedSubmission(null)}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              color: colors.muted,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Not Right Now
          </button>

        </div>
      </div>
    )
  }

  // ==========================================
  // LIST VIEW - All Active Responses
  // ==========================================
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: colors.background, 
      padding: '40px 30px',
      paddingBottom: '100px'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Back Button */}
        <p 
          onClick={onBack}
          style={{ 
            color: colors.muted, 
            fontSize: '16px', 
            marginBottom: '20px',
            cursor: 'pointer'
          }}
        >
          ← Back
        </p>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '60px', marginBottom: '15px' }}>📝</div>
          <h1 style={{ color: colors.text, margin: '0 0 10px 0' }}>Response Room</h1>
          <p style={{ color: colors.muted, margin: 0 }}>Where BUCKET + RCA write winning responses together</p>
        </div>

        {/* Count */}
        <p style={{ color: colors.muted, fontSize: '13px', marginBottom: '15px' }}>
          {submissions.length} active response{submissions.length !== 1 ? 's' : ''}
        </p>

        {/* List Items */}
        {submissions.map((sub) => {
          const daysLeft = getDaysLeft(sub.due_date)
          const score = getScore(sub)

          return (
            <div
              key={sub.id}
              onClick={() => {
                setSelectedSubmission(sub)
                setCurrentPhase(1) // Always start at Overview
              }}
              style={{
                backgroundColor: colors.card,
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${colors.border}`,
                marginBottom: '15px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'border-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = colors.border}
            >
              <div style={{ flex: 1 }}>
                {/* Badges */}
                <div style={{ marginBottom: '10px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    marginRight: '8px',
                    backgroundColor: colors.gold,
                    color: colors.background
                  }}>
                    In Progress
                  </span>
                  
                  {daysLeft !== null && daysLeft <= 14 && (
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      backgroundColor: daysLeft <= 7 ? colors.danger : colors.gold,
                      color: colors.background
                    }}>
                      {daysLeft} days left
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 style={{ 
                  color: colors.text, 
                  fontSize: '16px', 
                  margin: '0 0 8px 0' 
                }}>
                  {sub.title}
                </h3>

                {/* Meta */}
                <p style={{ color: colors.muted, fontSize: '13px', margin: 0 }}>
                  {sub.agency || 'Agency'} • Due: {formatShortDate(sub.due_date)}
                  {sub.estimated_value && ` • ${sub.estimated_value}`}
                </p>
              </div>

              {/* Score */}
              <div style={{ 
                color: colors.primary, 
                fontSize: '24px', 
                fontWeight: '700',
                marginLeft: '20px'
              }}>
                {score}%
              </div>
            </div>
          )
        })}

      </div>
    </div>
  )
}
