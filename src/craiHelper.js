// CR-AI Helper - Connects to Claude API for smart suggestions

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

export async function getAISuggestion(prompt, context, apiKey) {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are CR-AI, a helpful assistant for small businesses applying for government contracts and grants.

Context about the business:
${context}

Task: ${prompt}

Respond in a professional but approachable tone. Be concise and actionable.`
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data.content[0].text
  } catch (error) {
    console.error('CR-AI Error:', error)
    throw error
  }
}

export async function generateMission(companyName, services, context, apiKey) {
  const prompt = `Write a compelling 2-3 sentence mission statement for "${companyName}". 
  
Their services include: ${services || 'various professional services'}

The mission should explain WHY the company exists and WHO they serve. Make it specific, not generic.`

  return getAISuggestion(prompt, context, apiKey)
}

export async function generateVision(companyName, context, apiKey) {
  const prompt = `Write an inspiring 2-3 sentence vision statement for "${companyName}".

The vision should describe WHERE the company is heading and WHAT future they're creating. Make it ambitious but believable.`

  return getAISuggestion(prompt, context, apiKey)
}

export async function generateElevatorPitch(companyName, services, mission, context, apiKey) {
  const prompt = `Write a 30-second elevator pitch for "${companyName}".

Their services: ${services || 'professional services'}
Their mission: ${mission || 'to serve their community'}

Format: "We help [target audience] achieve [outcome] by [what you do differently]."

Make it memorable and specific. No more than 3-4 sentences.`

  return getAISuggestion(prompt, context, apiKey)
}

export async function improveTex(text, fieldType, apiKey) {
  const prompt = `Improve this ${fieldType} for a government contractor. Make it more professional, compelling, and concise while keeping the core message:

"${text}"

Return ONLY the improved text, no explanations.`

  return getAISuggestion(prompt, '', apiKey)
}

export async function parseCapabilityStatement(text, apiKey) {
  const prompt = `Extract business information from this capability statement text. Return a JSON object with these fields (use null if not found):

{
  "company_name": "",
  "dba": "",
  "address": "",
  "city": "",
  "state": "",
  "zip": "",
  "phone": "",
  "email": "",
  "website": "",
  "mission": "",
  "vision": "",
  "elevator_pitch": "",
  "services": [],
  "naics_codes": [],
  "certifications": [],
  "uei_number": "",
  "cage_code": "",
  "sam_registered": true/false
}

Capability Statement Text:
${text}

Return ONLY valid JSON, no markdown or explanations.`

  const response = await getAISuggestion(prompt, '', apiKey)
  try {
    return JSON.parse(response)
  } catch {
    console.error('Failed to parse AI response as JSON')
    return null
  }
}
