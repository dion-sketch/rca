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
    // Build profile context
    const profileContext = profile ? `
COMPANY: ${profile.company_name || 'Not specified'}
LOCATION: ${profile.city ? `${profile.city}, ${profile.state}` : 'Not specified'}
NAICS CODES: ${profile.naics_codes?.map(n => n.code || n).join(', ') || 'None listed'}
CERTIFICATIONS: ${profile.certifications?.map(c => c.name || c).join(', ') || 'None listed'}
SERVICES: ${profile.services?.join(', ') || 'Not specified'}
PAST PERFORMANCE: ${profile.past_performance || 'Not specified'}
MISSION: ${profile.mission_statement || 'Not specified'}
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

    // Special handling for budget section
    const isBudget = section.id === 'budget' || section.title.toLowerCase().includes('budget')
    
    const userPrompt = isBudget 
      ? `Create a budget breakdown for this opportunity:

OPPORTUNITY: ${opportunity.title}
ESTIMATED VALUE: ${opportunity.estimated_value || 'Not specified'}

Create a realistic budget breakdown with these categories:
1. Personnel (salaries, benefits) - typically 60-70% of total
2. Supplies & Materials
3. Travel (if applicable)
4. Equipment (if applicable)
5. Indirect Costs / Overhead (typically 10-15%)
6. TOTAL

Format as a clear line-item budget. Use realistic numbers that add up to approximately the estimated value if provided. Include brief justification for major line items.`
      : `Write a response for this section:

SECTION: ${section.title}
QUESTION/PROMPT: ${section.prompt}
CHARACTER LIMIT: ${charLimit || 1500}

Write a direct, compelling response. Start with the answer, not the company name.`

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

    // Trim to character limit if needed
    if (answer.length > (charLimit || 1500)) {
      // Find last sentence within limit
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
