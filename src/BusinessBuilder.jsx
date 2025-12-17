import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { generateMission, generateVision, generateElevatorPitch, improveTex } from './craiHelper'

const colors = {
  primary: '#00FF00',
  gold: '#FFD700',
  background: '#000000',
  card: '#0A1F0A',
  white: '#FFFFFF',
  gray: '#888888',
}

const getApiKey = () => {
  return localStorage.getItem('anthropic_api_key') || ''
}

const industryCategories = [
  'Healthcare & Social Services',
  'Professional Services',
  'Architecture & Engineering',
  'Construction & Trades',
  'IT & Technology',
  'Marketing, Media & Communications',
  'Training & Education',
  'Transportation & Logistics',
  'Facilities & Maintenance',
  'Landscaping & Environmental',
  'Food & Catering',
  'Event Services & Venues',
  'Apparel & Supplies',
  'Community & Nonprofit Services',
  'Real Estate & Property Management',
  'Beauty & Barber',
  'Staffing & Employment',
  'Other'
]

const sections = [
  { id: 1, title: 'Company Basics', icon: '🏢', description: 'Legal name, DBA, address, contact info' },
  { id: 2, title: 'Mission, Vision & Elevator Pitch', icon: '🎯', description: 'Your company story and value proposition' },
  { id: 3, title: 'Services', icon: '⚙️', description: 'What you offer (up to 10 services)' },
  { id: 4, title: 'NAICS Codes', icon: '🔢', description: 'Industry classification codes (up to 10)' },
  { id: 5, title: 'Certifications', icon: '📜', description: 'MBE, WBE, DVBE, SBE, 8(a), HUBZone, etc.' },
  { id: 6, title: 'SAM.gov Registration', icon: '✅', description: 'Federal registration status, UEI, CAGE code' },
  { id: 7, title: 'Pricing Snapshot', icon: '💰', description: 'Hourly rates by role' },
  { id: 8, title: 'Past Performance', icon: '📊', description: 'Previous contracts and projects (up to 5)' },
  { id: 9, title: 'Team Builder', icon: '👥', description: 'Employees, contractors, vendors — grows as you submit' },
  { id: 10, title: 'Generate Capability Statement', icon: '📄', description: 'Create a professional capability statement from your BUCKET' },
]

