// /api/contract-search.js
// RCA Contract & Grant Search Engine
// Uses Claude web_search to find opportunities

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { 
    searchQuery,
    searchType,
    userLocation,
    geographicPreference,
    naicsCodes,
    certifications
  } = req.body

  try {
    console.log('Search request:', searchQuery, 'Type:', searchType)
    
    // Build the search query
    const query = buildQuery(searchQuery, userLocation, geographicPreference)
    
    // Execute search
    const results = await executeSearch(query)
    
    // Score results
    const scored = scoreResults(results, naicsCodes, certifications)
    
    return res.status(200).json({
      success: true,
      count: scored.length,
      opportunities: scored,
      searchedAreas: getSearchedAreas(geographicPreference, userLocation)
    })

  } catch (error) {
    console.error('Search error:', error)
    return res.status(500).json({ 
      error: 'Search failed', 
      message: error.message 
    })
  }
}

// Build search query based on user input and preferences
function buildQuery(searchQuery, userLocation, geographicPreference) {
  let query = searchQuery || ''
  
  // Add location context
  if (geographicPreference === 'local' || geographicPreference === 'county') {
    const county = userLocation?.county || 'Los Angeles'
    query += ` ${county} County California`
  } else if (geographicPreference === 'state') {
    query += ' California state'
  } else if (geographicPreference === 'federal') {
    query += ' federal government'
  }
  
  // Add contract/grant keywords if not already present
  if (!query.toLowerCase().includes('rfp') && 
      !query.toLowerCase().includes('grant') &&
      !query.toLowerCase().includes('contract')) {
    query += ' RFP grant solicitation'
  }
  
  return query.trim()
}

// Execute search using Claude API with web_search
async function executeSearch(query) {
  const results = []
  
  console.log('Executing search:', query)
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search'
        }],
        messages: [{
          role: 'user',
          content: `Search for current government contracts, RFPs, grants, and solicitations matching: "${query}"

Find opportunities that are CURRENTLY OPEN for bidding/applications.

After searching, provide ONLY a JSON array with the opportunities found. Each should have:
{
  "title": "opportunity name",
  "agency": "issuing organization",
  "dueDate": "deadline if found",
  "estimatedValue": "dollar amount if shown",
  "description": "brief description",
  "sourceUrl": "link to opportunity",
  "source": "where found"
}

Return ONLY the JSON array. If nothing found, return: []`
        }]
      })
    })

    const data = await response.json()
    
    console.log('API response status:', response.status)
    
    if (data.error) {
      console.error('API Error:', data.error.type, data.error.message)
      return results
    }
    
    if (!data.content) {
      console.log('No content in response')
      return results
    }
    
    // Process each content block
    for (const block of data.content) {
      console.log('Processing block type:', block.type)
      
      // Handle web search results
      if (block.type === 'web_search_tool_result' && block.content) {
        console.log('Found web_search_tool_result with', block.content.length, 'items')
        
        for (const item of block.content) {
          if (item.type === 'web_search_result') {
            const title = (item.title || '').toLowerCase()
            
            // Filter for relevant results
            if (title.includes('rfp') || 
                title.includes('grant') || 
                title.includes('contract') ||
                title.includes('solicitation') ||
                title.includes('bid') ||
                title.includes('proposal') ||
                title.includes('funding')) {
              
              results.push({
                id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: item.title,
                agency: getAgency(item.url),
                dueDate: null,
                estimatedValue: 'Not specified',
                description: item.page_snippet || item.snippet || '',
                sourceUrl: item.url,
                source: getSource(item.url),
                level: getLevel(item.url)
              })
            }
          }
        }
      }
      
      // Handle text responses (may contain JSON)
      if (block.type === 'text' && block.text) {
        try {
          const jsonMatch = block.text.match(/\[[\s\S]*?\]/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (item.title) {
                  results.push({
                    id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    title: item.title,
                    agency: item.agency || 'Unknown',
                    dueDate: item.dueDate || null,
                    estimatedValue: item.estimatedValue || 'Not specified',
                    description: item.description || '',
                    sourceUrl: item.sourceUrl || item.url || '',
                    source: item.source || 'Web Search',
                    level: item.level || 'unknown'
                  })
                }
              }
            }
          }
        } catch (e) {
          console.log('Could not parse JSON from text')
        }
      }
    }
    
    console.log('Total results found:', results.length)
    
  } catch (err) {
    console.error('Search failed:', err.message)
  }
  
  return results
}

// Helper functions
function getAgency(url) {
  if (!url) return 'Unknown'
  if (url.includes('sam.gov')) return 'Federal (SAM.gov)'
  if (url.includes('grants.gov')) return 'Federal (Grants.gov)'
  if (url.includes('ca.gov')) return 'California State'
  if (url.includes('lacounty') || url.includes('la.county')) return 'LA County'
  if (url.includes('lacity')) return 'City of Los Angeles'
  return 'Government Agency'
}

function getSource(url) {
  if (!url) return 'Web Search'
  if (url.includes('sam.gov')) return 'SAM.gov'
  if (url.includes('grants.gov')) return 'Grants.gov'
  if (url.includes('ca.gov')) return 'California Portal'
  if (url.includes('lacounty')) return 'LA County'
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'Web Search'
  }
}

function getLevel(url) {
  if (!url) return 'unknown'
  if (url.includes('sam.gov') || url.includes('grants.gov')) return 'federal'
  if (url.includes('ca.gov')) return 'state'
  if (url.includes('county')) return 'county'
  if (url.includes('city')) return 'city'
  return 'unknown'
}

// Score results against user profile
function scoreResults(results, naicsCodes, certifications) {
  return results.map(opp => {
    let score = 50
    
    const text = `${opp.title} ${opp.description}`.toLowerCase()
    
    // Boost for NAICS matches
    if (naicsCodes?.length > 0) {
      for (const code of naicsCodes) {
        const codeStr = (code.code || code).toString()
        if (text.includes(codeStr)) {
          score += 15
          break
        }
      }
    }
    
    // Boost for certification mentions
    if (certifications?.length > 0) {
      const certTerms = {
        'MBE': ['minority', 'mbe'],
        'WBE': ['woman', 'wbe', 'women'],
        'SBE': ['small business', 'sbe'],
        'DBE': ['disadvantaged', 'dbe'],
        'DVBE': ['veteran', 'dvbe', 'disabled veteran']
      }
      
      for (const cert of certifications) {
        const terms = certTerms[cert] || [cert.toLowerCase()]
        for (const term of terms) {
          if (text.includes(term)) {
            score += 10
            break
          }
        }
      }
    }
    
    // Determine match level
    let matchLevel = 'low'
    if (score >= 80) matchLevel = 'high'
    else if (score >= 60) matchLevel = 'medium'
    
    return {
      ...opp,
      matchScore: Math.min(score, 100),
      matchLevel
    }
  }).sort((a, b) => b.matchScore - a.matchScore)
}

// Get description of what areas were searched
function getSearchedAreas(geographicPreference, userLocation) {
  switch (geographicPreference) {
    case 'federal':
      return ['SAM.gov', 'Grants.gov', 'Federal agencies']
    case 'state':
      return ['California state agencies', 'CaleProcure', 'CA Grants Portal']
    case 'county':
      return [`${userLocation?.county || 'Los Angeles'} County`, 'County departments']
    case 'local':
      return [`${userLocation?.city || 'Local'} city`, 'Municipal agencies']
    default:
      return ['Federal', 'State', 'County', 'Local']
  }
}
