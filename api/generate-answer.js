// /api/generate-answer.js
// Generates a response for a specific section based on strategy + BUCKET
// CRITICAL: Only uses REAL data from BUCKET - NEVER makes up fake contracts/numbers

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
PAST PERFORMANCE (FROM BUCKET): ${profile.past_performance || 'No specific past performance listed in BUCKET'}
MISSION: ${profile.mission_statement || 'Not specified'}

TEAM MEMBERS IN BUCKET:
${profile.team_members?.length > 0 
  ? profile.team_members.map(m => `- ${m.role}: ${m.name || 'TBD'} (${m.hoursPerWeek}hrs/wk @ $${m.hourlyRate}/hr) - ${m.description || ''}`).join('\n')
  : 'No team members saved in BUCKET yet'}

REFERENCES IN BUCKET:
${profile.references?.length > 0 
  ? profile.references.map(r => `- ${r.company}: ${r.contactName}, ${r.contractValue || ''} - ${r.description || ''}`).join('\n')
  : 'No references saved in BUCKET yet'}
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

===========================================
CRITICAL ANTI-HALLUCINATION RULES - YOU MUST FOLLOW:
===========================================
1. ONLY use information that is ACTUALLY in the BUCKET above
2. NEVER make up specific contract names, dollar values, or dates
3. NEVER invent statistics (percentages, numbers of clients served, etc.)
4. If the BUCKET has no past performance data, write GENERALLY about capabilities - do NOT invent fake contracts
5. If BUCKET says "No references saved" - do NOT create fake references
6. When you don't have specific data, use phrases like:
   - "Our team brings experience in..." (general)
   - "We have successfully delivered..." (without fake specifics)
   - "Our approach includes..." (methodology, not fake history)
7. NEVER write things like "Through our $2.3M California contract..." if that's not in the BUCKET
8. Honest answers win more than fabricated ones

WINNING ANSWER FORMULA - Use this structure:
1. DIRECT ANSWER (first 1-2 sentences) - Answer the question clearly
2. APPROACH (next 2-3 sentences) - How you will accomplish it
3. EXPERIENCE (next 2-3 sentences) - ONLY what's actually in the BUCKET
4. OUTCOME (final 1-2 sentences) - Tie back to their goals

WRITING RULES:
1. DO NOT start with the company name. Lead with VALUE.
2. DO NOT focus on physical location/address
3. DO NOT use markdown formatting (no asterisks, no bold, no headers)
4. FOCUS ON THE MISSION - what the agency needs and how you deliver it
5. Stay within the character limit: ${charLimit || 1500} characters
6. Output plain text only - no special formatting`

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
    
    // Check what BUCKET data we actually have
    const hasPastPerformance = profile?.past_performance && profile.past_performance.length > 20
    const hasTeamMembers = profile?.team_members?.length > 0
    const hasReferences = profile?.references?.length > 0
    const hasServices = profile?.services?.length > 0 || profile?.services_description
    
    let userPrompt
    
    if (isBudget) {
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
` : 'Create a realistic budget breakdown based on the opportunity.'}

Write a professional budget justification. No markdown formatting.`

    } else if (isTeam) {
      const teamMembers = section.teamMembers || profile?.team_members || []
      userPrompt = `Write a Key Personnel section for this opportunity:

OPPORTUNITY: ${opportunity.title}

${teamMembers.length > 0 ? `ACTUAL TEAM MEMBERS FROM BUCKET:
${teamMembers.map(m => `- ${m.role}: ${m.name || 'TBD'} - ${m.description || 'Key team member'} (${m.hoursPerWeek} hours/week)`).join('\n')}

Write about THESE specific team members and their qualifications.` 
: `No team members in BUCKET yet. Write GENERALLY about the types of roles needed for this project without making up specific names or fake credentials.`}

REMEMBER: Only describe team members that are actually listed above. Do not invent credentials or experience not mentioned.

