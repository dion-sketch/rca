// /api/import-opportunities.js
// Imports CSV data from government portals into the opportunities database
// Supports: LA County, SAM.gov, Grants.gov, California, Cities

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for admin operations
)

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb' // Allow larger CSV files
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { source, csvData } = req.body

  if (!source || !csvData) {
    return res.status(400).json({ error: 'Missing source or csvData' })
  }

  try {
    // Parse CSV
    const rows = parseCSV(csvData)
    
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data found in CSV' })
    }

    console.log(`Importing ${rows.length} opportunities from ${source}`)

    // Map rows based on source format
    const opportunities = rows.map(row => mapRowToOpportunity(row, source)).filter(Boolean)

    // Upsert into database (update if exists, insert if new)
    const { data, error } = await supabase
      .from('opportunities')
      .upsert(opportunities, { 
        onConflict: 'source,source_id',
        ignoreDuplicates: false 
      })
      .select()

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({ error: 'Failed to import opportunities', details: error.message })
    }

    // Mark old opportunities as inactive if not in new import
    const sourceIds = opportunities.map(o => o.source_id)
    await supabase
      .from('opportunities')
      .update({ is_active: false })
      .eq('source', source)
      .not('source_id', 'in', `(${sourceIds.map(id => `'${id}'`).join(',')})`)

    return res.status(200).json({
      success: true,
      imported: opportunities.length,
      source: source,
      message: `Successfully imported ${opportunities.length} opportunities from ${source}`
    })

  } catch (error) {
    console.error('Import error:', error)
    return res.status(500).json({ error: 'Import failed', message: error.message })
  }
}

// Parse CSV string into array of objects
function parseCSV(csvString) {
  const lines = csvString.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  // Parse header row
  const headers = parseCSVLine(lines[0])
  
  // Parse data rows
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === headers.length) {
      const row = {}
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || ''
      })
      rows.push(row)
    }
  }
  
  return rows
}

// Handle CSV line parsing with quoted fields
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  
  return result.map(val => val.replace(/^"|"$/g, '').trim())
}

// Map row data to opportunity object based on source format
function mapRowToOpportunity(row, source) {
  switch (source) {
    case 'la_county':
      return mapLACounty(row)
    case 'sam_gov':
      return mapSAMGov(row)
    case 'grants_gov':
      return mapGrantsGov(row)
    case 'california':
      return mapCalifornia(row)
    default:
      return mapGeneric(row, source)
  }
}

