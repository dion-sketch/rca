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

  // Strip HTML tags from text
  const stripHtml = (html) => {
    if (!html) return ''
    return html
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/&amp;/g, '&')     // Decode &amp;
      .replace(/&lt;/g, '<')      // Decode &lt;
      .replace(/&gt;/g, '>')      // Decode &gt;
      .replace(/&nbsp;/g, ' ')    // Decode &nbsp;
      .replace(/&quot;/g, '"')    // Decode &quot;
      .replace(/&#39;/g, "'")     // Decode &#39;
      .replace(/\s+/g, ' ')       // Collapse whitespace
      .trim()
  }

  // Format currency from number or string
  const formatCurrency = (value) => {
    if (!value) return 'Not specified'
    // Extract number from string like "$500,000" or "7500000.0"
    const num = typeof value === 'string' 
      ? parseFloat(value.replace(/[^0-9.]/g, ''))
      : value
    if (isNaN(num)) return 'Not specified'
    return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  // Parse agency name (handle emails like "IBHModel@cms.hhs.gov")
  const parseAgencyName = (agency) => {
    if (!agency) return 'Not specified'
    // If it's an email, extract domain parts
    if (agency.includes('@')) {
      const domain = agency.split('@')[1] // cms.hhs.gov
      if (domain) {
        // Extract meaningful part (cms.hhs.gov -> CMS / HHS)
        const parts = domain.split('.')
        if (parts.length >= 2) {
          return parts.slice(0, -1).map(p => p.toUpperCase()).join(' / ')
        }
      }
      return agency // Return as-is if can't parse
    }
    return agency
  }

  // Safe number parsing (returns 0 instead of NaN)
  const safeNumber = (value, defaultVal = 0) => {
    const num = parseFloat(value)
    return isNaN(num) ? defaultVal : num
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
      setRfpError('Could not fetch listing details.')
    } finally {
      setLoadingRfp(false)
    }
  }

  // ==========================================
  // PHASE 3: ANSWERS FUNCTIONS
  // ==========================================

  // Default sections for grant/contract responses - ordered by importance
  const defaultSections = [
    { 
      id: 'understanding', 
      title: 'Understanding of Need', 
      prompt: 'This section shows evaluators you understand their problem. RCA will analyze the opportunity and create this section for you.',
      charLimit: 1000,
      answer: '',
      status: 'pending',
      weight: 15,
      tip: 'Click "Generate with RCA" to create this section based on the opportunity description.',
      type: 'text'
    },
    { 
      id: 'narrative', 
      title: 'Technical Approach', 
      prompt: 'This section explains HOW you will deliver the project. RCA will create a methodology based on your BUCKET and the opportunity.',
      charLimit: 2000,
      answer: '',
      status: 'pending',
      weight: 35,
      tip: 'This is usually the highest weighted section. Click "Generate with RCA" to create your approach.',
      type: 'text'
    },
    { 
      id: 'qualifications', 
      title: 'Past Performance & Experience', 
      prompt: 'This section proves you\'ve done this before. RCA will pull from your BUCKET\'s past performance.',
      charLimit: 1500,
      answer: '',
      status: 'pending',
      weight: 25,
      tip: 'RCA will use your BUCKET info. Add specifics like contract values and outcomes to make it stronger.',
      type: 'text'
    },
    { 
      id: 'references', 
      title: 'References', 
      prompt: 'Add 2-3 references from past similar work. These should be contacts who can verify your experience.',
      charLimit: 1000,
      answer: '',
      status: 'pending',
      weight: 5,
      tip: 'Get permission from references before listing them.',
      type: 'references',
      references: []
    },
    { 
      id: 'team', 
      title: 'Key Personnel', 
      prompt: 'Add your team members below. Names can be "TBD" if not confirmed yet.',
      charLimit: 1500,
      answer: '',
      status: 'pending',
      weight: 10,
      tip: 'You can use Title/Role only (e.g., "Project Manager - TBD") if names aren\'t confirmed yet.',
      type: 'team',
      teamMembers: []
    },
    { 
      id: 'timeline', 
      title: 'Management & Timeline', 
      prompt: 'This section shows your project plan. RCA will create milestones and deliverables based on the opportunity.',
      charLimit: 800,
      answer: '',
      status: 'pending',
      weight: 5,
      tip: 'Click "Generate with RCA" to create a realistic project timeline.',
      type: 'text'
    },
    { 
      id: 'budget', 
      title: 'Budget & Cost', 
      prompt: 'Budget auto-calculates from your team. Add travel, equipment, and other costs below.',
      charLimit: 1500,
      answer: '',
      status: 'pending',
      weight: 5,
      tip: 'Personnel is usually 60-70% of total budget. Stay under the funding ceiling.',
      type: 'budget',
      fringeRate: 30,
      indirectRate: 10,
      travelItems: [],
      equipmentItems: [],
      supplyItems: [],
      contractualItems: [],
      otherItems: []
    }
  ]

  // Common compliance items - not always required, depends on RFP
  const [complianceItems, setComplianceItems] = useState([
    { id: 'insurance_liability', label: 'General Liability Insurance', common: true, have: null, note: 'Usually required for contracts over $100K' },
    { id: 'insurance_workers', label: 'Workers Compensation Insurance', common: true, have: null, note: 'Required if you have employees' },
    { id: 'w9', label: 'W-9 / Tax ID Form', common: true, have: null, note: 'Almost always required' },
    { id: 'sam', label: 'SAM.gov Registration', common: false, have: null, note: 'Required for federal contracts/grants' },
    { id: 'cert_business', label: 'Business License', common: true, have: null, note: 'Check your local requirements' }
  ])

  // Auto-save state
  const [lastSaved, setLastSaved] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  // Initialize sections - LOAD SAVED PROGRESS FIRST, then fallback to defaults
  // Pre-fill Team and References from BUCKET (profileData) only if creating new
  const initializeSections = () => {
    // FIRST: Check if we have saved progress
    if (selectedSubmission?.draft_sections) {
      try {
        const savedSections = JSON.parse(selectedSubmission.draft_sections)
        if (savedSections && savedSections.length > 0) {
          console.log('Loading saved sections:', savedSections.length)
          setSections(savedSections)
          // Don't reset to section 0 - stay where they were or go to first incomplete
          const firstIncomplete = savedSections.findIndex(s => s.status !== 'complete')
          setCurrentSectionIndex(firstIncomplete >= 0 ? firstIncomplete : 0)
          return // Use saved data, don't create new
        }
      } catch (e) {
        console.error('Error parsing saved sections:', e)
      }
    }
    
    // NO SAVED DATA - Create new sections
    let sectionsToUse = [...defaultSections]
    
    if (rfpContent?.questions && rfpContent.questions.length > 0) {
      // Use extracted RFP questions
      sectionsToUse = rfpContent.questions.map((q, i) => ({
        id: `q${i}`,
        title: `Question ${i + 1}`,
        prompt: q,
        charLimit: 1500,
        answer: '',
        status: 'pending'
      }))
    }
    
    // Pre-fill Team Members from BUCKET - with default values
    const teamSectionIdx = sectionsToUse.findIndex(s => s.id === 'team')
    if (teamSectionIdx >= 0 && profileData?.team_members?.length > 0) {
      sectionsToUse[teamSectionIdx] = {
        ...sectionsToUse[teamSectionIdx],
        teamMembers: profileData.team_members.map(m => ({
          id: m.id || Date.now() + Math.random(),
          role: m.role || 'Team Member',
          name: m.name || 'TBD',
          hoursPerWeek: safeNumber(m.hoursPerWeek, 40),
          hourlyRate: safeNumber(m.hourlyRate, 50),
          description: m.description || ''
        }))
      }
    }
    
    // Pre-fill References from BUCKET - with default values
    const refSectionIdx = sectionsToUse.findIndex(s => s.id === 'references')
    if (refSectionIdx >= 0 && profileData?.references?.length > 0) {
      sectionsToUse[refSectionIdx] = {
        ...sectionsToUse[refSectionIdx],
        references: profileData.references.map(r => ({
          id: r.id || Date.now() + Math.random(),
          company: r.company || '',
          contactName: r.contactName || '',
          contactPhone: r.contactPhone || '',
          contactEmail: r.contactEmail || '',
          contractValue: r.contractValue || '',
          dates: r.dates || '',
          description: r.description || ''
        }))
      }
    }
    
    setSections(sectionsToUse)
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
      
      // Strip markdown formatting (asterisks, etc.)
      const cleanAnswer = data.answer
        .replace(/\*\*/g, '')  // Remove bold **
        .replace(/\*/g, '')    // Remove italic *
        .replace(/\_\_/g, '')  // Remove __
        .replace(/\_/g, '')    // Remove _
        .replace(/\#\#\#/g, '') // Remove headers
        .replace(/\#\#/g, '')
        .replace(/\#/g, '')
      
      setSections(prev => prev.map((s, i) => 
        i === sectionIndex ? { ...s, answer: cleanAnswer, status: 'complete' } : s
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

  // Polish/clean up user's rough draft
  const polishAnswer = async (sectionIndex) => {
    const section = sections[sectionIndex]
    
    if (!section.answer || section.answer.trim().length < 20) {
      alert('Please write at least a few sentences first, then click Polish.')
      return
    }
    
    // Update status to generating
    setSections(prev => prev.map((s, i) => 
      i === sectionIndex ? { ...s, status: 'generating' } : s
    ))

    try {
      const response = await fetch('/api/polish-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: section,
          opportunity: selectedSubmission,
          profile: profileData,
          roughDraft: section.answer,
          charLimit: section.charLimit
        })
      })

      if (!response.ok) throw new Error('Failed to polish')

      const data = await response.json()
      
      // Strip markdown formatting
      const cleanAnswer = data.answer
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/\_\_/g, '')
        .replace(/\_/g, '')
        .replace(/\#\#\#/g, '')
        .replace(/\#\#/g, '')
        .replace(/\#/g, '')
      
      setSections(prev => prev.map((s, i) => 
        i === sectionIndex ? { ...s, answer: cleanAnswer, status: 'complete' } : s
      ))
    } catch (err) {
      console.error('Polish error:', err)
      alert('Could not polish. Please try again.')
      setSections(prev => prev.map((s, i) => 
        i === sectionIndex ? { ...s, status: 'complete' } : s
      ))
    }
  }

  // Update answer manually
  const updateAnswer = (sectionIndex, newAnswer) => {
    setSections(prev => prev.map((s, i) => 
      i === sectionIndex ? { ...s, answer: newAnswer, status: 'complete' } : s
    ))
    triggerAutoSave()
  }

  // ==========================================
  // TEAM MEMBER FUNCTIONS
  // ==========================================
  const addTeamMember = (sectionIndex) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        const newMember = {
          id: Date.now(),
          role: '',
          name: 'TBD',
          hoursPerWeek: 40,
          hourlyRate: 50,
          description: ''
        }
        return { ...s, teamMembers: [...(s.teamMembers || []), newMember] }
      }
      return s
    }))
    triggerAutoSave()
  }

  const updateTeamMember = (sectionIndex, memberId, field, value) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        const updated = (s.teamMembers || []).map(m => 
          m.id === memberId ? { ...m, [field]: value } : m
        )
        return { ...s, teamMembers: updated, status: 'complete' }
      }
      return s
    }))
    triggerAutoSave()
  }

  const removeTeamMember = (sectionIndex, memberId) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        return { ...s, teamMembers: (s.teamMembers || []).filter(m => m.id !== memberId) }
      }
      return s
    }))
    triggerAutoSave()
  }

  // Generate team narrative from members
  const generateTeamNarrative = (sectionIndex) => {
    const section = sections[sectionIndex]
    const members = section.teamMembers || []
    if (members.length === 0) {
      alert('Add at least one team member first')
      return
    }
    
    const narrative = members.map(m => 
      `${m.role}${m.name && m.name !== 'TBD' ? ` (${m.name})` : ''}: ${m.description || 'Key team member'} - ${m.hoursPerWeek} hours/week`
    ).join('\n\n')
    
    updateAnswer(sectionIndex, narrative)
  }

  // ==========================================
  // REFERENCE FUNCTIONS
  // ==========================================
  const addReference = (sectionIndex) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        const newRef = {
          id: Date.now(),
          company: '',
          contactName: '',
          contactPhone: '',
          contactEmail: '',
          contractValue: '',
          dates: '',
          description: ''
        }
        return { ...s, references: [...(s.references || []), newRef] }
      }
      return s
    }))
    triggerAutoSave()
  }

  const updateReference = (sectionIndex, refId, field, value) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        const updated = (s.references || []).map(r => 
          r.id === refId ? { ...r, [field]: value } : r
        )
        return { ...s, references: updated, status: 'complete' }
      }
      return s
    }))
    triggerAutoSave()
  }

  const removeReference = (sectionIndex, refId) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        return { ...s, references: (s.references || []).filter(r => r.id !== refId) }
      }
      return s
    }))
    triggerAutoSave()
  }

  // ==========================================
  // BUDGET FUNCTIONS
  // ==========================================
  const calculatePersonnelCost = () => {
    const teamSection = sections.find(s => s.id === 'team')
    if (!teamSection || !teamSection.teamMembers) return 0
    
    // Calculate annual cost: hours/week × rate × 52 weeks
    return teamSection.teamMembers.reduce((total, m) => {
      const hours = safeNumber(m.hoursPerWeek, 40)
      const rate = safeNumber(m.hourlyRate, 0)
      return total + (hours * rate * 52)
    }, 0)
  }

  const addOtherCost = (sectionIndex) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        const newCost = {
          id: Date.now(),
          category: '',
          description: '',
          amount: 0
        }
        return { ...s, otherCosts: [...(s.otherCosts || []), newCost] }
      }
      return s
    }))
    triggerAutoSave()
  }

  const updateOtherCost = (sectionIndex, costId, field, value) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        const updated = (s.otherCosts || []).map(c => 
          c.id === costId ? { ...c, [field]: value } : c
        )
        return { ...s, otherCosts: updated, status: 'complete' }
      }
      return s
    }))
    triggerAutoSave()
  }

  const removeOtherCost = (sectionIndex, costId) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        return { ...s, otherCosts: (s.otherCosts || []).filter(c => c.id !== costId) }
      }
      return s
    }))
    triggerAutoSave()
  }

  const calculateTotalBudget = () => {
    const budgetSection = sections.find(s => s.id === 'budget')
    const personnel = safeNumber(calculatePersonnelCost(), 0)
    const otherCosts = (budgetSection?.otherCosts || []).reduce((sum, c) => sum + safeNumber(c.amount, 0), 0)
    const subtotal = personnel + otherCosts
    const indirect = Math.round(subtotal * 0.15) // 15% indirect
    return { 
      personnel: safeNumber(personnel, 0), 
      otherCosts: safeNumber(otherCosts, 0), 
      indirect: safeNumber(indirect, 0), 
      total: safeNumber(subtotal + indirect, 0) 
    }
  }

  // Parse budget ceiling from string like "$500,000" or "500000"
  const parseBudgetCeiling = (value) => {
    if (!value) return null
    const cleaned = value.toString().replace(/[$,\s]/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }

  // Add item to a budget category
  const addBudgetItem = (sectionIndex, category, defaultItem) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        const newItem = { id: Date.now(), ...defaultItem }
        const items = s[category] || []
        return { ...s, [category]: [...items, newItem], status: 'complete' }
      }
      return s
    }))
    triggerAutoSave()
  }

  // Update item in a budget category
  const updateBudgetItem = (sectionIndex, category, itemId, field, value) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        const updated = (s[category] || []).map(item => 
          item.id === itemId ? { ...item, [field]: value } : item
        )
        return { ...s, [category]: updated, status: 'complete' }
      }
      return s
    }))
    triggerAutoSave()
  }

  // Remove item from a budget category
  const removeBudgetItem = (sectionIndex, category, itemId) => {
    setSections(prev => prev.map((s, i) => {
      if (i === sectionIndex) {
        return { ...s, [category]: (s[category] || []).filter(item => item.id !== itemId) }
      }
      return s
    }))
    triggerAutoSave()
  }

  // Calculate direct costs (everything except indirect)
  const calculateDirectCosts = (budgetSection) => {
    const personnel = calculatePersonnelCost()
    const fringe = personnel * ((budgetSection?.fringeRate || 30) / 100)
    const travel = (budgetSection?.travelItems || []).reduce((sum, t) => sum + ((t.trips || 0) * (t.costPerTrip || 0)), 0)
    const equipment = (budgetSection?.equipmentItems || []).reduce((sum, e) => sum + ((e.quantity || 0) * (e.unitCost || 0)), 0)
    const supplies = (budgetSection?.supplyItems || []).reduce((sum, s) => sum + (s.amount || 0), 0)
    const contractual = (budgetSection?.contractualItems || []).reduce((sum, c) => sum + ((c.hours || 0) * (c.rate || 0)), 0)
    const other = (budgetSection?.otherItems || []).reduce((sum, o) => sum + (o.amount || 0), 0)
    
    return personnel + fringe + travel + equipment + supplies + contractual + other
  }

  // Calculate full budget with all categories
  const calculateFullBudget = (budgetSection) => {
    const personnel = safeNumber(calculatePersonnelCost(), 0)
    const fringeRate = safeNumber(budgetSection?.fringeRate, 30)
    const fringe = Math.round(personnel * (fringeRate / 100))
    
    const travel = (budgetSection?.travelItems || []).reduce((sum, t) => 
      sum + (safeNumber(t.trips, 0) * safeNumber(t.costPerTrip, 0)), 0)
    
    const equipment = (budgetSection?.equipmentItems || []).reduce((sum, e) => 
      sum + (safeNumber(e.quantity, 0) * safeNumber(e.unitCost, 0)), 0)
    
    const supplies = (budgetSection?.supplyItems || []).reduce((sum, s) => 
      sum + safeNumber(s.amount, 0), 0)
    
    const contractual = (budgetSection?.contractualItems || []).reduce((sum, c) => 
      sum + (safeNumber(c.hours, 0) * safeNumber(c.rate, 0)), 0)
    
    const other = (budgetSection?.otherItems || []).reduce((sum, o) => 
      sum + safeNumber(o.amount, 0), 0)
    
    const directTotal = personnel + fringe + travel + equipment + supplies + contractual + other
    const indirectRate = safeNumber(budgetSection?.indirectRate, 10)
    const indirect = Math.round(directTotal * (indirectRate / 100))
    const total = directTotal + indirect
    
    return { 
      personnel: safeNumber(personnel, 0), 
      fringe: safeNumber(fringe, 0), 
      travel: safeNumber(travel, 0), 
      equipment: safeNumber(equipment, 0), 
      supplies: safeNumber(supplies, 0), 
      contractual: safeNumber(contractual, 0), 
      other: safeNumber(other, 0), 
      indirect: safeNumber(indirect, 0), 
      total: safeNumber(total, 0) 
    }
  }

  // Generate budget narrative from calculated values
  const generateBudgetNarrative = (budget) => {
    const lines = []
    
    lines.push('BUDGET JUSTIFICATION\n')
    
    const p = safeNumber(budget.personnel, 0)
    const f = safeNumber(budget.fringe, 0)
    const tr = safeNumber(budget.travel, 0)
    const eq = safeNumber(budget.equipment, 0)
    const su = safeNumber(budget.supplies, 0)
    const co = safeNumber(budget.contractual, 0)
    const ot = safeNumber(budget.other, 0)
    const ind = safeNumber(budget.indirect, 0)
    const tot = safeNumber(budget.total, 0)
    
    if (p > 0) {
      lines.push(`Personnel: $${p.toLocaleString()} - Salaries for project staff including project manager, program staff, and support personnel.`)
    }
    
    if (f > 0) {
      lines.push(`Fringe Benefits: $${f.toLocaleString()} - Employee benefits including health insurance, retirement, and payroll taxes.`)
    }
    
    if (tr > 0) {
      lines.push(`Travel: $${tr.toLocaleString()} - Local and out-of-area travel for project activities, site visits, and meetings.`)
    }
    
    if (eq > 0) {
      lines.push(`Equipment: $${eq.toLocaleString()} - Major equipment purchases required for project implementation.`)
    }
    
    if (su > 0) {
      lines.push(`Supplies: $${su.toLocaleString()} - Office supplies, program materials, and consumable items.`)
    }
    
    if (co > 0) {
      lines.push(`Contractual: $${co.toLocaleString()} - Consultant fees and subcontractor costs for specialized services.`)
    }
    
    if (ot > 0) {
      lines.push(`Other Direct Costs: $${ot.toLocaleString()} - Facility costs, insurance, communications, and other operational expenses.`)
    }
    
    if (ind > 0) {
      lines.push(`Indirect Costs: $${ind.toLocaleString()} - Administrative overhead and facilities costs.`)
    }
    
    lines.push(`\nTOTAL PROJECT COST: $${tot.toLocaleString()}`)
    
    return lines.join('\n\n')
  }

  // ==========================================
  // AUTO-SAVE FUNCTIONS
  // ==========================================
  const triggerAutoSave = () => {
    // Debounced auto-save
    if (window.autoSaveTimeout) clearTimeout(window.autoSaveTimeout)
    window.autoSaveTimeout = setTimeout(() => {
      saveProgress()
    }, 2000) // Save 2 seconds after last change
  }

  const saveProgress = async () => {
    if (!selectedSubmission || !session?.user?.id) return
    
    setIsSaving(true)
    try {
      const draftData = {
        draft_sections: JSON.stringify(sections),
        draft_strategy: JSON.stringify(generatedStrategy),
        draft_compliance: JSON.stringify(complianceItems),
        updated_at: new Date().toISOString()
      }
      
      // Save sections progress to database
      await supabase
        .from('submissions')
        .update(draftData)
        .eq('id', selectedSubmission.id)
      
      // Also update local state so initializeSections can read it
      setSelectedSubmission(prev => ({
        ...prev,
        draft_sections: draftData.draft_sections,
        draft_strategy: draftData.draft_strategy,
        draft_compliance: draftData.draft_compliance
      }))
      
      setLastSaved(new Date())
    } catch (err) {
      console.error('Auto-save error:', err)
    }
    setIsSaving(false)
  }

  // Calculate % complete
  const getCompletionPercent = () => {
    if (sections.length === 0) return 0
    const completed = sections.filter(s => s.status === 'complete').length
    return Math.round((completed / sections.length) * 100)
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
              
              {/* Capabilities to Highlight */}
              {generatedStrategy.fromBucket && generatedStrategy.fromBucket.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '10px' }}>
                    💪 CAPABILITIES TO HIGHLIGHT
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
              {/* WHAT THIS CONTRACT/GRANT IS ABOUT */}
              <div style={{
                backgroundColor: colors.card,
                borderRadius: '16px',
                padding: '25px',
                marginBottom: '20px',
                border: `1px solid ${colors.border}`
              }}>
                <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '10px', textTransform: 'uppercase' }}>
                  📋 What They're Looking For
                </p>
                <p style={{ color: colors.text, fontSize: '14px', lineHeight: '1.7', marginBottom: '15px' }}>
                  {selectedSubmission.description}
                </p>
                {selectedSubmission.agency && (
                  <p style={{ color: colors.muted, fontSize: '12px' }}>
                    <strong>Agency:</strong> {selectedSubmission.agency}
                  </p>
                )}
                {selectedSubmission.estimated_value && (
                  <p style={{ color: colors.gold, fontSize: '12px', marginTop: '5px' }}>
                    <strong>Value:</strong> {selectedSubmission.estimated_value}
                  </p>
                )}
              </div>

              {/* NOW ask for direction */}
              <div style={{
                backgroundColor: colors.card,
                border: `2px solid ${colors.gold}`,
                borderRadius: '16px',
                padding: '30px',
                textAlign: 'center',
                marginBottom: '25px'
              }}>
                <p style={{ color: colors.gold, fontSize: '20px', marginBottom: '10px' }}>
                  Choose Your Approach
                </p>
                <p style={{ color: colors.muted, fontSize: '13px', marginBottom: '25px' }}>
                  How do you want to position your response to their needs?
                </p>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '25px' }}>
                  {['🎯 Experience-focused', '🤝 Community partnerships', '📊 Data-driven', '💰 Cost-effective'].map(pick => (
                    <button 
                      key={pick} 
                      onClick={() => generateStrategy(pick)}
                      style={{
                        backgroundColor: '#1a1a1a',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '20px',
                        padding: '12px 20px',
                        color: '#ccc',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      {pick}
                    </button>
                  ))}
                </div>

                <p style={{ color: colors.muted, fontSize: '12px', marginBottom: '15px' }}>
                  Or describe your own angle:
                </p>
                
                <textarea
                  value={userAngle}
                  onChange={(e) => setUserAngle(e.target.value)}
                  placeholder="Example: Focus on our track record delivering similar programs..."
                  style={{
                    width: '100%',
                    backgroundColor: '#1a1a1a',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    padding: '15px',
                    color: colors.text,
                    fontSize: '14px',
                    resize: 'none',
                    minHeight: '60px',
                    marginBottom: '20px'
                  }}
                />
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
            onClick={async () => {
              await saveProgress() // Save and WAIT before leaving
              setCurrentPhase(2)
            }}
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

          {/* Title and Auto-save */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
            <h2 style={{ color: colors.text, fontSize: '20px', margin: 0 }}>
              {selectedSubmission.title}
            </h2>
            <span style={{ color: colors.muted, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {isSaving ? '💾 Saving...' : lastSaved ? `✓ Saved ${lastSaved.toLocaleTimeString()}` : ''}
            </span>
          </div>
          <p style={{ color: colors.muted, fontSize: '13px', marginBottom: '30px' }}>
            {completedCount} of {sections.length} sections complete ({getCompletionPercent()}%)
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
              {/* Section Header with Weight */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ color: colors.text, fontSize: '18px', margin: 0 }}>
                    {currentSection.title}
                  </h3>
                  {currentSection.weight && (
                    <span style={{ 
                      backgroundColor: `${colors.gold}20`, 
                      color: colors.gold, 
                      padding: '4px 10px', 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {currentSection.weight}% of score
                    </span>
                  )}
                </div>
                <p style={{ color: colors.muted, fontSize: '13px', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                  {currentSection.prompt}
                </p>
                {currentSection.tip && (
                  <p style={{ 
                    color: colors.primary, 
                    fontSize: '12px', 
                    margin: 0, 
                    padding: '8px 12px',
                    backgroundColor: `${colors.primary}10`,
                    borderRadius: '6px',
                    borderLeft: `3px solid ${colors.primary}`
                  }}>
                    💡 {currentSection.tip}
                  </p>
                )}
              </div>

              {/* Answer Area - Conditional by type */}
              {currentSection.status === 'generating' ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p style={{ color: colors.gold, fontSize: '16px' }}>🤖 RCA is writing...</p>
                  <p style={{ color: colors.muted, fontSize: '13px' }}>Crafting your response based on the strategy</p>
                </div>
              ) : currentSection.type === 'team' ? (
                /* TEAM SECTION - Structured Input */
                <div>
                  {/* Auto-fill notice */}
                  {(currentSection.teamMembers || []).length > 0 && profileData?.team_members?.length > 0 && (
                    <div style={{
                      backgroundColor: `${colors.primary}10`,
                      padding: '12px 15px',
                      borderRadius: '8px',
                      marginBottom: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <span style={{ fontSize: '16px' }}>🪣</span>
                      <span style={{ color: colors.primary, fontSize: '13px' }}>
                        Pre-filled from your BUCKET. Edit or add more team members below.
                      </span>
                    </div>
                  )}
                  
                  {/* Team Members List */}
                  {(currentSection.teamMembers || []).map((member, idx) => (
                    <div key={member.id} style={{
                      backgroundColor: '#1a1a1a',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '15px',
                      border: `1px solid ${colors.border}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ color: colors.muted, fontSize: '12px' }}>Team Member {idx + 1}</span>
                        <button 
                          onClick={() => removeTeamMember(currentSectionIndex, member.id)}
                          style={{ background: 'none', border: 'none', color: colors.danger, cursor: 'pointer', fontSize: '12px' }}
                        >
                          Remove
                        </button>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Role/Title *</label>
                          <input
                            value={member.role}
                            onChange={(e) => updateTeamMember(currentSectionIndex, member.id, 'role', e.target.value)}
                            placeholder="e.g., Project Manager"
                            style={{
                              width: '100%',
                              padding: '10px',
                              backgroundColor: colors.background,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              color: colors.text,
                              fontSize: '14px'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Name (or TBD)</label>
                          <input
                            value={member.name}
                            onChange={(e) => updateTeamMember(currentSectionIndex, member.id, 'name', e.target.value)}
                            placeholder="John Smith or TBD"
                            style={{
                              width: '100%',
                              padding: '10px',
                              backgroundColor: colors.background,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              color: colors.text,
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Hours/Week</label>
                          <input
                            type="number"
                            value={member.hoursPerWeek}
                            onChange={(e) => updateTeamMember(currentSectionIndex, member.id, 'hoursPerWeek', parseInt(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: '10px',
                              backgroundColor: colors.background,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              color: colors.text,
                              fontSize: '14px'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Hourly Rate ($)</label>
                          <input
                            type="number"
                            value={member.hourlyRate}
                            onChange={(e) => updateTeamMember(currentSectionIndex, member.id, 'hourlyRate', parseInt(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: '10px',
                              backgroundColor: colors.background,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              color: colors.text,
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Role Description</label>
                        <input
                          value={member.description}
                          onChange={(e) => updateTeamMember(currentSectionIndex, member.id, 'description', e.target.value)}
                          placeholder="Brief description of responsibilities"
                          style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '6px',
                            color: colors.text,
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      
                      <p style={{ color: colors.gold, fontSize: '12px', margin: '10px 0 0 0' }}>
                        Est. annual cost: ${(safeNumber(member.hoursPerWeek, 40) * safeNumber(member.hourlyRate, 0) * 52).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => addTeamMember(currentSectionIndex)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      backgroundColor: 'transparent',
                      border: `2px dashed ${colors.border}`,
                      borderRadius: '10px',
                      color: colors.muted,
                      fontSize: '14px',
                      cursor: 'pointer',
                      marginBottom: '20px'
                    }}
                  >
                    + Add Team Member
                  </button>
                  
                  {(currentSection.teamMembers || []).length > 0 && (
                    <button
                      onClick={() => generateTeamNarrative(currentSectionIndex)}
                      style={{
                        width: '100%',
                        padding: '14px',
                        backgroundColor: colors.gold,
                        border: 'none',
                        borderRadius: '10px',
                        color: colors.background,
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      🤖 Generate Team Narrative
                    </button>
                  )}
                  
                  {currentSection.answer && (
                    <div style={{ marginTop: '20px' }}>
                      <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '8px' }}>Generated Narrative (editable)</label>
                      <textarea
                        value={currentSection.answer}
                        onChange={(e) => updateAnswer(currentSectionIndex, e.target.value)}
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
                          minHeight: '150px'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button
                          onClick={() => generateTeamNarrative(currentSectionIndex)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px',
                            color: colors.muted,
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          🔄 Regenerate
                        </button>
                        <button
                          onClick={() => polishAnswer(currentSectionIndex)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            backgroundColor: colors.gold,
                            border: 'none',
                            borderRadius: '8px',
                            color: colors.background,
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          ✨ Polish
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Mark Complete - shows when has team members but no narrative yet */}
                  {(currentSection.teamMembers || []).length > 0 && !currentSection.answer && (
                    <p style={{ color: colors.gold, fontSize: '12px', marginTop: '15px', textAlign: 'center' }}>
                      👆 Click "Generate Team Narrative" to complete this section
                    </p>
                  )}
                </div>

              ) : currentSection.type === 'references' ? (
                /* REFERENCES SECTION */
                <div>
                  {/* Auto-fill notice */}
                  {(currentSection.references || []).length > 0 && profileData?.references?.length > 0 && (
                    <div style={{
                      backgroundColor: `${colors.primary}10`,
                      padding: '12px 15px',
                      borderRadius: '8px',
                      marginBottom: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <span style={{ fontSize: '16px' }}>🪣</span>
                      <span style={{ color: colors.primary, fontSize: '13px' }}>
                        Pre-filled from your BUCKET. Edit or add more references below.
                      </span>
                    </div>
                  )}
                  
                  {(currentSection.references || []).map((ref, idx) => (
                    <div key={ref.id} style={{
                      backgroundColor: '#1a1a1a',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '15px',
                      border: `1px solid ${colors.border}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ color: colors.muted, fontSize: '12px' }}>Reference {idx + 1}</span>
                        <button 
                          onClick={() => removeReference(currentSectionIndex, ref.id)}
                          style={{ background: 'none', border: 'none', color: colors.danger, cursor: 'pointer', fontSize: '12px' }}
                        >
                          Remove
                        </button>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Company/Organization *</label>
                          <input
                            value={ref.company}
                            onChange={(e) => updateReference(currentSectionIndex, ref.id, 'company', e.target.value)}
                            placeholder="e.g., LA County DCFS"
                            style={{
                              width: '100%',
                              padding: '10px',
                              backgroundColor: colors.background,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              color: colors.text,
                              fontSize: '14px'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Contract Value</label>
                          <input
                            value={ref.contractValue}
                            onChange={(e) => updateReference(currentSectionIndex, ref.id, 'contractValue', e.target.value)}
                            placeholder="e.g., $250,000"
                            style={{
                              width: '100%',
                              padding: '10px',
                              backgroundColor: colors.background,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              color: colors.text,
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Contact Name *</label>
                          <input
                            value={ref.contactName}
                            onChange={(e) => updateReference(currentSectionIndex, ref.id, 'contactName', e.target.value)}
                            placeholder="e.g., Jane Smith"
                            style={{
                              width: '100%',
                              padding: '10px',
                              backgroundColor: colors.background,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              color: colors.text,
                              fontSize: '14px'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Phone</label>
                          <input
                            value={ref.contactPhone}
                            onChange={(e) => updateReference(currentSectionIndex, ref.id, 'contactPhone', e.target.value)}
                            placeholder="(555) 123-4567"
                            style={{
                              width: '100%',
                              padding: '10px',
                              backgroundColor: colors.background,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              color: colors.text,
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Email</label>
                        <input
                          value={ref.contactEmail}
                          onChange={(e) => updateReference(currentSectionIndex, ref.id, 'contactEmail', e.target.value)}
                          placeholder="jane.smith@agency.gov"
                          style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '6px',
                            color: colors.text,
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '4px' }}>Brief Description of Work</label>
                        <input
                          value={ref.description}
                          onChange={(e) => updateReference(currentSectionIndex, ref.id, 'description', e.target.value)}
                          placeholder="e.g., Mental health services for foster youth"
                          style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '6px',
                            color: colors.text,
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => addReference(currentSectionIndex)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      backgroundColor: 'transparent',
                      border: `2px dashed ${colors.border}`,
                      borderRadius: '10px',
                      color: colors.muted,
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Reference
                  </button>
                  
                  <p style={{ color: colors.muted, fontSize: '12px', marginTop: '15px', textAlign: 'center' }}>
                    ⚠️ Contact your references BEFORE submitting to get their permission
                  </p>
                  
                  {/* Generate Narrative Button */}
                  {(currentSection.references || []).length > 0 && (
                    <button
                      onClick={() => {
                        // Generate reference narrative from structured data
                        const refs = currentSection.references || []
                        const narrative = refs.map((r, i) => 
                          `Reference ${i + 1}: ${r.company || 'Organization'}\nContact: ${r.contactName || 'Name'}, ${r.contactPhone || 'Phone'}, ${r.contactEmail || 'Email'}\n${r.contractValue ? `Contract Value: ${r.contractValue}\n` : ''}${r.description || 'Past project work'}`
                        ).join('\n\n')
                        updateAnswer(currentSectionIndex, narrative)
                      }}
                      style={{
                        width: '100%',
                        padding: '14px',
                        backgroundColor: colors.gold,
                        border: 'none',
                        borderRadius: '10px',
                        color: colors.background,
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginTop: '15px'
                      }}
                    >
                      ✓ Save References
                    </button>
                  )}
                  
                  {/* Show generated narrative */}
                  {currentSection.answer && (
                    <div style={{ marginTop: '15px' }}>
                      <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '8px' }}>Reference Summary (editable)</label>
                      <textarea
                        value={currentSection.answer}
                        onChange={(e) => updateAnswer(currentSectionIndex, e.target.value)}
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
                          minHeight: '120px'
                        }}
                      />
                    </div>
                  )}
                </div>

              ) : currentSection.type === 'budget' ? (
                /* BUDGET BUILDER - Real form like grant applications */
                <div>
                  {/* Budget Ceiling Warning */}
                  <div style={{
                    backgroundColor: `${colors.gold}15`,
                    padding: '15px 20px',
                    borderRadius: '10px',
                    marginBottom: '20px',
                    border: `1px solid ${colors.gold}30`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <p style={{ color: colors.gold, fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Funding Available</p>
                      <p style={{ color: colors.text, fontSize: '20px', fontWeight: '700', margin: 0 }}>
                        {formatCurrency(selectedSubmission.estimated_value)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: colors.muted, fontSize: '12px', margin: '0 0 4px 0' }}>Your Total</p>
                      <p style={{ 
                        color: calculateTotalBudget().total > parseBudgetCeiling(selectedSubmission.estimated_value) ? colors.danger : colors.primary, 
                        fontSize: '20px', 
                        fontWeight: '700', 
                        margin: 0 
                      }}>
                        {formatCurrency(calculateTotalBudget().total)}
                      </p>
                    </div>
                  </div>

                  {/* CATEGORY 1: PERSONNEL */}
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '15px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h4 style={{ color: colors.text, fontSize: '14px', margin: 0 }}>
                        👥 PERSONNEL & SALARIES
                      </h4>
                      <span style={{ color: colors.muted, fontSize: '11px' }}>Usually 60-70% of budget</span>
                    </div>
                    
                    {(() => {
                      const teamSection = sections.find(s => s.id === 'team')
                      const members = teamSection?.teamMembers || []
                      if (members.length === 0) {
                        return (
                          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: colors.background, borderRadius: '8px' }}>
                            <p style={{ color: colors.muted, fontSize: '13px', margin: '0 0 10px 0' }}>
                              No team members added yet
                            </p>
                            <button
                              onClick={() => {
                                const teamIdx = sections.findIndex(s => s.id === 'team')
                                if (teamIdx >= 0) setCurrentSectionIndex(teamIdx)
                              }}
                              style={{
                                padding: '10px 20px',
                                backgroundColor: colors.primary,
                                border: 'none',
                                borderRadius: '6px',
                                color: colors.background,
                                fontSize: '13px',
                                cursor: 'pointer'
                              }}
                            >
                              → Go to Team Section
                            </button>
                          </div>
                        )
                      }
                      return (
                        <div style={{ backgroundColor: colors.background, borderRadius: '8px', overflow: 'hidden' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 15px', borderBottom: `1px solid ${colors.border}` }}>
                            <span style={{ color: colors.muted, fontSize: '11px', textTransform: 'uppercase' }}>Position</span>
                            <span style={{ color: colors.muted, fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Hours/Wk</span>
                            <span style={{ color: colors.muted, fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Rate</span>
                            <span style={{ color: colors.muted, fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Annual</span>
                          </div>
                          {members.map(m => (
                            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 15px', borderBottom: `1px solid ${colors.border}` }}>
                              <span style={{ color: colors.text, fontSize: '13px' }}>{m.role || 'Unnamed'}</span>
                              <span style={{ color: colors.text, fontSize: '13px', textAlign: 'right' }}>{safeNumber(m.hoursPerWeek, 40)}</span>
                              <span style={{ color: colors.text, fontSize: '13px', textAlign: 'right' }}>${safeNumber(m.hourlyRate, 0)}</span>
                              <span style={{ color: colors.gold, fontSize: '13px', textAlign: 'right', fontWeight: '600' }}>
                                ${(safeNumber(m.hoursPerWeek, 40) * safeNumber(m.hourlyRate, 0) * 52).toLocaleString()}
                              </span>
                            </div>
                          ))}
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 15px', backgroundColor: `${colors.gold}10` }}>
                            <span style={{ color: colors.text, fontSize: '13px', fontWeight: '600' }}>Personnel Subtotal</span>
                            <span></span>
                            <span></span>
                            <span style={{ color: colors.gold, fontSize: '14px', textAlign: 'right', fontWeight: '700' }}>
                              ${calculatePersonnelCost().toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* CATEGORY 2: FRINGE BENEFITS */}
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '15px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h4 style={{ color: colors.text, fontSize: '14px', margin: 0 }}>
                        🏥 FRINGE BENEFITS
                      </h4>
                      <span style={{ color: colors.muted, fontSize: '11px' }}>Usually 25-35% of personnel</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ color: colors.muted, fontSize: '13px' }}>Rate:</span>
                      <input
                        type="number"
                        value={currentSection.fringeRate || 30}
                        onChange={(e) => {
                          setSections(prev => prev.map((s, i) => 
                            i === currentSectionIndex ? { ...s, fringeRate: parseInt(e.target.value) || 0, status: 'complete' } : s
                          ))
                          triggerAutoSave()
                        }}
                        style={{
                          width: '70px',
                          padding: '8px',
                          backgroundColor: colors.background,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '6px',
                          color: colors.text,
                          fontSize: '14px',
                          textAlign: 'center'
                        }}
                      />
                      <span style={{ color: colors.muted, fontSize: '13px' }}>%</span>
                      <span style={{ marginLeft: 'auto', color: colors.gold, fontSize: '14px', fontWeight: '600' }}>
                        ${Math.round(calculatePersonnelCost() * ((currentSection.fringeRate || 30) / 100)).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* CATEGORY 3: TRAVEL */}
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '15px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <h4 style={{ color: colors.text, fontSize: '14px', margin: '0 0 15px 0' }}>
                      ✈️ TRAVEL
                    </h4>
                    {(currentSection.travelItems || []).map((item, idx) => (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                        <input
                          value={item.description}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'travelItems', item.id, 'description', e.target.value)}
                          placeholder="e.g., Site visits, conferences"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px' }}
                        />
                        <input
                          type="number"
                          value={item.trips}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'travelItems', item.id, 'trips', parseInt(e.target.value) || 0)}
                          placeholder="# trips"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px', textAlign: 'center' }}
                        />
                        <input
                          type="number"
                          value={item.costPerTrip}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'travelItems', item.id, 'costPerTrip', parseInt(e.target.value) || 0)}
                          placeholder="$/trip"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px', textAlign: 'center' }}
                        />
                        <span style={{ color: colors.gold, fontSize: '13px', textAlign: 'right' }}>
                          ${((item.trips || 0) * (item.costPerTrip || 0)).toLocaleString()}
                        </span>
                        <button onClick={() => removeBudgetItem(currentSectionIndex, 'travelItems', item.id)} style={{ background: 'none', border: 'none', color: colors.danger, cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => addBudgetItem(currentSectionIndex, 'travelItems', { description: '', trips: 1, costPerTrip: 0 })}
                      style={{ padding: '8px 16px', backgroundColor: 'transparent', border: `1px dashed ${colors.border}`, borderRadius: '6px', color: colors.muted, fontSize: '12px', cursor: 'pointer' }}
                    >
                      + Add Travel
                    </button>
                  </div>

                  {/* CATEGORY 4: EQUIPMENT */}
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '15px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h4 style={{ color: colors.text, fontSize: '14px', margin: 0 }}>
                        🖥️ EQUIPMENT
                      </h4>
                      <span style={{ color: colors.muted, fontSize: '11px' }}>Items over $5,000</span>
                    </div>
                    {(currentSection.equipmentItems || []).map((item, idx) => (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                        <input
                          value={item.description}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'equipmentItems', item.id, 'description', e.target.value)}
                          placeholder="e.g., Computer, Vehicle"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px' }}
                        />
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'equipmentItems', item.id, 'quantity', parseInt(e.target.value) || 0)}
                          placeholder="Qty"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px', textAlign: 'center' }}
                        />
                        <input
                          type="number"
                          value={item.unitCost}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'equipmentItems', item.id, 'unitCost', parseInt(e.target.value) || 0)}
                          placeholder="Unit $"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px', textAlign: 'center' }}
                        />
                        <button onClick={() => removeBudgetItem(currentSectionIndex, 'equipmentItems', item.id)} style={{ background: 'none', border: 'none', color: colors.danger, cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => addBudgetItem(currentSectionIndex, 'equipmentItems', { description: '', quantity: 1, unitCost: 0 })}
                      style={{ padding: '8px 16px', backgroundColor: 'transparent', border: `1px dashed ${colors.border}`, borderRadius: '6px', color: colors.muted, fontSize: '12px', cursor: 'pointer' }}
                    >
                      + Add Equipment
                    </button>
                  </div>

                  {/* CATEGORY 5: SUPPLIES */}
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '15px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h4 style={{ color: colors.text, fontSize: '14px', margin: 0 }}>
                        📦 SUPPLIES
                      </h4>
                      <span style={{ color: colors.muted, fontSize: '11px' }}>Items under $5,000</span>
                    </div>
                    {(currentSection.supplyItems || []).map((item, idx) => (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                        <input
                          value={item.description}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'supplyItems', item.id, 'description', e.target.value)}
                          placeholder="e.g., Office supplies, Program materials"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px' }}
                        />
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'supplyItems', item.id, 'amount', parseInt(e.target.value) || 0)}
                          placeholder="$0"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px', textAlign: 'center' }}
                        />
                        <button onClick={() => removeBudgetItem(currentSectionIndex, 'supplyItems', item.id)} style={{ background: 'none', border: 'none', color: colors.danger, cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => addBudgetItem(currentSectionIndex, 'supplyItems', { description: '', amount: 0 })}
                      style={{ padding: '8px 16px', backgroundColor: 'transparent', border: `1px dashed ${colors.border}`, borderRadius: '6px', color: colors.muted, fontSize: '12px', cursor: 'pointer' }}
                    >
                      + Add Supply
                    </button>
                  </div>

                  {/* CATEGORY 6: CONTRACTUAL */}
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '15px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <h4 style={{ color: colors.text, fontSize: '14px', margin: '0 0 15px 0' }}>
                      🤝 CONTRACTUAL / CONSULTANTS
                    </h4>
                    {(currentSection.contractualItems || []).map((item, idx) => (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                        <input
                          value={item.description}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'contractualItems', item.id, 'description', e.target.value)}
                          placeholder="e.g., IT Support, Evaluator"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px' }}
                        />
                        <input
                          type="number"
                          value={item.hours}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'contractualItems', item.id, 'hours', parseInt(e.target.value) || 0)}
                          placeholder="Hours"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px', textAlign: 'center' }}
                        />
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'contractualItems', item.id, 'rate', parseInt(e.target.value) || 0)}
                          placeholder="$/hr"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px', textAlign: 'center' }}
                        />
                        <span style={{ color: colors.gold, fontSize: '13px', textAlign: 'right' }}>
                          ${((item.hours || 0) * (item.rate || 0)).toLocaleString()}
                        </span>
                        <button onClick={() => removeBudgetItem(currentSectionIndex, 'contractualItems', item.id)} style={{ background: 'none', border: 'none', color: colors.danger, cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => addBudgetItem(currentSectionIndex, 'contractualItems', { description: '', hours: 0, rate: 0 })}
                      style={{ padding: '8px 16px', backgroundColor: 'transparent', border: `1px dashed ${colors.border}`, borderRadius: '6px', color: colors.muted, fontSize: '12px', cursor: 'pointer' }}
                    >
                      + Add Consultant/Contractor
                    </button>
                  </div>

                  {/* CATEGORY 7: OTHER DIRECT COSTS */}
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '15px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <h4 style={{ color: colors.text, fontSize: '14px', margin: '0 0 15px 0' }}>
                      📋 OTHER DIRECT COSTS
                    </h4>
                    {(currentSection.otherItems || []).map((item, idx) => (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                        <input
                          value={item.description}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'otherItems', item.id, 'description', e.target.value)}
                          placeholder="e.g., Rent, Insurance, Printing"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px' }}
                        />
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateBudgetItem(currentSectionIndex, 'otherItems', item.id, 'amount', parseInt(e.target.value) || 0)}
                          placeholder="$0"
                          style={{ padding: '8px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '13px', textAlign: 'center' }}
                        />
                        <button onClick={() => removeBudgetItem(currentSectionIndex, 'otherItems', item.id)} style={{ background: 'none', border: 'none', color: colors.danger, cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => addBudgetItem(currentSectionIndex, 'otherItems', { description: '', amount: 0 })}
                      style={{ padding: '8px 16px', backgroundColor: 'transparent', border: `1px dashed ${colors.border}`, borderRadius: '6px', color: colors.muted, fontSize: '12px', cursor: 'pointer' }}
                    >
                      + Add Other Cost
                    </button>
                  </div>

                  {/* CATEGORY 8: INDIRECT COSTS */}
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h4 style={{ color: colors.text, fontSize: '14px', margin: 0 }}>
                        🏢 INDIRECT COSTS
                      </h4>
                      <span style={{ color: colors.muted, fontSize: '11px' }}>Usually 10-15% (or your negotiated rate)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ color: colors.muted, fontSize: '13px' }}>Rate:</span>
                      <input
                        type="number"
                        value={currentSection.indirectRate || 10}
                        onChange={(e) => {
                          setSections(prev => prev.map((s, i) => 
                            i === currentSectionIndex ? { ...s, indirectRate: parseInt(e.target.value) || 0, status: 'complete' } : s
                          ))
                          triggerAutoSave()
                        }}
                        style={{
                          width: '70px',
                          padding: '8px',
                          backgroundColor: colors.background,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '6px',
                          color: colors.text,
                          fontSize: '14px',
                          textAlign: 'center'
                        }}
                      />
                      <span style={{ color: colors.muted, fontSize: '13px' }}>%</span>
                      <span style={{ marginLeft: 'auto', color: colors.gold, fontSize: '14px', fontWeight: '600' }}>
                        ${Math.round(calculateDirectCosts(currentSection) * ((currentSection.indirectRate || 10) / 100)).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* BUDGET TOTAL SUMMARY */}
                  <div style={{
                    backgroundColor: `${colors.primary}15`,
                    borderRadius: '12px',
                    padding: '25px',
                    border: `2px solid ${colors.primary}40`
                  }}>
                    <h4 style={{ color: colors.text, fontSize: '16px', margin: '0 0 20px 0', textAlign: 'center' }}>
                      💰 BUDGET SUMMARY
                    </h4>
                    
                    {(() => {
                      const budget = calculateFullBudget(currentSection)
                      const ceiling = parseBudgetCeiling(selectedSubmission.estimated_value)
                      const isOverBudget = ceiling && budget.total > ceiling
                      
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                            <span style={{ color: colors.muted, fontSize: '14px' }}>Personnel</span>
                            <span style={{ color: colors.text, fontSize: '14px' }}>${budget.personnel.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                            <span style={{ color: colors.muted, fontSize: '14px' }}>Fringe Benefits</span>
                            <span style={{ color: colors.text, fontSize: '14px' }}>${budget.fringe.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                            <span style={{ color: colors.muted, fontSize: '14px' }}>Travel</span>
                            <span style={{ color: colors.text, fontSize: '14px' }}>${budget.travel.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                            <span style={{ color: colors.muted, fontSize: '14px' }}>Equipment</span>
                            <span style={{ color: colors.text, fontSize: '14px' }}>${budget.equipment.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                            <span style={{ color: colors.muted, fontSize: '14px' }}>Supplies</span>
                            <span style={{ color: colors.text, fontSize: '14px' }}>${budget.supplies.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                            <span style={{ color: colors.muted, fontSize: '14px' }}>Contractual</span>
                            <span style={{ color: colors.text, fontSize: '14px' }}>${budget.contractual.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                            <span style={{ color: colors.muted, fontSize: '14px' }}>Other Direct Costs</span>
                            <span style={{ color: colors.text, fontSize: '14px' }}>${budget.other.toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                            <span style={{ color: colors.muted, fontSize: '14px' }}>Indirect Costs</span>
                            <span style={{ color: colors.text, fontSize: '14px' }}>${budget.indirect.toLocaleString()}</span>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', padding: '15px', backgroundColor: isOverBudget ? `${colors.danger}20` : `${colors.primary}20`, borderRadius: '8px' }}>
                            <span style={{ color: isOverBudget ? colors.danger : colors.primary, fontSize: '18px', fontWeight: '700' }}>TOTAL PROJECT COST</span>
                            <span style={{ color: isOverBudget ? colors.danger : colors.primary, fontSize: '18px', fontWeight: '700' }}>${Math.round(budget.total).toLocaleString()}</span>
                          </div>
                          
                          {isOverBudget && (
                            <p style={{ color: colors.danger, fontSize: '13px', marginTop: '15px', textAlign: 'center', padding: '10px', backgroundColor: `${colors.danger}10`, borderRadius: '6px' }}>
                              ⚠️ Over budget by ${(budget.total - ceiling).toLocaleString()}. Reduce costs or adjust team hours.
                            </p>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  
                  {/* Save / Regenerate Buttons */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    {currentSection.answer && (
                      <button
                        onClick={() => {
                          const budget = calculateFullBudget(currentSection)
                          const narrative = generateBudgetNarrative(budget)
                          updateAnswer(currentSectionIndex, narrative)
                        }}
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
                        🔄 Regenerate Narrative
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const budget = calculateFullBudget(currentSection)
                        const narrative = generateBudgetNarrative(budget)
                        updateAnswer(currentSectionIndex, narrative)
                      }}
                      style={{
                        flex: currentSection.answer ? 1 : 'auto',
                        width: currentSection.answer ? 'auto' : '100%',
                        padding: '16px',
                        backgroundColor: colors.gold,
                        border: 'none',
                        borderRadius: '10px',
                        color: colors.background,
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      ✓ {currentSection.answer ? 'Update Budget' : 'Save Budget & Generate Narrative'}
                    </button>
                  </div>
                  
                  {/* Show generated narrative */}
                  {currentSection.answer && (
                    <div style={{ marginTop: '20px' }}>
                      <label style={{ color: colors.muted, fontSize: '11px', display: 'block', marginBottom: '8px' }}>Budget Justification (editable)</label>
                      <textarea
                        value={currentSection.answer}
                        onChange={(e) => updateAnswer(currentSectionIndex, e.target.value)}
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
                          minHeight: '200px'
                        }}
                      />
                    </div>
                  )}
                </div>

              ) : (
                /* DEFAULT TEXT SECTION - RCA GENERATES, USER EDITS */
                <>
                  {/* If no content yet, show the "Generate First" UI */}
                  {!currentSection.answer ? (
                    <div style={{
                      backgroundColor: colors.card,
                      borderRadius: '12px',
                      padding: '30px',
                      border: `1px solid ${colors.border}`,
                      textAlign: 'center'
                    }}>
                      <div style={{ marginBottom: '20px' }}>
                        <span style={{ fontSize: '40px' }}>🤖</span>
                      </div>
                      <h3 style={{ color: colors.text, fontSize: '18px', margin: '0 0 10px 0' }}>
                        Let RCA Write This Section
                      </h3>
                      <p style={{ color: colors.muted, fontSize: '14px', margin: '0 0 25px 0', lineHeight: '1.6' }}>
                        Based on the opportunity and your BUCKET, RCA will generate a professional response for this section. You can edit it afterward.
                      </p>
                      <button
                        onClick={() => generateAnswer(currentSectionIndex)}
                        disabled={currentSection.status === 'generating'}
                        style={{
                          padding: '16px 40px',
                          backgroundColor: colors.gold,
                          border: 'none',
                          borderRadius: '10px',
                          color: colors.background,
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: currentSection.status === 'generating' ? 'wait' : 'pointer',
                          opacity: currentSection.status === 'generating' ? 0.7 : 1
                        }}
                      >
                        {currentSection.status === 'generating' ? '⏳ Generating...' : '🤖 Generate This Section'}
                      </button>
                    </div>
                  ) : (
                    /* Content exists - show editable textarea with regenerate/polish options */
                    <>
                      <p style={{ color: colors.muted, fontSize: '12px', marginBottom: '8px' }}>
                        ✏️ Review and edit as needed:
                      </p>
                      <textarea
                        value={currentSection.answer}
                        onChange={(e) => updateAnswer(currentSectionIndex, e.target.value)}
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

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          onClick={() => generateAnswer(currentSectionIndex)}
                          disabled={currentSection.status === 'generating'}
                          style={{
                            flex: 1,
                            padding: '12px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px',
                            color: colors.muted,
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          🔄 Regenerate
                        </button>
                        <button
                          onClick={() => polishAnswer(currentSectionIndex)}
                          disabled={currentSection.status === 'generating'}
                          style={{
                            flex: 1,
                            padding: '12px',
                            backgroundColor: colors.gold,
                            border: 'none',
                            borderRadius: '8px',
                            color: colors.background,
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          ✨ Polish & Improve
                        </button>
                      </div>
                    </>
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
                  padding: '16px',
                  backgroundColor: colors.primary,
                  border: 'none',
                  borderRadius: '10px',
                  color: colors.background,
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                NEXT SECTION →
              </button>
            ) : (
              <button
                onClick={() => {
                  if (completedCount === sections.length) {
                    // All complete - go to review
                    setCurrentPhase(4)
                  } else {
                    // Find next incomplete section and go there
                    const nextIncomplete = sections.findIndex(s => s.status !== 'complete')
                    if (nextIncomplete >= 0) {
                      setCurrentSectionIndex(nextIncomplete)
                    }
                  }
                }}
                style={{
                  flex: 1,
                  padding: '16px',
                  backgroundColor: completedCount === sections.length ? colors.gold : colors.primary,
                  border: 'none',
                  borderRadius: '10px',
                  color: colors.background,
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {completedCount === sections.length ? '✓ REVIEW & SUBMIT' : `COMPLETE ${sections.length - completedCount} MORE →`}
              </button>
            )}
          </div>
          
          {/* Progress indicator with SAVE button */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '15px',
            marginTop: '15px' 
          }}>
            <p style={{ color: colors.muted, fontSize: '12px', margin: 0 }}>
              {completedCount}/{sections.length} sections complete • {isSaving ? '💾 Saving...' : lastSaved ? `✓ Saved ${lastSaved.toLocaleTimeString()}` : 'Auto-save enabled'}
            </p>
            <button
              onClick={async () => {
                await saveProgress()
                alert('✓ Progress saved!')
              }}
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.muted,
                fontSize: '12px',
                cursor: isSaving ? 'wait' : 'pointer'
              }}
            >
              {isSaving ? '💾 Saving...' : '💾 Save Now'}
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 4: REVIEW SCREEN with Compliance Checklist
  // ==========================================
  if (selectedSubmission && currentPhase === 4) {
    const allComplete = sections.filter(s => s.status === 'complete').length === sections.length
    const totalChars = sections.reduce((sum, s) => sum + (s.answer?.length || 0), 0)
    
    // Compliance checks
    const complianceChecks = [
      { 
        label: 'All sections completed', 
        passed: allComplete,
        detail: `${sections.filter(s => s.status === 'complete').length}/${sections.length} sections`
      },
      { 
        label: 'No sections over character limit', 
        passed: !sections.some(s => s.answer?.length > s.charLimit),
        detail: sections.find(s => s.answer?.length > s.charLimit)?.title || 'All within limits'
      },
      { 
        label: 'Understanding of Need addressed', 
        passed: sections.find(s => s.id === 'understanding')?.answer?.length > 100,
        detail: 'Shows you read the RFP'
      },
      { 
        label: 'Technical Approach is detailed', 
        passed: sections.find(s => s.id === 'narrative')?.answer?.length > 500,
        detail: '35% of evaluation score'
      },
      { 
        label: 'Past Performance has specifics', 
        passed: sections.find(s => s.id === 'qualifications')?.answer?.length > 300,
        detail: 'Include numbers and outcomes'
      },
      { 
        label: 'Budget breakdown included', 
        passed: sections.find(s => s.id === 'budget')?.answer?.length > 200,
        detail: 'Cost justification'
      }
    ]
    
    const passedChecks = complianceChecks.filter(c => c.passed).length

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
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '11px', color: colors.muted }}>
            <span>Overview</span>
            <span>Strategy</span>
            <span>Answers</span>
            <span style={{ color: colors.primary, fontWeight: '600' }}>Review</span>
            <span>Submit</span>
          </div>

          {/* Compliance Checklist */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.border}`,
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: colors.text, fontSize: '18px', margin: 0 }}>
                ✅ Compliance Checklist
              </h3>
              <span style={{ 
                color: passedChecks === complianceChecks.length ? colors.primary : colors.gold,
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {passedChecks}/{complianceChecks.length} passed
              </span>
            </div>
            
            {complianceChecks.map((check, i) => (
              <div 
                key={i}
                style={{
                  padding: '12px 0',
                  borderBottom: i < complianceChecks.length - 1 ? `1px solid ${colors.border}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <span style={{ 
                  fontSize: '18px',
                  color: check.passed ? colors.primary : colors.danger 
                }}>
                  {check.passed ? '✓' : '✗'}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: colors.text, fontSize: '14px', margin: 0 }}>{check.label}</p>
                  <p style={{ color: colors.muted, fontSize: '11px', margin: '2px 0 0 0' }}>{check.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Sections Summary */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.border}`,
            marginBottom: '20px'
          }}>
            <h3 style={{ color: colors.text, fontSize: '18px', margin: '0 0 20px 0' }}>
              📄 Response Summary
            </h3>
            
            {sections.map((section, i) => (
              <div 
                key={section.id}
                style={{
                  padding: '12px 0',
                  borderBottom: i < sections.length - 1 ? `1px solid ${colors.border}` : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ color: colors.text, fontSize: '14px' }}>{section.title}</span>
                  {section.weight && (
                    <span style={{ color: colors.muted, fontSize: '11px', marginLeft: '8px' }}>
                      ({section.weight}%)
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ 
                    color: section.answer?.length > section.charLimit ? colors.danger : colors.muted, 
                    fontSize: '12px' 
                  }}>
                    {section.answer?.length || 0}/{section.charLimit}
                  </span>
                  <span style={{ 
                    color: section.status === 'complete' ? colors.primary : colors.muted,
                    fontSize: '16px'
                  }}>
                    {section.status === 'complete' ? '✓' : '○'}
                  </span>
                </div>
              </div>
            ))}
            
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: `1px solid ${colors.border}` }}>
              <p style={{ color: colors.muted, fontSize: '13px', margin: 0 }}>
                Total: <strong style={{ color: colors.text }}>{totalChars.toLocaleString()}</strong> characters across {sections.length} sections
              </p>
            </div>
          </div>

          {/* Required Documents Reminder */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.border}`,
            marginBottom: '20px'
          }}>
            <h3 style={{ color: colors.text, fontSize: '18px', margin: '0 0 8px 0' }}>
              📋 Check Your RFP Requirements
            </h3>
            <p style={{ color: colors.muted, fontSize: '13px', margin: '0 0 20px 0', lineHeight: '1.5' }}>
              Every contract/grant has different requirements. Review your RFP for what documents they need.
            </p>
            
            <div style={{ backgroundColor: colors.background, borderRadius: '10px', padding: '15px' }}>
              <p style={{ color: colors.muted, fontSize: '12px', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
                Common Requirements (check your RFP)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ color: colors.text, fontSize: '13px' }}>• W-9 / Tax ID Form</span>
                <span style={{ color: colors.text, fontSize: '13px' }}>• Business License</span>
                <span style={{ color: colors.text, fontSize: '13px' }}>• Insurance certificates (if required)</span>
                <span style={{ color: colors.text, fontSize: '13px' }}>• SAM.gov registration (federal only)</span>
                <span style={{ color: colors.text, fontSize: '13px' }}>• Certifications (DBE, MBE, etc.)</span>
              </div>
            </div>
            
            {selectedSubmission.source_url && (
              <a 
                href={selectedSubmission.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  marginTop: '15px',
                  padding: '12px',
                  backgroundColor: `${colors.gold}15`,
                  borderRadius: '8px',
                  color: colors.gold,
                  fontSize: '13px',
                  textDecoration: 'none',
                  textAlign: 'center'
                }}
              >
                📄 View Original RFP for Full Requirements →
              </a>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setCurrentPhase(3)}
              style={{
                flex: 1,
                padding: '16px',
                backgroundColor: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                color: colors.muted,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              ← Edit Answers
            </button>
            <button
              onClick={() => setCurrentPhase(5)}
              disabled={!allComplete}
              style={{
                flex: 1,
                padding: '16px',
                backgroundColor: allComplete ? colors.gold : colors.card,
                border: 'none',
                borderRadius: '10px',
                color: allComplete ? colors.background : colors.muted,
                fontSize: '16px',
                fontWeight: '700',
                cursor: allComplete ? 'pointer' : 'not-allowed',
                textTransform: 'uppercase'
              }}
            >
              SUBMIT →
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE 5: SUBMIT / EXPORT
  // ==========================================
  if (selectedSubmission && currentPhase === 5) {
    const allComplete = sections.filter(s => s.status === 'complete').length === sections.length

    const handleSaveToBucket = async () => {
      try {
        // Save each answer to saved_answers table for reuse
        for (const section of sections) {
          if (section.answer) {
            await supabase.from('saved_answers').insert({
              user_id: session.user.id,
              submission_id: selectedSubmission.id,
              section_type: section.id,
              section_title: section.title,
              answer_text: section.answer,
              created_at: new Date().toISOString()
            })
          }
        }
        
        // Save team members to BUCKET for future use
        const teamSection = sections.find(s => s.id === 'team')
        if (teamSection?.teamMembers?.length > 0) {
          const existingProfile = await supabase
            .from('profiles')
            .select('team_members')
            .eq('user_id', session.user.id)
            .single()
          
          const existingTeam = existingProfile.data?.team_members || []
          const newMembers = teamSection.teamMembers.filter(m => 
            !existingTeam.some(e => e.role === m.role && e.name === m.name)
          )
          
          if (newMembers.length > 0) {
            await supabase
              .from('profiles')
              .update({ 
                team_members: [...existingTeam, ...newMembers],
                updated_at: new Date().toISOString()
              })
              .eq('user_id', session.user.id)
          }
        }
        
        // Save references to BUCKET for future use
        const refSection = sections.find(s => s.id === 'references')
        if (refSection?.references?.length > 0) {
          const existingProfile = await supabase
            .from('profiles')
            .select('references')
            .eq('user_id', session.user.id)
            .single()
          
          const existingRefs = existingProfile.data?.references || []
          const newRefs = refSection.references.filter(r => 
            !existingRefs.some(e => e.company === r.company && e.contactName === r.contactName)
          )
          
          if (newRefs.length > 0) {
            await supabase
              .from('profiles')
              .update({ 
                references: [...existingRefs, ...newRefs],
                updated_at: new Date().toISOString()
              })
              .eq('user_id', session.user.id)
          }
        }
        
        // Update submission status
        await supabase
          .from('submissions')
          .update({ status: 'submitted' })
          .eq('id', selectedSubmission.id)
        
        alert('Saved to BUCKET! Your answers, team members, and references are saved for future opportunities.')
      } catch (err) {
        console.error('Save error:', err)
        alert('Error saving. Please try again.')
      }
    }

    const handleDownload = (format) => {
      // Build document content
      let content = `${selectedSubmission.title}\n`
      content += `Agency: ${selectedSubmission.agency || 'Not specified'}\n`
      content += `Due: ${selectedSubmission.due_date || 'Not specified'}\n`
      content += `\n${'='.repeat(50)}\n\n`
      
      if (generatedStrategy) {
        content += `PROGRAM TITLE: ${generatedStrategy.suggestedTitle}\n\n`
      }
      
      sections.forEach(section => {
        content += `${section.title.toUpperCase()}\n`
        content += `${'-'.repeat(30)}\n`
        content += `${section.answer || 'Not completed'}\n\n`
      })

      // Download as text file (Word/PDF generation would need backend)
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedSubmission.title.substring(0, 30).replace(/[^a-z0-9]/gi, '_')}_response.txt`
      a.click()
      URL.revokeObjectURL(url)
    }

    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.background, 
        padding: '40px 30px',
        paddingBottom: '100px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          <p 
            onClick={() => setCurrentPhase(4)}
            style={{ color: colors.muted, fontSize: '16px', marginBottom: '20px', cursor: 'pointer' }}
          >
            ← Back to Review
          </p>

          {/* Progress Bar - All complete */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '30px' }}>
            {[1, 2, 3, 4, 5].map(phase => (
              <div 
                key={phase}
                style={{
                  flex: 1,
                  height: '4px',
                  backgroundColor: colors.primary,
                  borderRadius: '2px'
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '12px', color: colors.muted }}>
            <span>1. Overview</span>
            <span>2. Strategy</span>
            <span>3. Answers</span>
            <span>4. Review</span>
            <span style={{ color: colors.primary, fontWeight: '600' }}>5. Submit</span>
          </div>

          {/* Success Card */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '40px 30px',
            textAlign: 'center',
            border: `1px solid ${colors.primary}40`,
            marginBottom: '25px'
          }}>
            <span style={{ fontSize: '48px', marginBottom: '15px', display: 'block' }}>🎉</span>
            <h2 style={{ color: colors.primary, fontSize: '24px', marginBottom: '10px' }}>
              Response Complete!
            </h2>
            <p style={{ color: colors.muted, fontSize: '14px', marginBottom: '0' }}>
              {sections.length} sections ready • {sections.reduce((sum, s) => sum + (s.answer?.length || 0), 0)} total characters
            </p>
          </div>

          {/* Export Options */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.border}`,
            marginBottom: '25px'
          }}>
            <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '15px', textTransform: 'uppercase' }}>
              Export Your Response
            </p>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              <button
                onClick={() => handleDownload('txt')}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: colors.gold,
                  border: 'none',
                  borderRadius: '10px',
                  color: colors.background,
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                📄 Download Response
              </button>
              
              <button
                onClick={handleSaveToBucket}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.primary}`,
                  borderRadius: '10px',
                  color: colors.primary,
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                🪣 Save to BUCKET (reuse for future)
              </button>
            </div>
          </div>

          {/* What happens next */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.border}`,
            marginBottom: '20px'
          }}>
            <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '15px', textTransform: 'uppercase' }}>
              Next Steps
            </p>
            <ol style={{ color: colors.text, fontSize: '14px', margin: 0, paddingLeft: '20px', lineHeight: '2.2' }}>
              <li>Download your response document</li>
              <li>Review and make any final edits in Word</li>
              <li>Submit through the agency's portal</li>
              <li>Save to BUCKET for future similar opportunities</li>
            </ol>
          </div>

          {/* IMPORTANT: Required Documents Reminder */}
          <div style={{
            backgroundColor: '#FF980015',
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid #FF9800`,
            marginBottom: '20px'
          }}>
            <p style={{ color: '#FF9800', fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
              ⚠️ Don't Forget: Required Documents
            </p>
            <p style={{ color: colors.text, fontSize: '13px', marginBottom: '15px', lineHeight: '1.6' }}>
              Most contracts and grants require additional forms that must be downloaded, signed, and submitted with your response:
            </p>
            <ul style={{ color: colors.text, fontSize: '13px', margin: 0, paddingLeft: '20px', lineHeight: '2' }}>
              <li>Signature pages & certifications</li>
              <li>Insurance certificates</li>
              <li>W-9 / Tax forms</li>
              <li>Debarment certifications</li>
              <li>Other agency-specific attachments</li>
            </ul>
            {selectedSubmission.source_url && (
              <a 
                href={selectedSubmission.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '15px',
                  padding: '10px 20px',
                  backgroundColor: '#FF9800',
                  color: '#000',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                📎 Go to Agency Portal for Required Documents
              </a>
            )}
          </div>

          {/* Back to Dashboard */}
          <button
            onClick={() => {
              setSelectedSubmission(null)
              setCurrentPhase(1)
              setSections([])
              setGeneratedStrategy(null)
            }}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '14px',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              color: colors.muted,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            ← Back to Response Room
          </button>

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
                {stripHtml(selectedSubmission.description)}
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
                  {stripHtml(selectedSubmission.description)}
                </span>
              </div>
            )}

            {/* Meta Info */}
            <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
              {selectedSubmission.estimated_value && (
                <div>
                  <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '4px' }}>Funding</p>
                  <p style={{ color: colors.primary, fontSize: '14px', fontWeight: '600', margin: 0 }}>
                    {formatCurrency(selectedSubmission.estimated_value)}
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
                  {parseAgencyName(selectedSubmission.agency)}
                </p>
              </div>
            </div>
          </div>

          {/* Your Match Score */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.border}`,
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: colors.muted, fontSize: '12px', marginBottom: '4px' }}>
                  Your BUCKET Match
                </p>
                <p style={{ 
                  color: currentScore >= 70 ? colors.primary : currentScore >= 50 ? colors.gold : colors.muted, 
                  fontSize: '42px', 
                  fontWeight: '700', 
                  margin: 0 
                }}>
                  {currentScore}%
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: colors.muted, fontSize: '12px', marginBottom: '4px' }}>
                  {currentScore >= 70 ? 'Strong Match' : currentScore >= 50 ? 'Good Match' : 'Potential Match'}
                </p>
                <p style={{ color: colors.muted, fontSize: '13px' }}>
                  {currentScore >= 70 ? 'Your BUCKET aligns well' : 'RCA can help strengthen your response'}
                </p>
              </div>
            </div>
          </div>

          {/* Why You're Competitive */}
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '25px',
            border: `1px solid ${colors.border}`,
            marginBottom: '20px'
          }}>
            <p style={{ color: colors.muted, fontSize: '11px', marginBottom: '15px', textTransform: 'uppercase' }}>
              💪 Why You're Competitive
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {profileData?.naics_codes?.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: colors.primary }}>✓</span>
                  <span style={{ color: colors.text, fontSize: '14px' }}>Your NAICS codes match this opportunity</span>
                </div>
              )}
              {profileData?.certifications?.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: colors.primary }}>✓</span>
                  <span style={{ color: colors.text, fontSize: '14px' }}>Your certifications give you an advantage</span>
                </div>
              )}
              {profileData?.services_description && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: colors.primary }}>✓</span>
                  <span style={{ color: colors.text, fontSize: '14px' }}>Your services align with what they need</span>
                </div>
              )}
              {profileData?.past_performance && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: colors.primary }}>✓</span>
                  <span style={{ color: colors.text, fontSize: '14px' }}>You have relevant past performance</span>
                </div>
              )}
            </div>
            
            {/* Loading state */}
            {loadingRfp && (
              <div style={{ textAlign: 'center', padding: '15px' }}>
                <p style={{ color: colors.gold, fontSize: '14px' }}>🔄 Loading opportunity details...</p>
              </div>
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
