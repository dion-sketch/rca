import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, profile, scopeItems, opportunityTitle } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const systemPrompt = `You are CR-AI, the AI engine powering RCA (Rambo Contract Assistant). Your job is to help small business owners write winning contract and grant responses.

IMPORTANT GUIDELINES:
- Write in a professional but warm tone
- Be specific and use concrete details from their profile
- Keep responses focused and concise (2-4 paragraphs typically)
- If information is missing, write a strong response with what's available and note what could strengthen it
- Never make up specific numbers, certifications, or credentials not in the profile
- End with confidence - these are capable business owners

THEIR BUSINESS PROFILE (BUCKET):
${profile ? JSON.stringify(profile, null, 2) : 'No profile data available'}

${scopeItems && scopeItems.length > 0 ? `KEY SCOPE ITEMS FOR THIS OPPORTUNITY:
${scopeItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}` : ''}

${opportunityTitle ? `OPPORTUNITY: ${opportunityTitle}` : ''}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Write a response to this RFP/grant question:\n\n"${question}"\n\nUse the business profile above to write a compelling, specific response.`
        }
      ],
    });

    const responseText = message.content[0].text;
    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Failed to generate response' });
  }
}
