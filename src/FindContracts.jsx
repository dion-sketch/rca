import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const colors = {
  primary: '#00FF00',
  gold: '#FFD700',
  background: '#000000',
  card: '#0A1F0A',
  white: '#FFFFFF',
  gray: '#888888',
}

function FindContracts({ session, onBack, onStartResponse }) {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedContract, setSelectedContract] = useState(null)

  // Sample contracts for demo (until we populate the database)
  const sampleContracts = [
    {
      id: 1,
      title: 'Mental Health Outreach Services',
      agency: 'LA County Department of Mental Health',
      type: 'contract',
      value_min: 500000,
      value_max: 1500000,
      deadline: '2025-01-15',
      description: 'Seeking qualified vendors to provide community-based mental health outreach services to underserved populations in Los Angeles County.',
      naics_codes: ['621420', '624190'],
      certifications_required: ['MBE', 'SBE'],
      status: 'open'
    },
    {
      id: 2,
      title: 'Youth Wellness Program Grant',
      agency: 'California Department of Education',
      type: 'grant',
      value_min: 100000,
      value_max: 250000,
      deadline: '2025-01-30',
      description: 'Grant funding available for organizations providing mental health and wellness programming to K-12 students.',
      naics_codes: ['611710', '624190'],
      certifications_required: [],
      status: 'open'
    },
    {
      id: 3,
      title: 'Mobile Health Unit Operations',
      agency: 'City of Hawthorne',
      type: 'contract',
      value_min: 200000,
      value_max: 400000,
      deadline: '2025-02-01',
      description: 'Contract for operation and staffing of mobile health units providing services to residents.',
      naics_codes: ['621999', '485999'],
      certifications_required: ['SBE', 'Local'],
      status: 'open'
    },
    {
      id: 4,
      title: 'Community Health Education Services',
      agency: 'Department of Public Health',
      type: 'contract',
      value_min: 150000,
      value_max: 300000,
      deadline: '2025-02-15',
      description: 'Educational outreach services for community health initiatives targeting diverse populations.',
      naics_codes: ['611710', '541611'],
      certifications_required: ['DVBE'],
      status: 'open'
    },
    {
      id: 5,
      title: 'Behavioral Health Integration Grant',
      agency: 'SAMHSA',
      type: 'grant',
      value_min: 500000,
      value_max: 2000000,
      deadline: '2025-03-01',
      description: 'Federal grant for integrating behavioral health services into primary care settings.',
      naics_codes: ['621420', '621111'],
      certifications_required: [],
      status: 'open'
    }
  ]

  useEffect(() => {
    fetchContracts()
  }, [])

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('contracts_grants')
        .select('*')
        .eq('status', 'open')
        .order('deadline', { ascending: true })

      if (error) throw error

      // Use sample data if database is empty
      if (data && data.length > 0) {
        setContracts(data)
      } else {
        setContracts(sampleContracts)
      }
    } catch (err) {
      console.error('Error fetching contracts:', err)
      setContracts(sampleContracts)
    } finally {
      setLoading(false)
    }
  }

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.agency.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || contract.type === filterType
    return matchesSearch && matchesType
  })

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getDaysUntilDeadline = (dateString) => {
    const deadline = new Date(dateString)
    const today = new Date()
    const diffTime = deadline - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: colors.primary, fontSize: '24px' }}>Loading opportunities...</div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: colors.card,
        padding: '20px 30px',
        borderBottom: `1px solid ${colors.primary}30`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: colors.gray,
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ← Back
          </button>
          <h1 style={{ color: colors.white, margin: 0, fontSize: '24px' }}>
            🔍 Find Contracts & Grants
          </h1>
        </div>
        <div style={{
          backgroundColor: `${colors.primary}20`,
          padding: '8px 16px',
          borderRadius: '20px',
          border: `1px solid ${colors.primary}`
        }}>
          <span style={{ color: colors.primary, fontWeight: '600' }}>
            {filteredContracts.length} Opportunities
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{
        backgroundColor: colors.card,
        padding: '20px 30px',
        borderBottom: `1px solid ${colors.primary}30`,
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <input
          type="text"
          placeholder="Search by title, agency, or keyword..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: '300px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: `1px solid ${colors.gray}`,
            backgroundColor: '#1a1a1a',
            color: colors.white,
            fontSize: '16px'
          }}
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            border: `1px solid ${colors.gray}`,
            backgroundColor: '#1a1a1a',
            color: colors.white,
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Types</option>
          <option value="contract">Contracts</option>
          <option value="grant">Grants</option>
        </select>
      </div>

      {/* Contract List */}
      <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        {selectedContract ? (
          /* Contract Detail View */
          <div style={{
            backgroundColor: colors.card,
            borderRadius: '16px',
            padding: '30px',
            border: `1px solid ${colors.primary}30`
          }}>
            <button
              onClick={() => setSelectedContract(null)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.gray,
                cursor: 'pointer',
                fontSize: '14px',
                marginBottom: '20px'
              }}
            >
              ← Back to list
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span style={{
                  backgroundColor: selectedContract.type === 'grant' ? `${colors.gold}30` : `${colors.primary}30`,
                  color: selectedContract.type === 'grant' ? colors.gold : colors.primary,
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  {selectedContract.type}
                </span>
                <h2 style={{ color: colors.white, margin: '10px 0', fontSize: '28px' }}>
                  {selectedContract.title}
                </h2>
                <p style={{ color: colors.gray, margin: 0 }}>{selectedContract.agency}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: colors.primary, fontSize: '24px', fontWeight: '700' }}>
                  {formatCurrency(selectedContract.value_min)} - {formatCurrency(selectedContract.value_max)}
                </div>
                <div style={{ color: colors.gold, fontSize: '14px', marginTop: '5px' }}>
                  ⏰ {getDaysUntilDeadline(selectedContract.deadline)} days left
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <h3 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '16px' }}>Description</h3>
              <p style={{ color: colors.gray, margin: 0, lineHeight: '1.6' }}>
                {selectedContract.description}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <h3 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '16px' }}>NAICS Codes</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedContract.naics_codes?.map((code, i) => (
                    <span key={i} style={{
                      backgroundColor: `${colors.primary}20`,
                      color: colors.primary,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}>
                      {code}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <h3 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '16px' }}>Required Certifications</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedContract.certifications_required?.length > 0 ? (
                    selectedContract.certifications_required.map((cert, i) => (
                      <span key={i} style={{
                        backgroundColor: `${colors.gold}20`,
                        color: colors.gold,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}>
                        {cert}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: colors.gray }}>None specified</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '30px'
            }}>
              <h3 style={{ color: colors.white, margin: '0 0 10px 0', fontSize: '16px' }}>Key Dates</h3>
              <div style={{ display: 'flex', gap: '30px' }}>
                <div>
                  <span style={{ color: colors.gray, fontSize: '14px' }}>Deadline: </span>
                  <span style={{ color: colors.white, fontWeight: '600' }}>{formatDate(selectedContract.deadline)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                // TODO: Start response flow
                alert('Response builder coming soon!')
              }}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: colors.primary,
                color: colors.background,
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              🚀 Start Response with CR-AI
            </button>
          </div>
        ) : (
          /* Contract List View */
          <div style={{ display: 'grid', gap: '15px' }}>
            {filteredContracts.length === 0 ? (
              <div style={{
                backgroundColor: colors.card,
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center'
              }}>
                <p style={{ color: colors.gray, fontSize: '18px', margin: 0 }}>
                  No opportunities found matching your search.
                </p>
              </div>
            ) : (
              filteredContracts.map((contract) => {
                const daysLeft = getDaysUntilDeadline(contract.deadline)
                return (
                  <div
                    key={contract.id}
                    onClick={() => setSelectedContract(contract)}
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: '12px',
                      padding: '20px',
                      border: `1px solid ${colors.gray}30`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.primary
                      e.currentTarget.style.transform = 'translateX(5px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${colors.gray}30`
                      e.currentTarget.style.transform = 'translateX(0)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <span style={{
                            backgroundColor: contract.type === 'grant' ? `${colors.gold}30` : `${colors.primary}30`,
                            color: contract.type === 'grant' ? colors.gold : colors.primary,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            textTransform: 'uppercase'
                          }}>
                            {contract.type}
                          </span>
                          <span style={{
                            backgroundColor: daysLeft <= 14 ? '#ff444430' : `${colors.gray}30`,
                            color: daysLeft <= 14 ? '#ff4444' : colors.gray,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '11px'
                          }}>
                            {daysLeft} days left
                          </span>
                        </div>
                        <h3 style={{ color: colors.white, margin: '0 0 5px 0', fontSize: '18px' }}>
                          {contract.title}
                        </h3>
                        <p style={{ color: colors.gray, margin: '0 0 10px 0', fontSize: '14px' }}>
                          {contract.agency}
                        </p>
                        <p style={{ color: colors.gray, margin: 0, fontSize: '13px', lineHeight: '1.4' }}>
                          {contract.description.substring(0, 120)}...
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '20px' }}>
                        <div style={{ color: colors.primary, fontSize: '18px', fontWeight: '700' }}>
                          {formatCurrency(contract.value_min)} - {formatCurrency(contract.value_max)}
                        </div>
                        <div style={{ color: colors.gray, fontSize: '12px', marginTop: '5px' }}>
                          Due: {formatDate(contract.deadline)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FindContracts
