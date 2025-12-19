// ============================================
// /api/generate.js
// CR-AI Generation API with Rules Enforcement
// ============================================

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ============================================
// CORE SYSTEM PROMPT (Fallback if DB fails)
// ============================================
const FALLBACK_SYSTEM_PROMPT = `You are CR-AI, a PhD-level small business contracts expert created by Contract Ready.

CORE IDENTITY:
- You help minority-owned, women-owned, veteran-owned, and disadvantaged small businesses win government contracts and grants
- You are a trusted advisor, business partner, and coach who BELIEVES in the user
- You NEVER create fear - you empower

YOUR ROLE:
- Supportive tool that creates DRAFT responses
- NOT their legal team
- NOT a guarantee of winning
- May contain errors — user MUST review
- User is responsible for final accuracy

WRITING RULES:
1. Write in FIRST PERSON ("We provide...", "Our team...", "We have...")
2. Be SPECIFIC — use actual numbers, names, and details from the BUCKET
3. Sound PROFESSIONAL but HUMAN — not robotic or generic
4. NEVER make up information — only use what's in the BUCKET
5. If BUCKET lacks info, write a solid response but note what could be added
6. Match the TONE to government RFP expectations
7. Stay UNDER character limits — aim for 90% of limit

THE #1 RULE: NEVER CREATE FEAR
- Show what they HAVE, not what they're missing
- Insurance, bonds, etc. are needed AFTER winning, not to apply
- If something is missing, offer solutions (partners, hiring, etc.)

VOICE — USE THESE:
- "You're closer than you think."
- "This is doable. Let's go for it."
- "I've got you."
- "Don't let the title fool you."

VOICE — NEVER SAY:
- "Unfortunately"
- "You're missing"
- "You don't have"
- "You need to"
- "I cannot help"`

// ============================================
// MAIN HANDLER
// ============================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      question,
      profile,
      opportunity,
      previousAnswers,
      charLimit,
      wordLimit,
      mustInclude,
      budgetRange,
      strategyPlan,
      generationType // 'standard', 'strategy', 'qa_batch', 'shorten'
    } = req.body

    // ==========================================
    // 1. FETCH RULES FROM DATABASE
    // ==========================================
    let config = {}
    try {
      const { data } = await supabase
        .from('cr_ai_config')
        .select('key, value')
      
      if (data) {
        config = Object.fromEntries(data.map(c => [c.key, c.value]))
      }
    } catch (dbError) {
      console.warn('Could not fetch CR-AI config from database, using fallback:', dbError)
    }

    // ==========================================
    // 2. BUILD BUCKET CONTEXT
    // ==========================================
    const bucketContext = buildBucketContext(profile)

    // ==========================================
    // 3. BUILD OPPORTUNITY CONTEXT
    // ==========================================
    const opportunityContext = opportunity ? buildOpportunityContext(opportunity) : ''

    // ==========================================
    // 4. BUILD PREVIOUS ANSWERS CONTEXT
    // ==========================================
    const previousContext = previousAnswers?.length > 0
      ? `\nPREVIOUS ANSWERS (for consistency):\n${previousAnswers.map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.answer}`).join('\n\n')}`
      : ''

    // ==========================================
    // 5. BUILD SYSTEM PROMPT WITH RULES
    // ==========================================
    const systemPrompt = buildSystemPrompt({
      config,
      bucketContext,
      opportunityContext,
      previousContext,
      charLimit,
      wordLimit,
      mustInclude,
      budgetRange,
      strategyPlan,
      generationType
    })

    // ==========================================
    // 6. BUILD USER PROMPT
    // ==========================================
    const userPrompt = buildUserPrompt({
      question,
      charLimit,
      wordLimit,
      generationType,
      opportunity
    })

    // ==========================================
    // 7. CALL CLAUDE API
    // ==========================================
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
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', errorText)
      throw new Error('Failed to generate response')
    }

    const data = await response.json()
    let generatedText = data.content[0].text

    // ==========================================
    // 8. ENFORCEMENT LAYER — POST-GENERATION
    // ==========================================
    const complianceRules = config.compliance_rules || {
      enforce_char_limits: true,
      auto_truncate: true
    }

    // Enforce character limit
    if (complianceRules.enforce_char_limits && charLimit && generatedText.length > charLimit) {
      console.log(`Response over limit: ${generatedText.length}/${charLimit}. Auto-truncating.`)
      generatedText = truncateAtSentence(generatedText, charLimit)
    }

    // Enforce word limit
    if (complianceRules.enforce_char_limits && wordLimit) {
      const words = generatedText.split(/\s+/)
      if (words.length > wordLimit) {
        console.log(`Response over word limit: ${words.length}/${wordLimit}. Truncating.`)
        generatedText = words.slice(0, wordLimit).join(' ') + '...'
      }
    }

    // Check for forbidden phrases
    const voicePhrases = config.voice_phrases || { never: [] }
    const forbiddenFound = checkForbiddenPhrases(generatedText, voicePhrases.never)
    if (forbiddenFound.length > 0) {
      console.warn('CR-AI used forbidden phrases:', forbiddenFound)
      // Could auto-replace here in future
    }

    // Check compliance
    const compliance = checkCompliance(generatedText, {
      charLimit,
      wordLimit,
      mustInclude
    })

    // ==========================================
    // 9. RETURN RESPONSE
    // ==========================================
    return res.status(200).json({
      response: generatedText,
      compliance: compliance,
      usage: data.usage,
      model: 'claude-sonnet-4-20250514',
      meta: {
        charCount: generatedText.length,
        charLimit: charLimit || null,
        wordCount: generatedText.split(/\s+/).length,
        wordLimit: wordLimit || null,
        forbiddenPhrasesFound: forbiddenFound
      }
    })

  } catch (error) {
    console.error('Generation error:', error)
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    })
  }
}

// ============================================
// HELPER: Build BUCKET Context
// ============================================
function buildBucketContext(profile) {
  if (!profile) {
    return 'No company profile available. User should build their BUCKET first.'
  }

  let context = `COMPANY: ${profile.company_name || 'Not specified'}
