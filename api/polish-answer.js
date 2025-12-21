// ============================================
// polish-answer.js
// Takes user's rough draft and polishes it
// ============================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { section, opportunity, profile, roughDraft, charLimit } = req.body

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' })
    }

    // Build profile context
    const profileContext = profile ? `
Company: ${profile.company_name || 'Not specified'}
Services: ${profile.services_description || 'Not specified'}
NAICS Codes: ${profile.naics_codes?.join(', ') || 'None'}
Certifications: ${profile.certifications?.join(', ') || 'None'}
` : 'No profile data available'

    const systemPrompt = `You are RCA (Rambo Contract Assistant), helping polish rough draft responses for government contracts and grants.

COMPANY CONTEXT:
${profileContext}

OPPORTUNITY: ${opportunity?.title || 'Not specified'}

YOUR JOB:
Take the user's rough draft and polish it into a professional response.

POLISHING RULES:
1. Keep the user's main ideas and points - don't change the meaning
2. Fix grammar, spelling, and punctuation
3. Make it sound professional and confident
4. Use the WINNING FORMULA structure if the draft allows:
   - Direct Answer → Approach → Experience → Outcome
5. DO NOT start with the company name
6. DO NOT add information the user didn't mention
7. Keep it within ${charLimit || 1500} characters
8. Remove any filler words or fluff
9. Make every sentence count

OUTPUT: Return ONLY the polished text. No explanations, no markdown, no asterisks.`

    const userPrompt = `Polish this rough draft for the "${section.title}" section:

ROUGH DRAFT:
${roughDraft}

CHARACTER LIMIT: ${charLimit || 1500}

Return only the polished, professional version.`

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
      return res.status(500).json({ error: 'Failed to polish answer' })
    }

    const data = await response.json()
    let answer = data.content[0].text

    // Trim to character limit
    if (charLimit && answer.length > charLimit) {
      answer = answer.substring(0, charLimit - 3) + '...'
    }

    return res.status(200).json({ answer })

  } catch (error) {
    console.error('Polish answer error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
