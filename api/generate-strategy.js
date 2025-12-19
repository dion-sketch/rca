// /api/generate-strategy.js - RCA Strategy Generator
// Generates approach strategy based on opportunity + BUCKET

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { opportunity, profile, userAngle } = req.body

  if (!opportunity) {
    return res.status(400).json({ error: 'Opportunity data required' })
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
MISSION: ${profile.mission_statement || 'Not specified'}
` : 'No company profile available.'

    const systemPrompt = `You are RCA (Rambo Contract Assistant), an expert at helping small businesses win government contracts and grants.

Your job is to create a WINNING STRATEGY for this opportunity based on what you know about the company.

COMPANY BUCKET:
${profileContext}

RULES:
1. Create a compelling program TITLE (5-10 words, memorable)
2. Write an APPROACH paragraph (3-4 sentences) explaining how they should position themselves
3. Be SPECIFIC - use their actual company name, certifications, location
4. Sound CONFIDENT but realistic
5. Focus on what makes them UNIQUELY qualified
6. If they lack certain qualifications, focus on strengths they DO have`

    const userPrompt = `Create a winning strategy for this opportunity:

TITLE: ${opportunity.title}
DESCRIPTION: ${opportunity.description || 'Not provided'}
AGENCY: ${opportunity.agency || 'Not specified'}
DUE DATE: ${opportunity.due_date || 'Not specified'}

${userAngle ? `THE USER'S ANGLE/APPROACH IDEA: "${userAngle}"` : 'No specific angle provided - suggest the best approach based on their BUCKET.'}

Respond in this EXACT JSON format:
{
  "suggestedTitle": "Your suggested program title here",
  "approach": "Your 3-4 sentence approach strategy here"
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Anthropic API error:', errorData)
      return res.status(500).json({ error: 'Failed to generate strategy' })
    }

    const data = await response.json()
    const text = data.content[0].text

    // Parse the JSON response
    let strategy
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        strategy = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found')
      }
    } catch (e) {
      // If JSON parsing fails, create structure from text
      strategy = {
        suggestedTitle: 'Strategic Partnership Proposal',
        approach: text
      }
    }

    return res.status(200).json({ 
      success: true,
      strategy: strategy
    })

  } catch (error) {
    console.error('Strategy generation error:', error)
    return res.status(500).json({ error: 'Failed to generate strategy' })
  }
}