ENTITY TYPE: ${profile.entity_type || 'Not specified'}
LOCATION: ${profile.city || ''}, ${profile.state || ''} ${profile.zip || ''}
`

  if (profile.services?.length > 0) {
    context += `\nSERVICES:\n${profile.services.map(s => `- ${s}`).join('\n')}`
  }

  if (profile.naics_codes?.length > 0) {
    context += `\n\nNAICS CODES: ${profile.naics_codes.join(', ')}`
  }

  if (profile.certifications?.length > 0) {
    const activeCerts = profile.certifications.filter(c => c.status === 'active' || c.status === 'certified')
    if (activeCerts.length > 0) {
      context += `\n\nCERTIFICATIONS:\n${activeCerts.map(c => `- ${c.name || c.type}`).join('\n')}`
    }
  }

  if (profile.past_performance?.length > 0) {
    context += `\n\nPAST PERFORMANCE:\n${profile.past_performance.map(p => 
      `- ${p.project_name || p.title}: ${p.client || p.agency} (${p.value ? '$' + p.value.toLocaleString() : 'Value not specified'})`
    ).join('\n')}`
  }

  if (profile.team_members?.length > 0) {
    context += `\n\nKEY PERSONNEL:\n${profile.team_members.map(t => 
      `- ${t.name}: ${t.title || t.role}`
    ).join('\n')}`
  }

  if (profile.mission) {
    context += `\n\nMISSION: ${profile.mission}`
  }

  if (profile.elevator_pitch) {
    context += `\n\nELEVATOR PITCH: ${profile.elevator_pitch}`
  }

  if (profile.what_makes_you_different) {
    context += `\n\nDIFFERENTIATOR: ${profile.what_makes_you_different}`
  }

  return context
}

// ============================================
// HELPER: Build Opportunity Context
// ============================================
function buildOpportunityContext(opportunity) {
  let context = `OPPORTUNITY: ${opportunity.title || 'Untitled'}`
  
  if (opportunity.agency) {
    context += `\nAGENCY: ${opportunity.agency}`
  }
  
  if (opportunity.due_date) {
    context += `\nDUE DATE: ${new Date(opportunity.due_date).toLocaleDateString()}`
  }
  
  if (opportunity.estimated_value) {
    context += `\nESTIMATED VALUE: ${opportunity.estimated_value}`
  }
  
  if (opportunity.description) {
    context += `\nDESCRIPTION: ${opportunity.description}`
  }
  
  if (opportunity.scope_items?.length > 0) {
    context += `\nSCOPE:\n${opportunity.scope_items.map(s => `- ${s}`).join('\n')}`
  }

  return context
}

// ============================================
// HELPER: Build System Prompt
// ============================================
function buildSystemPrompt(options) {
  const {
    config,
    bucketContext,
    opportunityContext,
    previousContext,
    charLimit,
    wordLimit,
    mustInclude,
    budgetRange,
    strategyPlan,
    generationType
  } = options

  let prompt = FALLBACK_SYSTEM_PROMPT

  prompt += `\n\nBUCKET (User's Business Profile):\n${bucketContext}`

  if (opportunityContext) {
    prompt += `\n\nOPPORTUNITY:\n${opportunityContext}`
  }

  if (strategyPlan) {
    prompt += `\n\nSTRATEGY TO FOLLOW:\n${strategyPlan}`
  }

  if (previousContext) {
    prompt += `\n${previousContext}`
  }

  // Add constraints
  if (charLimit) {
    prompt += `\n\n⚠️ CHARACTER LIMIT: ${charLimit}
Your response MUST be UNDER ${charLimit} characters.
Aim for ${Math.floor(charLimit * 0.9)} characters to leave a safety buffer.
Count carefully. Do not exceed under any circumstances.`
  }

  if (wordLimit) {
    prompt += `\n\n⚠️ WORD LIMIT: ${wordLimit}
Your response MUST be UNDER ${wordLimit} words.`
  }

  if (mustInclude?.length > 0) {
    prompt += `\n\nREQUIRED ELEMENTS — Your response MUST mention:\n${mustInclude.map(item => `- ${item}`).join('\n')}`
  }

  if (budgetRange) {
    prompt += `\n\nBUDGET CONSTRAINTS:
- Floor (minimum): $${budgetRange.floor?.toLocaleString() || 'Not specified'}
- Ceiling (maximum): $${budgetRange.ceiling?.toLocaleString() || 'Not specified'}`
  }

  // Generation type specific instructions
  if (generationType === 'strategy') {
    prompt += `\n\nGENERATION TYPE: Strategy Plan
Create a strategic response plan that includes:
1. PROGRAM TITLE - A creative, memorable name that connects to the agency's mission
2. KEY THEMES - 3-4 bullet points on what to emphasize
3. APPROACH SUMMARY - 2-3 sentences on positioning
4. DIFFERENTIATORS - What makes this business stand out`
  }

  if (generationType === 'shorten') {
    prompt += `\n\nGENERATION TYPE: Shorten
Your ONLY job is to shorten the text while preserving key information.
You MUST stay under the character/word limit.
Do NOT add new information, just condense.`
  }

  return prompt
}

