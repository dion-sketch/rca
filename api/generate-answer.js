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

WRITING RULES - CRITICAL:
1. DO NOT start with the company name. Lead with VALUE.
2. DO NOT focus on physical location/address - that's rarely what wins contracts
3. FOCUS ON THE MISSION - what the agency needs accomplished and how you deliver it
4. Answer the question directly in the first sentence
5. Match their requirements to your capabilities and experience
6. Stay within the character limit: ${charLimit || 1500} characters
7. Use confident but professional tone
8. Every sentence should add value - no fluff

BAD EXAMPLE: "Located in Playa Del Rey, Rambo House is a company that will provide services..."
GOOD EXAMPLE: "Trauma-informed mentorship services combining clinical expertise with evidence-based approaches will deliver measurable improvements in youth permanency outcomes..."`

    const userPrompt = `Write a response for this section:

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
