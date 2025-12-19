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
          userAngle: quickPick || userAngle
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
        approach: `We will leverage our expertise and commitment to deliver exceptional results for this opportunity. Our team brings proven experience and a client-focused approach that aligns with the goals outlined in this request.`
      })
    } finally {
      setGeneratingStrategy(false)
    }
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
            // GENERATED STRATEGY DISPLAY
            <div style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.primary}40`,
              borderRadius: '16px',
              padding: '25px',
              marginBottom: '25px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                marginBottom: '20px',
                paddingBottom: '15px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                <span style={{ fontSize: '24px' }}>🪣+🤖</span>
                <span style={{ color: colors.primary, fontSize: '13px', fontWeight: '600' }}>
                  BUCKET + RCA STRATEGY
                </span>
              </div>
              
              <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '8px' }}>SUGGESTED TITLE</p>
              <p style={{ color: colors.primary, fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
                "{generatedStrategy.suggestedTitle}"
              </p>
              
              <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '8px' }}>APPROACH</p>
              <p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.7', marginBottom: '25px' }}>
                {generatedStrategy.approach}
              </p>
              
              {/* Action Buttons */}
              <div style={{ display: 'grid', gap: '12px' }}>
                <button
                  disabled={true}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: colors.gold,
                    border: 'none',
                    borderRadius: '10px',
                    color: colors.background,
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'not-allowed',
                    opacity: 0.6
                  }}
                >
                  ✅ Use This → Continue to Answers (Coming Soon)
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
                <button
                  onClick={() => setGeneratedStrategy(null)}
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
                  ✏️ Edit
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
