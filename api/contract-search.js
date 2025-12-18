// /api/contract-search.js
// RCA Contract & Grant Search Engine
// Searches the ENTIRE INTERNET for opportunities
// Based on user's GEOGRAPHIC PREFERENCE and ADDRESS

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { 
    searchQuery,           // What user typed (RFP name, number, keyword)
    searchType,            // 'specific' (looking for one) or 'shopping' (find matches)
    userLocation,          // { address, city, county, state, zip } from their profile
    geographicPreference,  // 'federal' | 'state' | 'county' | 'local' | 'nationwide'
    naicsCodes,            // Their NAICS codes for matching
    certifications,        // Their certs for set-aside matching
    keywords               // Industry keywords from their services
  } = req.body

  try {
    // Build search queries based on geographic preference AND location
    const searchQueries = buildSearchQueries({
      searchQuery,
      searchType,
      userLocation,
      geographicPreference: geographicPreference || 'local', // Default to local
      naicsCodes,
      certifications,
      keywords
    })

    // Execute searches across the internet
    const results = await executeSearches(searchQueries)

    // Parse and structure the results
    const opportunities = await parseOpportunities(results)

    // Score against user's profile
    const scoredOpportunities = scoreOpportunities(opportunities, {
      naicsCodes,
      certifications,
      userLocation
    })

    return res.status(200).json({
      success: true,
      count: scoredOpportunities.length,
      opportunities: scoredOpportunities,
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

// ==========================================
// STATE PORTAL DATABASE
// Every state's procurement portals
// ==========================================
const STATE_PORTALS = {
  'Alabama': { code: 'AL', portals: ['https://purchasing.alabama.gov'] },
  'Alaska': { code: 'AK', portals: ['https://state.prior.us/ak'] },
  'Arizona': { code: 'AZ', portals: ['https://spo.az.gov'] },
  'Arkansas': { code: 'AR', portals: ['https://www.dfa.arkansas.gov/office-of-state-procurement'] },
  'California': { code: 'CA', portals: ['https://caleprocure.ca.gov', 'https://www.calosba.ca.gov'] },
  'Colorado': { code: 'CO', portals: ['https://www.bidscolorado.com'] },
  'Connecticut': { code: 'CT', portals: ['https://portal.ct.gov/DAS/Procurement'] },
  'Delaware': { code: 'DE', portals: ['https://myfss.delaware.gov'] },
  'Florida': { code: 'FL', portals: ['https://myflorida.com/apps/vbs/vbs_www.main_menu'] },
  'Georgia': { code: 'GA', portals: ['https://doas.ga.gov/state-purchasing'] },
  'Hawaii': { code: 'HI', portals: ['https://hands.ehawaii.gov'] },
  'Idaho': { code: 'ID', portals: ['https://purchasing.idaho.gov'] },
  'Illinois': { code: 'IL', portals: ['https://www.bidbuy.illinois.gov'] },
  'Indiana': { code: 'IN', portals: ['https://www.in.gov/idoa/procurement'] },
  'Iowa': { code: 'IA', portals: ['https://das.iowa.gov/procurement'] },
  'Kansas': { code: 'KS', portals: ['https://admin.ks.gov/offices/procurement-and-contracts'] },
  'Kentucky': { code: 'KY', portals: ['https://finance.ky.gov/procurement'] },
  'Louisiana': { code: 'LA', portals: ['https://wwwprd.doa.louisiana.gov/osp'] },
  'Maine': { code: 'ME', portals: ['https://www.maine.gov/purchases'] },
  'Maryland': { code: 'MD', portals: ['https://eMaryland.buyspeed.com'] },
  'Massachusetts': { code: 'MA', portals: ['https://www.mass.gov/orgs/operational-services-division'] },
  'Michigan': { code: 'MI', portals: ['https://www.michigan.gov/dtmb/procurement'] },
  'Minnesota': { code: 'MN', portals: ['https://mn.gov/admin/procurement'] },
  'Mississippi': { code: 'MS', portals: ['https://www.dfa.ms.gov/procurement-contracts'] },
  'Missouri': { code: 'MO', portals: ['https://oa.mo.gov/purchasing'] },
  'Montana': { code: 'MT', portals: ['https://svc.mt.gov/gsd/onestop'] },
  'Nebraska': { code: 'NE', portals: ['https://das.nebraska.gov/materiel/purchasing'] },
  'Nevada': { code: 'NV', portals: ['https://purchasing.nv.gov'] },
  'New Hampshire': { code: 'NH', portals: ['https://das.nh.gov/purchasing'] },
  'New Jersey': { code: 'NJ', portals: ['https://www.njstart.gov'] },
  'New Mexico': { code: 'NM', portals: ['https://www.generalservices.state.nm.us/statepurchasing'] },
  'New York': { code: 'NY', portals: ['https://ogs.ny.gov/procurement'] },
  'North Carolina': { code: 'NC', portals: ['https://eprocurement.nc.gov'] },
  'North Dakota': { code: 'ND', portals: ['https://www.nd.gov/omb/agency/procurement'] },
  'Ohio': { code: 'OH', portals: ['https://procure.ohio.gov'] },
  'Oklahoma': { code: 'OK', portals: ['https://oklahoma.gov/omes/services/purchasing.html'] },
  'Oregon': { code: 'OR', portals: ['https://orpin.oregon.gov'] },
  'Pennsylvania': { code: 'PA', portals: ['https://www.emarketplace.state.pa.us'] },
  'Rhode Island': { code: 'RI', portals: ['https://purchasing.ri.gov'] },
  'South Carolina': { code: 'SC', portals: ['https://procurement.sc.gov'] },
  'South Dakota': { code: 'SD', portals: ['https://boa.sd.gov/central-services/procurement'] },
  'Tennessee': { code: 'TN', portals: ['https://www.tn.gov/generalservices/procurement.html'] },
  'Texas': { code: 'TX', portals: ['https://comptroller.texas.gov/purchasing', 'https://www.txsmartbuy.com'] },
  'Utah': { code: 'UT', portals: ['https://purchasing.utah.gov'] },
  'Vermont': { code: 'VT', portals: ['https://bgs.vermont.gov/purchasing-contracting'] },
  'Virginia': { code: 'VA', portals: ['https://eva.virginia.gov'] },
  'Washington': { code: 'WA', portals: ['https://des.wa.gov/services/contracting-purchasing'] },
  'West Virginia': { code: 'WV', portals: ['https://purchasing.wv.gov'] },
  'Wisconsin': { code: 'WI', portals: ['https://vendornet.wi.gov'] },
  'Wyoming': { code: 'WY', portals: ['https://ai.wyo.gov/procurement'] },
  'District of Columbia': { code: 'DC', portals: ['https://ocp.dc.gov'] }
}

// ==========================================
// MAJOR COUNTY PORTALS (expandable)
// ==========================================
const MAJOR_COUNTIES = {
  'CA': {
    'Los Angeles': ['https://camisvr.co.la.ca.us/LACoBids', 'https://rfrq.rampla.org', 'https://dmh.lacounty.gov', 'https://dcfs.lacounty.gov', 'https://publichealth.lacounty.gov'],
    'San Diego': ['https://www.sandiegocounty.gov/content/sdc/purchasing.html'],
    'Orange': ['https://www.ocgov.com/gov/ceo/purchasing'],
    'San Francisco': ['https://sfgov.org/oca/purchasing'],
    'Alameda': ['https://www.acgov.org/gsa/purchasing']
  },
  'TX': {
    'Harris': ['https://purchasing.harriscountytx.gov'],
    'Dallas': ['https://www.dallascounty.org/departments/purchasing'],
    'Bexar': ['https://www.bexar.org/1609/Purchasing'],
    'Travis': ['https://www.traviscountytx.gov/purchasing']
  },
  'FL': {
    'Miami-Dade': ['https://www.miamidade.gov/global/business/procurement.page'],
    'Broward': ['https://www.broward.org/Purchasing'],
    'Palm Beach': ['https://discover.pbcgov.org/Purchasing']
  },
  'NY': {
    'New York': ['https://www.nyc.gov/site/mocs/index.page'],
    'Kings': ['https://www.nyc.gov/site/mocs/index.page'],
    'Queens': ['https://www.nyc.gov/site/mocs/index.page']
  },
  'IL': {
    'Cook': ['https://www.cookcountyil.gov/service/procurement-services']
  },
  'PA': {
    'Philadelphia': ['https://www.phila.gov/departments/procurement-department']
  },
  'AZ': {
    'Maricopa': ['https://www.maricopa.gov/1762/Procurement-Services']
  },
  'WA': {
    'King': ['https://kingcounty.gov/depts/finance-business-operations/procurement.aspx']
  },
  'MA': {
    'Suffolk': ['https://www.boston.gov/departments/purchasing']
  },
  'GA': {
    'Fulton': ['https://www.fultoncountyga.gov/services/purchasing']
  }
  // Add more as needed...
}

// ==========================================
// MAJOR CITY PORTALS
// ==========================================
const MAJOR_CITIES = {
  'CA': {
    'Los Angeles': ['https://labavn.org', 'https://www.lacity.org/doing-business'],
    'San Diego': ['https://www.sandiego.gov/purchasing'],
    'San Francisco': ['https://sfgov.org/oca'],
    'San Jose': ['https://www.sanjoseca.gov/your-government/departments-offices/finance/purchasing']
  },
  'TX': {
    'Houston': ['https://www.houstontx.gov/obo'],
    'Dallas': ['https://dallascityhall.com/departments/procurement'],
    'San Antonio': ['https://www.sanantonio.gov/Purchasing'],
    'Austin': ['https://www.austintexas.gov/department/purchasing']
  },
  'FL': {
    'Miami': ['https://www.miamigov.com/Government/Departments-Organizations/Procurement'],
    'Jacksonville': ['https://www.coj.net/departments/finance/procurement']
  },
  'NY': {
    'New York': ['https://www.nyc.gov/site/mocs/index.page']
  },
  'IL': {
    'Chicago': ['https://www.chicago.gov/city/en/depts/dps.html']
  }
  // Add more as needed...
}

// ==========================================
// BUILD SEARCH QUERIES BASED ON GEOGRAPHIC PREFERENCE
// ==========================================
function buildSearchQueries({ searchQuery, searchType, userLocation, geographicPreference, naicsCodes, certifications, keywords }) {
  const queries = []
  const { city, county, state, zip } = userLocation || {}
  
  // Get state code
  const stateInfo = Object.entries(STATE_PORTALS).find(([name, info]) => 
    name === state || info.code === state
  )
  const stateCode = stateInfo?.[1]?.code || state
  const stateName = stateInfo?.[0] || state

  // NAICS string for searching
  const naicsString = naicsCodes?.slice(0, 3).map(n => n.code || n).join(' OR ') || ''
  const keywordString = keywords?.slice(0, 5).join(' OR ') || ''
  
  if (searchType === 'specific') {
    // ==========================================
    // USER IS LOOKING FOR A SPECIFIC CONTRACT
    // Search everywhere for this exact opportunity
    // ==========================================
    
    // General searches
    queries.push(
      `"${searchQuery}" RFP solicitation contract`,
      `"${searchQuery}" grant application funding`,
      `"${searchQuery}" request for proposal`,
      `"${searchQuery}" notice of funding opportunity NOFO`
    )

    // Federal
    queries.push(
      `site:sam.gov "${searchQuery}"`,
      `site:grants.gov "${searchQuery}"`
    )

    // State-specific
    if (stateName && STATE_PORTALS[stateName]) {
      queries.push(`${stateName} "${searchQuery}" RFP contract grant`)
    }

    // County-specific
    if (county) {
      queries.push(`${county} County "${searchQuery}" RFP`)
    }

    // City-specific
    if (city) {
      queries.push(`City of ${city} "${searchQuery}" RFP contract`)
    }

  } else if (searchType === 'shopping') {
    // ==========================================
    // USER WANTS TO FIND MATCHING OPPORTUNITIES
    // Based on their geographic preference
    // ==========================================

    // ALWAYS include Federal (unless they specifically excluded it)
    if (geographicPreference !== 'local-only') {
      queries.push(
        `site:sam.gov contract opportunity ${naicsString}`,
        `site:sam.gov RFP ${keywordString}`,
        `site:grants.gov grant ${naicsString}`,
        `site:grants.gov funding opportunity ${keywordString}`
      )
    }

    // STATE level - if preference includes state or lower
    if (['state', 'county', 'local', 'nationwide'].includes(geographicPreference)) {
      if (geographicPreference === 'nationwide') {
        // Search ALL states
        queries.push(
          `state RFP contract ${naicsString}`,
          `state government solicitation ${keywordString}`
        )
      } else if (stateName) {
        // Search user's state
        queries.push(
          `${stateName} state RFP contract ${naicsString}`,
          `${stateName} government solicitation ${keywordString}`,
          `site:${stateCode?.toLowerCase()}.gov RFP contract`
        )
      }
    }

    // COUNTY level - if preference includes county or lower
    if (['county', 'local'].includes(geographicPreference) && county) {
      queries.push(
        `${county} County RFP contract ${naicsString}`,
        `${county} County solicitation ${keywordString}`,
        `${county} County government bid opportunity`
      )
      
      // Check for known county portals
      if (MAJOR_COUNTIES[stateCode]?.[county]) {
        queries.push(`${county} County procurement ${keywordString}`)
      }
    }

    // CITY/LOCAL level - if preference is local
    if (geographicPreference === 'local' && city) {
      queries.push(
        `City of ${city} RFP contract ${naicsString}`,
        `${city} ${stateName} solicitation ${keywordString}`,
        `${city} government bid opportunity`
      )
      
      // Check for known city portals
      if (MAJOR_CITIES[stateCode]?.[city]) {
        queries.push(`${city} procurement contract opportunity`)
      }
    }

    // NATIONWIDE - search everything
    if (geographicPreference === 'nationwide') {
      queries.push(
        `government RFP ${naicsString}`,
        `government contract opportunity ${keywordString}`,
        `municipal RFP ${naicsString}`,
        `county government contract ${keywordString}`
      )
    }

    // Add certification-based searches
    if (certifications?.length > 0) {
      const certNames = certifications.map(c => c.name || c.id || c).join(' ')
      queries.push(
        `${certNames} set-aside contract opportunity`,
        `small business set-aside ${naicsString}`
      )
    }
  }

  return queries
}

// ==========================================
// EXECUTE SEARCHES USING REAL WEB SEARCH
// ==========================================
async function executeSearches(queries) {
  const results = []

  // Use Claude API with web_search tool to search the internet
  for (const query of queries.slice(0, 5)) { // Limit to 5 queries to avoid timeouts
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
          max_tokens: 4096,
          tools: [{
            type: 'web_search_20250305',
            name: 'web_search'
          }],
          messages: [{
            role: 'user',
            content: `Search for: "${query}"

Find government contracts, RFPs, grants, and solicitations that are CURRENTLY OPEN (not expired).

After searching, respond with ONLY a JSON array containing the opportunities found. No other text.

Each opportunity should have:
{
  "title": "exact name of opportunity",
  "agency": "issuing organization", 
  "dueDate": "YYYY-MM-DD or null",
  "estimatedValue": "dollar amount or Not specified",
  "description": "brief summary",
  "sourceUrl": "URL",
  "rfpNumber": "solicitation number or null",
  "level": "federal/state/county/city",
  "source": "where found (SAM.gov, Grants.gov, state portal, etc)"
}

If no opportunities found, respond with: []

RESPOND WITH ONLY THE JSON ARRAY, NO OTHER TEXT.`
          }]
        })
      })

      const data = await response.json()
      
      // Log full response for debugging
      console.log('API Response for query:', query)
      console.log('Full response:', JSON.stringify(data).substring(0, 500))
      
      // Check for API errors
      if (data.error) {
        console.error('API Error:', data.error.type, data.error.message)
        continue
      }
      
      // Check if response has content
      if (!data.content) {
        console.log('No content in response')
        continue
      }
      
      console.log('Response content types:', data.content.map(c => c.type))
      
      // Extract text content from response - handle multiple content blocks
      let textContent = ''
      for (const block of data.content) {
        if (block.type === 'text') {
          textContent += block.text + '\n'
        }
        // Also check for tool_result blocks (web search returns these)
        if (block.type === 'tool_result') {
          textContent += (block.content || '') + '\n'
        }
      }
      
      console.log('Text content length:', textContent.length)
      console.log('Raw text:', textContent.substring(0, 300))
      
      // Try to extract JSON from the response
      try {
        // Remove markdown code blocks
        let cleanJson = textContent
          .replace(/```json\n?/gi, '')
          .replace(/```\n?/gi, '')
          .trim()
        
        // Try to find JSON array in the response
        const jsonMatch = cleanJson.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          cleanJson = jsonMatch[0]
        }
        
        const parsed = JSON.parse(cleanJson)
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('Parsed', parsed.length, 'opportunities from query:', query)
          results.push(...parsed)
        } else {
          console.log('Empty or non-array result for query:', query)
        }
      } catch (parseErr) {
        console.log('Could not parse JSON for query:', query)
        console.log('Raw text:', textContent.substring(0, 500))
        
        // Try to extract opportunities from natural language response
        const opportunities = extractOpportunitiesFromText(textContent, query)
        if (opportunities.length > 0) {
          console.log('Extracted', opportunities.length, 'opportunities from text')
          results.push(...opportunities)
        }
      }

    } catch (err) {
      console.error('Search failed for query:', query, err.message)
    }
  }

  return results
}

