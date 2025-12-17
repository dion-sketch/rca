// /api/generate.js - CR-AI Response Generator
// This serverless function powers the RFP question answering

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { question, profile, opportunity, previousResponses } = req.body

  // Validate required fields
  if (!question) {
    return res.status(400).json({ error: 'Question is required' })
  }

  // Get API key from environment variable
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    // Build the BUCKET context from profile
    const bucketContext = buildBucketContext(profile)
    
    // Build opportunity context
    const opportunityContext = buildOpportunityContext(opportunity)
    
    // Build previous responses context (for consistency)
    const previousContext = buildPreviousContext(previousResponses)

    // Create the prompt
    const systemPrompt = `You are CR-AI, an expert government contracting assistant for Contract Ready. Your job is to help small businesses write compelling RFP responses.

CRITICAL RULES:
1. Write in FIRST PERSON ("We provide...", "Our team...", "I have...")
2. Be SPECIFIC - use actual numbers, names, and details from the BUCKET
3. Keep responses CONCISE but COMPLETE (2-4 paragraphs typical)
4. Sound PROFESSIONAL but HUMAN - not robotic or generic
5. NEVER make up information - only use what's in the BUCKET
6. If the BUCKET lacks info for the question, write a solid response but note what could be added
7. Match the TONE to government RFP expectations - professional, confident, specific

BUCKET (Company Profile):
${bucketContext}

${opportunityContext}

${previousContext}`

    const userPrompt = `Write a compelling response to this RFP question:

"${question}"

Remember:
- First person voice
- Use specific details from the BUCKET
- Professional government contracting tone
- 2-4 paragraphs unless the question requires more
- Include relevant past performance, certifications, or team qualifications if applicable`

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Anthropic API error:', errorData)
      return res.status(500).json({ error: 'Failed to generate response', details: errorData })
    }

    const data = await response.json()
    const generatedResponse = data.content[0].text

    return res.status(200).json({ 
      response: generatedResponse,
      model: 'claude-sonnet-4-20250514',
      usage: data.usage
    })

  } catch (error) {
    console.error('Generation error:', error)
    return res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}

// Helper: Build BUCKET context from profile
function buildBucketContext(profile) {
  if (!profile) {
    return 'No company profile available. User should build their BUCKET first.'
  }

  let context = ''

  // Company basics
  if (profile.company_name) {
    context += `COMPANY: ${profile.company_name}`
    if (profile.dba) context += ` (DBA: ${profile.dba})`
    context += '\n'
  }
  
  if (profile.city || profile.state) {
    context += `LOCATION: ${profile.city || ''}, ${profile.state || ''}\n`
  }
  
  if (profile.year_established) {
    const years = new Date().getFullYear() - parseInt(profile.year_established)
    context += `ESTABLISHED: ${profile.year_established} (${years} years in business)\n`
  }
  
  if (profile.team_size) {
    context += `TEAM SIZE: ${profile.team_size}\n`
  }
  
  if (profile.entity_type) {
    context += `ENTITY TYPE: ${profile.entity_type}\n`
  }
  
  if (profile.is_nonprofit) {
    context += `NONPROFIT: Yes\n`
  }

  // Mission & Pitch
  if (profile.mission) {
    context += `\nMISSION: ${profile.mission}\n`
  }
  
  if (profile.elevator_pitch) {
    context += `\nELEVATOR PITCH: ${profile.elevator_pitch}\n`
  }

  // What makes them different
  if (profile.what_makes_you_different) {
    context += `\nDIFFERENTIATORS: ${profile.what_makes_you_different}\n`
  }
  
  if (profile.results_achieved) {
    context += `\nRESULTS/IMPACT: ${profile.results_achieved}\n`
  }
  
  if (profile.anything_else) {
    context += `\nADDITIONAL CONTEXT: ${profile.anything_else}\n`
  }

  // Services
  if (profile.services && profile.services.length > 0) {
    context += `\nSERVICES OFFERED:\n`
    profile.services.forEach((s, i) => {
      context += `${i + 1}. ${s.category}`
      if (s.description) context += `: ${s.description}`
      context += '\n'
    })
  }

  // NAICS Codes
  if (profile.naics_codes && profile.naics_codes.length > 0) {
    const codes = profile.naics_codes.map(n => `${n.code}${n.description ? ' - ' + n.description : ''}`).join(', ')
    context += `\nNAICS CODES: ${codes}\n`
  }

  // Certifications
  if (profile.certifications && profile.certifications.length > 0) {
    const certs = profile.certifications.map(c => c.name || c.id).join(', ')
    context += `\nCERTIFICATIONS: ${certs}\n`
  }

  // SAM.gov
  if (profile.sam_registered) {
    context += `\nSAM.GOV: Registered`
    if (profile.uei_number) context += ` | UEI: ${profile.uei_number}`
    if (profile.cage_code) context += ` | CAGE: ${profile.cage_code}`
    context += '\n'
  }

  // Past Performance
  if (profile.past_performance && profile.past_performance.length > 0) {
    context += `\nPAST PERFORMANCE:\n`
    profile.past_performance.forEach((pp, i) => {
      context += `${i + 1}. ${pp.clientName || 'Client'}`
      if (pp.projectName) context += ` - "${pp.projectName}"`
      if (pp.contractValue) context += ` ($${pp.contractValue})`
      if (pp.startYear || pp.endYear) context += ` [${pp.startYear || '?'}-${pp.endYear || 'present'}]`
      context += '\n'
      if (pp.description) context += `   What we did: ${pp.description}\n`
      if (pp.results) context += `   Results: ${pp.results}\n`
    })
  }

  // Team
  if (profile.team_members && profile.team_members.length > 0) {
    context += `\nKEY PERSONNEL:\n`
    profile.team_members.forEach((tm, i) => {
      context += `${i + 1}. ${tm.name || 'Team Member'} - ${tm.role || 'Staff'}`
      if (tm.yearsExperience) context += ` (${tm.yearsExperience} yrs exp)`
      if (tm.type) context += ` [${tm.type}]`
      context += '\n'
      if (tm.qualifications) context += `   Qualifications: ${tm.qualifications}\n`
      if (tm.bio) context += `   Bio: ${tm.bio}\n`
    })
  }

  // Pricing
  if (profile.pricing && profile.pricing.length > 0) {
    context += `\nRATE STRUCTURE:\n`
    profile.pricing.forEach(p => {
      context += `- ${p.role}: $${p.hourlyRate}/hr\n`
    })
  }

  return context || 'Limited profile data available.'
}

// Helper: Build opportunity context
function buildOpportunityContext(opportunity) {
  if (!opportunity) return ''
  
  let context = '\nOPPORTUNITY DETAILS:\n'
  if (opportunity.title) context += `Title: ${opportunity.title}\n`
  if (opportunity.agency) context += `Agency: ${opportunity.agency}\n`
  if (opportunity.due_date) context += `Due: ${opportunity.due_date}\n`
  if (opportunity.estimated_value) context += `Value: ${opportunity.estimated_value}\n`
  if (opportunity.description) context += `Notes: ${opportunity.description}\n`
  
  return context
}

// Helper: Build previous responses context for consistency
function buildPreviousContext(previousResponses) {
  if (!previousResponses || previousResponses.length === 0) return ''
  
  let context = '\nPREVIOUS RESPONSES IN THIS SUBMISSION (maintain consistency):\n'
  previousResponses.forEach((pr, i) => {
    if (pr.response) {
      context += `Q${i + 1}: ${pr.text.substring(0, 100)}...\n`
      context += `A${i + 1}: ${pr.response.substring(0, 200)}...\n\n`
    }
  })
  
  return context
}