// LA County CSV Format
function mapLACounty(row) {
  // Skip if no title
  if (!row['Bid Title']) return null

  // Parse closing date - handle "Continuous" and date formats
  let closeDate = null
  let isContinuous = false
  const closingDateStr = row['Closing Date'] || ''
  
  if (closingDateStr.toLowerCase() === 'continuous') {
    isContinuous = true
  } else if (closingDateStr) {
    closeDate = parseDate(closingDateStr)
  }

  return {
    source: 'la_county',
    source_id: row['Bid Number'] || null,
    source_url: row['Bid URL'] || null,
    title: row['Bid Title'],
    description: row['Bid Description'] || null,
    agency: row['Department'] || 'LA County',
    bid_type: row['Bid Type'] || null,
    open_date: parseDate(row['Open Date']),
    close_date: closeDate,
    is_continuous: isContinuous,
    commodity_code: row['Commodity Code']?.replace(/[="]/g, '') || null,
    commodity_description: row['Commodity Description'] || null,
    contact_name: row['Contact Name'] || null,
    contact_phone: row['Contact Phone'] || null,
    contact_email: row['Contact Email'] || null,
    state: 'CA',
    county: 'Los Angeles',
    is_active: true
  }
}

// SAM.gov CSV Format (Federal Contracts)
function mapSAMGov(row) {
  if (!row['Title'] && !row['Opportunity Title']) return null

  return {
    source: 'sam_gov',
    source_id: row['Solicitation Number'] || row['Notice ID'] || null,
    source_url: row['URL'] || row['Link'] || null,
    title: row['Title'] || row['Opportunity Title'],
    description: row['Description'] || null,
    agency: row['Department/Agency'] || row['Agency'] || 'Federal',
    bid_type: row['Type'] || row['Notice Type'] || 'Federal Contract',
    open_date: parseDate(row['Posted Date'] || row['Original Published Date']),
    close_date: parseDate(row['Response Deadline'] || row['Response Date']),
    is_continuous: false,
    naics_codes: row['NAICS Code'] ? [row['NAICS Code']] : null,
    set_asides: row['Set-Aside'] ? [row['Set-Aside']] : null,
    estimated_value: row['Award Amount'] || row['Estimated Value'] || null,
    contact_name: row['Primary Contact'] || row['Contact Name'] || null,
    contact_email: row['Contact Email'] || row['Primary Email'] || null,
    state: row['State'] || null,
    is_active: true
  }
}

// Grants.gov CSV Format (Federal Grants)
function mapGrantsGov(row) {
  if (!row['Opportunity Title'] && !row['Title']) return null

  return {
    source: 'grants_gov',
    source_id: row['Opportunity Number'] || row['Funding Opportunity Number'] || null,
    source_url: row['URL'] || `https://www.grants.gov/search-results-detail/${row['Opportunity Number']}` || null,
    title: row['Opportunity Title'] || row['Title'],
    description: row['Description'] || row['Synopsis'] || null,
    agency: row['Agency Name'] || row['Agency'] || 'Federal',
    bid_type: 'Grant',
    open_date: parseDate(row['Posted Date'] || row['Open Date']),
    close_date: parseDate(row['Close Date'] || row['Deadline']),
    is_continuous: false,
    estimated_value: row['Award Ceiling'] || row['Estimated Total Program Funding'] || null,
    contact_name: row['Contact Name'] || null,
    contact_email: row['Contact Email'] || null,
    state: null, // Federal grants are nationwide
    is_active: true
  }
}

// California State (CaleProcure) Format
function mapCalifornia(row) {
  if (!row['Title'] && !row['Bid Title'] && !row['Solicitation Title']) return null

  return {
    source: 'california',
    source_id: row['Solicitation Number'] || row['Bid Number'] || row['ID'] || null,
    source_url: row['URL'] || row['Link'] || null,
    title: row['Title'] || row['Bid Title'] || row['Solicitation Title'],
    description: row['Description'] || null,
    agency: row['Agency'] || row['Department'] || 'California State',
    bid_type: row['Type'] || row['Bid Type'] || 'State Contract',
    open_date: parseDate(row['Posted Date'] || row['Open Date']),
    close_date: parseDate(row['Close Date'] || row['Deadline'] || row['Due Date']),
    is_continuous: false,
    contact_name: row['Contact'] || row['Contact Name'] || null,
    contact_email: row['Email'] || row['Contact Email'] || null,
    state: 'CA',
    is_active: true
  }
}

// Generic mapper for unknown formats
function mapGeneric(row, source) {
  // Try to find title in common field names
  const title = row['Title'] || row['Bid Title'] || row['Opportunity Title'] || 
                row['Solicitation Title'] || row['Name'] || Object.values(row)[0]
  
  if (!title) return null

  return {
    source: source,
    source_id: row['ID'] || row['Number'] || row['Bid Number'] || row['Solicitation Number'] || null,
    source_url: row['URL'] || row['Link'] || row['Bid URL'] || null,
    title: title,
    description: row['Description'] || row['Summary'] || null,
    agency: row['Agency'] || row['Department'] || row['Organization'] || source,
    bid_type: row['Type'] || row['Category'] || null,
    open_date: parseDate(row['Posted Date'] || row['Open Date'] || row['Start Date']),
    close_date: parseDate(row['Close Date'] || row['Deadline'] || row['Due Date'] || row['End Date']),
    is_continuous: false,
    contact_name: row['Contact'] || row['Contact Name'] || null,
    contact_email: row['Email'] || row['Contact Email'] || null,
    is_active: true
  }
}

// Parse various date formats
function parseDate(dateStr) {
  if (!dateStr || dateStr.toLowerCase() === 'continuous' || dateStr === 'N/A') {
    return null
  }

  // Remove any leading/trailing whitespace and quotes
  dateStr = dateStr.replace(/['"]/g, '').trim()

  // Try various date formats
  const formats = [
    // MM/DD/YYYY HH:MM AM/PM
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i,
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // Month DD, YYYY
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/
  ]

  // Try MM/DD/YYYY format first (most common in government data)
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/)
  if (mdyMatch) {
    const [_, month, day, year, time] = mdyMatch
    let hours = 12, minutes = 0
    
    if (time) {
      const timeMatch = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
      if (timeMatch) {
        hours = parseInt(timeMatch[1])
        minutes = parseInt(timeMatch[2])
        if (timeMatch[3]?.toUpperCase() === 'PM' && hours < 12) hours += 12
        if (timeMatch[3]?.toUpperCase() === 'AM' && hours === 12) hours = 0
      }
    }
    
    const date = new Date(year, month - 1, day, hours, minutes)
    return date.toISOString()
  }

  // Try ISO format
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return new Date(dateStr).toISOString()
  }

  // Fallback to native parsing
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString()
  }

  return null
}
