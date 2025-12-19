// /api/fetch-listing.js
// Fetches full description from grants.gov or SAM.gov listing page

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { source_url, source } = req.body

  if (!source_url) {
    return res.status(400).json({ error: 'source_url required' })
  }

  try {
    // Fetch the listing page
    const response = await fetch(source_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RCA/1.0)'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const html = await response.text()

    let description = ''
    let requirements = ''
    let attachments = []

    if (source === 'grants_gov' || source_url.includes('grants.gov')) {
      // Parse grants.gov page
      // Look for description section
      const descMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      if (descMatch) {
        description = cleanHtml(descMatch[1])
      }

      // Look for eligibility/requirements
      const eligMatch = html.match(/eligibility[^<]*<[^>]*>([\s\S]*?)<\/(?:div|section)>/i)
      if (eligMatch) {
        requirements = cleanHtml(eligMatch[1])
      }

      // Find PDF attachments
      const pdfMatches = html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)
      for (const match of pdfMatches) {
        attachments.push(match[1])
      }

    } else if (source === 'sam_gov' || source_url.includes('sam.gov')) {
      // Parse SAM.gov page
      const descMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      if (descMatch) {
        description = cleanHtml(descMatch[1])
      }

      // Find attachments
      const pdfMatches = html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)
      for (const match of pdfMatches) {
        attachments.push(match[1])
      }
    }

    // If we couldn't parse structured content, try to get main text
    if (!description) {
      // Strip scripts and styles, get text content
      const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      // Get first substantial paragraph (over 100 chars)
      const sentences = textContent.split(/[.!?]+/)
      let extracted = ''
      for (const s of sentences) {
        if (s.trim().length > 50) {
          extracted += s.trim() + '. '
          if (extracted.length > 500) break
        }
      }
      description = extracted.trim()
    }

    return res.status(200).json({
      success: true,
      description: description.substring(0, 2000), // Limit length
      requirements: requirements.substring(0, 1000),
      attachments: attachments.slice(0, 10), // First 10 PDFs
      source_url
    })

  } catch (error) {
    console.error('Fetch listing error:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch listing',
      message: error.message 
    })
  }
}

// Clean HTML tags and entities
function cleanHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
