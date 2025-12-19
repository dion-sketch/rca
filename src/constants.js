// ============================================
// constants.js
// Frontend Rules for CR-AI React Components
// ============================================
// Import this in any component that needs CR-AI rules
// import { CR_AI, COLORS, SCORING, etc. } from './constants'
// ============================================

// ============================================
// BRANDING
// ============================================
export const BRANDING = {
  name: 'CR-AI',
  fullName: 'Contract Ready AI',
  tagline: 'Contracts AND Grants',
  bucketName: 'BUCKET',
  
  // NEVER say these
  neverSay: ['AI', 'artificial intelligence', 'machine learning', 'bot'],
  
  // ALWAYS say these
  alwaysSay: ['CR-AI', 'Contracts AND Grants', 'BUCKET']
}

// ============================================
// COLORS (Contract Ready Brand)
// ============================================
export const COLORS = {
  primary: '#39FF14',      // Neon green
  secondary: '#FFD700',    // Gold
  background: '#000000',   // Black
  surface: '#111111',      // Dark surface
  text: '#FFFFFF',         // White text
  textMuted: '#888888',    // Gray text
  error: '#FF4444',        // Red
  warning: '#FFD700',      // Gold/Yellow
  success: '#39FF14',      // Green
  
  // Status colors
  compliant: '#39FF14',
  overLimit: '#FF4444',
  nearLimit: '#FFD700'
}

// ============================================
// SCORING
// ============================================
export const SCORING = {
  // Weights for BUCKET score calculation
  weights: {
    coreBasics: 40,      // Company info, contact, address
    services: 20,        // What they do
    naicsCodes: 20,      // How contracts find them
    pastPerformance: 10, // Grows over time
    team: 10             // Key personnel
  },
  
  // Messages by score range
  messages: {
    low: {
      range: [0, 30],
      message: "Let's build your foundation. Start with basics.",
      color: COLORS.warning
    },
    building: {
      range: [31, 50],
      message: "You're getting there! A few more items unlocks opportunities.",
      color: COLORS.warning
    },
    solid: {
      range: [51, 70],
      message: "Solid foundation! Let's target some wins.",
      color: COLORS.primary
    },
    competitive: {
      range: [71, 85],
      message: "You're competitive! Time to go shopping.",
      color: COLORS.primary
    },
    ready: {
      range: [86, 100],
      message: "You're ready for almost anything. Let's win.",
      color: COLORS.primary
    }
  },
  
  // Get message for a score
  getMessage: (score) => {
    if (score <= 30) return SCORING.messages.low
    if (score <= 50) return SCORING.messages.building
    if (score <= 70) return SCORING.messages.solid
    if (score <= 85) return SCORING.messages.competitive
    return SCORING.messages.ready
  }
}

// ============================================
// GAMIFICATION
// ============================================
export const GAMIFICATION = {
  monthlyGoal: 2,
  trophyEmoji: '🏆',
  
  // NEVER track wins/losses
  trackWins: false,
  trackLosses: false,
  
  // Celebrate ALL submissions
  celebrateAllSubmissions: true,
  
  // Never fake numbers
  fakeNumbers: false,
  showZeroForNewUsers: true,
  
  // Trophy display
  getTrophyDisplay: (timesHit) => {
    if (timesHit === 0) return null
    return `${GAMIFICATION.trophyEmoji} x${timesHit}`
  }
}

// ============================================
// COMPLIANCE
// ============================================
export const COMPLIANCE = {
  // Character limits
  enforceCharLimits: true,
  targetPercentOfLimit: 0.9, // Aim for 90%
  
  // Visual feedback thresholds
  thresholds: {
    safe: 0.85,      // Green: under 85%
    warning: 0.95,   // Yellow: 85-95%
    danger: 1.0      // Red: over 95%
  },
  
  // Get status for character count
  getCharStatus: (current, limit) => {
    if (!limit) return { status: 'safe', color: COLORS.compliant }
    const percent = current / limit
    if (percent <= COMPLIANCE.thresholds.safe) {
      return { status: 'safe', color: COLORS.compliant }
    }
    if (percent <= COMPLIANCE.thresholds.warning) {
      return { status: 'warning', color: COLORS.warning }
    }
    return { status: 'danger', color: COLORS.overLimit }
  },
  
  // Block actions
  blockNonCompliantSave: true,
  blockNonCompliantExport: true,
  requireDisclaimerBeforeDownload: true
}

