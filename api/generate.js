// api/generate.js - Professional tone
// Date: December 28, 2025
// CRF 3-part formula with neutral professional prompts

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    questionId,
    questionText, 
    businessProfile, 
    submission, 
    strategy, 
    scopeItems
  } = req.body;

  if (!questionText || !businessProfile) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const companyName = businessProfile.company_name || 'Our organization';
  const capabilities = businessProfile.capabilities || [];
  const pastPerformance = businessProfile.past_performance || [];
  const yearsExperience = businessProfile.years_in_business || 'several';
  const naicsCodes = businessProfile.naics_codes || [];
  
  const agencyName = submission?.agency || 'the agency';
  const opportunityTitle = submission?.title || submission?.contract_title || 'this opportunity';
  const winThemes = strategy?.approachNotes || '';

  // ============================================
  // SYSTEM PROMPT - Professional tone
  // ============================================
  const systemPrompt = `You are an expert proposal writer generating responses for government contracts.

## RESPONSE STRUCTURE (CRF 3-Part Formula)
Every response must follow this structure:

### Part 1: Answer (1-2 sentences)
Lead with the solution. Do not start with the company name.
- Wrong: "${companyName} provides..."
- Correct: "Comprehensive case management services ensure..."

### Part 2: Magnetism (2-3 sentences)
Include three elements:
1. The agency's specific need
2. Your approach or methodology
3. Proof of capability (numbers, outcomes, experience)

### Part 3: Outcome (1-2 sentences)
Describe the result the agency will achieve.

## RULES
- Never start sentences with "${companyName}" or "Our company"
- Include specific numbers and metrics when available
- Focus outcomes on the agency's success
- Mirror terminology from the RFP when possible

## CONTEXT
Company: ${companyName}
Years in Business: ${yearsExperience}
NAICS: ${naicsCodes.join(', ') || 'N/A'}
Capabilities: ${capabilities.slice(0, 5).join(', ') || 'Professional services'}
Past Performance: ${pastPerformance.length} contracts
${pastPerformance.slice(0, 3).map(p => `- ${p.project_name || p.name}: ${p.client || ''}`).join('\n')}

Agency: ${agencyName}
Opportunity: ${opportunityTitle}
Key Themes: ${winThemes || 'Not specified'}

## OUTPUT FORMAT
Structure output with these labels:

ANSWER:
[1-2 sentence direct answer]

MAGNETISM:
[2-3 sentences: need + approach + proof]

OUTCOME:
[1-2 sentences: agency result]
`;

  const userPrompt = `Generate a response for this question:

"${questionText}"

${scopeItems?.length > 0 ? `\nScope items:\n${scopeItems.map(s => `- ${s}`).join('\n')}` : ''}

Follow the CRF structure (Answer, Magnetism, Outcome).`;

  try {
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
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(500).json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    const generatedText = data.content[0]?.text || '';
    const crfParts = parseCRFResponse(generatedText);

    return res.status(200).json({ 
      response: generatedText,
      crfParts: crfParts,
      questionId: questionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to generate response', 
      details: error.message 
    });
  }
}

function parseCRFResponse(text) {
  const parts = {
    answer: '',
    magnetism: '',
    outcome: '',
    raw: text
  };

  const answerMatch = text.match(/ANSWER:?\s*([\s\S]*?)(?=MAGNETISM|$)/i);
  const magnetismMatch = text.match(/MAGNETISM:?\s*([\s\S]*?)(?=OUTCOME|$)/i);
  const outcomeMatch = text.match(/OUTCOME:?\s*([\s\S]*?)$/i);

  if (answerMatch) parts.answer = answerMatch[1].trim();
  if (magnetismMatch) parts.magnetism = magnetismMatch[1].trim();
  if (outcomeMatch) parts.outcome = outcomeMatch[1].trim();

  if (!parts.answer && !parts.magnetism && !parts.outcome) {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length >= 3) {
      parts.answer = paragraphs[0].trim();
      parts.magnetism = paragraphs.slice(1, -1).join('\n\n').trim();
      parts.outcome = paragraphs[paragraphs.length - 1].trim();
    } else {
      parts.answer = text.trim();
    }
  }

  return parts;
}