// ============================================
// HELPER: Build User Prompt
// ============================================
function buildUserPrompt(options) {
  const { question, charLimit, wordLimit, generationType, opportunity } = options

  if (generationType === 'strategy') {
    return `Create a strategic response plan for this opportunity.
Base it on the business profile and tailor it to the specific opportunity details.`
  }

  if (generationType === 'shorten') {
    return `Shorten the following text to fit within ${charLimit || wordLimit} ${charLimit ? 'characters' : 'words'}:

${question}`
  }

  let prompt = `Write a professional, compelling response to this RFP question:

"${question}"

Remember:
- First person voice ("We...", "Our team...")
- Use specific details from the BUCKET
- Professional government contracting tone
- 2-4 paragraphs unless the question requires more`

  if (charLimit) {
    prompt += `\n- STAY UNDER ${charLimit} CHARACTERS`
  }

  if (wordLimit) {
    prompt += `\n- STAY UNDER ${wordLimit} WORDS`
  }

  return prompt
}

// ============================================
// HELPER: Truncate at Sentence Boundary
// ============================================
function truncateAtSentence(text, maxLength) {
  if (text.length <= maxLength) return text

  // Leave room for "..."
  const truncated = text.substring(0, maxLength - 3)
  
  // Find the last sentence boundary
  const lastPeriod = truncated.lastIndexOf('.')
  const lastQuestion = truncated.lastIndexOf('?')
  const lastExclaim = truncated.lastIndexOf('!')
  
  const lastBoundary = Math.max(lastPeriod, lastQuestion, lastExclaim)
  
  if (lastBoundary > maxLength * 0.5) {
    // Use sentence boundary if it's past halfway
    return text.substring(0, lastBoundary + 1)
  }
  
  // Otherwise just truncate with ellipsis
  return truncated + '...'
}

// ============================================
// HELPER: Check Forbidden Phrases
// ============================================
function checkForbiddenPhrases(text, forbiddenList = []) {
  const found = []
  const defaultForbidden = [
    'Unfortunately',
    "You're missing",
    "You don't have",
    'You need to',
    'You lack',
    'I cannot help'
  ]
  
  const checkList = forbiddenList.length > 0 ? forbiddenList : defaultForbidden
  
  checkList.forEach(phrase => {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      found.push(phrase)
    }
  })
  
  return found
}

// ============================================
// HELPER: Check Compliance
// ============================================
function checkCompliance(text, requirements) {
  const issues = []

  // Character limit
  if (requirements.charLimit && text.length > requirements.charLimit) {
    issues.push({
      type: 'char_limit',
      message: `${text.length - requirements.charLimit} characters over limit`,
      severity: 'error'
    })
  }

  // Word limit
  if (requirements.wordLimit) {
    const wordCount = text.split(/\s+/).length
    if (wordCount > requirements.wordLimit) {
      issues.push({
        type: 'word_limit',
        message: `${wordCount - requirements.wordLimit} words over limit`,
        severity: 'error'
      })
    }
  }

  // Required elements
  if (requirements.mustInclude?.length > 0) {
    requirements.mustInclude.forEach(element => {
      if (!text.toLowerCase().includes(element.toLowerCase())) {
        issues.push({
          type: 'missing_element',
          message: `Does not mention: ${element}`,
          severity: 'warning'
        })
      }
    })
  }

  return {
    compliant: issues.filter(i => i.severity === 'error').length === 0,
    issues
  }
}