// ============================================
// TOKEN MANAGEMENT
// ============================================
export const TOKEN_MANAGEMENT = {
  // NO RFP/Grant uploads
  allowRfpUploads: false,
  
  // Manual entry only
  manualEntryOnly: true,
  
  // Profile uploads ONE-TIME
  profileUploadsOneTime: true,
  
  // Document limits
  maxPages: {
    capabilityStatement: 4,
    resume: 4,
    letterOfSupport: 4
  },
  maxResumes: 5,
  
  // Error messages
  errors: {
    rfpUpload: "To keep costs low for all subscribers, we don't upload full RFP documents. Please copy/paste the questions instead.",
    tooManyPages: (max) => `Document exceeds ${max} page limit. Please reduce and try again.`
  }
}

// ============================================
// ELIGIBILITY
// ============================================
export const ELIGIBILITY = {
  // Geographic - allow local partner workaround
  geographic: {
    checkLocation: true,
    allowWorkaround: true,
    workaroundMessage: "You can still apply with a LOCAL PARTNER in that area. CR-AI can help you find one."
  },
  
  // Federal - SAM.gov
  federal: {
    requireSamGov: true,
    requireUEI: true,
    allowWithoutRegistration: true, // Can answer questions
    registrationLink: 'https://sam.gov',
    message: "Federal contracts require SAM.gov registration. You can still prepare your responses while registering."
  },
  
  // Entity type
  entityType: {
    check501c3: true,
    checkFiscalSponsor: true,
    fiscalSponsorMessage: "This grant requires 501(c)(3) status. If you're for-profit, you can apply through a fiscal sponsor."
  },
  
  // Mandatory meetings
  mandatoryMeetings: {
    trackDates: true,
    allowRepresentative: true,
    representativeMessage: "You don't have to attend yourself - a representative from your company can go."
  }
}

// ============================================
// EXPIRED OPPORTUNITIES
// ============================================
export const EXPIRED = {
  // Filter out expired
  filterExpired: true,
  
  // Check mandatory meetings
  checkMandatoryMeetings: true,
  
  // Warning message
  warningMessage: (opportunity) => ({
    title: '⚠️ This opportunity may have expired',
    details: [
      opportunity.due_date && new Date(opportunity.due_date) < new Date() 
        ? `Due Date: ${new Date(opportunity.due_date).toLocaleDateString()} — PASSED` 
        : null,
      opportunity.mandatory_meeting_date && new Date(opportunity.mandatory_meeting_date) < new Date()
        ? `Mandatory Meeting: ${new Date(opportunity.mandatory_meeting_date).toLocaleDateString()} — PASSED`
        : null
    ].filter(Boolean),
    action: "You cannot submit for this opportunity. Would you like to find similar ACTIVE opportunities instead?"
  }),
  
  // Check if expired
  isExpired: (opportunity) => {
    if (opportunity.due_date && new Date(opportunity.due_date) < new Date()) {
      return true
    }
    if (opportunity.mandatory_meeting_date && new Date(opportunity.mandatory_meeting_date) < new Date()) {
      return true
    }
    return false
  }
}

// ============================================
// SHOPPING / SEARCH
// ============================================
export const SHOPPING = {
  // Search by ENTIRE BUCKET, not just NAICS
  searchByBucket: true,
  
  // Fields to search by
  searchFields: [
    'naics_codes',
    'services',
    'certifications',
    'past_performance',
    'location',
    'entity_type'
  ],
  
  // BUCKET grows over time, NAICS stays static
  prioritizeBucketOverNaics: true,
  
  // Source indicators
  sources: {
    manual: 'You found this',
    autoDelivered: 'Auto-delivered for you',
    matched: 'Matched to your BUCKET',
    shopping: 'From Go Shopping'
  },
  
  // Require "Is this it?" confirmation
  requireConfirmation: true,
  confirmationMessage: "Is this the opportunity you're looking for?"
}