function BusinessBuilder({ session, onBack }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState(null)
  const [saving, setSaving] = useState(false)
  const [completionPercentage, setCompletionPercentage] = useState(0)
  const [aiLoading, setAiLoading] = useState({})
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [tempApiKey, setTempApiKey] = useState('')

  // Company Basics
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

  // Mission/Vision/Pitch
  const [mission, setMission] = useState('')
  const [vision, setVision] = useState('')
  const [elevatorPitch, setElevatorPitch] = useState('')
  
  // Extra context questions for CR-AI
  const [whatMakesYouDifferent, setWhatMakesYouDifferent] = useState('')
  const [resultsAchieved, setResultsAchieved] = useState('')
  const [anythingElse, setAnythingElse] = useState('')

  // Services
  const [services, setServices] = useState([])

  // Past Performance
  const [pastPerformance, setPastPerformance] = useState([])

  // NAICS Codes
  const [naicsCodes, setNaicsCodes] = useState([])

  // Certifications
  const [certifications, setCertifications] = useState([])

  // Pricing
  const [pricing, setPricing] = useState([])

  // Team
  const [teamMembers, setTeamMembers] = useState([])

  // SAM.gov
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
        setWhatMakesYouDifferent(data.what_makes_you_different || '')
        setResultsAchieved(data.results_achieved || '')
        setAnythingElse(data.anything_else || '')
        setServices(data.services || [])
        setPastPerformance(data.past_performance || [])
        setNaicsCodes(data.naics_codes || [])
        setCertifications(data.certifications || [])
        setPricing(data.pricing || [])
        setTeamMembers(data.team_members || [])
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateCompletion = () => {
    let filled = 0
    let total = 26

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
    if (services.length > 0) filled += 2
    if (pastPerformance.length > 0) filled += 2
    if (naicsCodes.length > 0) filled += 2
    if (certifications.length > 0) filled += 2
    if (pricing.length > 0) filled += 2
    if (teamMembers.length > 0) filled += 2

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
      what_makes_you_different: whatMakesYouDifferent,
      results_achieved: resultsAchieved,
      anything_else: anythingElse,
      services: services,
      past_performance: pastPerformance,
      naics_codes: naicsCodes,
      certifications: certifications,
      pricing: pricing,
      team_members: teamMembers,
    }

    try {
      if (profile) {
        const { error } = await supabase
          .from('business_profiles')
          .update(profileData)
          .eq('id', profile.id)
        if (error) throw error
      } else {
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

  // Build full context from all data
  const buildFullContext = () => {
    return `
COMPANY INFORMATION:
- Company Name: ${companyName || 'Not provided'}
- DBA: ${dba || 'Same as company name'}
- Location: ${city || 'Not provided'}, ${state || ''}
- Year Established: ${yearEstablished || 'Not provided'}
- Entity Type: ${entityType || 'Not provided'}
- Team Size: ${teamSize || 'Not provided'}
- Annual Revenue: ${revenueRange || 'Not provided'}
- Nonprofit: ${isNonprofit ? 'Yes' : 'No'}

WHAT MAKES THEM DIFFERENT:
${whatMakesYouDifferent || 'Not provided yet'}

RESULTS/IMPACT ACHIEVED:
${resultsAchieved || 'Not provided yet'}

ADDITIONAL CONTEXT:
${anythingElse || 'None provided'}

EXISTING MISSION (if any): ${mission || 'None yet'}
EXISTING VISION (if any): ${vision || 'None yet'}
    `.trim()
  }

  const handleAIGenerate = async (type) => {
    const apiKey = getApiKey()
    if (!apiKey) {
      setShowApiKeyModal(true)
      return
    }

    if (!companyName) {
      alert('Please fill out Company Basics first so CR-AI has information to work with.')
      return
    }

    setAiLoading({ ...aiLoading, [type]: true })

    try {
      const fullContext = buildFullContext()
      let result = ''
      let prompt = ''

      if (type === 'mission') {
        prompt = `Write a compelling 2-3 sentence mission statement for "${companyName}".

Use this context to make it specific and authentic:
${fullContext}

The mission should:
- Explain WHY the company exists
- Mention WHO they serve
- Highlight what makes them unique
- Use language that appeals to government contract evaluators

Return ONLY the mission statement, no explanations.`
      } else if (type === 'vision') {
        prompt = `Write an inspiring 2-3 sentence vision statement for "${companyName}".

Use this context:
${fullContext}

The vision should:
- Describe WHERE the company is heading
- Be ambitious but believable
- Align with government/community impact goals

Return ONLY the vision statement, no explanations.`
      } else if (type === 'pitch') {
        prompt = `Write a powerful 30-second elevator pitch for "${companyName}".

Use this context:
${fullContext}

Format: "We help [specific audience] achieve [specific outcome] by [unique approach]. [Proof point or result]."

Make it:
- Memorable and specific
- Include a concrete result if provided
- Sound professional for government audiences

Return ONLY the elevator pitch (2 sentences max, under 40 words), no explanations.`
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)
      
      const data = await response.json()
      result = data.content[0].text

      if (type === 'mission') setMission(result)
      else if (type === 'vision') setVision(result)
      else if (type === 'pitch') setElevatorPitch(result)

    } catch (err) {
      console.error('AI Error:', err)
      alert('Error generating. Please check your API key and try again.')
    } finally {
      setAiLoading({ ...aiLoading, [type]: false })
    }
  }

  const handleAIImprove = async (type) => {
    const apiKey = getApiKey()
    if (!apiKey) {
      setShowApiKeyModal(true)
      return
    }

    let currentText = ''
    if (type === 'mission') currentText = mission
    else if (type === 'vision') currentText = vision
    else if (type === 'pitch') currentText = elevatorPitch

    if (!currentText.trim()) {
      alert('Please write something first, then click Improve.')
      return
    }

    setAiLoading({ ...aiLoading, [type]: true })

    try {
      const prompt = `Improve this ${type} statement for a government contractor. Make it more professional, compelling, and concise while keeping the core message:

"${currentText}"

Context about the company:
${buildFullContext()}

Return ONLY the improved text, no explanations.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)
      
      const data = await response.json()
      const result = data.content[0].text

      if (type === 'mission') setMission(result)
      else if (type === 'vision') setVision(result)
      else if (type === 'pitch') setElevatorPitch(result)

    } catch (err) {
      console.error('AI Error:', err)
      alert('Error improving text. Please try again.')
    } finally {
      setAiLoading({ ...aiLoading, [type]: false })
    }
  }

  // Services functions
  const addService = () => {
    if (services.length >= 10) {
      alert('Maximum 10 service areas allowed')
      return
    }
    setServices([...services, { category: '', description: '' }])
  }

  const removeService = (index) => {
    setServices(services.filter((_, i) => i !== index))
  }

  const updateService = (index, field, value) => {
    const updated = [...services]
    updated[index][field] = value
    setServices(updated)
  }

  const generateServiceDescription = async (index) => {
    const apiKey = getApiKey()
    if (!apiKey) {
      setShowApiKeyModal(true)
      return
    }

    const service = services[index]
    if (!service.category) {
      alert('Please select a category first.')
      return
    }

    setAiLoading({ ...aiLoading, [`service_${index}`]: true })

    try {
      const prompt = `Write a professional 2-3 sentence description for this service offered by a government contractor:

Industry Category: ${service.category}
Company: ${companyName || 'Not specified'}

Company Context:
${buildFullContext()}

The description should:
- Explain what services they likely provide in this category
- Highlight benefits to government/public sector clients
- Sound professional for RFP responses
- Be specific, not generic

Return ONLY the service description, no explanations.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)
      
      const data = await response.json()
      updateService(index, 'description', data.content[0].text)

    } catch (err) {
      console.error('AI Error:', err)
      alert('Error generating description. Please try again.')
    } finally {
      setAiLoading({ ...aiLoading, [`service_${index}`]: false })
    }
  }

  // Past Performance functions
  const addPastPerformance = () => {
    if (pastPerformance.length >= 5) {
      alert('Maximum 5 past performance entries allowed')
      return
    }
    setPastPerformance([...pastPerformance, { 
      clientName: '', 
      projectName: '', 
      contractValue: '', 
      startYear: '', 
      endYear: '', 
      description: '', 
      results: '',
      referenceName: '',
      referenceTitle: '',
      referenceContact: ''
    }])
  }

  const removePastPerformance = (index) => {
    setPastPerformance(pastPerformance.filter((_, i) => i !== index))
  }

  const updatePastPerformance = (index, field, value) => {
    const updated = [...pastPerformance]
    updated[index][field] = value
    setPastPerformance(updated)
  }

  // NAICS Code functions
  const addNaicsCode = () => {
    if (naicsCodes.length >= 10) {
      alert('Maximum 10 NAICS codes allowed')
      return
    }
    setNaicsCodes([...naicsCodes, { code: '', description: '', isPrimary: naicsCodes.length === 0 }])
  }

  const removeNaicsCode = (index) => {
    const updated = naicsCodes.filter((_, i) => i !== index)
    // If we removed the primary, make the first one primary
    if (updated.length > 0 && !updated.some(n => n.isPrimary)) {
      updated[0].isPrimary = true
    }
    setNaicsCodes(updated)
  }

  const updateNaicsCode = (index, field, value) => {
    const updated = [...naicsCodes]
    if (field === 'isPrimary' && value === true) {
      // Only one can be primary
      updated.forEach((n, i) => n.isPrimary = i === index)
    } else {
      updated[index][field] = value
    }
    setNaicsCodes(updated)
  }

  // Pricing functions
  const addPricingRole = () => {
    if (pricing.length >= 15) {
      alert('Maximum 15 roles allowed')
      return
    }
    setPricing([...pricing, { role: '', hourlyRate: '', description: '' }])
  }

  const removePricingRole = (index) => {
    setPricing(pricing.filter((_, i) => i !== index))
  }

  const updatePricingRole = (index, field, value) => {
    const updated = [...pricing]
    updated[index][field] = value
    setPricing(updated)
  }

  // Team functions
  const addTeamMember = () => {
    if (teamMembers.length >= 10) {
      alert('Maximum 10 team members allowed')
      return
    }
    setTeamMembers([...teamMembers, { 
      name: '', 
      role: '', 
      type: '',
      yearsExperience: '', 
      hourlyRate: '',
      qualifications: '',
      bio: ''
    }])
  }

  const removeTeamMember = (index) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index))
  }

  const updateTeamMember = (index, field, value) => {
    const updated = [...teamMembers]
    updated[index][field] = value
    setTeamMembers(updated)
  }

  const saveApiKey = () => {
    localStorage.setItem('anthropic_api_key', tempApiKey)
    setShowApiKeyModal(false)
    setTempApiKey('')
  }

  const getSectionCompletion = (sectionId) => {
    if (!profile) return 0
    switch (sectionId) {
      case 1:
        let basics = 0
        if (profile.company_name) basics += 20
        if (profile.address && profile.city && profile.state) basics += 20
        if (profile.phone) basics += 20
        if (profile.email) basics += 20
        if (profile.entity_type) basics += 20
        return basics
      case 2:
        let mvp = 0
        if (profile.mission) mvp += 33
        if (profile.vision) mvp += 33
        if (profile.elevator_pitch) mvp += 34
        return mvp
      case 3:
        if (profile.services && profile.services.length > 0) {
          return Math.min(100, profile.services.length * 20)
        }
        return 0
      case 4:
        if (profile.naics_codes && profile.naics_codes.length > 0) {
          return Math.min(100, profile.naics_codes.length * 20)
        }
        return 0
      case 5:
        if (profile.certifications && profile.certifications.length > 0) {
          return 100
        }
        return 0
      case 7:
        if (profile.pricing && profile.pricing.length > 0) {
          return Math.min(100, profile.pricing.length * 20)
        }
        return 0
      case 9:
        if (profile.team_members && profile.team_members.length > 0) {
          return Math.min(100, profile.team_members.length * 20)
        }
        return 0
      case 8:
        if (profile.past_performance && profile.past_performance.length > 0) {
          return Math.min(100, profile.past_performance.length * 20)
        }
        return 0
      case 6:
        if (profile.sam_registered && profile.uei_number) return 100
        if (profile.sam_registered || profile.uei_number) return 50
        return 0
      default:
        return 0
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

  const aiButtonStyle = {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: colors.primary, fontSize: '24px' }}>Loading...</div>
      </div>
    )
  }

  const renderSectionForm = () => {
    switch (activeSection) {
      case 1:
        return (
          <div style={{ display: 'grid', gap: '20px' }}>
            <h3 style={{ color: colors.white, margin: 0 }}>Company Basics</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Legal Company Name *</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Enter legal company name" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>DBA (Doing Business As)</label>
                <input type="text" value={dba} onChange={(e) => setDba(e.target.value)} placeholder="Enter DBA if different" style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Street Address *</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter street address" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>City *</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>State *</label>
                <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="CA" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>ZIP Code</label>
                <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="90001" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Phone *</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@company.com" style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Website</label>
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://www.yourcompany.com" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Entity Type *</label>
                <select value={entityType} onChange={(e) => setEntityType(e.target.value)} style={inputStyle}>
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
                <select value={isNonprofit ? 'nonprofit' : 'forprofit'} onChange={(e) => setIsNonprofit(e.target.value === 'nonprofit')} style={inputStyle}>
                  <option value="forprofit">For-Profit</option>
                  <option value="nonprofit">Nonprofit</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Team Size</label>
                <select value={teamSize} onChange={(e) => setTeamSize(e.target.value)} style={inputStyle}>
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
                <input type="text" value={yearEstablished} onChange={(e) => setYearEstablished(e.target.value)} placeholder="2015" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>Annual Revenue</label>
                <select value={revenueRange} onChange={(e) => setRevenueRange(e.target.value)} style={inputStyle}>
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
          <div style={{ display: 'grid', gap: '25px' }}>
            <h3 style={{ color: colors.white, margin: 0 }}>Mission, Vision & Elevator Pitch</h3>

            {/* Show data being pulled from BUCKET */}
            {companyName && (
              <div style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${colors.primary}30`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                  <span style={{ fontSize: '20px' }}>🪣</span>
                  <span style={{ color: colors.primary, fontWeight: '600', fontSize: '14px' }}>
                    CR-AI is pulling from your BUCKET:
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ color: colors.gray, fontSize: '13px' }}>
                    <strong style={{ color: colors.white }}>Company:</strong> {companyName}
                  </div>
                  <div style={{ color: colors.gray, fontSize: '13px' }}>
                    <strong style={{ color: colors.white }}>Location:</strong> {city}, {state}
                  </div>
                  <div style={{ color: colors.gray, fontSize: '13px' }}>
                    <strong style={{ color: colors.white }}>Established:</strong> {yearEstablished || 'Not set'}
                  </div>
                  <div style={{ color: colors.gray, fontSize: '13px' }}>
                    <strong style={{ color: colors.white }}>Type:</strong> {entityType || 'Not set'}
                  </div>
                </div>
              </div>
            )}

            {/* Extra questions for CR-AI */}
            <div style={{
              backgroundColor: `${colors.gold}10`,
              borderRadius: '12px',
              padding: '20px',
              border: `1px solid ${colors.gold}30`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <span style={{ fontSize: '20px' }}>✨</span>
                <span style={{ color: colors.gold, fontWeight: '600', fontSize: '14px' }}>
                  Add to your BUCKET — CR-AI uses this to write better content:
                </span>
              </div>

              <div style={{ display: 'grid', gap: '15px' }}>
                <div>
                  <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                    🌟 What makes you different from competitors?
                  </label>
                  <textarea
                    value={whatMakesYouDifferent}
                    onChange={(e) => setWhatMakesYouDifferent(e.target.value)}
                    placeholder="Example: We're the only company that combines mental health services with entertainment events..."
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
                  />
                </div>

                <div>
                  <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                    📊 What results or impact have you achieved?
                  </label>
                  <textarea
                    value={resultsAchieved}
                    onChange={(e) => setResultsAchieved(e.target.value)}
                    placeholder="Example: Served 50,000 students, operated 25 mobile health units, 15 years in LA County..."
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
                  />
                </div>

                <div>
                  <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                    💬 Anything else CR-AI should know? (optional)
                  </label>
                  <textarea
                    value={anythingElse}
                    onChange={(e) => setAnythingElse(e.target.value)}
                    placeholder="Example: We focus on underserved communities, specialize in youth programs..."
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
                  />
                </div>
              </div>
            </div>

            {/* Mission */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ color: colors.gray, fontSize: '14px' }}>
                  Mission Statement *
                  <span style={{ fontSize: '12px', marginLeft: '10px' }}>Why does your company exist?</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleAIGenerate('mission')}
                    disabled={aiLoading.mission}
                    style={{ ...aiButtonStyle, backgroundColor: colors.primary, color: colors.background }}
                  >
                    {aiLoading.mission ? '⏳ Generating...' : '✨ Generate with CR-AI'}
                  </button>
                  {mission && (
                    <button
                      onClick={() => handleAIImprove('mission')}
                      disabled={aiLoading.mission}
                      style={{ ...aiButtonStyle, backgroundColor: colors.gold, color: colors.background }}
                    >
                      {aiLoading.mission ? '⏳' : '🔧 Improve'}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="Our mission is to..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Vision */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ color: colors.gray, fontSize: '14px' }}>
                  Vision Statement *
                  <span style={{ fontSize: '12px', marginLeft: '10px' }}>Where is your company going?</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleAIGenerate('vision')}
                    disabled={aiLoading.vision}
                    style={{ ...aiButtonStyle, backgroundColor: colors.primary, color: colors.background }}
                  >
                    {aiLoading.vision ? '⏳ Generating...' : '✨ Generate with CR-AI'}
                  </button>
                  {vision && (
                    <button
                      onClick={() => handleAIImprove('vision')}
                      disabled={aiLoading.vision}
                      style={{ ...aiButtonStyle, backgroundColor: colors.gold, color: colors.background }}
                    >
                      {aiLoading.vision ? '⏳' : '🔧 Improve'}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                placeholder="Our vision is to..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Elevator Pitch */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ color: colors.gray, fontSize: '14px' }}>
                  Elevator Pitch *
                  <span style={{ fontSize: '12px', marginLeft: '10px' }}>30-second company description</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleAIGenerate('pitch')}
                    disabled={aiLoading.pitch}
                    style={{ ...aiButtonStyle, backgroundColor: colors.primary, color: colors.background }}
                  >
                    {aiLoading.pitch ? '⏳ Generating...' : '✨ Generate with CR-AI'}
                  </button>
                  {elevatorPitch && (
                    <button
                      onClick={() => handleAIImprove('pitch')}
                      disabled={aiLoading.pitch}
                      style={{ ...aiButtonStyle, backgroundColor: colors.gold, color: colors.background }}
                    >
                      {aiLoading.pitch ? '⏳' : '🔧 Improve'}
                    </button>
                  )}
                </div>
              </div>
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

      case 3:
        return (
          <div style={{ display: 'grid', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: colors.white, margin: 0 }}>What Services Do You Offer?</h3>
              <span style={{ color: colors.gray, fontSize: '14px' }}>{services.length}/10 areas</span>
            </div>

            {/* Info box */}
            <div style={{
              backgroundColor: `${colors.primary}10`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.primary}30`
            }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                💡 <strong style={{ color: colors.white }}>Just tell us what you do.</strong> Pick a category and explain everything you offer in that area. CR-AI will use this to match you with contracts.
              </p>
            </div>

            {/* Existing Services */}
            {services.map((service, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#1a1a1a',
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${colors.gray}30`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ color: colors.primary, fontWeight: '600', fontSize: '14px' }}>
                    Service Area #{index + 1}
                  </span>
                  <button
                    onClick={() => removeService(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '15px' }}>
                  <div>
                    <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                      What type of work is this?
                    </label>
                    <select
                      value={service.category}
                      onChange={(e) => updateService(index, 'category', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select category</option>
                      {industryCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ marginBottom: '5px' }}>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block' }}>
                        Explain EVERYTHING you do in this area
                      </label>
                      <span style={{ color: colors.gray, fontSize: '12px' }}>
                        We'll organize it in your BUCKET. You can add or change it anytime.
                      </span>
                    </div>
                    <textarea
                      value={service.description}
                      onChange={(e) => updateService(index, 'description', e.target.value)}
                      placeholder="Example: We do photography and video for events, corporate headshots, and products. We also handle editing, social media content, and live event coverage. We've done concerts, city events, and campaigns for small businesses..."
                      rows={6}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Service Button */}
            {services.length < 10 && (
              <button
                onClick={addService}
                style={{
                  padding: '15px',
                  borderRadius: '12px',
                  border: `2px dashed ${colors.gray}`,
                  backgroundColor: 'transparent',
                  color: colors.gray,
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                ➕ Add Another Service Area
              </button>
            )}

            {services.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: colors.gray }}>
                <p style={{ fontSize: '16px', margin: 0 }}>No services added yet.</p>
                <p style={{ fontSize: '14px', margin: '10px 0 0 0' }}>Click "Add Another Service Area" to get started.</p>
              </div>
            )}
          </div>
        )

      case 4:
        return (
          <div style={{ display: 'grid', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: colors.white, margin: 0 }}>NAICS Codes</h3>
              <span style={{ color: colors.gray, fontSize: '14px' }}>{naicsCodes.length}/10 codes</span>
            </div>

            {/* Info box */}
            <div style={{
              backgroundColor: `${colors.primary}10`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.primary}30`
            }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                💡 <strong style={{ color: colors.white }}>NAICS codes tell agencies what you do.</strong> Every contract lists required codes. Add yours so CR-AI can match you with the right opportunities. Don't know your codes? <a href="https://www.naics.com/search/" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>Look them up here</a>
              </p>
            </div>

            {/* Existing NAICS Codes */}
            {naicsCodes.map((naics, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#1a1a1a',
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${naics.isPrimary ? colors.primary : colors.gray}30`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: naics.isPrimary ? colors.primary : colors.gray, fontWeight: '600', fontSize: '14px' }}>
                      {naics.isPrimary ? '⭐ Primary Code' : `Code #${index + 1}`}
                    </span>
                    {!naics.isPrimary && (
                      <button
                        onClick={() => updateNaicsCode(index, 'isPrimary', true)}
                        style={{
                          background: 'none',
                          border: `1px solid ${colors.gray}`,
                          borderRadius: '4px',
                          color: colors.gray,
                          cursor: 'pointer',
                          fontSize: '11px',
                          padding: '2px 8px'
                        }}
                      >
                        Make Primary
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => removeNaicsCode(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                      Code *
                    </label>
                    <input
                      type="text"
                      value={naics.code}
                      onChange={(e) => updateNaicsCode(index, 'code', e.target.value)}
                      placeholder="e.g., 541611"
                      style={inputStyle}
                      maxLength={6}
                    />
                  </div>
                  <div>
                    <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                      What does this code cover?
                    </label>
                    <input
                      type="text"
                      value={naics.description}
                      onChange={(e) => updateNaicsCode(index, 'description', e.target.value)}
                      placeholder="e.g., Administrative Management Consulting Services"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add NAICS Button */}
            {naicsCodes.length < 10 && (
              <button
                onClick={addNaicsCode}
                style={{
                  padding: '15px',
                  borderRadius: '12px',
                  border: `2px dashed ${colors.gray}`,
                  backgroundColor: 'transparent',
                  color: colors.gray,
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                ➕ Add NAICS Code
              </button>
            )}

            {naicsCodes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: colors.gray }}>
                <p style={{ fontSize: '16px', margin: 0 }}>No NAICS codes added yet.</p>
                <p style={{ fontSize: '14px', margin: '10px 0 0 0' }}>These help contracts find YOU. Add at least your primary code.</p>
              </div>
            )}

            {/* Common codes helper */}
            <div style={{
              backgroundColor: `${colors.gold}10`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.gold}30`
            }}>
              <p style={{ color: colors.gold, margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>
                Common NAICS codes based on your previously inputted information. You can change anytime.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  { code: '541611', desc: 'Management Consulting' },
                  { code: '541810', desc: 'Advertising Agencies' },
                  { code: '621330', desc: 'Mental Health Services' },
                  { code: '611430', desc: 'Professional Training' },
                  { code: '561720', desc: 'Janitorial Services' },
                  { code: '236220', desc: 'Commercial Construction' },
                  { code: '541512', desc: 'Computer Systems Design' },
                  { code: '561320', desc: 'Temporary Staffing' },
                ].map((item) => (
                  <button
                    key={item.code}
                    onClick={() => {
                      if (naicsCodes.length < 10) {
                        setNaicsCodes([...naicsCodes, { code: item.code, description: item.desc, isPrimary: naicsCodes.length === 0 }])
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${colors.gold}50`,
                      backgroundColor: 'transparent',
                      color: colors.gray,
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {item.code} - {item.desc}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case 5:
        const availableCerts = [
          { id: 'mbe', name: 'MBE', full: 'Minority Business Enterprise' },
          { id: 'wbe', name: 'WBE', full: 'Women Business Enterprise' },
          { id: 'dbe', name: 'DBE', full: 'Disadvantaged Business Enterprise' },
          { id: 'dvbe', name: 'DVBE', full: 'Disabled Veteran Business Enterprise' },
          { id: 'sdvosb', name: 'SDVOSB', full: 'Service-Disabled Veteran-Owned Small Business' },
          { id: 'sbe', name: 'SBE', full: 'Small Business Enterprise' },
          { id: 'lsbe', name: 'LSBE', full: 'Local Small Business Enterprise' },
          { id: '8a', name: '8(a)', full: 'SBA 8(a) Business Development Program' },
          { id: 'hubzone', name: 'HUBZone', full: 'Historically Underutilized Business Zone' },
          { id: 'wosb', name: 'WOSB', full: 'Women-Owned Small Business' },
          { id: 'edwosb', name: 'EDWOSB', full: 'Economically Disadvantaged WOSB' },
          { id: 'lgbtbe', name: 'LGBTBE', full: 'LGBT Business Enterprise' },
          { id: 'vosb', name: 'VOSB', full: 'Veteran-Owned Small Business' },
        ]

        const toggleCert = (cert) => {
          const exists = certifications.find(c => c.id === cert.id)
          if (exists) {
            setCertifications(certifications.filter(c => c.id !== cert.id))
          } else {
            setCertifications([...certifications, { id: cert.id, name: cert.name, full: cert.full, certNumber: '', expirationDate: '' }])
          }
        }

        const updateCert = (certId, field, value) => {
          setCertifications(certifications.map(c => 
            c.id === certId ? { ...c, [field]: value } : c
          ))
        }

        return (
          <div style={{ display: 'grid', gap: '25px' }}>
            <h3 style={{ color: colors.white, margin: 0 }}>Certifications</h3>

            {/* Info box */}
            <div style={{
              backgroundColor: `${colors.primary}10`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.primary}30`
            }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                💡 <strong style={{ color: colors.white }}>Certifications give you bidding advantages.</strong> Many contracts are set aside for certified businesses. Check all that apply — you can update this anytime in your BUCKET.
              </p>
            </div>

            {/* No certs message */}
            <div style={{
              backgroundColor: `${colors.gold}10`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.gold}30`
            }}>
              <p style={{ color: colors.gold, margin: 0, fontSize: '14px' }}>
                ⚠️ <strong>Don't have certifications yet?</strong> That's okay! You can still bid on open contracts. Certifications just give you extra advantages. Skip this section and come back later.
              </p>
            </div>

            {/* Certification checkboxes */}
            <div style={{ display: 'grid', gap: '10px' }}>
              {availableCerts.map((cert) => {
                const isChecked = certifications.some(c => c.id === cert.id)
                const certData = certifications.find(c => c.id === cert.id)
                
                return (
                  <div key={cert.id}>
                    <div
                      onClick={() => toggleCert(cert)}
                      style={{
                        backgroundColor: isChecked ? `${colors.primary}15` : '#1a1a1a',
                        borderRadius: '10px',
                        padding: '15px',
                        border: `1px solid ${isChecked ? colors.primary : colors.gray}30`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px'
                      }}
                    >
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        border: `2px solid ${isChecked ? colors.primary : colors.gray}`,
                        backgroundColor: isChecked ? colors.primary : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isChecked && <span style={{ color: colors.background, fontSize: '14px' }}>✓</span>}
                      </div>
                      <div>
                        <span style={{ color: colors.white, fontWeight: '600', fontSize: '16px' }}>{cert.name}</span>
                        <span style={{ color: colors.gray, fontSize: '14px', marginLeft: '10px' }}>{cert.full}</span>
                      </div>
                    </div>

                    {/* Show details when checked */}
                    {isChecked && (
                      <div style={{
                        backgroundColor: '#1a1a1a',
                        borderRadius: '0 0 10px 10px',
                        padding: '15px',
                        marginTop: '-5px',
                        borderLeft: `1px solid ${colors.primary}30`,
                        borderRight: `1px solid ${colors.primary}30`,
                        borderBottom: `1px solid ${colors.primary}30`,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px'
                      }}>
                        <div>
                          <label style={{ color: colors.gray, fontSize: '12px', display: 'block', marginBottom: '5px' }}>
                            Certification # (optional)
                          </label>
                          <input
                            type="text"
                            value={certData?.certNumber || ''}
                            onChange={(e) => updateCert(cert.id, 'certNumber', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Enter cert number"
                            style={{ ...inputStyle, padding: '10px', fontSize: '14px' }}
                          />
                        </div>
                        <div>
                          <label style={{ color: colors.gray, fontSize: '12px', display: 'block', marginBottom: '5px' }}>
                            Expiration Date (optional)
                          </label>
                          <input
                            type="text"
                            value={certData?.expirationDate || ''}
                            onChange={(e) => updateCert(cert.id, 'expirationDate', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="MM/YYYY"
                            style={{ ...inputStyle, padding: '10px', fontSize: '14px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            {certifications.length > 0 && (
              <div style={{
                backgroundColor: `${colors.primary}10`,
                borderRadius: '10px',
                padding: '15px',
                border: `1px solid ${colors.primary}30`
              }}>
                <p style={{ color: colors.primary, margin: 0, fontSize: '14px' }}>
                  ✅ <strong>{certifications.length} certification{certifications.length > 1 ? 's' : ''} selected:</strong>{' '}
                  {certifications.map(c => c.name).join(', ')}
                </p>
              </div>
            )}
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
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>UEI Number (Unique Entity ID)</label>
                  <input type="text" value={ueiNumber} onChange={(e) => setUeiNumber(e.target.value)} placeholder="Enter your 12-character UEI" style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '5px' }}>CAGE Code</label>
                  <input type="text" value={cageCode} onChange={(e) => setCageCode(e.target.value)} placeholder="Enter your 5-character CAGE code" style={inputStyle} />
                </div>
              </>
            )}

            {!samRegistered && (
              <div style={{ backgroundColor: `${colors.gold}20`, borderRadius: '8px', padding: '15px', border: `1px solid ${colors.gold}30` }}>
                <p style={{ color: colors.gold, margin: 0, fontSize: '14px' }}>
                  💡 <strong>Tip:</strong> SAM.gov registration is required for federal contracts. Visit <a href="https://sam.gov" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>sam.gov</a> to register for free.
                </p>
              </div>
            )}
          </div>
        )

      case 7:
        const commonRoles = [
          { role: 'Project Manager', rate: '85' },
          { role: 'Program Director', rate: '125' },
          { role: 'Consultant', rate: '75' },
          { role: 'Senior Consultant', rate: '95' },
          { role: 'Analyst', rate: '65' },
          { role: 'Administrative Support', rate: '45' },
          { role: 'Trainer/Facilitator', rate: '80' },
          { role: 'Counselor/Therapist', rate: '90' },
          { role: 'Technician', rate: '55' },
          { role: 'Developer/Engineer', rate: '110' },
        ]

        return (
          <div style={{ display: 'grid', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: colors.white, margin: 0 }}>Pricing Snapshot</h3>
              <span style={{ color: colors.gray, fontSize: '14px' }}>{pricing.length}/15 roles</span>
            </div>

            {/* Info box */}
            <div style={{
              backgroundColor: `${colors.primary}10`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.primary}30`
            }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                💡 <strong style={{ color: colors.white }}>Add your typical hourly rates by role.</strong> These are just starting estimates — you'll adjust them for each contract or grant you submit.
              </p>
            </div>

            {/* Quick add common roles */}
            <div style={{
              backgroundColor: `${colors.gold}10`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.gold}30`
            }}>
              <p style={{ color: colors.gold, margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>
                Quick add common roles:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {commonRoles.map((item) => (
                  <button
                    key={item.role}
                    onClick={() => {
                      if (pricing.length < 15 && !pricing.some(p => p.role === item.role)) {
                        setPricing([...pricing, { role: item.role, hourlyRate: item.rate, description: '' }])
                      }
                    }}
                    disabled={pricing.some(p => p.role === item.role)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${colors.gold}50`,
                      backgroundColor: pricing.some(p => p.role === item.role) ? `${colors.gray}30` : 'transparent',
                      color: pricing.some(p => p.role === item.role) ? colors.gray : colors.white,
                      cursor: pricing.some(p => p.role === item.role) ? 'default' : 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {item.role}
                  </button>
                ))}
              </div>
            </div>

            {/* Existing Pricing Roles */}
            {pricing.map((item, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#1a1a1a',
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${colors.gray}30`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ color: colors.primary, fontWeight: '600', fontSize: '14px' }}>
                    Role #{index + 1}
                  </span>
                  <button
                    onClick={() => removePricingRole(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                      Role / Position Title
                    </label>
                    <input
                      type="text"
                      value={item.role}
                      onChange={(e) => updatePricingRole(index, 'role', e.target.value)}
                      placeholder="e.g., Project Manager"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                      Hourly Estimate ($)
                    </label>
                    <input
                      type="text"
                      value={item.hourlyRate}
                      onChange={(e) => updatePricingRole(index, 'hourlyRate', e.target.value)}
                      placeholder="e.g., 85 (adjust per job)"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Role Button */}
            {pricing.length < 15 && (
              <button
                onClick={addPricingRole}
                style={{
                  padding: '15px',
                  borderRadius: '12px',
                  border: `2px dashed ${colors.gray}`,
                  backgroundColor: 'transparent',
                  color: colors.gray,
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                ➕ Add Custom Role
              </button>
            )}

            {pricing.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: colors.gray }}>
                <p style={{ fontSize: '16px', margin: 0 }}>No pricing added yet.</p>
                <p style={{ fontSize: '14px', margin: '10px 0 0 0' }}>Click a common role above or add your own.</p>
              </div>
            )}
          </div>
        )

      case 8:
        return (
          <div style={{ display: 'grid', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: colors.white, margin: 0 }}>Past Performance</h3>
              <span style={{ color: colors.gray, fontSize: '14px' }}>{pastPerformance.length}/5 projects</span>
            </div>

            {/* Info box */}
            <div style={{
              backgroundColor: `${colors.primary}10`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.primary}30`
            }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                💡 <strong style={{ color: colors.white }}>This is what evaluators look at most.</strong> Add ANY projects — government contracts, private clients, grants, volunteer work. Start with what you have and build over time. You can always update this in your BUCKET.
              </p>
            </div>

            {/* Important clarification */}
            <div style={{
              backgroundColor: `${colors.gold}15`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.gold}50`
            }}>
              <p style={{ color: colors.gold, margin: 0, fontSize: '14px', fontWeight: '600' }}>
                ⚠️ This can be ANY work you've done — government OR private!
              </p>
              <p style={{ color: colors.gray, margin: '8px 0 0 0', fontSize: '13px' }}>
                Include projects for businesses, nonprofits, churches, schools, or anyone. If you've done the work, it counts. Evaluators want to see you can deliver — doesn't matter if it was public or private.
              </p>
            </div>

            {/* Existing Past Performance */}
            {pastPerformance.map((pp, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#1a1a1a',
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${colors.gray}30`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ color: colors.primary, fontWeight: '600', fontSize: '14px' }}>
                    Project #{index + 1}
                  </span>
                  <button
                    onClick={() => removePastPerformance(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '15px' }}>
                  {/* Row 1: Client and Project Name */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                        Who did you do this work for? *
                      </label>
                      <input
                        type="text"
                        value={pp.clientName}
                        onChange={(e) => updatePastPerformance(index, 'clientName', e.target.value)}
                        placeholder="e.g., LA County, ABC Church, Smith Construction, Local Nonprofit"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                        Project or Contract Name
                      </label>
                      <input
                        type="text"
                        value={pp.projectName}
                        onChange={(e) => updatePastPerformance(index, 'projectName', e.target.value)}
                        placeholder="e.g., Student Wellness Program"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Row 2: Value and Dates */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                        Contract Value
                      </label>
                      <input
                        type="text"
                        value={pp.contractValue}
                        onChange={(e) => updatePastPerformance(index, 'contractValue', e.target.value)}
                        placeholder="e.g., $250,000"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                        Start Year
                      </label>
                      <input
                        type="text"
                        value={pp.startYear}
                        onChange={(e) => updatePastPerformance(index, 'startYear', e.target.value)}
                        placeholder="e.g., 2022"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                        End Year
                      </label>
                      <input
                        type="text"
                        value={pp.endYear}
                        onChange={(e) => updatePastPerformance(index, 'endYear', e.target.value)}
                        placeholder="e.g., 2024 or Ongoing"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                      What did you do?
                    </label>
                    <textarea
                      value={pp.description}
                      onChange={(e) => updatePastPerformance(index, 'description', e.target.value)}
                      placeholder="Explain what you delivered, how you did it, who you served..."
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
                    />
                  </div>

                  {/* Results */}
                  <div>
                    <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                      What were the results? (Numbers help!)
                    </label>
                    <textarea
                      value={pp.results}
                      onChange={(e) => updatePastPerformance(index, 'results', e.target.value)}
                      placeholder="e.g., Served 5,000 students, 95% satisfaction rate, completed on time and under budget..."
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
                    />
                  </div>

                  {/* Reference (collapsible) */}
                  <div style={{ 
                    backgroundColor: `${colors.gray}10`, 
                    borderRadius: '8px', 
                    padding: '15px',
                    border: `1px solid ${colors.gray}20`
                  }}>
                    <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '10px' }}>
                      📞 Reference Contact (optional but recommended)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input
                        type="text"
                        value={pp.referenceName}
                        onChange={(e) => updatePastPerformance(index, 'referenceName', e.target.value)}
                        placeholder="Contact Name"
                        style={{ ...inputStyle, padding: '10px', fontSize: '14px' }}
                      />
                      <input
                        type="text"
                        value={pp.referenceTitle}
                        onChange={(e) => updatePastPerformance(index, 'referenceTitle', e.target.value)}
                        placeholder="Title (e.g., Program Manager)"
                        style={{ ...inputStyle, padding: '10px', fontSize: '14px' }}
                      />
                    </div>
                    <input
                      type="text"
                      value={pp.referenceContact}
                      onChange={(e) => updatePastPerformance(index, 'referenceContact', e.target.value)}
                      placeholder="Phone or Email"
                      style={{ ...inputStyle, padding: '10px', fontSize: '14px', marginTop: '10px' }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Past Performance Button */}
            {pastPerformance.length < 5 && (
              <button
                onClick={addPastPerformance}
                style={{
                  padding: '15px',
                  borderRadius: '12px',
                  border: `2px dashed ${colors.gray}`,
                  backgroundColor: 'transparent',
                  color: colors.gray,
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                ➕ Add Past Project
              </button>
            )}

            {pastPerformance.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: colors.gray }}>
                <p style={{ fontSize: '16px', margin: 0 }}>No past performance added yet.</p>
                <p style={{ fontSize: '14px', margin: '10px 0 0 0' }}>Add any project — public or private. Even 1-2 examples help you get started!</p>
              </div>
            )}
          </div>
        )

      case 9:
        return (
          <div style={{ display: 'grid', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: colors.white, margin: 0 }}>Team Builder</h3>
              <span style={{ color: colors.gray, fontSize: '14px' }}>{teamMembers.length}/10 people</span>
            </div>

            {/* Info box */}
            <div style={{
              backgroundColor: `${colors.primary}10`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.primary}30`
            }}>
              <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                💡 <strong style={{ color: colors.white }}>This is your team POOL — not everyone goes on every job.</strong> Add anyone you might work with. When you respond to a contract or grant, you'll SELECT who to include from this list.
              </p>
            </div>

            {/* Growth message */}
            <div style={{
              backgroundColor: `${colors.gold}10`,
              borderRadius: '12px',
              padding: '15px',
              border: `1px solid ${colors.gold}30`
            }}>
              <p style={{ color: colors.gold, margin: 0, fontSize: '14px' }}>
                🪣 <strong>Part of your BUCKET.</strong> Add employees, contractors, vendors, partners — whoever you work with. This list grows over time. For each submission, you choose who fits that specific job.
              </p>
            </div>

            {/* Existing Team Members */}
            {teamMembers.map((member, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#1a1a1a',
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${colors.gray}30`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ color: colors.primary, fontWeight: '600', fontSize: '14px' }}>
                    {index === 0 ? '⭐ Primary Contact' : `Team Member #${index + 1}`}
                  </span>
                  <button
                    onClick={() => removeTeamMember(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '15px' }}>
                  {/* Row 1: Name and Role */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                        Name *
                      </label>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => updateTeamMember(index, 'name', e.target.value)}
                        placeholder="e.g., John Smith"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                        Role / Title *
                      </label>
                      <input
                        type="text"
                        value={member.role}
                        onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                        placeholder="e.g., Project Manager, Plumber, Consultant"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Row 2: Type, Experience, Rate */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                        Type
                      </label>
                      <select
                        value={member.type || ''}
                        onChange={(e) => updateTeamMember(index, 'type', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">Select type</option>
                        <option value="owner">Owner / Principal</option>
                        <option value="employee">Employee</option>
                        <option value="contractor">Contractor</option>
                        <option value="vendor">Vendor / Partner</option>
                        <option value="consultant">Consultant</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                        Years of Experience
                      </label>
                      <input
                        type="text"
                        value={member.yearsExperience}
                        onChange={(e) => updateTeamMember(index, 'yearsExperience', e.target.value)}
                        placeholder="e.g., 10"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                        Hourly Estimate ($)
                      </label>
                      <input
                        type="text"
                        value={member.hourlyRate || ''}
                        onChange={(e) => updateTeamMember(index, 'hourlyRate', e.target.value)}
                        placeholder="e.g., 85 (adjust per job)"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Qualifications */}
                  <div>
                    <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                      Key Qualifications / Certifications / Licenses
                    </label>
                    <input
                      type="text"
                      value={member.qualifications}
                      onChange={(e) => updateTeamMember(index, 'qualifications', e.target.value)}
                      placeholder="e.g., PMP, Licensed Contractor, MBA, LCSW"
                      style={inputStyle}
                    />
                  </div>

                  {/* Bio */}
                  <div>
                    <label style={{ color: colors.white, fontSize: '14px', display: 'block', marginBottom: '5px' }}>
                      Brief Bio / Relevant Experience
                    </label>
                    <textarea
                      value={member.bio}
                      onChange={(e) => updateTeamMember(index, 'bio', e.target.value)}
                      placeholder="Describe their background and experience. This helps CR-AI write about them in proposals..."
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Team Member Button */}
            {teamMembers.length < 10 && (
              <button
                onClick={addTeamMember}
                style={{
                  padding: '15px',
                  borderRadius: '12px',
                  border: `2px dashed ${colors.gray}`,
                  backgroundColor: 'transparent',
                  color: colors.gray,
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                ➕ Add Team Member
              </button>
            )}

            {teamMembers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: colors.gray }}>
                <p style={{ fontSize: '16px', margin: 0 }}>No team members added yet.</p>
                <p style={{ fontSize: '14px', margin: '10px 0 0 0' }}>Build your pool — you'll pick from this list for each contract you go after.</p>
              </div>
            )}
          </div>
        )

      default:
        // Case 10: Generate Capability Statement
        if (activeSection === 10) {
          
          // Smart Logic: Determine what to show
          const hasEmployees = teamSize && parseInt(teamSize) > 1
          const hasRevenue = revenueRange && revenueRange !== '' && revenueRange !== 'Prefer not to say'
          const hasPastPerf = pastPerformance.length > 0
          const hasCerts = certifications.length > 0
          const hasNaics = naicsCodes.length > 0
          const hasUei = ueiNumber && ueiNumber.trim() !== ''
          const hasCage = cageCode && cageCode.trim() !== ''
          const hasTeam = teamMembers.length > 0
          const hasResults = resultsAchieved && resultsAchieved.trim() !== ''
          const hasDifferentiator = whatMakesYouDifferent && whatMakesYouDifferent.trim() !== ''
          const hasYearEstablished = yearEstablished && yearEstablished.trim() !== ''
          
          // Get primary service from first service entry
          const primaryService = services.length > 0 ? services[0].category : 'professional services'
          
          // Get owner/founder from team (first person or fallback)
          const owner = teamMembers.length > 0 ? teamMembers[0] : null
          
          // Format revenue display
          const formatRevenue = (range) => {
            if (!range || range === 'Prefer not to say') return null
            return range
          }
          
          // Format team size display
          const formatTeamSize = (size) => {
            if (!size) return null
            const num = parseInt(size)
            if (num === 1) return null // Don't show "1 Employee"
            if (size.includes('+')) return size
            return `${size} Team Members`
          }

          return (
            <div style={{ display: 'grid', gap: '25px' }}>
              <h3 style={{ color: colors.white, margin: 0 }}>Generate Capability Statement</h3>

              {/* Info box */}
              <div style={{
                backgroundColor: `${colors.primary}10`,
                borderRadius: '12px',
                padding: '15px',
                border: `1px solid ${colors.primary}30`
              }}>
                <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>
                  💡 <strong style={{ color: colors.white }}>Professional template with YOUR data.</strong> Same clean layout for everyone. Smart logic shows your strengths and hides what you don't have.
                </p>
              </div>

              {/* Preview what will be included */}
              <div style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${colors.gray}30`
              }}>
                <p style={{ color: colors.white, fontWeight: '600', marginBottom: '15px', fontSize: '16px' }}>
                  Smart Logic Preview:
                </p>
                <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                  <div style={{ color: companyName ? colors.primary : colors.gray }}>
                    {companyName ? '✅' : '⬜'} Company Header & Contact
                  </div>
                  <div style={{ color: hasYearEstablished || formatTeamSize(teamSize) || formatRevenue(revenueRange) ? colors.primary : colors.gray }}>
                    {hasYearEstablished || formatTeamSize(teamSize) || formatRevenue(revenueRange) ? '✅' : '➖'} Quick Facts Sidebar {!hasYearEstablished && !formatTeamSize(teamSize) && !formatRevenue(revenueRange) ? '(will skip - no data)' : ''}
                  </div>
                  <div style={{ color: services.length > 0 ? colors.primary : colors.gray }}>
                    {services.length > 0 ? '✅' : '⬜'} Core Capabilities ({services.length} services)
                  </div>
                  <div style={{ color: hasPastPerf ? colors.primary : colors.gold }}>
                    {hasPastPerf ? '✅ Past Performance' : '🔄 "Why Contract Ready" (no past performance)'} 
                  </div>
                  <div style={{ color: hasDifferentiator ? colors.primary : colors.gray }}>
                    {hasDifferentiator ? '✅' : '➖'} Differentiators {!hasDifferentiator ? '(will skip)' : ''}
                  </div>
                  <div style={{ color: hasCerts || hasNaics || hasUei ? colors.primary : colors.gray }}>
                    {hasCerts || hasNaics || hasUei ? '✅' : '⬜'} Certifications & Codes
                  </div>
                  <div style={{ color: hasTeam ? colors.primary : colors.gray }}>
                    {hasTeam ? '✅' : '➖'} Key Personnel {!hasTeam ? '(will skip)' : `(${teamMembers.length} people)`}
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={() => {
                  if (!companyName) {
                    alert('Please fill out Company Basics first.')
                    return
                  }

                  // BUILD THE TEMPLATE - No AI needed for most parts
                  
                  // Quick Facts (only show what exists)
                  let quickFacts = []
                  if (hasYearEstablished) quickFacts.push(`Est. ${yearEstablished}`)
                  if (formatTeamSize(teamSize)) quickFacts.push(formatTeamSize(teamSize))
                  if (formatRevenue(revenueRange)) quickFacts.push(formatRevenue(revenueRange))
                  if (city && state) quickFacts.push(`${city}, ${state}`)
                  
                  // Core Capabilities (from services)
                  const capabilities = services.map(s => s.category).filter(Boolean)
                  
                  // Past Performance OR Why Contract Ready
                  let performanceSection = ''
                  if (hasPastPerf) {
                    performanceSection = `
                      <h2>PAST PERFORMANCE</h2>
                      <ul>
                        ${pastPerformance.slice(0, 4).map(p => `<li><strong>${p.clientName || 'Client'}</strong>${p.projectName ? ` - ${p.projectName}` : ''}${p.contractValue ? ` ($${p.contractValue})` : ''}${p.description ? `<br><span style="color:#666;font-size:10pt">${p.description.substring(0, 100)}${p.description.length > 100 ? '...' : ''}</span>` : ''}</li>`).join('')}
                      </ul>
                    `
                  } else {
                    // Why Contract Ready - templated sentences
                    let readyPoints = []
                    if (owner && owner.yearsExperience) {
                      readyPoints.push(`${owner.yearsExperience}+ years of industry experience`)
                    } else if (hasYearEstablished) {
                      const years = new Date().getFullYear() - parseInt(yearEstablished)
                      if (years > 0) readyPoints.push(`${years}+ years in business`)
                    }
                    if (formatTeamSize(teamSize)) {
                      readyPoints.push(`${formatTeamSize(teamSize)} ready to deliver`)
                    }
                    if (hasCerts) {
                      readyPoints.push(`Certified: ${certifications.map(c => c.name).join(', ')}`)
                    }
                    if (hasResults) {
                      readyPoints.push(resultsAchieved.substring(0, 80) + (resultsAchieved.length > 80 ? '...' : ''))
                    }
                    if (readyPoints.length === 0) {
                      readyPoints.push('Fully operational and ready to perform')
                      readyPoints.push('Committed to quality and compliance')
                    }
                    
                    performanceSection = `
                      <h2>WHY CONTRACT READY</h2>
                      <ul>
                        ${readyPoints.map(p => `<li>${p}</li>`).join('')}
                      </ul>
                    `
                  }
                  
                  // Differentiators (only if they have it)
                  let diffSection = ''
                  if (hasDifferentiator) {
                    // Split by common delimiters or just show as-is
                    const diffs = whatMakesYouDifferent.includes('\n') 
                      ? whatMakesYouDifferent.split('\n').filter(d => d.trim())
                      : whatMakesYouDifferent.includes(',')
                        ? whatMakesYouDifferent.split(',').filter(d => d.trim())
                        : [whatMakesYouDifferent]
                    
                    diffSection = `
                      <h2>DIFFERENTIATORS</h2>
                      <ul>
                        ${diffs.slice(0, 4).map(d => `<li>${d.trim()}</li>`).join('')}
                      </ul>
                    `
                  }
                  
                  // Key Personnel (only if they have team)
                  let personnelSection = ''
                  if (hasTeam) {
                    personnelSection = `
                      <h2>KEY PERSONNEL</h2>
                      <ul>
                        ${teamMembers.slice(0, 4).map(t => `<li><strong>${t.name || 'Team Member'}</strong> - ${t.role || 'Staff'}${t.yearsExperience ? ` - ${t.yearsExperience} yrs` : ''}${t.qualifications ? ` - ${t.qualifications}` : ''}</li>`).join('')}
                      </ul>
                    `
                  }
                  
                  // Certifications & Codes
                  const certList = hasCerts ? certifications.map(c => c.name).join(' | ') : 'N/A'
                  const naicsList = hasNaics ? naicsCodes.map(n => n.code).join(' | ') : 'N/A'
                  
                  // BUILD FINAL HTML
                  const capStatement = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${companyName} - Capability Statement</title>
<style>
@page { size: letter; margin: 0.5in; }
body { font-family: Arial, sans-serif; font-size: 10pt; margin: 0; padding: 20px; color: #333; }
.container { max-width: 7.5in; margin: 0 auto; }
.header { text-align: center; border-bottom: 4px solid #00A86B; padding-bottom: 10px; margin-bottom: 15px; }
.header h1 { margin: 0; font-size: 22pt; color: #00A86B; letter-spacing: 1px; }
.header .tagline { font-size: 10pt; color: #666; margin-top: 3px; }
.header .contact { font-size: 9pt; color: #333; margin-top: 8px; }
.main { display: flex; gap: 15px; }
.sidebar { width: 140px; flex-shrink: 0; }
.sidebar-box { background: #00A86B; color: white; padding: 12px; border-radius: 6px; }
.sidebar-box h3 { margin: 0 0 10px 0; font-size: 10pt; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 5px; }
.sidebar-box p { margin: 5px 0; font-size: 9pt; }
.sidebar-box strong { display: block; font-size: 12pt; }
.content { flex: 1; }
h2 { font-size: 11pt; background: #00A86B; color: white; padding: 4px 10px; margin: 12px 0 8px 0; border-radius: 3px; }
ul { margin: 5px 0 10px 0; padding-left: 18px; }
li { margin: 4px 0; font-size: 10pt; }
.codes-box { background: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 9pt; }
.codes-box strong { color: #00A86B; }
.overview { font-size: 10pt; line-height: 1.4; margin-bottom: 10px; }
.footer { text-align: center; font-size: 8pt; color: #999; margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd; }
.logo-placeholder { width: 80px; height: 80px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #999; margin: 0 auto 10px auto; }
</style>
</head>
<body>
<div class="container">

<div class="header">
  <div class="logo-placeholder">YOUR LOGO</div>
  <h1>${companyName.toUpperCase()}</h1>
  ${elevatorPitch ? `<div class="tagline">${elevatorPitch.substring(0, 80)}${elevatorPitch.length > 80 ? '...' : ''}</div>` : ''}
  <div class="contact">
    ${address ? `${address}, ` : ''}${city || ''}${state ? `, ${state}` : ''} ${zip || ''}<br>
    ${phone || ''}${email ? ` | ${email}` : ''}${website ? ` | ${website}` : ''}
  </div>
</div>

<div class="main">
  ${quickFacts.length > 0 ? `
  <div class="sidebar">
    <div class="sidebar-box">
      <h3>QUICK FACTS</h3>
      ${quickFacts.map(f => `<p>${f}</p>`).join('')}
      ${hasUei ? `<p><strong>UEI</strong>${ueiNumber}</p>` : ''}
      ${hasCage ? `<p><strong>CAGE</strong>${cageCode}</p>` : ''}
    </div>
  </div>
  ` : ''}
  
  <div class="content">
    <h2>COMPANY OVERVIEW</h2>
    <p class="overview">${mission ? mission.substring(0, 200) + (mission.length > 200 ? '...' : '') : `${companyName} provides professional ${primaryService} services.`}</p>
    
    ${capabilities.length > 0 ? `
    <h2>CORE CAPABILITIES</h2>
    <ul>
      ${capabilities.slice(0, 6).map(c => `<li>${c}</li>`).join('')}
    </ul>
    ` : ''}
    
    ${performanceSection}
    
    ${diffSection}
    
    ${personnelSection}
    
    <div class="codes-box">
      <strong>Certifications:</strong> ${certList}<br>
      <strong>NAICS:</strong> ${naicsList}
      ${hasUei && quickFacts.length === 0 ? `<br><strong>UEI:</strong> ${ueiNumber}` : ''}
      ${hasCage && quickFacts.length === 0 ? ` | <strong>CAGE:</strong> ${cageCode}` : ''}
    </div>
  </div>
</div>

<div class="footer">Generated with ContractReady.com</div>

</div>
</body>
</html>`

                  // Download as .doc
                  const blob = new Blob([capStatement], { type: 'application/msword' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${companyName.replace(/[^a-z0-9]/gi, '_')}_Capability_Statement.doc`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)

                  alert('✅ Capability Statement downloaded! Open in Word to add your logo.')
                }}
                style={{
                  padding: '20px 40px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: colors.background,
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                📄 Generate Capability Statement
              </button>

              <p style={{ color: colors.gray, fontSize: '13px', textAlign: 'center', margin: 0 }}>
                Instant download — no AI wait time. Opens in Word. Add your logo.
              </p>
            </div>
          )
        }
        
        return (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: colors.gray, fontSize: '18px' }}>🚧 This section is coming soon!</p>
          </div>
        )
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* API Key Modal */}
      {showApiKeyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', maxWidth: '500px', width: '90%', border: `2px solid ${colors.primary}` }}>
            <h3 style={{ color: colors.white, margin: '0 0 15px 0' }}>🔑 Enter CR-AI API Key</h3>
            <p style={{ color: colors.gray, fontSize: '14px', marginBottom: '20px' }}>To use AI features, enter your Anthropic API key. This is stored locally on your device.</p>
            <input type="password" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} placeholder="sk-ant-api03-..." style={{ ...inputStyle, marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowApiKeyModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveApiKey} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, cursor: 'pointer', fontWeight: '600' }}>Save Key</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ backgroundColor: colors.card, padding: '20px 30px', borderBottom: `1px solid ${colors.primary}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.gray, cursor: 'pointer', fontSize: '16px' }}>← Back</button>
          <h1 style={{ color: colors.white, margin: 0, fontSize: '24px' }}>🏗️ Business Builder</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ backgroundColor: completionPercentage >= 90 ? `${colors.primary}20` : `${colors.gold}20`, padding: '8px 16px', borderRadius: '20px', border: `1px solid ${completionPercentage >= 90 ? colors.primary : colors.gold}` }}>
            <span style={{ color: completionPercentage >= 90 ? colors.primary : colors.gold, fontWeight: '600' }}>{completionPercentage}% Complete</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
        {activeSection ? (
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', padding: '30px', border: `1px solid ${colors.primary}30` }}>
            {renderSectionForm()}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', paddingTop: '20px', borderTop: `1px solid ${colors.gray}30` }}>
              <button onClick={() => setActiveSection(null)} style={{ padding: '12px 24px', borderRadius: '8px', border: `1px solid ${colors.gray}`, backgroundColor: 'transparent', color: colors.white, cursor: 'pointer', fontSize: '16px' }}>Cancel</button>
              <button onClick={saveProfile} disabled={saving} style={{ padding: '12px 30px', borderRadius: '8px', border: 'none', backgroundColor: colors.primary, color: colors.background, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: '600', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save & Continue'}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {sections.map((section) => {
              const completion = getSectionCompletion(section.id)
              return (
                <div
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  style={{ backgroundColor: colors.card, borderRadius: '12px', padding: '20px', border: `1px solid ${completion === 100 ? colors.primary : colors.gray}30`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.primary; e.currentTarget.style.transform = 'translateX(5px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${completion === 100 ? colors.primary : colors.gray}30`; e.currentTarget.style.transform = 'translateX(0)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '28px' }}>{section.icon}</span>
                    <div>
                      <h3 style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '18px' }}>{section.title}</h3>
                      <p style={{ color: colors.gray, margin: 0, fontSize: '14px' }}>{section.description}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {completion === 100 ? <span style={{ color: colors.primary, fontSize: '20px' }}>✓</span> : completion > 0 ? <span style={{ color: colors.gold, fontSize: '14px' }}>{completion}%</span> : null}
                    <span style={{ color: colors.gray, fontSize: '20px' }}>→</span>
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

export default BusinessBuilder
