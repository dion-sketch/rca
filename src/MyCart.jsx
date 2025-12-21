import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const colors = {
  background: '#000000',
  card: '#0a0a0a',
  border: '#1a1a1a',
  text: '#ffffff',
  muted: '#888888',
  primary: '#00ff00',
  gold: '#ffd700',
  danger: '#ff4444'
}

export default function MyCart({ session, onNavigate, profileData }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('considering')

  useEffect(() => {
    if (session?.user?.id) {
      fetchSubmissions()
    }
  }, [session])

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setSubmissions(data || [])
    } catch (err) {
      console.error('Error fetching submissions:', err)
    }
    setLoading(false)
  }

  const removeSubmission = async (id) => {
    if (!confirm('Remove this opportunity from your cart?')) return
    
    try {
      await supabase
        .from('submissions')
        .delete()
        .eq('id', id)
      
      setSubmissions(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Error removing:', err)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No deadline'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getDaysLeft = (dateStr) => {
    if (!dateStr) return null
    const due = new Date(dateStr)
    const now = new Date()
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getFilteredSubmissions = () => {
    switch (activeTab) {
      case 'considering':
        return submissions.filter(s => !s.status || s.status === 'considering' || s.status === 'saved')
      case 'in_progress':
        return submissions.filter(s => s.status === 'in_progress' || s.status === 'drafting')
      case 'submitted':
        return submissions.filter(s => s.status === 'submitted')
      default:
        return submissions
    }
  }

  const filteredSubmissions = getFilteredSubmissions()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.primary }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: '20px 30px', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <p 
            onClick={() => onNavigate('dashboard')}
            style={{ color: colors.muted, fontSize: '14px', cursor: 'pointer', margin: 0 }}
          >
            ← Dashboard
          </p>
          <h1 style={{ color: colors.text, fontSize: '24px', margin: 0 }}>My Cart</h1>
          <div style={{ width: '80px' }}></div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
          {[
            { id: 'considering', label: 'Considering' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'submitted', label: 'Submitted' }
          ].map(tab => {
            const count = tab.id === 'considering' 
              ? submissions.filter(s => !s.status || s.status === 'considering' || s.status === 'saved').length
              : tab.id === 'in_progress'
              ? submissions.filter(s => s.status === 'in_progress' || s.status === 'drafting').length
              : submissions.filter(s => s.status === 'submitted').length

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: activeTab === tab.id ? colors.primary : 'transparent',
                  border: `1px solid ${activeTab === tab.id ? colors.primary : colors.border}`,
                  borderRadius: '20px',
                  color: activeTab === tab.id ? colors.background : colors.muted,
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? '600' : '400'
                }}
              >
                {tab.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Empty State */}
        {filteredSubmissions.length === 0 && (
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '60px 40px',
            border: `2px dashed ${colors.border}`,
            textAlign: 'center'
          }}>
            <p style={{ color: colors.text, fontSize: '18px', margin: '0 0 10px 0' }}>
              {activeTab === 'considering' && 'No opportunities yet'}
              {activeTab === 'in_progress' && 'No drafts in progress'}
              {activeTab === 'submitted' && 'No submissions yet'}
            </p>
            <p style={{ color: colors.muted, fontSize: '14px', margin: '0 0 25px 0' }}>
              {activeTab === 'considering' && 'Find opportunities in Shopping and add them here'}
              {activeTab === 'in_progress' && 'Start a response from your Considering list'}
              {activeTab === 'submitted' && 'Complete a response to see it here'}
            </p>
            {activeTab === 'considering' && (
              <button
                onClick={() => onNavigate('shop')}
                style={{
                  padding: '14px 28px',
                  backgroundColor: colors.gold,
                  border: 'none',
                  borderRadius: '10px',
                  color: colors.background,
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🛍️ Go Shopping
              </button>
            )}
          </div>
        )}

        {/* Submissions List */}
        {filteredSubmissions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {filteredSubmissions.map(sub => {
              const daysLeft = getDaysLeft(sub.due_date)
              const isUrgent = daysLeft !== null && daysLeft <= 7
              
              return (
                <div 
                  key={sub.id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: '12px',
                    padding: '20px',
                    border: `1px solid ${isUrgent ? colors.gold : colors.border}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ 
                        color: colors.text, 
                        fontSize: '16px', 
                        margin: '0 0 8px 0',
                        lineHeight: '1.4'
                      }}>
                        {sub.title}
                      </h3>
                      
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {sub.agency && (
                          <span style={{ color: colors.muted, fontSize: '13px' }}>
                            {sub.agency}
                          </span>
                        )}
                        {sub.estimated_value && (
                          <span style={{ color: colors.primary, fontSize: '13px' }}>
                            {sub.estimated_value}
                          </span>
                        )}
                        <span style={{ 
                          color: isUrgent ? colors.gold : colors.muted, 
                          fontSize: '13px',
                          fontWeight: isUrgent ? '600' : '400'
                        }}>
                          {isUrgent && '⚠️ '}{formatDate(sub.due_date)}
                          {daysLeft !== null && ` (${daysLeft} days)`}
                        </span>
                      </div>

                      {/* Match Score */}
                      {sub.cr_match_score && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: colors.muted, fontSize: '12px' }}>Match:</span>
                          <span style={{ 
                            color: sub.cr_match_score >= 70 ? colors.primary : sub.cr_match_score >= 50 ? colors.gold : colors.muted,
                            fontSize: '14px',
                            fontWeight: '600'
                          }}>
                            {sub.cr_match_score}%
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      {activeTab === 'considering' && (
                        <>
                          <button
                            onClick={() => onNavigate('response-room', sub)}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: colors.gold,
                              border: 'none',
                              borderRadius: '8px',
                              color: colors.background,
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Start Response
                          </button>
                          <button
                            onClick={() => removeSubmission(sub.id)}
                            style={{
                              padding: '10px 14px',
                              backgroundColor: 'transparent',
                              border: `1px solid ${colors.border}`,
                              borderRadius: '8px',
                              color: colors.muted,
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                          >
                            ✕
                          </button>
                        </>
                      )}
                      
                      {activeTab === 'in_progress' && (
                        <button
                          onClick={() => onNavigate('response-room', sub)}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: colors.primary,
                            border: 'none',
                            borderRadius: '8px',
                            color: colors.background,
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Continue →
                        </button>
                      )}
                      
                      {activeTab === 'submitted' && (
                        <button
                          onClick={() => onNavigate('response-room', sub)}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px',
                            color: colors.muted,
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
