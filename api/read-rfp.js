// /api/read-rfp.js
// Reads RFP/Grant PDF and extracts content for RCA to use
// This is the DNA of the product - understanding what to respond to

import pdf from 'pdf-parse'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pdf_url, pdf_base64 } = req.body

  if (!pdf_url && !pdf_base64) {
    return res.status(400).json({ error: 'pdf_url or pdf_base64 required' })
  }

  try {
    let pdfBuffer

    if (pdf_base64) {
      // User uploaded PDF
      pdfBuffer = Buffer.from(pdf_base64, 'base64')
    } else {
      // Fetch PDF from URL
      const response = await fetch(pdf_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RCA/1.0)'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      pdfBuffer = Buffer.from(arrayBuffer)
    }

    // Parse PDF
    const data = await pdf(pdfBuffer)
    const fullText = data.text

    // Extract structured content
    const extracted = extractRFPContent(fullText)

    return res.status(200).json({
      success: true,
      pageCount: data.numpages,
      fullText: fullText.substring(0, 50000), // Limit for API
      ...extracted
    })

  } catch (error) {
    console.error('PDF read error:', error)
    return res.status(500).json({ 
      error: 'Failed to read PDF',
      message: error.message 
    })
  }
}

// Extract key RFP sections
function extractRFPContent(text) {
  const sections = {
    description: '',
    scope: '',
    requirements: '',
    qualifications: '',
    evaluation: '',
    questions: [],
    budget: '',
    timeline: '',
    pageLimit: ''
  }

  // Normalize text
  const normalized = text.replace(/\s+/g, ' ')

  // Find Description/Overview/Background
  const descPatterns = [
    /(?:description|overview|background|introduction|purpose)[:\s]*([\s\S]{100,2000}?)(?=\n\n|\d+\.|[A-Z]{2,})/i,
    /(?:project\s*description)[:\s]*([\s\S]{100,2000}?)(?=\n\n|\d+\.)/i
  ]
  for (const pattern of descPatterns) {
    const match = normalized.match(pattern)
    if (match) {
      sections.description = match[1].trim()
      break
    }
  }

  // Find Scope of Work
  const scopeMatch = normalized.match(/(?:scope\s*of\s*(?:work|services))[:\s]*([\s\S]{100,3000}?)(?=\n\n|\d+\.|requirements|qualifications)/i)
  if (scopeMatch) {
    sections.scope = scopeMatch[1].trim()
  }

  // Find Requirements
  const reqMatch = normalized.match(/(?:requirements|minimum\s*requirements)[:\s]*([\s\S]{100,2000}?)(?=\n\n|\d+\.|evaluation|qualifications)/i)
  if (reqMatch) {
    sections.requirements = reqMatch[1].trim()
  }

  // Find Qualifications
  const qualMatch = normalized.match(/(?:qualifications|experience\s*requirements)[:\s]*([\s\S]{100,2000}?)(?=\n\n|\d+\.|evaluation|submission)/i)
  if (qualMatch) {
    sections.qualifications = qualMatch[1].trim()
  }

  // Find Evaluation Criteria
  const evalMatch = normalized.match(/(?:evaluation\s*criteria|scoring|selection\s*criteria)[:\s]*([\s\S]{100,2000}?)(?=\n\n|\d+\.|submission|budget)/i)
  if (evalMatch) {
    sections.evaluation = evalMatch[1].trim()
  }

  // Find Questions to Answer
  // Look for numbered items that look like questions
  const questionPatterns = [
    /\d+\.\s*(?:describe|explain|provide|how|what|why)[^.?]*[.?]/gi,
    /(?:question|item)\s*\d+[:\s]*([^.?]+[.?])/gi
  ]
  for (const pattern of questionPatterns) {
    const matches = normalized.matchAll(pattern)
    for (const m of matches) {
      const q = (m[1] || m[0]).trim()
      if (q.length > 20 && q.length < 500) {
        sections.questions.push(q)
      }
    }
  }
  sections.questions = sections.questions.slice(0, 20) // Max 20 questions

  // Find Budget info
  const budgetMatch = normalized.match(/(?:budget|funding|award\s*amount)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i)
  if (budgetMatch) {
    sections.budget = budgetMatch[1]
  }

  // Find Page Limits
  const pageMatch = normalized.match(/(?:page\s*limit|not\s*(?:to\s*)?exceed|maximum)[:\s]*(\d+)\s*pages?/i)
  if (pageMatch) {
    sections.pageLimit = pageMatch[1] + ' pages'
  }

  return sections
}
