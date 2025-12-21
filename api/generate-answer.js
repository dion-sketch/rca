// /api/generate-answer.js
// Generates a response for a specific section based on strategy + BUCKET

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { section, opportunity, profile, strategy, rfpContent, charLimit } = req.body

  if (!section || !opportunity) {
    return res.status(400).json({ error: 'Section and opportunity required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    // Build profile context - including team and references
    const profileContext = profile ? `
COMPANY: ${profile.company_name || 'Not specified'}
LOCATION: ${profile.city ? `${profile.city}, ${profile.state}` : 'Not specified'}
NAICS CODES: ${profile.naics_codes?.map(n => n.code || n).join(', ') || 'None listed'}
CERTIFICATIONS: ${profile.certifications?.map(c => c.name || c).join(', ') || 'None listed'}
SERVICES: ${profile.services?.join(', ') || profile.services_description || 'Not specified'}
PAST PERFORMANCE: ${profile.past_performance || 'Not specified'}
MISSION: ${profile.mission_statement || 'Not specified'}

TEAM MEMBERS IN BUCKET:
${profile.team_members?.length > 0 
  ? profile.team_members.map(m => `- ${m.role}: ${m.name || 'TBD'} (${m.hoursPerWeek}hrs/wk @ $${m.hourlyRate}/hr) - ${m.description || ''}`).join('\n')
  : 'No team members saved yet'}

REFERENCES IN BUCKET:
${profile.references?.length > 0 
  ? profile.references.map(r => `- ${r.company}: ${r.contactName}, ${r.contractValue || ''} - ${r.description || ''}`).join('\n')
  : 'No references saved yet'}
` : 'No company profile available.'

    // Build strategy context
    const strategyContext = strategy ? `
CHOSEN STRATEGY:
- Program Title: ${strategy.suggestedTitle || 'Not set'}
- Angle: ${strategy.angle || strategy.approach || 'Not set'}
- Key Points: ${strategy.keyPoints?.join('; ') || 'Not set'}
- Highlight from BUCKET: ${strategy.fromBucket?.join(', ') || 'Not set'}
` : 'No strategy set.'

    // Build RFP context
    const rfpContext = rfpContent ? `
RFP CONTENT:
${rfpContent.description ? `Description: ${rfpContent.description.substring(0, 1000)}` : ''}
${rfpContent.requirements ? `Requirements: ${rfpContent.requirements.substring(0, 500)}` : ''}
` : ''

    const systemPrompt = `You are RCA (Rambo Contract Assistant), writing government contract/grant responses.

COMPANY BUCKET:
${profileContext}

${strategyContext}

OPPORTUNITY: ${opportunity.title}
AGENCY: ${opportunity.agency || 'Not specified'}
${rfpContext}

WINNING ANSWER FORMULA - Use this structure for EVERY response:
1. DIRECT ANSWER (first 1-2 sentences) - Answer the question clearly and directly
2. APPROACH (next 2-3 sentences) - How you will accomplish it / your methodology
3. EXPERIENCE (next 2-3 sentences) - Proof you've done this before / qualifications
4. OUTCOME (final 1-2 sentences) - Tie back to their goals / the benefit to the agency

WRITING RULES - CRITICAL:
1. DO NOT start with the company name. Lead with VALUE.
2. DO NOT focus on physical location/address - that's rarely what wins contracts
3. DO NOT use markdown formatting (no asterisks, no bold, no headers)
4. FOCUS ON THE MISSION - what the agency needs accomplished and how you deliver it
5. Follow the 4-part formula: Answer → Approach → Experience → Outcome
6. Match their requirements to your capabilities and experience
7. Stay within the character limit: ${charLimit || 1500} characters
8. Use confident but professional tone
9. Every sentence should add value - no fluff
10. Output plain text only - no special formatting

BAD EXAMPLE: "Located in Playa Del Rey, Rambo House is a company that will provide services..."
GOOD EXAMPLE: "Trauma-informed mentorship services combining clinical expertise with evidence-based approaches will deliver measurable improvements in youth permanency outcomes. Our integrated model pairs licensed clinicians with trained mentors to provide wrap-around support. Over the past 5 years, this approach has achieved 85% positive outcomes across 200+ youth served. This directly aligns with the County's goal of reducing foster care re-entry rates."`

    // Determine section type
    const sectionType = section.type || 'text'
    const sectionId = section.id?.toLowerCase() || ''
    const sectionTitle = section.title?.toLowerCase() || ''
    
    const isBudget = sectionType === 'budget' || sectionId === 'budget' || sectionTitle.includes('budget')
    const isTeam = sectionType === 'team' || sectionId === 'team' || sectionTitle.includes('personnel') || sectionTitle.includes('team')
    const isReferences = sectionType === 'references' || sectionId === 'references' || sectionTitle.includes('reference')
    const isUnderstanding = sectionId === 'understanding' || sectionTitle.includes('understanding')
    const isNarrative = sectionId === 'narrative' || sectionTitle.includes('technical') || sectionTitle.includes('approach')
    const isQualifications = sectionId === 'qualifications' || sectionTitle.includes('experience') || sectionTitle.includes('performance')
    
    let userPrompt
    
    if (isBudget) {
      // Budget section - handled by UI, but generate narrative if called
      const budgetData = section.budgetData || {}
      userPrompt = `Create a budget justification narrative for this opportunity:

OPPORTUNITY: ${opportunity.title}
ESTIMATED VALUE: ${opportunity.estimated_value || 'Not specified'}

${budgetData.total ? `BUDGET BREAKDOWN:
- Personnel: $${budgetData.personnel?.toLocaleString() || 0}
- Fringe Benefits: $${budgetData.fringe?.toLocaleString() || 0}
- Travel: $${budgetData.travel?.toLocaleString() || 0}
- Equipment: $${budgetData.equipment?.toLocaleString() || 0}
- Supplies: $${budgetData.supplies?.toLocaleString() || 0}
- Contractual: $${budgetData.contractual?.toLocaleString() || 0}
- Other: $${budgetData.other?.toLocaleString() || 0}
- Indirect: $${budgetData.indirect?.toLocaleString() || 0}
- TOTAL: $${budgetData.total?.toLocaleString() || 0}
` : 'Create a realistic budget breakdown.'}

Write a professional budget justification explaining each cost category and why it's necessary for the project. No markdown formatting.`

    } else if (isTeam) {
      // Team/Personnel section
      const teamMembers = section.teamMembers || profile?.team_members || []
      userPrompt = `Write a Key Personnel section for this opportunity:

OPPORTUNITY: ${opportunity.title}

${teamMembers.length > 0 ? `TEAM MEMBERS:
${teamMembers.map(m => `- ${m.role}: ${m.name || 'TBD'} - ${m.description || 'Key team member'} (${m.hoursPerWeek} hours/week)`).join('\n')}` 
: 'Describe the key personnel who will work on this project based on what this opportunity needs.'}

Write a compelling narrative about the team's qualifications and how they'll work together. Include roles, relevant experience, and why this team is qualified for THIS specific opportunity. Do not start with the company name. No markdown formatting.

CHARACTER LIMIT: ${charLimit || 1500}`

    } else if (isReferences) {
      // References section
      const refs = section.references || profile?.references || []
      userPrompt = `Write a References/Past Performance section for this opportunity:

OPPORTUNITY: ${opportunity.title}

${refs.length > 0 ? `REFERENCES:
${refs.map(r => `- ${r.company}: ${r.contactName} (${r.contactPhone || r.contactEmail || 'Contact info available'})
  Contract Value: ${r.contractValue || 'N/A'}
  Work: ${r.description || 'Similar services'}`).join('\n\n')}`
: 'Describe relevant past performance that demonstrates capability for this work.'}

Write a professional narrative highlighting relevant past performance and references. Focus on outcomes and how the experience relates to THIS opportunity. No markdown formatting.

CHARACTER LIMIT: ${charLimit || 1000}`

    } else if (isUnderstanding) {
      userPrompt = `Write an "Understanding of Need" section that shows we clearly understand what the agency needs.

OPPORTUNITY: ${opportunity.title}
DESCRIPTION: ${opportunity.description || 'Not provided'}
AGENCY: ${opportunity.agency || 'Not specified'}

Structure:
1. Restate the problem/need the agency is trying to address (2-3 sentences)
2. Acknowledge why this is important/urgent (1-2 sentences)
3. Identify key challenges they face (2-3 sentences)
4. Briefly connect to how we're positioned to help (1 sentence)

CHARACTER LIMIT: ${charLimit || 1000}

Write in a way that shows we READ and UNDERSTOOD their RFP. Do not start with the company name. No markdown formatting.`

    } else if (isNarrative) {
      userPrompt = `Write the Technical Approach / Project Narrative section:

OPPORTUNITY: ${opportunity.title}
DESCRIPTION: ${opportunity.description || 'Not provided'}

This is the MOST IMPORTANT section (typically 30-40% of evaluation score).

Write a detailed technical approach that includes:
1. Your methodology and how you'll deliver the services
2. Specific activities and key tasks
3. How your approach meets their stated requirements
4. What makes your approach effective
5. Quality control and performance measures

Be specific about HOW you will do the work. Do not start with the company name. No markdown formatting.

CHARACTER LIMIT: ${charLimit || 2000}`

    } else if (isQualifications) {
      userPrompt = `Write the Past Performance / Qualifications section:

OPPORTUNITY: ${opportunity.title}

This section is about 20-30% of evaluation score.

Include:
1. Relevant contracts/grants (names, values, dates)
2. Measurable outcomes (percentages, numbers)
3. How past experience relates to THIS opportunity
4. Why your experience makes you the right choice

Use specific numbers and results. Do not start with the company name. No markdown formatting.

CHARACTER LIMIT: ${charLimit || 1500}`

    } else {
      // Default text section
      userPrompt = `Write a response for this section:

SECTION: ${section.title}
QUESTION/PROMPT: ${section.prompt}
CHARACTER LIMIT: ${charLimit || 1500}

Write a direct, compelling response following the Winning Answer Formula. Start with the answer, not the company name. No markdown formatting.`
    }

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
      return res.status(500).json({ error: 'Failed to generate answer' })
    }

    const data = await response.json()
    let answer = data.content[0].text

    // Strip any markdown that slipped through
    answer = answer
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\_\_/g, '')
      .replace(/\_/g, '')
      .replace(/\#\#\#/g, '')
      .replace(/\#\#/g, '')
      .replace(/\#/g, '')

    // Trim to character limit if needed
    if (answer.length > (charLimit || 1500)) {
      const trimmed = answer.substring(0, charLimit || 1500)
      const lastPeriod = trimmed.lastIndexOf('.')
      if (lastPeriod > (charLimit * 0.7)) {
        answer = trimmed.substring(0, lastPeriod + 1)
      } else {
        answer = trimmed + '...'
      }
    }

    return res.status(200).json({ 
      success: true,
      answer: answer.trim()
    })

  } catch (error) {
    console.error('Answer generation error:', error)
    return res.status(500).json({ error: 'Failed to generate answer' })
  }
}
