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

const sections = [
  {
    id: 1,
    title: 'Company Basics',
    icon: '🏢',
    description: 'Legal name, DBA, address, contact info',
    fields: ['company_name', 'dba', 'address', 'city', 'state', 'zip', 'phone', 'email', 'website', 'entity_type', 'is_nonprofit', 'team_size', 'year_established', 'revenue_range']
  },
  {
    id: 2,
    title: 'Mission, Vision & Elevator Pitch',
    icon: '🎯',
    description: 'Your company story and value proposition',
    fields: ['mission', 'vision', 'elevator_pitch']
  },
  {
    id: 3,
    title: 'Services',
    icon: '⚙️',
    description: 'What you offer (up to 10 services)',
    fields: ['services']
  },
  {
    id: 4,
    title: 'NAICS Codes',
    icon: '🔢',
    description: 'Industry classification codes (up to 10)',
    fields: ['naics_codes']
  },
  {
    id: 5,
    title: 'Certifications',
    icon: '📜',
    description: 'MBE, WBE, DVBE, SBE, 8(a), HUBZone, etc.',
    fields: ['certifications']
  },
  {
    id: 6,
    title: 'SAM.gov Registration',
    icon: '✅',
    description: 'Federal registration status, UEI, CAGE code',
    fields: ['sam_registered', 'uei_number', 'cage_code']
  },
  {
    id: 7,
    title: 'Pricing Snapshot',
    icon: '💰',
    description: 'Hourly rates by role',
    fields: ['hourly_rates']
  },
  {
    id: 8,
    title: 'Past Performance',
    icon: '📊',
    description: 'Previous contracts and projects (up to 5)',
    fields: ['past_performance']
  },
  {
    id: 9,
    title: 'Team',
    icon: '👥',
    description: 'Key personnel and their qualifications',
    fields: ['team_members']
  },
  {
    id: 10,
    title: 'Documents',
    icon: '📁',
    description: 'Capability statement, W-9, resumes, certifications',
    fields: ['documents']
  },
]

