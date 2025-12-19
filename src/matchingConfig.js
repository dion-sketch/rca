// ============================================
// matchingConfig.js
// CR-AI MATCHING ALGORITHM CONFIGURATION
// ============================================
// 
// LOCKED RULES - DO NOT MODIFY WITHOUT REVIEW
// These rules ensure accurate opportunity matching
// for 10,000+ Contract Ready users.
//
// Last Updated: December 19, 2024
// ============================================

// ============================================
// SKIP WORDS - Never match on these
// These words are too common and cause false matches
// ============================================
export const SKIP_WORDS = [
  'services',
  'service', 
  'management',
  'support',
  'professional',
  'general',
  'other',
  'consulting',
  'solutions',
  'development',
  'training',
  'program',
  'project',
  'assistant',
  'associate',
  'specialist',
  'coordinator',
  'operations',
  'administrative',
  'technical',
  'maintenance',
  'inspection',
  'assessment',
  'evaluation',
  'review',
  'analysis',
  'planning',
  'implementation'
]

// ============================================
// NAICS KEYWORD MAPPING
// Maps NAICS code prefixes to SPECIFIC keywords
// Only match on terms that truly indicate industry fit
// ============================================
export const NAICS_KEYWORDS = {
  // Professional Services
  '5411': ['legal', 'attorney', 'law firm', 'paralegal'],
  '5412': ['accounting', 'bookkeeping', 'audit', 'tax preparation', 'CPA'],
  '5413': ['architect', 'engineering', 'surveying', 'drafting'],
  '5414': ['graphic design', 'interior design', 'industrial design'],
  '5415': ['software', 'programming', 'IT support', 'cybersecurity', 'web development', 'app development'],
  '5416': ['strategic planning', 'business consulting'],
  '5417': ['research', 'laboratory', 'scientific', 'R&D'],
  '5418': ['advertising', 'public relations', 'media buying', 'marketing campaign', 'PR firm', 'ad agency'],
  '5419': ['veterinary', 'photography', 'translation'],
  
  // Healthcare - SPECIFIC mental health terms
  '6211': ['physician', 'doctor', 'medical practice', 'primary care'],
  '6212': ['dental', 'dentist', 'orthodont', 'oral health'],
  '6213': [
    'mental health', 
    'behavioral health', 
    'counseling', 
    'therapy', 
    'psychiatric', 
    'psychologist', 
    'therapist',
    'substance abuse',
    'addiction',
    'crisis intervention',
    'trauma',
    'PTSD'
  ],
  '6214': ['outpatient', 'health center', 'clinic', 'ambulatory'],
  '6215': ['laboratory', 'diagnostic', 'blood test', 'pathology'],
  '6216': ['home health', 'home care', 'nursing home', 'hospice'],
  '6219': ['ambulance', 'paramedic', 'emergency medical'],
  
  // Social Services - SPECIFIC family/youth terms
  '6241': [
    'family service',
    'youth program', 
    'child welfare', 
    'social work', 
    'case management', 
    'foster care',
    'foster', 
    'adoption', 
    'permanency',
    'juvenile',
    'at-risk youth',
    'family preservation',
    'child protective',
    'reunification'
  ],
  '6242': ['emergency shelter', 'homeless', 'food bank', 'relief', 'housing assistance'],
  '6243': ['vocational rehabilitation', 'job training', 'workforce development', 'career counseling'],
  '6244': ['child care', 'daycare', 'preschool', 'childcare', 'early childhood'],
  
  // Arts/Entertainment - SPECIFIC event terms
  '7111': ['performing arts', 'theater', 'theatre', 'symphony', 'opera', 'ballet', 'dance company'],
  '7112': ['sports team', 'stadium', 'arena'],
  '7113': [
    'concert', 
    'festival', 
    'event promotion', 
    'live event', 
    'entertainment event',
    'music festival',
    'cultural event',
    'community event'
  ],
  '7114': ['talent agent', 'artist manager', 'booking agent'],
  '7115': ['artist', 'musician', 'performer', 'entertainer'],
  
  // Education
  '6111': ['elementary school', 'secondary school', 'K-12', 'public school'],
  '6112': ['university', 'college', 'higher education', 'academic'],
  '6113': ['community college', 'junior college'],
  '6114': ['business school', 'professional development'],
  '6115': ['trade school', 'technical training', 'vocational school'],
  '6116': ['tutoring', 'test prep', 'educational support'],
  '6117': ['education consulting']
}

// ============================================
// SCORING WEIGHTS
// Points awarded for each match type
// ============================================
export const SCORING = {
  // NAICS Matching
  NAICS_DIRECT_CODE_MATCH: 40,      // Exact NAICS code match
  NAICS_KEYWORD_FROM_DESC: 35,      // Keyword from NAICS description
  NAICS_INDUSTRY_KEYWORD: 30,       // Industry keyword match
  
  // Location Matching
  LOCATION_STATE_MATCH: 20,         // User state = Opp state
  LOCATION_OPEN_TO_ALL: 10,         // No location requirement
  
  // Services Matching
  SERVICES_KEYWORD_MATCH: 25,       // Service keyword found
  
  // Bonus Points
  CERTIFICATIONS_BONUS: 10,         // Has relevant certifications
  PAST_PERFORMANCE_BONUS: 5,        // Has past performance
  
  // CR-AI Potential Boost
  CRAI_BOOST: 25,                   // Max points CR-AI can add
  MAX_SCORE: 95                     // Never show 100% (nothing is guaranteed)
}

// ============================================
// MATCH LEVEL THRESHOLDS
// ============================================
export const MATCH_LEVELS = {
  HIGH: 55,      // Score >= 55 = Strong Match
  MEDIUM: 35,    // Score >= 35 = Good Potential
  LOW: 1         // Score >= 1 = Review Needed
  // Score = 0 = No Match (hidden by default)
}

// ============================================
// CERTIFICATION KEYWORDS
// Terms in opportunity text that indicate cert relevance
// ============================================
export const CERT_KEYWORDS = [
  'small business',
  'minority',
  'woman owned',
  'women owned',
  'veteran',
  'dvbe',
  'mbe',
  'wbe',
  'sbe',
  'dbe',
  '8(a)',
  'hubzone',
  'disadvantaged',
  'set-aside',
  'set aside'
]

// ============================================
// MINIMUM KEYWORD LENGTH
// Skip words shorter than this
// ============================================
export const MIN_KEYWORD_LENGTH = 5
