import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import BusinessBuilder from './BusinessBuilder'
import MyCart from './MyCart'

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
  const [submissions, setSubmissions] = useState(0)

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session) {
        fetchProfileCompletion(session.user.id)
        fetchCartCount(session.user.id)
      }
    })

    // Listen for auth changes
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
    const { data } = await supabase
      .from('submissions')
      .select('id')
      .eq('user_id', userId)
      .neq('status', 'archived')
    
    if (data) {
      setCartCount(data.length)
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
      // Create user record in our users table
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

  // Loading state
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

  // Auth Screen (Login/Signup)
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
          {/* Logo */}
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

          {/* Auth Form */}
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

          {/* Toggle Auth Mode */}
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

  // Main Dashboard
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
        <div>
          <h1 style={{ color: colors.primary, margin: 0, fontSize: '24px', letterSpacing: '1px' }}>
            RCA
          </h1>
          <p style={{ color: colors.gray, margin: '2px 0 0 0', fontSize: '10px', letterSpacing: '0.5px' }}>
            Rambo Contract Assistant
          </p>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {[
            { label: 'Dashboard', page: 'dashboard' },
            { label: 'Shop Contracts', page: 'shop-contracts' },
            { label: 'Business Builder', page: 'business-builder' },
            { label: 'My Cart', page: 'my-cart' },
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
                fontSize: '14px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: currentPage === item.page ? `${colors.primary}20` : 'transparent'
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
              fontSize: '14px',
              padding: '8px 16px',
              borderRadius: '6px'
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Conditional Page Rendering */}
      {currentPage === 'business-builder' ? (
        <BusinessBuilder 
          session={session} 
          onBack={() => {
            setCurrentPage('dashboard')
            fetchProfileCompletion(session.user.id)
          }} 
        />
      ) : currentPage === 'my-cart' ? (
        <MyCart 
          session={session} 
          onBack={() => {
            setCurrentPage('dashboard')
            fetchCartCount(session.user.id)
          }}
          profileData={profileData}
        />
      ) : currentPage === 'shop-contracts' ? (
        /* Shop Contracts Page */
        <div style={{ padding: '40px 30px', maxWidth: '800px', margin: '0 auto' }}>
          <button 
            onClick={() => setCurrentPage('dashboard')} 
            style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px', marginBottom: '20px' }}
          >
            ← Back to Dashboard
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>🛍️</div>
            <h1 style={{ color: colors.white, margin: '0 0 10px 0' }}>Shop Contracts</h1>
            <p style={{ color: colors.gray, margin: 0 }}>Find contracts & grants matched to your profile</p>
          </div>

          {/* Coming Soon Card */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '40px',
            border: `2px solid ${colors.gold}`,
            textAlign: 'center',
            marginBottom: '25px'
          }}>
            <div style={{
              backgroundColor: colors.gold,
              color: colors.background,
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'inline-block',
              marginBottom: '20px'
            }}>
              COMING SOON
            </div>
            <h2 style={{ color: colors.white, margin: '0 0 15px 0' }}>Auto-Matched Opportunities</h2>
            <p style={{ color: colors.gray, margin: '0 0 20px 0', lineHeight: '1.6' }}>
              Soon, RCA will automatically search SAM.gov, state portals, and grant databases to find opportunities that match your NAICS codes, certifications, and capabilities.
            </p>
            <p style={{ color: colors.gold, margin: 0, fontSize: '14px' }}>
              🚀 Expected: Coming with API integration
            </p>
          </div>

          {/* For Now - Manual Option */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '30px',
            border: `2px solid ${colors.primary}`,
            textAlign: 'center'
          }}>
            <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>Found an opportunity yourself?</h3>
            <p style={{ color: colors.gray, margin: '0 0 20px 0' }}>
              Add it to your cart and let CR-AI help you respond.
            </p>
            <button
              onClick={() => setCurrentPage('my-cart')}
              style={{
                padding: '14px 30px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: colors.primary,
                color: colors.background,
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              🛒 Go to My Cart
            </button>
          </div>
        </div>
      ) : currentPage === 'my-bucket' ? (
        /* My BUCKET Page */
        <MyBucketPage 
          session={session} 
          profileData={profileData}
          onBack={() => setCurrentPage('dashboard')}
          onEditProfile={() => setCurrentPage('business-builder')}
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
              title="Click to view My BUCKET"
            >
              <div style={{ color: profileCompletion >= 80 ? colors.primary : colors.gold, fontSize: '32px', fontWeight: '700' }}>
                🪣 {profileCompletion}%
              </div>
              <div style={{ color: colors.gray, fontSize: '12px' }}>Bucket Built</div>
            </div>
            <div 
              onClick={() => setCurrentPage('my-cart')}
              style={{ textAlign: 'center', cursor: 'pointer' }}
              title="Click to view My Cart"
            >
              <div style={{ color: colors.gold, fontSize: '32px', fontWeight: '700' }}>
                🛒 {cartCount}
              </div>
              <div style={{ color: colors.gray, fontSize: '12px' }}>In Cart</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: colors.white, fontSize: '32px', fontWeight: '700' }}>
                🎯 {submissions}/2
              </div>
              <div style={{ color: colors.gray, fontSize: '12px' }}>Monthly Goal</div>
            </div>
          </div>

          {/* Main Content */}
          <div style={{ padding: '40px 30px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Welcome Message */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ color: colors.white, margin: '0 0 10px 0' }}>
                Welcome to RCA! 👋
              </h2>
              <p style={{ color: colors.gray, margin: 0 }}>
                Your <strong style={{ color: colors.primary }}>Rambo Contract Assistant</strong>. Let's get you contract ready.
              </p>
            </div>

            {/* Three Main Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '25px'
            }}>
              {/* Shop Contracts Card */}
              <div style={{
                backgroundColor: colors.card,
                borderRadius: '16px',
                padding: '30px',
                border: `2px solid ${colors.primary}30`,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => setCurrentPage('shop-contracts')}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = `${colors.primary}30`}
              >
                <div style={{ fontSize: '40px', marginBottom: '15px' }}>🛍️</div>
                <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>Shop Contracts</h3>
                <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                  Find contracts & grants matched to your profile
                </p>
              </div>

              {/* Business Builder Card */}
              <div style={{
                backgroundColor: colors.card,
                borderRadius: '16px',
                padding: '30px',
                border: `2px solid ${colors.primary}`,
                cursor: 'pointer',
                boxShadow: `0 0 20px ${colors.primary}40`,
                position: 'relative'
              }}
              onClick={() => setCurrentPage('business-builder')}
              >
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '20px',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {profileCompletion > 0 ? `${profileCompletion}% BUILT` : 'START HERE'}
                </div>
                <div style={{ fontSize: '40px', marginBottom: '15px' }}>🪣</div>
                <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>Build Your BUCKET</h3>
                <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                  Your business profile — CR-AI pulls from here
                </p>
              </div>

              {/* My Cart Card */}
              <div style={{
                backgroundColor: colors.card,
                borderRadius: '16px',
                padding: '30px',
                border: `2px solid ${colors.primary}30`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative'
              }}
              onClick={() => setCurrentPage('my-cart')}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.primary}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = `${colors.primary}30`}
              >
                {cartCount > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '20px',
                    backgroundColor: colors.gold,
                    color: colors.background,
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {cartCount} IN CART
                  </div>
                )}
                <div style={{ fontSize: '40px', marginBottom: '15px' }}>🛒</div>
                <h3 style={{ color: colors.white, margin: '0 0 10px 0' }}>My Cart</h3>
                <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                  Opportunities you're bidding on (not submitted yet)
                </p>
              </div>
            </div>

            {/* Tip Box */}
            <div style={{
              marginTop: '40px',
              backgroundColor: `${colors.primary}10`,
              borderRadius: '12px',
              padding: '20px',
              border: `1px solid ${colors.primary}30`
            }}>
              <p style={{ color: colors.primary, margin: 0, fontSize: '14px' }}>
                💡 <strong>Tip:</strong> Build your BUCKET in Business Builder, then go shopping for contracts! Add opportunities to your cart and let CR-AI help you respond.
              </p>
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
          Powered by <span style={{ color: colors.primary }}>Contract Ready</span> • CR-AI Technology
        </p>
      </div>
    </div>
  )
}

