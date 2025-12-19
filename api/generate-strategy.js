// /api/generate-strategy.js - RCA Strategy Generator
// Generates approach strategy based on opportunity + BUCKET + RFP Content

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { opportunity, profile, userAngle, rfpContent } = req.body

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

    // Build RFP context from uploaded/fetched document
    const rfpContext = rfpContent ? `
=== ACTUAL RFP/GRANT DOCUMENT CONTENT ===
${rfpContent.description ? `DESCRIPTION:\n${rfpContent.description.substring(0, 2000)}` : ''}
${rfpContent.scope ? `\nSCOPE OF WORK:\n${rfpContent.scope.substring(0, 2000)}` : ''}
${rfpContent.requirements ? `\nREQUIREMENTS:\n${rfpContent.requirements.substring(0, 1500)}` : ''}
${rfpContent.qualifications ? `\nQUALIFICATIONS:\n${rfpContent.qualifications.substring(0, 1500)}` : ''}
${rfpContent.evaluation ? `\nEVALUATION CRITERIA:\n${rfpContent.evaluation.substring(0, 1000)}` : ''}
${rfpContent.questions?.length > 0 ? `\nQUESTIONS TO ADDRESS:\n${rfpContent.questions.slice(0, 10).join('\n')}` : ''}
${rfpContent.pageLimit ? `\nPAGE LIMIT: ${rfpContent.pageLimit}` : ''}
${rfpContent.budget ? `\nBUDGET: $${rfpContent.budget}` : ''}
=== END RFP CONTENT ===
` : 'No RFP document uploaded - using opportunity title and description only.'

    const systemPrompt = `You are RCA (Rambo Contract Assistant), an expert at helping small businesses win government contracts and grants.

Your job is to create a SHORT, ACTIONABLE game plan - NOT a long paragraph.

COMPANY BUCKET:
${profileContext}

${rfpContext}

OUTPUT FORMAT - Keep it tight:
1. SUGGESTED TITLE: A compelling 5-8 word program name
2. YOUR ANGLE: One sentence - the main positioning strategy
3. FROM YOUR BUCKET - USE THESE: List 3-4 specific things from their profile to highlight
4. KEY POINTS TO HIT: 3-4 bullet points of what to emphasize in the response

RULES:
- Be SPECIFIC - use their actual company name, certs, location
- Keep it SHORT - this is a game plan, not the actual response
- Focus on what makes them UNIQUELY qualified
- Reference actual RFP requirements if available`

    const userPrompt = `Create a winning game plan for this opportunity:

TITLE: ${opportunity.title}
DESCRIPTION: ${opportunity.description || 'Not provided'}
AGENCY: ${opportunity.agency || 'Not specified'}

${userAngle ? `USER'S ANGLE: "${userAngle}"` : ''}

Respond in this EXACT JSON format:
{
  "suggestedTitle": "Your 5-8 word program title",
  "angle": "One sentence positioning strategy",
  "fromBucket": ["Specific item 1 to highlight", "Specific item 2", "Specific item 3"],
  "keyPoints": ["Point 1 to emphasize", "Point 2", "Point 3"]
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
        angle: text.substring(0, 150),
        fromBucket: ['Your relevant experience', 'Key qualifications'],
        keyPoints: ['Review and customize this strategy']
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