CHARACTER LIMIT: ${charLimit || 1500}
No markdown formatting.`

    } else if (isReferences) {
      const refs = section.references || profile?.references || []
      userPrompt = `Write a References/Past Performance section for this opportunity:

OPPORTUNITY: ${opportunity.title}

${refs.length > 0 ? `ACTUAL REFERENCES FROM BUCKET:
${refs.map(r => `- ${r.company}: ${r.contactName} (${r.contactPhone || r.contactEmail || 'Contact info available'})
  Contract Value: ${r.contractValue || 'N/A'}
  Work: ${r.description || 'Similar services'}`).join('\n\n')}

Write about THESE specific references only.`
: `No references saved in BUCKET yet. 

IMPORTANT: Since there are no specific references, write about the TYPES of work the company does based on their services (${profile?.services_description || 'general consulting'}), but DO NOT make up:
- Specific contract names
- Dollar amounts
- Client names
- Dates
- Statistics

Instead, describe capabilities and approach in general terms.`}

CHARACTER LIMIT: ${charLimit || 1000}
No markdown formatting.`

    } else if (isUnderstanding) {
      userPrompt = `Write an "Understanding of Need" section that shows we understand what the agency needs.

OPPORTUNITY: ${opportunity.title}
DESCRIPTION: ${opportunity.description || 'Not provided'}
AGENCY: ${opportunity.agency || 'Not specified'}

Structure:
1. Restate the problem/need the agency is trying to address (2-3 sentences)
2. Acknowledge why this is important/urgent (1-2 sentences)
3. Identify key challenges they face (2-3 sentences)
4. Briefly connect to how we're positioned to help (1 sentence)

This section is about understanding THEIR problem - not about our experience.

CHARACTER LIMIT: ${charLimit || 1000}
No markdown formatting.`

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

Focus on HOW you will do the work. You can reference the company's services: ${profile?.services_description || 'consulting and professional services'}

REMEMBER: Do NOT make up specific past contract names, dollar values, or statistics. Describe the APPROACH, not fake history.

CHARACTER LIMIT: ${charLimit || 2000}
No markdown formatting.`

    } else if (isQualifications) {
      userPrompt = `Write the Past Performance / Qualifications section:

OPPORTUNITY: ${opportunity.title}

${hasPastPerformance ? `ACTUAL PAST PERFORMANCE FROM BUCKET:
${profile.past_performance}

Use THIS information to write the section.` : `
LIMITED BUCKET DATA - The BUCKET does not contain specific past performance history.

COMPANY SERVICES: ${profile?.services_description || 'Professional services'}
MISSION: ${profile?.mission_statement || 'Not specified'}

IMPORTANT: Since there's no specific past performance data, write about:
- The company's relevant CAPABILITIES and EXPERTISE
- Their APPROACH to similar work
- WHY they're qualified based on their mission and services

DO NOT make up:
- Specific contract names or dollar values
- Fake statistics (percentages, numbers served)
- Invented client names
- Made-up dates

Write honestly about what the company CAN do, not fabricated history.`}

CHARACTER LIMIT: ${charLimit || 1500}
No markdown formatting.`

    } else {
      userPrompt = `Write a response for this section:

SECTION: ${section.title}
QUESTION/PROMPT: ${section.prompt}
CHARACTER LIMIT: ${charLimit || 1500}

Write a direct, compelling response. Use ONLY information from the BUCKET above - do NOT invent specific contracts, statistics, or credentials. No markdown formatting.`
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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Anthropic API error:', errorData)
      return res.status(500).json({ error: 'Failed to generate answer' })
    }

    const data = await response.json()
    let answer = data.content[0].text

    // Strip any markdown that slipped through
    answer = answer
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^#+\s/gm, '')
      .replace(/^-\s/gm, '• ')
      .trim()

    return res.status(200).json({ answer })

  } catch (error) {
    console.error('Generate answer error:', error)
    return res.status(500).json({ error: 'Failed to generate answer' })
  }
}
