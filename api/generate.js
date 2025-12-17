// /api/generate.js - CR-AI Response Generator with Compliance Enforcement

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { 
      question, 
      profile, 
      opportunity, 
      previousResponses,
      charLimit,
      requirements,
      isStrategyGeneration,
      isQAGeneration,
      isShortening,
      strategyPlan,
      mustInclude
    } = req.body

    if (!question) {
      return res.status(400).json({ error: 'Question is required' })
    }

    // Build the context from BUCKET (profile)
    const bucketContext = buildBucketContext(profile)
    const opportunityContext = buildOpportunityContext(opportunity)
    const previousContext = buildPreviousContext(previousResponses)

    // Build character limit instruction
    const limitInstruction = charLimit 
      ? `\n\nCRITICAL: Your response MUST be UNDER ${charLimit} characters. Count carefully. Do not exceed ${charLimit} characters under any circumstances. Aim for ${Math.floor(charLimit * 0.9)} characters to leave a safety buffer.`
      : ''

    // Build required elements instruction
    const elementsInstruction = mustInclude?.length > 0
      ? `\n\nREQUIRED: Your response MUST include mention of: ${mustInclude.join(', ')}.`
      : ''

    // Different prompts for different generation types
    let systemPrompt = ''
    let userPrompt = ''

    if (isShortening) {
      systemPrompt = `You are an expert editor. Your ONLY job is to shorten text while preserving key information. You must stay UNDER the character limit.`
      userPrompt = question + limitInstruction
    } else if (isStrategyGeneration) {
      systemPrompt = `You are CR-AI, a strategic proposal consultant powered by BUCKET + CR-AI Technology. You help small businesses win government contracts by creating compelling, strategic response plans.

${bucketContext}

Your role is to create a strategic response plan that positions this business for success.`
      
      userPrompt = `${question}

${opportunityContext}

Create a strategic response plan that includes:
1. PROGRAM TITLE - A creative, memorable name that connects to the agency's mission
2. KEY THEMES - 3-4 bullet points on what to emphasize
3. APPROACH SUMMARY - 2-3 sentences on positioning
4. DIFFERENTIATORS - What makes this business stand out

Base this on the business profile and tailor it to the specific opportunity.`

    } else if (isQAGeneration) {
      systemPrompt = `You are CR-AI, a proposal response generator powered by BUCKET + CR-AI Technology. You create compliant, compelling RFP responses.

${bucketContext}

CRITICAL RULES:
- Each answer MUST stay under its character limit
- Write in first person ("We provide..." not "The company provides...")
- Be specific, use real details from the BUCKET
- Sound professional but human`

      userPrompt = `${question}

${opportunityContext}

${strategyPlan ? `STRATEGY TO FOLLOW:\n${strategyPlan}\n` : ''}

Generate questions and answers. For each answer, stay UNDER the specified character limit. Count characters carefully.`

    } else {
      // Standard question response
      systemPrompt = `You are CR-AI, a proposal response generator powered by BUCKET + CR-AI Technology. You help small businesses respond to government RFP questions with professional, compelling answers.

${bucketContext}

CRITICAL RULES:
- Write in first person ("We provide..." "Our team..." "We have...")
- Be specific - use real company details from the profile
- Sound confident but not arrogant
- Match the tone to government proposals
- If a character limit is specified, you MUST stay under it${charLimit ? `\n- YOUR HARD LIMIT: ${charLimit} characters. Do not exceed this.` : ''}
${elementsInstruction}`

      userPrompt = `${opportunityContext}

${strategyPlan ? `STRATEGY:\n${strategyPlan}\n\n` : ''}

${previousContext}

QUESTION TO ANSWER:
${question}
${limitInstruction}

Write a professional, compelling response using the business profile. ${charLimit ? `STAY UNDER ${charLimit} CHARACTERS.` : ''}`
    }

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
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
      const errorText = await response.text()
      console.error('Claude API error:', errorText)
      throw new Error('Failed to generate response')
    }

    const data = await response.json()
    let generatedText = data.content[0].text

    // ==========================================
    // HARD ENFORCEMENT LAYER
    // ==========================================
    
    // If there's a character limit, ENFORCE it
    if (charLimit && generatedText.length > charLimit) {
      console.log(`Response over limit: ${generatedText.length}/${charLimit}. Auto-truncating.`)
      
      // Try to truncate at a sentence boundary
      let truncated = generatedText.substring(0, charLimit - 3)
      const lastPeriod = truncated.lastIndexOf('.')
      const lastQuestion = truncated.lastIndexOf('?')
      const lastExclaim = truncated.lastIndexOf('!')
      const lastSentence = Math.max(lastPeriod, lastQuestion, lastExclaim)
      
      if (lastSentence > charLimit * 0.7) {
        // Truncate at sentence if we keep at least 70% of content
        truncated = truncated.substring(0, lastSentence + 1)
      } else {
        // Otherwise just add ellipsis
        truncated = truncated.substring(0, charLimit - 3) + '...'
      }
      
      generatedText = truncated
    }

    // Check for required elements (warning only, don't block)
    if (mustInclude?.length > 0) {
      const missing = mustInclude.filter(element => 
        !generatedText.toLowerCase().includes(element.toLowerCase())
      )
      if (missing.length > 0) {
        console.log(`Warning: Response missing required elements: ${missing.join(', ')}`)
        // Could regenerate here, but for now just log
      }
    }

    return res.status(200).json({ 
      response: generatedText,
      charCount: generatedText.length,
      charLimit: charLimit || null,
      compliant: charLimit ? generatedText.length <= charLimit : true
    })

  } catch (error) {
    console.error('Generate error:', error)
    return res.status(500).json({ error: 'Failed to generate response. Please try again.' })
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function buildBucketContext(profile) {
  if (!profile) return 'No business profile available.'

  let context = `BUSINESS BUCKET (Profile Data):
`

  if (profile.company_name) context += `Company: ${profile.company_name}\n`
  if (profile.year_established) {
    const years = new Date().getFullYear() - parseInt(profile.year_established)
    context += `Years in Business: ${years}+ years (established ${profile.year_established})\n`
  }
  if (profile.city && profile.state) context += `Location: ${profile.city}, ${profile.state}\n`
  if (profile.mission) context += `Mission: ${profile.mission}\n`
  if (profile.elevator_pitch) context += `About: ${profile.elevator_pitch}\n`
  if (profile.what_makes_you_different) context += `Differentiators: ${profile.what_makes_you_different}\n`
  
  if (profile.services?.length > 0) {
    context += `Services: ${profile.services.map(s => s.name || s).join(', ')}\n`
  }
  
  if (profile.naics_codes?.length > 0) {
    context += `NAICS Codes: ${profile.naics_codes.map(n => `${n.code} (${n.description || 'N/A'})`).join(', ')}\n`
  }
  
  if (profile.certifications?.length > 0) {
    context += `Certifications: ${profile.certifications.map(c => c.name || c.id || c).join(', ')}\n`
  }
  
  if (profile.sam_registered) context += `SAM.gov: Registered\n`
  if (profile.sam_uei) context += `UEI: ${profile.sam_uei}\n`
  if (profile.cage_code) context += `CAGE: ${profile.cage_code}\n`

  if (profile.past_performance?.length > 0) {
    context += `\nPast Performance:\n`
    profile.past_performance.forEach((pp, i) => {
      context += `${i + 1}. ${pp.project_name || pp.title || 'Project'}`
      if (pp.client) context += ` for ${pp.client}`
      if (pp.value) context += ` ($${pp.value})`
      if (pp.description) context += `: ${pp.description}`
      context += `\n`
    })
  }

  if (profile.team_members?.length > 0) {
    context += `\nKey Personnel:\n`
    profile.team_members.forEach((member, i) => {
      context += `${i + 1}. ${member.name || 'Team Member'}`
      if (member.title || member.role) context += ` - ${member.title || member.role}`
      if (member.qualifications) context += ` (${member.qualifications})`
      context += `\n`
    })
  }

  return context
}

function buildOpportunityContext(opportunity) {
  if (!opportunity) return ''

  let context = `CONTRACT OPPORTUNITY:
`
  if (opportunity.title) context += `Title: ${opportunity.title}\n`
  if (opportunity.agency) context += `Agency: ${opportunity.agency}\n`
  if (opportunity.due_date) context += `Due: ${opportunity.due_date}\n`
  if (opportunity.estimated_value) context += `Value: ${opportunity.estimated_value}\n`
  if (opportunity.description) context += `Description: ${opportunity.description}\n`

  return context
}

function buildPreviousContext(previousResponses) {
  if (!previousResponses?.length) return ''

  let context = `PREVIOUS RESPONSES (for consistency):
`
  previousResponses.forEach((resp, i) => {
    context += `Q${i + 1}: ${resp.text}\nA: ${resp.response}\n\n`
  })
  
  context += `Maintain consistency with these previous answers.\n`
  return context
}