// Extract opportunities from natural language if JSON parsing fails
function extractOpportunitiesFromText(text, query) {
  const opportunities = []
  
  // Look for patterns like URLs, dates, dollar amounts
  const urlPattern = /https?:\/\/[^\s]+/g
  const datePattern = /\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi
  const dollarPattern = /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|M|k|K))?/g
  
  const urls = text.match(urlPattern) || []
  const dates = text.match(datePattern) || []
  const dollars = text.match(dollarPattern) || []
  
  // If we found relevant information, create a single opportunity
  if (urls.length > 0 || text.toLowerCase().includes('rfp') || text.toLowerCase().includes('grant')) {
    opportunities.push({
      title: query.split(' ').slice(0, 5).join(' ') + ' - Search Result',
      agency: 'Found via web search',
      dueDate: dates[0] || null,
      estimatedValue: dollars[0] || 'Not specified',
      description: text.substring(0, 300).replace(/\n/g, ' '),
      sourceUrl: urls[0] || '',
      rfpNumber: null,
      level: 'unknown',
      source: 'Web Search'
    })
  }
  
  return opportunities
}

// ==========================================
// PARSE AND DEDUPLICATE OPPORTUNITIES
// ==========================================
async function parseOpportunities(results) {
  const seen = new Set()
  const unique = []

  for (const opp of results) {
    const key = `${opp.title?.toLowerCase()?.substring(0, 50)}-${opp.agency?.toLowerCase()}`
    if (!seen.has(key) && opp.title) {
      seen.add(key)
      
      // Filter out expired opportunities
      if (opp.dueDate) {
        const dueDate = new Date(opp.dueDate)
        if (dueDate < new Date()) {
          continue // Skip expired
        }
      }
      
      unique.push({
        id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: opp.title,
        agency: opp.agency || 'Unknown Agency',
        dueDate: opp.dueDate || null,
        estimatedValue: opp.estimatedValue || 'Not specified',
        description: opp.description || '',
        sourceUrl: opp.sourceUrl || '',
        rfpNumber: opp.rfpNumber || '',
        level: opp.level || 'unknown',
        source: opp.source || 'Web Search',
        foundAt: new Date().toISOString()
      })
    }
  }

  return unique
}

