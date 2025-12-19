// /api/search-opportunities.js
// Smart search: Database first (instant), then Claude web search (fallback)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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
    certifications,
    sources // Optional: ['la_county', 'sam_gov', 'california', 'all']
  } = req.body

  try {
    console.log('Search request:', searchQuery, 'Preference:', geographicPreference)
    
    // STEP 1: Search database first (INSTANT)
    const dbResults = await searchDatabase(searchQuery, geographicPreference, sources)
    
    console.log('Database results:', dbResults.length)
    
    // If we found results in database, return them immediately
    if (dbResults.length > 0) {
      const scored = scoreResults(dbResults, naicsCodes, certifications)
      
      return res.status(200).json({
        success: true,
        count: scored.length,
        opportunities: scored,
        searchMethod: 'database',
        searchedAreas: getSearchedAreas(geographicPreference, userLocation),
        message: 'Found in database (instant)'
      })
    }
    
    // STEP 2: Fall back to Claude web search if database has no results
    console.log('No database results, falling back to web search...')
    
    const webResults = await searchWeb(searchQuery, userLocation, geographicPreference)
    
    if (webResults.length > 0) {
      const scored = scoreResults(webResults, naicsCodes, certifications)
      
      return res.status(200).json({
        success: true,
        count: scored.length,
        opportunities: scored,
        searchMethod: 'web',
        searchedAreas: getSearchedAreas(geographicPreference, userLocation),
        message: 'Found via web search'
      })
    }
    
    // No results anywhere
    return res.status(200).json({
      success: true,
      count: 0,
      opportunities: [],
      searchMethod: 'both',
      searchedAreas: getSearchedAreas(geographicPreference, userLocation),
      message: 'No opportunities found'
    })

  } catch (error) {
    console.error('Search error:', error)
    return res.status(500).json({ 
      error: 'Search failed', 
      message: error.message 
    })
  }
}