function BusinessBuilder({ session, onBack }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState(null)
  const [saving, setSaving] = useState(false)
  const [completionPercentage, setCompletionPercentage] = useState(0)

  // Form states for Company Basics
  const [companyName, setCompanyName] = useState('')
  const [dba, setDba] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [entityType, setEntityType] = useState('')
  const [isNonprofit, setIsNonprofit] = useState(false)
  const [teamSize, setTeamSize] = useState('')
  const [yearEstablished, setYearEstablished] = useState('')
  const [revenueRange, setRevenueRange] = useState('')

  // Form states for Mission/Vision/Pitch
  const [mission, setMission] = useState('')
  const [vision, setVision] = useState('')
  const [elevatorPitch, setElevatorPitch] = useState('')

  // Form states for SAM.gov
  const [samRegistered, setSamRegistered] = useState(false)
  const [ueiNumber, setUeiNumber] = useState('')
  const [cageCode, setCageCode] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [session])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error)
      }

      if (data) {
        setProfile(data)
        // Populate form fields
        setCompanyName(data.company_name || '')
        setDba(data.dba || '')
        setAddress(data.address || '')
        setCity(data.city || '')
        setState(data.state || '')
        setZip(data.zip || '')
        setPhone(data.phone || '')
        setEmail(data.email || '')
        setWebsite(data.website || '')
        setEntityType(data.entity_type || '')
        setIsNonprofit(data.is_nonprofit || false)
        setTeamSize(data.team_size || '')
        setYearEstablished(data.year_established || '')
        setRevenueRange(data.revenue_range || '')
        setMission(data.mission || '')
        setVision(data.vision || '')
        setElevatorPitch(data.elevator_pitch || '')
        setSamRegistered(data.sam_registered || false)
        setUeiNumber(data.uei_number || '')
        setCageCode(data.cage_code || '')
        setCompletionPercentage(data.completion_percentage || 0)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateCompletion = () => {
    let filled = 0
    let total = 14 // Total key fields we're tracking

    if (companyName) filled++
    if (address) filled++
    if (city) filled++
    if (state) filled++
    if (phone) filled++
    if (email) filled++
    if (entityType) filled++
    if (mission) filled++
    if (vision) filled++
    if (elevatorPitch) filled++
    if (samRegistered || ueiNumber) filled++
    if (teamSize) filled++
    if (yearEstablished) filled++
    if (revenueRange) filled++

    return Math.round((filled / total) * 100)
  }

  const saveProfile = async () => {
    setSaving(true)
    const completion = calculateCompletion()

    const profileData = {
      user_id: session.user.id,
      company_name: companyName,
      dba: dba,
      address: address,
      city: city,
      state: state,
      zip: zip,
      phone: phone,
      email: email,
      website: website,
      entity_type: entityType,
      is_nonprofit: isNonprofit,
      team_size: teamSize,
      year_established: yearEstablished,
      revenue_range: revenueRange,
      mission: mission,
      vision: vision,
      elevator_pitch: elevatorPitch,
      sam_registered: samRegistered,
      uei_number: ueiNumber,
      cage_code: cageCode,
      completion_percentage: completion,
    }

    try {
      if (profile) {
        // Update existing
        const { error } = await supabase
          .from('business_profiles')
          .update(profileData)
          .eq('id', profile.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('business_profiles')
          .insert(profileData)

        if (error) throw error
      }

      setCompletionPercentage(completion)
      setActiveSection(null)
      fetchProfile()
    } catch (err) {
      console.error('Error saving:', err)
      alert('Error saving profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const getSectionCompletion = (sectionId) => {
    if (!profile) return 0
    
    switch(sectionId) {
      case 1: // Company Basics
        let basics = 0
        if (profile.company_name) basics += 20
        if (profile.address && profile.city && profile.state) basics += 20
        if (profile.phone) basics += 20
        if (profile.email) basics += 20
        if (profile.entity_type) basics += 20
        return basics
      case 2: // Mission/Vision/Pitch
        let mvp = 0
        if (profile.mission) mvp += 33
        if (profile.vision) mvp += 33
        if (profile.elevator_pitch) mvp += 34
        return mvp
      case 6: // SAM.gov
        if (profile.sam_registered && profile.uei_number) return 100
        if (profile.sam_registered || profile.uei_number) return 50
        return 0
      default:
        return 0
    }
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

  // Render Section Form
  const renderSectionForm = () => {
    switch(activeSection) {
      case 1:
        return (
          <div style={{ display: 'grid', gap: '20px' }}>
            <h3 style={{ color: colors.white, margin: 0 }}>Company Basics</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Legal Company Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Enter legal company name"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>DBA (Doing Business As)</label>
                <input
                  type="text"
                  value={dba}
                  onChange={(e) => setDba(e.target.value)}
                  placeholder="Enter DBA if different"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Street Address *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter street address"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>City *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>State *</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="CA"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>ZIP Code</label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="90001"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Phone *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://www.yourcompany.com"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Entity Type *</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select entity type</option>
                  <option value="sole_proprietorship">Sole Proprietorship</option>
                  <option value="llc">LLC</option>
                  <option value="corporation">Corporation</option>
                  <option value="partnership">Partnership</option>
                  <option value="nonprofit">Nonprofit</option>
                </select>
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Nonprofit or For-Profit?</label>
                <select
                  value={isNonprofit ? 'nonprofit' : 'forprofit'}
                  onChange={(e) => setIsNonprofit(e.target.value === 'nonprofit')}
                  style={inputStyle}
                >
                  <option value="forprofit">For-Profit</option>
                  <option value="nonprofit">Nonprofit</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Team Size</label>
                <select
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select size</option>
                  <option value="1">Just me</option>
                  <option value="2-5">2-5 employees</option>
                  <option value="6-10">6-10 employees</option>
                  <option value="11-25">11-25 employees</option>
                  <option value="26-50">26-50 employees</option>
                  <option value="50+">50+ employees</option>
                </select>
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Year Established</label>
                <input
                  type="text"
                  value={yearEstablished}
                  onChange={(e) => setYearEstablished(e.target.value)}
                  placeholder="2015"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Annual Revenue</label>
                <select
                  value={revenueRange}
                  onChange={(e) => setRevenueRange(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select range</option>
                  <option value="0-100k">$0 - $100K</option>
                  <option value="100k-500k">$100K - $500K</option>
                  <option value="500k-1m">$500K - $1M</option>
                  <option value="1m-5m">$1M - $5M</option>
                  <option value="5m+">$5M+</option>
                </select>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div style={{ display: 'grid', gap: '20px' }}>
            <h3 style={{ color: colors.white, margin: 0 }}>Mission, Vision & Elevator Pitch</h3>
            
            <div>
              <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                Mission Statement *
                <span style={{ color: colors.gray, fontSize: '12px', marginLeft: '10px' }}>Why does your company exist?</span>
              </label>
              <textarea
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="Our mission is to..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                Vision Statement *
                <span style={{ color: colors.gray, fontSize: '12px', marginLeft: '10px' }}>Where is your company going?</span>
              </label>
              <textarea
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                placeholder="Our vision is to..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                Elevator Pitch *
                <span style={{ color: colors.gray, fontSize: '12px', marginLeft: '10px' }}>30-second company description</span>
              </label>
              <textarea
                value={elevatorPitch}
                onChange={(e) => setElevatorPitch(e.target.value)}
                placeholder="We help [target audience] achieve [outcome] by [what you do]..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>
        )

      case 6:
        return (
          <div style={{ display: 'grid', gap: '20px' }}>
            <h3 style={{ color: colors.white, margin: 0 }}>SAM.gov Registration</h3>
            
            <div>
              <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '10px' }}>
                Are you registered on SAM.gov? *
              </label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <button
                  onClick={() => setSamRegistered(true)}
                  style={{
                    padding: '12px 30px',
                    borderRadius: '8px',
                    border: `2px solid ${samRegistered ? colors.primary : colors.gray}`,
                    backgroundColor: samRegistered ? `${colors.primary}20` : 'transparent',
                    color: samRegistered ? colors.primary : colors.white,
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ✅ Yes
                </button>
                <button
                  onClick={() => setSamRegistered(false)}
                  style={{
                    padding: '12px 30px',
                    borderRadius: '8px',
                    border: `2px solid ${!samRegistered ? colors.primary : colors.gray}`,
                    backgroundColor: !samRegistered ? `${colors.primary}20` : 'transparent',
                    color: !samRegistered ? colors.primary : colors.white,
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ❌ No
                </button>
              </div>
            </div>

            {samRegistered && (
              <>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                    UEI Number (Unique Entity ID)
                  </label>
                  <input
                    type="text"
                    value={ueiNumber}
                    onChange={(e) => setUeiNumber(e.target.value)}
                    placeholder="Enter your 12-character UEI"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                    CAGE Code
                  </label>
                  <input
                    type="text"
                    value={cageCode}
                    onChange={(e) => setCageCode(e.target.value)}
                    placeholder="Enter your 5-character CAGE code"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            {!samRegistered && (
              <div style={{
                backgroundColor: `${colors.gold}20`,
                borderRadius: '8px',
                padding: '15px',
                border: `1px solid ${colors.gold}30`
              }}>
                <p style={{ color: colors.gold, margin: 0, fontSize: '14px' }}>
                  💡 <strong>Tip:</strong> SAM.gov registration is required for federal contracts. 
                  Visit <a href="https://sam.gov" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>sam.gov</a> to register for free.
                </p>
              </div>
            )}
          </div>
        )

      default:
        return (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: colors.gray, fontSize: '18px' }}>
              🚧 This section is coming soon!
            </p>
            <p style={{ color: colors.gray, fontSize: '14px', marginTop: '10px' }}>
              We're building out the {sections.find(s => s.id === activeSection)?.title} section.
            </p>
          </div>
        )
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: `1px solid ${colors.gray}`,
    backgroundColor: '#1a1a1a',
    color: colors.white,
    fontSize: '16px',
    boxSizing: 'border-box'
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: colors.card,
        padding: '20px 30px',
        borderBottom: `1px solid ${colors.primary}30`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: colors.gray,
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            ← Back
          </button>
          <h1 style={{ color: colors.white, margin: 0, fontSize: '24px' }}>
            🏗️ Business Builder
          </h1>
        </div>

        {/* Completion Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{
            backgroundColor: completionPercentage >= 90 ? `${colors.primary}20` : `${colors.gold}20`,
            padding: '8px 16px',
            borderRadius: '20px',
            border: `1px solid ${completionPercentage >= 90 ? colors.primary : colors.gold}`
          }}>
            <span style={{ 
              color: completionPercentage >= 90 ? colors.primary : colors.gold, 
              fontWeight: '600' 
            }}>
              {completionPercentage}% Complete
            </span>
          </div>
          {completionPercentage >= 90 && (
            <span style={{ fontSize: '24px' }}>🏆</span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
        {activeSection ? (
          /* Section Form */
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '30px',
            border: `1px solid ${colors.primary}30`
          }}>
            {renderSectionForm()}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '30px',
              paddingTop: '20px',
              borderTop: `1px solid ${colors.gray}30`
            }}>
              <button
                onClick={() => setActiveSection(null)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.gray}`,
                  backgroundColor: 'transparent',
                  color: colors.white,
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                style={{
                  padding: '12px 30px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </div>
        ) : (
          /* Section Cards */
          <div style={{ display: 'grid', gap: '15px' }}>
            {sections.map((section) => {
              const completion = getSectionCompletion(section.id)
              return (
                <div
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: '12px',
                    padding: '20px',
                    border: `1px solid ${completion === 100 ? colors.primary : colors.gray}30`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.primary
                    e.currentTarget.style.transform = 'translateX(5px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${completion === 100 ? colors.primary : colors.gray}30`
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '28px' }}>{section.icon}</span>
                    <div>
                      <h3 style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '18px' }}>
                        {section.title}
                      </h3>
                      <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                        {section.description}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {completion === 100 ? (
                      <span style={{ color: colors.primary, fontSize: '20px' }}>✓</span>
                    ) : completion > 0 ? (
                      <span style={{ color: colors.gold, fontSize: '14px' }}>{completion}%</span>
                    ) : null}
                    <span style={{ color: colors.gray, fontSize: '20px' }}>→</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Help Box */}
        {!activeSection && (
          <div style={{
            marginTop: '30px',
            backgroundColor: `${colors.primary}10`,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${colors.primary}30`
          }}>
            <p style={{ color: colors.primary, margin: 0, fontSize: '14px' }}>
              💡 <strong>Tip:</strong> Complete at least 90% of your profile to unlock the profile badge and get better contract matches!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default BusinessBuilder
