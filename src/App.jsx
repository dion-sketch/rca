import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import BusinessBuilder from './BusinessBuilder'
import MyCart from './MyCart'
import ShopContracts from './ShopContracts'
import ResponseRoom from './ResponseRoom'

// Contract Ready Brand Colors
const colors = {
  primary: '#00FF00',
  gold: '#FFD700',
  background: '#000000',
  card: '#0A1F0A',
  white: '#FFFFFF',
  gray: '#888888',
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [profileCompletion, setProfileCompletion] = useState(0)
  const [profileData, setProfileData] = useState(null)
  const [cartCount, setCartCount] = useState(0)
  const [submissionCount, setSubmissionCount] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session) {
        fetchProfileCompletion(session.user.id)
        fetchCartCount(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchProfileCompletion(session.user.id)
        fetchCartCount(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfileCompletion = async (userId) => {
    const { data } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (data) {
      setProfileData(data)
      if (data.completion_percentage) {
        setProfileCompletion(data.completion_percentage)
      }
    }
  }

  const fetchCartCount = async (userId) => {
    const { data: cartItems } = await supabase
      .from('submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'considering')
    
    if (cartItems) {
      setCartCount(cartItems.length)
    }

    const { data: submitted } = await supabase
      .from('submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'submitted')
    
    if (submitted) {
      setSubmissionCount(submitted.length)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    })
    
    if (error) {
      setAuthError(error.message)
    } else {
      await supabase.from('users').insert({
        id: data.user.id,
        email: email,
        full_name: fullName
      })
    }
    setAuthLoading(false)
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      setAuthError(error.message)
    }
    setAuthLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: colors.primary, fontSize: '24px' }}>Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: colors.card,
          borderRadius: '16px',
          padding: '40px',
          width: '100%',
          maxWidth: '400px',
          border: `2px solid ${colors.primary}`,
          boxShadow: `0 0 30px rgba(0, 255, 0, 0.2)`
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ 
              color: colors.primary, 
              fontSize: '36px', 
              margin: 0,
              textShadow: `0 0 10px ${colors.primary}`
            }}>
              RCA
            </h1>
            <p style={{ color: colors.gray, margin: '5px 0 0 0' }}>
              Rambo Contract Assistant
            </p>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
            {isSignUp && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: colors.white, display: 'block', marginBottom: '8px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your name"
                  required={isSignUp}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.gray}`,
                    backgroundColor: '#1a1a1a',
                    color: colors.white,
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: colors.white, display: 'block', marginBottom: '8px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.gray}`,
                  backgroundColor: '#1a1a1a',
                  color: colors.white,
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: colors.white, display: 'block', marginBottom: '8px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.gray}`,
                  backgroundColor: '#1a1a1a',
                  color: colors.white,
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {authError && (
              <div style={{
                backgroundColor: 'rgba(255,0,0,0.1)',
                border: '1px solid #ff4444',
                borderRadius: '8px',
                padding: '10px',
                marginBottom: '20px',
                color: '#ff4444'
              }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: colors.primary,
                color: colors.background,
                fontSize: '16px',
                fontWeight: '600',
                cursor: authLoading ? 'not-allowed' : 'pointer',
                opacity: authLoading ? 0.7 : 1
              }}
            >
              {authLoading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setAuthError('')
              }}
              style={{
                background: 'none',
                border: 'none',
                color: colors.primary,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Navigation */}
      <nav style={{
        backgroundColor: colors.card,
        padding: '15px 30px',
        borderBottom: `1px solid ${colors.primary}30`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div 
          onClick={() => setCurrentPage('dashboard')}
          style={{ cursor: 'pointer' }}
        >
          <h1 style={{ color: colors.primary, margin: 0, fontSize: '28px', fontWeight: '700', letterSpacing: '2px' }}>
            RCA
          </h1>
          <p style={{ color: colors.gray, margin: '2px 0 0 0', fontSize: '11px', letterSpacing: '0.5px' }}>
            Rambo Contract Assistant
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[
            { label: '🏠 Dashboard', page: 'dashboard' },
            { label: '🛍️ Go Shopping', page: 'go-shopping' },
            { label: '🛒 My Cart', page: 'my-cart' },
            { label: '📝 Response Room', page: 'response-room' },
            { label: '🪣 My BUCKET', page: 'my-bucket' }
          ].map((item) => (
            <button
              key={item.page}
              onClick={() => setCurrentPage(item.page)}
              style={{
                background: 'none',
                border: 'none',
                color: currentPage === item.page ? colors.primary : colors.white,
                cursor: 'pointer',
                fontSize: '13px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: currentPage === item.page ? `${colors.primary}20` : 'transparent',
                whiteSpace: 'nowrap'
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: `1px solid ${colors.gray}`,
              color: colors.gray,
              cursor: 'pointer',
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: '6px',
              marginLeft: '10px'
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Page Router */}
      {currentPage === 'go-shopping' ? (
        <ShopContracts session={session} />
      ) : currentPage === 'my-cart' ? (
        <MyCart 
          session={session} 
          onBack={() => setCurrentPage('dashboard')}
          onStartResponse={(item) => {
            setCurrentPage('response-room')
          }}
          profileData={profileData}
        />
      ) : currentPage === 'response-room' ? (
        <ResponseRoom 
          session={session}
          profileData={profileData}
          onBack={() => setCurrentPage('dashboard')}
        />
      ) : currentPage === 'my-bucket' ? (
        <MyBucketPage 
          session={session} 
          profileData={profileData}
          profileCompletion={profileCompletion}
          onBack={() => setCurrentPage('dashboard')}
          onEditProfile={() => setCurrentPage('build-bucket')}
        />
      ) : currentPage === 'build-bucket' ? (
        <BusinessBuilder 
          session={session} 
          onBack={() => {
            setCurrentPage('dashboard')
            fetchProfileCompletion(session.user.id)
          }} 
        />
      ) : (
        <>
          {/* Stats Bar */}
          <div style={{
            backgroundColor: colors.card,
            padding: '20px 30px',
            display: 'flex',
            justifyContent: 'space-around',
            borderBottom: `1px solid ${colors.primary}30`
          }}>
            <div 
              onClick={() => setCurrentPage('my-bucket')}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ color: profileCompletion >= 80 ? colors.primary : colors.gold, fontSize: '32px', fontWeight: '700' }}>
                🪣 {profileCompletion}%
              </div>
              <div style={{ color: colors.gray, fontSize: '12px' }}>BUCKET Built</div>
            </div>
            <div 
              onClick={() => setCurrentPage('my-cart')}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ color: colors.gold, fontSize: '32px', fontWeight: '700' }}>
                🛒 {cartCount}
              </div>
              <div style={{ color: colors.gray, fontSize: '12px' }}>In Cart</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: colors.white, fontSize: '32px', fontWeight: '700' }}>
                🎯 {submissionCount}/2
              </div>
              <div style={{ color: colors.gray, fontSize: '12px' }}>Monthly Goal</div>
            </div>
          </div>

          {/* Main Content */}
          <div style={{ padding: '40px 30px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ color: colors.white, margin: '0 0 10px 0' }}>
                Welcome! 👋
              </h2>
              <p style={{ color: colors.gray, margin: 0 }}>
                Your <strong style={{ color: colors.primary }}>Rambo Contract Assistant</strong>. Let's win some contracts.
              </p>
            </div>

            {/* THE FLOW - 4 Steps */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px'
            }}>
              {/* Step 1: Go Shopping */}
              <div 
                onClick={() => setCurrentPage('go-shopping')}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: '16px',
                  padding: '25px',
                  border: `2px solid ${colors.primary}30`,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = `${colors.primary}30`}
              >
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '20px',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  padding: '2px 10px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  STEP 1
                </div>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🛍️</div>
                <h3 style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '18px' }}>Go Shopping</h3>
                <p style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>
                  Search 7,000+ contracts & grants matched to your BUCKET
                </p>
              </div>

              {/* Step 2: My Cart */}
              <div 
                onClick={() => setCurrentPage('my-cart')}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: '16px',
                  padding: '25px',
                  border: `2px solid ${colors.primary}30`,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = `${colors.primary}30`}
              >
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '20px',
                  backgroundColor: colors.gold,
                  color: colors.background,
                  padding: '2px 10px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  STEP 2
                </div>
                {cartCount > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '20px',
                    backgroundColor: colors.gold,
                    color: colors.background,
                    padding: '2px 10px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}>
                    {cartCount} SAVED
                  </div>
                )}
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🛒</div>
                <h3 style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '18px' }}>My Cart</h3>
                <p style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>
                  Review saved opportunities, then start a response
                </p>
              </div>

              {/* Step 3: Response Room */}
              <div 
                onClick={() => setCurrentPage('response-room')}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: '16px',
                  padding: '25px',
                  border: `2px solid ${colors.primary}`,
                  cursor: 'pointer',
                  boxShadow: `0 0 20px ${colors.primary}30`,
                  position: 'relative'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '20px',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  padding: '2px 10px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  STEP 3
                </div>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📝</div>
                <h3 style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '18px' }}>Response Room</h3>
                <p style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>
                  BUCKET + RCA write winning responses together
                </p>
              </div>

              {/* Step 4: My BUCKET */}
              <div 
                onClick={() => setCurrentPage('my-bucket')}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: '16px',
                  padding: '25px',
                  border: `2px solid ${colors.primary}30`,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = `${colors.primary}30`}
              >
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '20px',
                  backgroundColor: colors.gray,
                  color: colors.background,
                  padding: '2px 10px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  GROWS
                </div>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🪣</div>
                <h3 style={{ color: colors.white, margin: '0 0 8px 0', fontSize: '18px' }}>My BUCKET</h3>
                <p style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>
                  Your profile + saved answers. Grows with each submission.
                </p>
              </div>
            </div>

            {/* Quick Access: Build BUCKET */}
            <div 
              onClick={() => setCurrentPage('build-bucket')}
              style={{
                marginTop: '30px',
                backgroundColor: `${colors.primary}10`,
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${colors.primary}30`,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <p style={{ color: colors.primary, margin: 0, fontSize: '14px', fontWeight: '600' }}>
                  🪣 Build Your BUCKET ({profileCompletion}% complete)
                </p>
                <p style={{ color: colors.gray, margin: '5px 0 0 0', fontSize: '13px' }}>
                  Add your company info, services, NAICS codes, team, and past performance
                </p>
              </div>
              <div style={{ color: colors.primary, fontSize: '20px' }}>→</div>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.card,
        padding: '10px 30px',
        borderTop: `1px solid ${colors.primary}30`,
        textAlign: 'center'
      }}>
        <p style={{ color: colors.gray, margin: 0, fontSize: '12px' }}>
          Powered by <span style={{ color: colors.primary }}>Contract Ready</span> • RCA Technology
        </p>
      </div>
    </div>
  )
}

// ==========================================
// MY BUCKET PAGE
// ==========================================
function MyBucketPage({ session, profileData, profileCompletion, onBack, onEditProfile }) {
  const [savedAnswers, setSavedAnswers] = useState([])
  const [submissions, setSubmissions] = useState([])

  useEffect(() => {
    fetchBucketData()
  }, [])

  const fetchBucketData = async () => {
    try {
      const { data: answers } = await supabase
        .from('saved_answers')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      if (answers) setSavedAnswers(answers)
    } catch (e) {}

    try {
      const { data: subs } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'submitted')
      if (subs) setSubmissions(subs)
    } catch (e) {}
  }

  const bucketScore = profileCompletion || 0

  return (
    <div style={{ padding: '40px 30px', maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
      <button 
        onClick={onBack} 
        style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px', marginBottom: '20px' }}
      >
        ← Back to Dashboard
      </button>

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ fontSize: '60px', marginBottom: '15px' }}>🪣</div>
        <h1 style={{ color: colors.white, margin: '0 0 10px 0' }}>My BUCKET</h1>
        <p style={{ color: colors.gray, margin: 0 }}>Everything RCA knows about your business</p>
      </div>

      <div style={{
        backgroundColor: colors.card,
        borderRadius: '16px',
        padding: '25px',
        border: `2px solid ${bucketScore >= 80 ? colors.primary : colors.gold}`,
        textAlign: 'center',
        marginBottom: '25px'
      }}>
        <div style={{ 
          color: bucketScore >= 80 ? colors.primary : colors.gold, 
          fontSize: '48px', 
          fontWeight: '700',
          marginBottom: '10px'
        }}>
          {bucketScore}%
        </div>
        <p style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '16px', fontWeight: '600' }}>
          {bucketScore >= 80 ? 'Strong BUCKET!' : bucketScore >= 50 ? 'Growing!' : 'Getting started'}
        </p>
        <p style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>
          {submissions.length} submissions • {savedAnswers.length} saved answers
        </p>
      </div>

      <div style={{
        backgroundColor: colors.card,
        borderRadius: '12px',
        padding: '20px',
        border: `1px solid ${colors.gray}30`,
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <p style={{ color: colors.gray, margin: 0, fontSize: '12px', fontWeight: '600' }}>COMPANY</p>
          <button 
            onClick={onEditProfile}
            style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', fontSize: '13px' }}
          >
            Edit BUCKET →
          </button>
        </div>
        <p style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '18px', fontWeight: '600' }}>
          {profileData?.company_name || 'Your Company Name'}
        </p>
        <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
          {profileData?.city && profileData?.state ? `${profileData.city}, ${profileData.state}` : 'Location not set'}
        </p>
      </div>

      {profileData?.naics_codes?.length > 0 && (
        <div style={{
          backgroundColor: colors.card,
          borderRadius: '12px',
          padding: '20px',
          border: `1px solid ${colors.gray}30`,
          marginBottom: '20px'
        }}>
          <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '12px', fontWeight: '600' }}>
            NAICS CODES ({profileData.naics_codes.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {profileData.naics_codes.map((naics, i) => (
              <span key={i} style={{
                backgroundColor: `${colors.primary}20`,
                color: colors.primary,
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px'
              }}>
                {naics.code}
              </span>
            ))}
          </div>
        </div>
      )}

      {profileData?.certifications?.length > 0 && (
        <div style={{
          backgroundColor: colors.card,
          borderRadius: '12px',
          padding: '20px',
          border: `1px solid ${colors.gray}30`,
          marginBottom: '20px'
        }}>
          <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '12px', fontWeight: '600' }}>
            CERTIFICATIONS ({profileData.certifications.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {profileData.certifications.map((cert, i) => (
              <span key={i} style={{
                backgroundColor: `${colors.gold}20`,
                color: colors.gold,
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px'
              }}>
                ✓ {cert.name || cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {!profileData?.company_name && (
        <div style={{
          backgroundColor: colors.card,
          borderRadius: '12px',
          padding: '40px',
          border: `2px dashed ${colors.gold}`,
          textAlign: 'center'
        }}>
          <p style={{ color: colors.white, margin: '0 0 15px 0', fontSize: '18px', fontWeight: '600' }}>
            Your BUCKET is empty!
          </p>
          <button
            onClick={onEditProfile}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: colors.primary,
              color: colors.background,
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Build BUCKET →
          </button>
        </div>
      )}
    </div>
  )
}

export default App
