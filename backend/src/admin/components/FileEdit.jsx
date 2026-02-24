import React, { useState, useRef } from 'react'
import { Box, Button, Text, Input, Label } from '@adminjs/design-system'

const FORMAT_LABELS = {
  epub: 'EPUB',
  pdf: 'PDF',
  mp3: 'MP3',
  m4a: 'M4A',
}

const FileEdit = (props) => {
  const { record, property, onChange } = props
  const currentKey = record.params[property.path] || ''
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [uploadInfo, setUploadInfo] = useState(null)
  const fileRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const allowed = [
      'application/epub+zip',
      'application/pdf',
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/mp3',
    ]
    if (!allowed.includes(file.type)) {
      setError('Format non supporte. Acceptes: EPUB, PDF, MP3, M4A')
      return
    }

    const sizeMb = (file.size / 1024 / 1024).toFixed(1)
    setError('')
    setUploading(true)
    setProgress('Upload en cours (' + sizeMb + ' Mo)...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/admin/api/upload-content', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data = await res.json()

      if (data.success && data.key) {
        // Set file_key
        onChange(property.path, data.key)

        // Auto-fill related fields if they exist
        if (data.format) onChange('format', data.format)
        if (data.content_type) onChange('content_type', data.content_type)
        if (data.size_bytes) onChange('file_size_bytes', String(data.size_bytes))

        setUploadInfo({
          key: data.key,
          format: data.format,
          size: sizeMb,
          name: data.original_name,
        })
        setProgress('')
      } else {
        const errMsg = typeof data.error === 'string'
          ? data.error
          : (data.error && data.error.message) || JSON.stringify(data.error) || 'Erreur upload'
        setError(errMsg)
        setProgress('')
      }
    } catch (err) {
      setError('Erreur reseau: ' + (err.message || String(err)))
      setProgress('')
    }

    setUploading(false)
  }

  const handleManualChange = (e) => {
    onChange(property.path, e.target.value)
  }

  const handleClear = () => {
    onChange(property.path, '')
    setUploadInfo(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Box mb="lg">
      <Label>{property.label || 'Fichier'}</Label>

      {/* Current file info */}
      {(currentKey || uploadInfo) && (
        <Box mb="sm" style={{
          background: '#f8f9fa',
          border: '1px solid #e0e0e0',
          borderRadius: '6px',
          padding: '10px 14px',
        }}>
          {uploadInfo ? (
            <Box>
              <Text style={{ fontWeight: 'bold', fontSize: '13px', color: '#2E4057' }}>
                {uploadInfo.name}
              </Text>
              <Text style={{ fontSize: '12px', color: '#666' }}>
                {FORMAT_LABELS[uploadInfo.format] || uploadInfo.format} - {uploadInfo.size} Mo
              </Text>
              <Text style={{ fontSize: '11px', color: '#999', wordBreak: 'break-all' }}>
                {uploadInfo.key}
              </Text>
            </Box>
          ) : currentKey ? (
            <Box>
              <Text style={{ fontSize: '13px', color: '#2E4057', fontWeight: 'bold' }}>
                Fichier existant
              </Text>
              <Text style={{ fontSize: '11px', color: '#999', wordBreak: 'break-all' }}>
                {currentKey}
              </Text>
            </Box>
          ) : null}
        </Box>
      )}

      {/* Upload input */}
      <Box mb="sm" flex flexDirection="row" alignItems="center" style={{ gap: '8px' }}>
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.pdf,.mp3,.m4a,application/epub+zip,application/pdf,audio/mpeg,audio/mp4"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ fontSize: '13px' }}
        />
        {currentKey && (
          <Button size="sm" variant="danger" onClick={handleClear} type="button" disabled={uploading}>
            Retirer
          </Button>
        )}
      </Box>

      <Text style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>
        Formats acceptes: EPUB, PDF, MP3, M4A (max 500 Mo)
      </Text>

      {uploading && (
        <Text style={{ color: '#B5651D', fontSize: '13px', fontWeight: 'bold' }}>
          {progress}
        </Text>
      )}

      {error && (
        <Text style={{ color: '#e74c3c', fontSize: '13px' }}>
          {error}
        </Text>
      )}

      {/* Manual key input */}
      <Box mt="sm">
        <Text style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
          Ou saisir une cle R2 manuellement :
        </Text>
        <Input
          value={record.params[property.path] || ''}
          onChange={handleManualChange}
          placeholder="ebooks/2026/02/fichier.epub"
          style={{ fontSize: '13px' }}
        />
      </Box>
    </Box>
  )
}

export default FileEdit