// ============================================
// DISCLAIMER
// ============================================
export const DISCLAIMER = {
  title: '⚠️ IMPORTANT DISCLAIMER',
  
  checkboxes: [
    {
      id: 'supportive_tool',
      text: 'I understand that CR-AI is a SUPPORTIVE TOOL ONLY, not a guarantee of winning.',
      required: true
    },
    {
      id: 'may_contain_errors',
      text: 'I understand CR-AI suggestions are recommendations only and MAY CONTAIN ERRORS. I must verify all content.',
      required: true
    },
    {
      id: 'responsible_for_review',
      text: 'I am responsible for reviewing and verifying ALL information before submitting.',
      required: true
    },
    {
      id: 'responsible_for_submission',
      text: 'I am responsible for submitting my application to the correct portal by the deadline.',
      required: true
    },
    {
      id: 'not_liable',
      text: 'Contract Ready and CR-AI are NOT LIABLE for application outcomes.',
      required: true
    },
    {
      id: 'double_checked',
      text: 'I have double-checked all information for accuracy.',
      required: true
    }
  ],
  
  // All required
  requireAll: true,
  
  // Check if all accepted
  allAccepted: (accepted) => {
    return DISCLAIMER.checkboxes
      .filter(c => c.required)
      .every(c => accepted[c.id])
  }
}

// ============================================
// VOICE / MESSAGING
// ============================================
export const VOICE = {
  // Phrases to use
  use: [
    "You're closer than you think.",
    "This is doable. Let's go for it.",
    "I've got you.",
    "Here's the real deal...",
    "Don't let the title fool you.",
    "Most people skip this one, but you actually qualify.",
    "Let me handle the hard part.",
    "You're not just a business owner — you're a contract manager. Hire the team to get it done."
  ],
  
  // Phrases to NEVER use
  never: [
    "Unfortunately",
    "You're missing",
    "You don't have",
    "You need to",
    "You lack",
    "You failed to",
    "You forgot to",
    "I cannot help",
    "This is not possible"
  ],
  
  // Empowering alternatives
  alternatives: {
    "You're missing insurance": "Insurance is only needed AFTER you win. Let's focus on winning first.",
    "You need a DVBE partner": "I can help you connect with a DVBE partner.",
    "You don't have enough references": "Let's draft a reference request letter together — takes 5 minutes.",
    "You lack experience": "You're a contract manager — let's find the right team to fill this gap."
  }
}

// ============================================
// PHASES (The 5-Step Flow)
// ============================================
export const PHASES = {
  overview: {
    id: 'overview',
    name: 'Overview',
    description: 'Review opportunity details and your match score'
  },
  strategy: {
    id: 'strategy',
    name: 'Strategy',
    description: 'CR-AI creates a strategic response plan'
  },
  answers: {
    id: 'answers',
    name: 'Answers',
    description: 'Answer questions with CR-AI assistance'
  },
  review: {
    id: 'review',
    name: 'Review',
    description: 'Review all answers and check compliance'
  },
  submit: {
    id: 'submit',
    name: 'Submit',
    description: 'Download and submit your response'
  },
  
  // Order
  order: ['overview', 'strategy', 'answers', 'review', 'submit'],
  
  // Get phase by index
  getPhase: (index) => PHASES[PHASES.order[index]],
  
  // Get index of phase
  getIndex: (phaseId) => PHASES.order.indexOf(phaseId)
}

// ============================================
// DUAL SCORE DISPLAY
// ============================================
export const DUAL_SCORE = {
  // Always show both scores
  showBoth: true,
  
  labels: {
    current: 'YOUR SCORE',
    potential: 'WITH CR-AI'
  },
  
  // Format score display
  format: (current, potential) => ({
    current: `${current}%`,
    potential: `${potential}% ✨`,
    improvement: `+${potential - current}%`
  })
}

// ============================================
// EXPORT ALL
// ============================================
export default {
  BRANDING,
  COLORS,
  SCORING,
  GAMIFICATION,
  COMPLIANCE,
  TOKEN_MANAGEMENT,
  ELIGIBILITY,
  EXPIRED,
  SHOPPING,
  DISCLAIMER,
  VOICE,
  PHASES,
  DUAL_SCORE
}
