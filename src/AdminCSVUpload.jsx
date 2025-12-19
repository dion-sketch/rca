// AdminCSVUpload.jsx
// Admin component for importing opportunities from government CSV files

import { useState } from 'react'

const colors = {
  background: '#0a0a0a',
  card: '#141414',
  primary: '#00ff88',
  gold: '#ffd700',
  white: '#ffffff',
  gray: '#888888',
  red: '#ff4444'
}

const sources = [
  { id: 'la_county', name: 'LA County', url: 'https://camisvr.co.la.ca.us/lacobids/BidLookUp/OpenBidList' },
  { id: 'sam_gov', name: 'SAM.gov (Federal)', url: 'https://sam.gov/data-services' },
  { id: 'grants_gov', name: 'Grants.gov (Federal)', url: 'https://www.grants.gov' },
  { id: 'california', name: 'California State', url: 'https://caleprocure.ca.gov' },
  { id: 'city_la', name: 'City of Los Angeles', url: '' },
  { id: 'other', name: 'Other Source', url: '' }
]

export default function AdminCSVUpload({ onClose }) {
  const [selectedSource, setSelectedSource] = useState('la_county')
  const [file, setFile] = useState(null)
  const [csvData, setCsvData] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setResult(null)
      
      // Read and preview
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target.result
        setCsvData(content)
        
        // Generate preview
        const lines = content.split('\n').slice(0, 6)
        setPreview(lines)
      }
      reader.readAsText(selectedFile)
    }
  }

  // Handle upload
  const handleUpload = async () => {
    if (!csvData) {
      setError('Please select a CSV file first')
      return
    }

    setIsUploading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/import-opportunities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: selectedSource,
          csvData: csvData
        })
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch (err) {
      setError('Network error: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const selectedSourceInfo = sources.find(s => s.id === selectedSource)

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: colors.card,
        borderRadius: '16px',
        padding: '30px',
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: `2px solid ${colors.primary}`
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h2 style={{ color: colors.white, margin: 0 }}>📥 Import Opportunities</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: colors.gray,
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >×</button>
        </div>

        {/* Source Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '8px' }}>
            Select Source
          </label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: `1px solid ${colors.gray}50`,
              backgroundColor: colors.background,
              color: colors.white,
              fontSize: '16px'
            }}
          >
            {sources.map(source => (
              <option key={source.id} value={source.id}>{source.name}</option>
            ))}
          </select>
          
          {selectedSourceInfo?.url && (
            <p style={{ color: colors.gray, fontSize: '13px', marginTop: '8px' }}>
              Download CSV from: <a href={selectedSourceInfo.url} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>{selectedSourceInfo.url}</a>
            </p>
          )}
        </div>

        {/* File Upload */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '8px' }}>
            Upload CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '8px',
              border: `2px dashed ${colors.primary}50`,
              backgroundColor: colors.background,
              color: colors.white,
              cursor: 'pointer'
            }}
          />
          {file && (
            <p style={{ color: colors.primary, fontSize: '14px', marginTop: '8px' }}>
              ✓ {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: colors.gray, fontSize: '14px', display: 'block', marginBottom: '8px' }}>
              Preview (first 5 rows)
            </label>
            <div style={{
              backgroundColor: colors.background,
              borderRadius: '8px',
              padding: '15px',
              overflow: 'auto',
              maxHeight: '200px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              {preview.map((line, i) => (
                <div key={i} style={{ 
                  color: i === 0 ? colors.primary : colors.gray,
                  whiteSpace: 'nowrap',
                  marginBottom: '5px'
                }}>
                  {line.substring(0, 150)}{line.length > 150 ? '...' : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: file && !isUploading ? colors.primary : colors.gray,
            color: colors.background,
            fontSize: '16px',
            fontWeight: '600',
            cursor: file && !isUploading ? 'pointer' : 'not-allowed',
            marginBottom: '20px'
          }}
        >
          {isUploading ? '⏳ Importing...' : '📤 Import Opportunities'}
        </button>

        {/* Result */}
        {result && (
          <div style={{
            backgroundColor: `${colors.primary}20`,
            borderRadius: '8px',
            padding: '15px',
            border: `1px solid ${colors.primary}`
          }}>
            <p style={{ color: colors.primary, margin: 0, fontWeight: '600' }}>
              ✅ {result.message}
            </p>
            <p style={{ color: colors.gray, margin: '10px 0 0 0', fontSize: '14px' }}>
              {result.imported} opportunities imported from {result.source}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            backgroundColor: `${colors.red}20`,
            borderRadius: '8px',
            padding: '15px',
            border: `1px solid ${colors.red}`
          }}>
            <p style={{ color: colors.red, margin: 0 }}>
              ❌ {error}
            </p>
          </div>
        )}

        {/* Instructions */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: colors.background,
          borderRadius: '8px'
        }}>
          <h4 style={{ color: colors.gold, margin: '0 0 10px 0' }}>📋 How to use:</h4>
          <ol style={{ color: colors.gray, fontSize: '14px', margin: 0, paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>Go to the source portal (LA County, SAM.gov, etc.)</li>
            <li style={{ marginBottom: '8px' }}>Download the CSV file with open opportunities</li>
            <li style={{ marginBottom: '8px' }}>Select the source above</li>
            <li style={{ marginBottom: '8px' }}>Upload the CSV file</li>
            <li>Click Import — opportunities will be searchable instantly!</li>
          </ol>
        </div>

        {/* Supported Formats */}
        <div style={{
          marginTop: '15px',
          padding: '15px',
          backgroundColor: colors.background,
          borderRadius: '8px'
        }}>
          <h4 style={{ color: colors.gold, margin: '0 0 10px 0' }}>✅ Supported Sources:</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {sources.slice(0, -1).map(source => (
              <div key={source.id} style={{ color: colors.gray, fontSize: '13px' }}>
                • {source.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