// ==========================================
// MY BUCKET PAGE COMPONENT
// Shows everything in the user's BUCKET
// ==========================================
function MyBucketPage({ session, profileData, onBack, onEditProfile }) {
  const [savedAnswers, setSavedAnswers] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBucketData()
  }, [])

  const fetchBucketData = async () => {
    try {
      // Fetch saved answers (may not exist yet - that's OK)
      try {
        const { data: answers } = await supabase
          .from('saved_answers')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })

        if (answers) setSavedAnswers(answers)
      } catch (e) {
        // Table might not exist yet - that's fine
        console.log('saved_answers table not ready yet')
      }

      // Fetch completed submissions
      const { data: subs } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })

      if (subs) setSubmissions(subs)
    } catch (err) {
      console.error('Error fetching bucket data:', err)
    } finally {
      setLoading(false)
    }
  }

  const submissionCount = profileData?.submission_count || submissions.length || 0
  const bucketScore = calculateBucketScore(profileData, submissionCount)

  function calculateBucketScore(profile, subCount) {
    if (!profile) return 0
    let score = 0
    const baseMax = 40

    // Foundation
    if (profile.company_name) score += 2
    if (profile.city && profile.state) score += 2
    if (profile.phone && profile.email) score += 2
    if (profile.mission) score += 3
    if (profile.elevator_pitch) score += 2
    if (profile.services?.length > 0) score += 5
    if (profile.naics_codes?.length > 0) score += 5
    if (profile.sam_registered) score += 5
    if (profile.past_performance?.length > 0) score += 3
    if (profile.past_performance?.length >= 3) score += 2
    if (profile.team_members?.length > 0) score += 2
    if (profile.team_members?.length >= 3) score += 1
    if (profile.pricing?.length > 0) score += 1
    if (profile.certifications?.length > 0) score += 1

    // Submission bonus
    score += subCount * 3

    return Math.round((score / baseMax) * 100)
  }

  return (
    <div style={{ padding: '40px 30px', maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
      <button 
        onClick={onBack} 
        style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px', marginBottom: '20px' }}
      >
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ fontSize: '60px', marginBottom: '15px' }}>🪣</div>
        <h1 style={{ color: colors.white, margin: '0 0 10px 0' }}>My BUCKET</h1>
        <p style={{ color: colors.gray, margin: 0 }}>Everything CR-AI knows about your business</p>
      </div>

      {/* Score Card */}
      <div style={{
        backgroundColor: colors.card,
        borderRadius: '16px',
        padding: '25px',
        border: `2px solid ${bucketScore >= 100 ? colors.primary : colors.gold}`,
        textAlign: 'center',
        marginBottom: '25px'
      }}>
        <div style={{ 
          color: bucketScore >= 100 ? colors.primary : colors.gold, 
          fontSize: '48px', 
          fontWeight: '700',
          marginBottom: '10px'
        }}>
          {bucketScore}%
        </div>
        <p style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '16px', fontWeight: '600' }}>
          {bucketScore >= 100 
            ? 'Expert BUCKET — You have a lot to work with!' 
            : bucketScore >= 80 
              ? 'Strong BUCKET — CR-AI can help you win'
              : bucketScore >= 50
                ? 'Growing BUCKET — Keep submitting!'
                : 'Building your foundation'
          }
        </p>
        <p style={{ color: colors.gray, margin: 0, fontSize: '13px' }}>
          {submissionCount} submission{submissionCount !== 1 ? 's' : ''} • {savedAnswers.length} saved answer{savedAnswers.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Company Info */}
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
            Edit in Business Builder →
          </button>
        </div>
        <p style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '18px', fontWeight: '600' }}>
          {profileData?.company_name || 'Your Company Name'}
        </p>
        <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
          {profileData?.city && profileData?.state 
            ? `${profileData.city}, ${profileData.state}` 
            : 'Location not set'
          }
          {profileData?.year_established && ` • ${new Date().getFullYear() - parseInt(profileData.year_established)}+ years`}
        </p>
        {profileData?.sam_registered && (
          <p style={{ color: colors.primary, margin: '8px 0 0 0', fontSize: '12px' }}>✓ SAM.gov Registered</p>
        )}
      </div>

      {/* Experience / Submissions */}
      <div style={{
        backgroundColor: colors.card,
        borderRadius: '12px',
        padding: '20px',
        border: `1px solid ${colors.gray}30`,
        marginBottom: '20px'
      }}>
        <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '12px', fontWeight: '600' }}>
          EXPERIENCE ({submissionCount} submission{submissionCount !== 1 ? 's' : ''})
        </p>
        
        {submissions.length > 0 ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {submissions.slice(0, 5).map((sub, i) => (
              <div key={sub.id} style={{ 
                backgroundColor: colors.background, 
                borderRadius: '8px', 
                padding: '12px',
                border: `1px solid ${colors.gray}20`
              }}>
                <p style={{ color: colors.white, margin: '0 0 4px 0', fontSize: '14px', fontWeight: '500' }}>
                  {sub.title}
                </p>
                <p style={{ color: colors.gray, margin: 0, fontSize: '12px' }}>
                  {sub.agency || 'No agency'} • {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'Submitted'}
                </p>
              </div>
            ))}
            {submissions.length > 5 && (
              <p style={{ color: colors.gold, margin: '10px 0 0 0', fontSize: '13px' }}>
                +{submissions.length - 5} more submissions
              </p>
            )}
          </div>
        ) : (
          <p style={{ color: colors.gray, margin: 0, fontSize: '14px', fontStyle: 'italic' }}>
            No submissions yet. Complete your first submission to grow your BUCKET!
          </p>
        )}
      </div>

      {/* Saved Answers */}
      <div style={{
        backgroundColor: colors.card,
        borderRadius: '12px',
        padding: '20px',
        border: `1px solid ${colors.gray}30`,
        marginBottom: '20px'
      }}>
        <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '12px', fontWeight: '600' }}>
          SAVED ANSWERS ({savedAnswers.length})
        </p>
        
        {savedAnswers.length > 0 ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {savedAnswers.slice(0, 5).map((ans, i) => (
              <div key={ans.id || i} style={{ 
                backgroundColor: colors.background, 
                borderRadius: '8px', 
                padding: '12px',
                border: `1px solid ${colors.gray}20`
              }}>
                <p style={{ color: colors.white, margin: '0 0 4px 0', fontSize: '13px', fontWeight: '500' }}>
                  {ans.question_text?.substring(0, 60)}...
                </p>
                <p style={{ color: colors.gray, margin: 0, fontSize: '11px' }}>
                  From: {ans.source_contract_title || 'Unknown'} • {ans.answer_text?.length || 0} chars
                </p>
              </div>
            ))}
            {savedAnswers.length > 5 && (
              <p style={{ color: colors.gold, margin: '10px 0 0 0', fontSize: '13px' }}>
                +{savedAnswers.length - 5} more saved answers
              </p>
            )}
          </div>
        ) : (
          <p style={{ color: colors.gray, margin: 0, fontSize: '14px', fontStyle: 'italic' }}>
            Answers you save get stored here for reuse. Submit a contract and choose "Put into my BUCKET" to start building your library.
          </p>
        )}
      </div>

      {/* Services */}
      {profileData?.services?.length > 0 && (
        <div style={{
          backgroundColor: colors.card,
          borderRadius: '12px',
          padding: '20px',
          border: `1px solid ${colors.gray}30`,
          marginBottom: '20px'
        }}>
          <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '12px', fontWeight: '600' }}>
            SERVICES ({profileData.services.length})
          </p>
          <div style={{ display: 'grid', gap: '10px' }}>
            {profileData.services.map((service, i) => (
              <div key={i} style={{
                backgroundColor: colors.background,
                borderRadius: '8px',
                padding: '12px',
                border: `1px solid ${colors.gray}20`
              }}>
                <p style={{ color: colors.primary, margin: '0 0 4px 0', fontSize: '13px', fontWeight: '600' }}>
                  {service.category || 'Service'}
                </p>
                <p style={{ color: colors.gray, margin: 0, fontSize: '12px' }}>
                  {service.description?.substring(0, 100) || 'No description'}
                  {service.description?.length > 100 ? '...' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NAICS Codes */}
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
                backgroundColor: naics.isPrimary ? `${colors.primary}20` : `${colors.gray}20`,
                color: naics.isPrimary ? colors.primary : colors.white,
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                border: naics.isPrimary ? `1px solid ${colors.primary}` : 'none'
              }}>
                {naics.isPrimary && '⭐ '}{naics.code} - {naics.description}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
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
                fontSize: '12px',
                border: `1px solid ${colors.gold}50`
              }}>
                ✓ {cert.name || cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Team */}
      {profileData?.team_members?.length > 0 && (
        <div style={{
          backgroundColor: colors.card,
          borderRadius: '12px',
          padding: '20px',
          border: `1px solid ${colors.gray}30`,
          marginBottom: '20px'
        }}>
          <p style={{ color: colors.gray, margin: '0 0 15px 0', fontSize: '12px', fontWeight: '600' }}>
            TEAM ({profileData.team_members.length})
          </p>
          <div style={{ display: 'grid', gap: '8px' }}>
            {profileData.team_members.slice(0, 5).map((member, i) => (
              <p key={i} style={{ color: colors.white, margin: 0, fontSize: '14px' }}>
                {member.name || 'Team Member'} {member.title && `— ${member.title}`}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Empty State - if nothing in profile */}
      {!profileData?.company_name && !profileData?.services?.length && (
        <div style={{
          backgroundColor: colors.card,
          borderRadius: '12px',
          padding: '40px',
          border: `2px dashed ${colors.gold}`,
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <p style={{ color: colors.white, margin: '0 0 15px 0', fontSize: '18px', fontWeight: '600' }}>
            Your BUCKET is empty!
          </p>
          <p style={{ color: colors.gray, margin: '0 0 20px 0', fontSize: '14px' }}>
            Start filling your BUCKET in the Business Builder so CR-AI can help you win contracts.
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
            Start Building →
          </button>
        </div>
      )}

      {/* Tip */}
      <div style={{
        backgroundColor: `${colors.gold}15`,
        borderRadius: '10px',
        padding: '15px',
        border: `1px solid ${colors.gold}30`
      }}>
        <p style={{ color: colors.white, margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
          💡 <strong>Your BUCKET grows with every submission.</strong> The more you submit, the smarter CR-AI gets about your business. Keep going!
        </p>
      </div>
    </div>
  )
}

export default App