// Search the opportunities database
async function searchDatabase(query, geographicPreference, sources) {
  if (!query) return []
  
  // Build the search query
  let dbQuery = supabase
    .from('opportunities')
    .select('*')
    .eq('is_active', true)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,agency.ilike.%${query}%,commodity_description.ilike.%${query}%`)
    .order('close_date', { ascending: true, nullsFirst: false })
    .limit(20)

  // Filter by geographic preference
  if (geographicPreference === 'federal') {
    dbQuery = dbQuery.in('source', ['sam_gov', 'grants_gov'])
  } else if (geographicPreference === 'state') {
    dbQuery = dbQuery.eq('source', 'california')
  } else if (geographicPreference === 'county') {
    dbQuery = dbQuery.eq('source', 'la_county')
  } else if (geographicPreference === 'local') {
    dbQuery = dbQuery.in('source', ['la_county', 'city_la'])
  }
  
  // Filter by specific sources if provided
  if (sources && sources.length > 0 && !sources.includes('all')) {
    dbQuery = dbQuery.in('source', sources)
  }

  const { data, error } = await dbQuery

  if (error) {
    console.error('Database search error:', error)
    return []
  }

  // Map to standard opportunity format
  return (data || []).map(row => ({
    id: row.id,
    title: row.title,
    agency: row.agency,
    dueDate: row.close_date ? formatDate(row.close_date) : (row.is_continuous ? 'Continuous' : null),
    estimatedValue: row.estimated_value || 'Not specified',
    description: row.description?.substring(0, 300) || '',
    sourceUrl: row.source_url,
    rfpNumber: row.source_id,
    source: formatSourceName(row.source),
    level: getLevel(row.source),
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    commodityCode: row.commodity_code,
    commodityDescription: row.commodity_description,
    fromDatabase: true
  }))
}

// Fall back to Claude web search
async function searchWeb(searchQuery, userLocation, geographicPreference) {
  // Build query with location context
  let query = searchQuery || ''
  
  if (geographicPreference === 'local' || geographicPreference === 'county') {
    const county = userLocation?.county || 'Los Angeles'
    query = `${query} "${county} County" California`
  } else if (geographicPreference === 'state') {
    query = `${query} California state government`
  } else if (geographicPreference === 'federal') {
    query += ' federal government SAM.gov grants.gov'
  }
  
  if (!query.toLowerCase().includes('rfp') && 
      !query.toLowerCase().includes('grant') &&
      !query.toLowerCase().includes('contract')) {
    query += ' RFP OR grant OR solicitation'
  }

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
          content: `Search for current government contracts, RFPs, grants: "${query}"
Find OPEN opportunities. Return JSON array with: title, agency, dueDate, estimatedValue, description, sourceUrl, source.
Return ONLY JSON array. If none found: []`
        }]
      })
    })

    const data = await response.json()
    
    if (data.error) {
      console.error('Claude API error:', data.error)
      return []
    }
    
    const results = []
    
    for (const block of data.content || []) {
      if (block.type === 'web_search_tool_result' && block.content) {
        for (const item of block.content) {
          if (item.type === 'web_search_result') {
            const title = (item.title || '').toLowerCase()
            if (title.includes('rfp') || title.includes('grant') || 
                title.includes('contract') || title.includes('solicitation') ||
                title.includes('bid') || title.includes('funding')) {
              
              results.push({
                id: `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: item.title,
                agency: getAgencyFromUrl(item.url),
                dueDate: null,
                estimatedValue: 'Not specified',
                description: item.page_snippet || '',
                sourceUrl: item.url,
                source: getSourceFromUrl(item.url),
                level: getLevelFromUrl(item.url),
                fromDatabase: false
              })
            }
          }
        }
      }
      
      // Try parsing JSON from text response
      if (block.type === 'text' && block.text) {
        try {
          const jsonMatch = block.text.match(/\[[\s\S]*?\]/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (item.title) {
                  results.push({
                    id: `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    title: item.title,
                    agency: item.agency || 'Unknown',
                    dueDate: item.dueDate || null,
                    estimatedValue: item.estimatedValue || 'Not specified',
                    description: item.description || '',
                    sourceUrl: item.sourceUrl || item.url || '',
                    source: item.source || 'Web Search',
                    level: item.level || 'unknown',
                    fromDatabase: false
                  })
                }
              }
            }
          }
        } catch (e) {
          // Not JSON
        }
      }
    }
    
    return results
    
  } catch (err) {
    console.error('Web search failed:', err)
    return []
  }
}

// Score results against user profile
function scoreResults(results, naicsCodes, certifications) {
  return results.map(opp => {
    let score = 50
    
    const text = `${opp.title} ${opp.description} ${opp.commodityDescription || ''}`.toLowerCase()
    
    // Boost for NAICS matches
    if (naicsCodes?.length > 0) {
      for (const code of naicsCodes) {
        const codeStr = (code.code || code).toString()
        if (text.includes(codeStr) || opp.commodityCode?.includes(codeStr)) {
          score += 20
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
            score += 15
            break
          }
        }
      }
    }
    
    // Boost for database results (more reliable)
    if (opp.fromDatabase) score += 10
    
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

// Helper functions
function formatDate(dateStr) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSourceName(source) {
  const names = {
    'la_county': 'LA County',
    'sam_gov': 'SAM.gov',
    'grants_gov': 'Grants.gov',
    'california': 'California State',
    'city_la': 'City of LA'
  }
  return names[source] || source
}

function getLevel(source) {
  const levels = {
    'la_county': 'county',
    'sam_gov': 'federal',
    'grants_gov': 'federal',
    'california': 'state',
    'city_la': 'city'
  }
  return levels[source] || 'unknown'
}

function getAgencyFromUrl(url) {
  if (!url) return 'Unknown'
  if (url.includes('sam.gov')) return 'Federal (SAM.gov)'
  if (url.includes('grants.gov')) return 'Federal (Grants.gov)'
  if (url.includes('ca.gov')) return 'California State'
  if (url.includes('lacounty')) return 'LA County'
  if (url.includes('lacity')) return 'City of LA'
  return 'Government Agency'
}

function getSourceFromUrl(url) {
  if (!url) return 'Web Search'
  if (url.includes('sam.gov')) return 'SAM.gov'
  if (url.includes('grants.gov')) return 'Grants.gov'
  if (url.includes('ca.gov')) return 'California'
  if (url.includes('lacounty')) return 'LA County'
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'Web Search'
  }
}

function getLevelFromUrl(url) {
  if (!url) return 'unknown'
  if (url.includes('sam.gov') || url.includes('grants.gov')) return 'federal'
  if (url.includes('ca.gov')) return 'state'
  if (url.includes('county')) return 'county'
  if (url.includes('city')) return 'city'
  return 'unknown'
}

function getSearchedAreas(geographicPreference, userLocation) {
  switch (geographicPreference) {
    case 'federal':
      return ['SAM.gov', 'Grants.gov', 'Federal agencies']
    case 'state':
      return ['California state agencies', 'CaleProcure']
    case 'county':
      return [`${userLocation?.county || 'Los Angeles'} County`]
    case 'local':
      return [`${userLocation?.city || 'Local'} city`, 'Municipal agencies']
    default:
      return ['Federal', 'State', 'County', 'Local']
  }
}