// ==========================================
// SCORE OPPORTUNITIES AGAINST USER PROFILE
// ==========================================
function scoreOpportunities(opportunities, { naicsCodes, certifications, userLocation }) {
  return opportunities.map(opp => {
    let score = 50 // Base score

    const oppText = `${opp.title} ${opp.description} ${opp.agency}`.toLowerCase()
    
    // NAICS match
    if (naicsCodes?.length > 0) {
      for (const code of naicsCodes) {
        const codeStr = (code.code || code).toString()
        if (oppText.includes(codeStr)) {
          score += 20
          break
        }
      }
    }

    // Certification match
    const certKeywords = {
      'MBE': ['minority', 'mbe', 'minority-owned'],
      'WBE': ['women', 'wbe', 'woman-owned', 'wosb'],
      'SBE': ['small business', 'sbe'],
      'DBE': ['disadvantaged', 'dbe'],
      'DVBE': ['veteran', 'dvbe', 'vosb', 'sdvosb'],
      '8(a)': ['8(a)', '8a'],
      'HUBZone': ['hubzone']
    }

    if (certifications?.length > 0) {
      for (const cert of certifications) {
        const certName = cert.name || cert.id || cert
        const keywords = certKeywords[certName] || [certName.toLowerCase()]
        for (const kw of keywords) {
          if (oppText.includes(kw)) {
            score += 15
            break
          }
        }
      }
    }

    // Location proximity bonus
    if (userLocation) {
      if (opp.level === 'city' && oppText.includes(userLocation.city?.toLowerCase())) {
        score += 15
      } else if (opp.level === 'county' && oppText.includes(userLocation.county?.toLowerCase())) {
        score += 10
      } else if (opp.level === 'state') {
        score += 5
      }
    }

    // Has due date = more actionable
    if (opp.dueDate) score += 5
    
    // Has value = helps decision
    if (opp.estimatedValue && opp.estimatedValue !== 'Not specified') score += 5

    return {
      ...opp,
      matchScore: Math.min(score, 100),
      matchLevel: score >= 80 ? 'Strong Match' : score >= 60 ? 'Good Match' : 'Potential Match'
    }
  }).sort((a, b) => b.matchScore - a.matchScore)
}

// ==========================================
// GET SEARCHED AREAS (for UI display)
// ==========================================
function getSearchedAreas(geographicPreference, userLocation) {
  const areas = ['Federal (SAM.gov, Grants.gov)']
  
  if (['state', 'county', 'local', 'nationwide'].includes(geographicPreference)) {
    if (geographicPreference === 'nationwide') {
      areas.push('All 50 States')
    } else if (userLocation?.state) {
      areas.push(`${userLocation.state} State`)
    }
  }
  
  if (['county', 'local'].includes(geographicPreference) && userLocation?.county) {
    areas.push(`${userLocation.county} County`)
  }
  
  if (geographicPreference === 'local' && userLocation?.city) {
    areas.push(`City of ${userLocation.city}`)
  }
  
  return areas
}
