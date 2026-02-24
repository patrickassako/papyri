import React, { useState, useRef } from 'react'
import { Box, Button, Text, Input, Label } from '@adminjs/design-system'

const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="200" viewBox="0 0 150 200">' +
  '<rect width="150" height="200" fill="#2E4057" rx="4"/>' +
  '<text x="75" y="95" text-anchor="middle" fill="#D4A017" font-size="13" font-family="sans-serif">Cliquer pour</text>' +
  '<text x="75" y="115" text-anchor="middle" fill="#D4A017" font-size="13" font-family="sans-serif">ajouter une image</text>' +
  '</svg>'
)

const CoverEdit = (props) => {
  const { record, property, onChange } = props
  const currentUrl = record.params[property.path] || ''
  const [preview, setPreview] = useState(currentUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Format non supporte. Acceptes: JPG, PNG, WebP, GIF')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 5 Mo)')
      return
    }

    setError('')
    setUploading(true)

    // Preview immediately
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(file)

    // Upload
    try {
      const formData = new FormData()
      formData.append('cover', file)

      const res = await fetch('/admin/api/upload-cover', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data = await res.json()

      if (data.success && data.url) {
        onChange(property.path, data.url)
        setPreview(data.url)
      } else {
        const errMsg = typeof data.error === 'string'
          ? data.error
          : (data.error && data.error.message) || JSON.stringify(data.error) || 'Erreur upload'
        setError(errMsg)
        setPreview(currentUrl)
      }
    } catch (err) {
      setError('Erreur reseau: ' + (err.message || String(err)))
      setPreview(currentUrl)
    }

    setUploading(false)
  }

  const handleUrlChange = (e) => {
    const val = e.target.value
    onChange(property.path, val)
    setPreview(val)
  }

  const handleClear = () => {
    onChange(property.path, '')
    setPreview('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Box mb="lg">
      <Label>{property.label || 'Couverture'}</Label>

      {/* Preview */}
      <Box
        mb="md"
        onClick={() => fileRef.current && fileRef.current.click()}
        style={{ cursor: 'pointer', display: 'inline-block' }}
      >
        <img
          src={preview || PLACEHOLDER}
          alt="Couverture"
          onError={(e) => { e.target.src = PLACEHOLDER }}
          style={{
            maxWidth: '150px',
            maxHeight: '200px',
            borderRadius: '6px',
            border: '2px dashed #ccc',
            display: 'block',
          }}
        />
      </Box>

      {/* File input */}
      <Box mb="sm" flex flexDirection="row" alignItems="center" style={{ gap: '8px' }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          style={{ fontSize: '13px' }}
        />
        {(preview || currentUrl) && (
          <Button size="sm" variant="danger" onClick={handleClear} type="button">
            Supprimer
          </Button>
        )}
      </Box>

      {uploading && (
        <Text style={{ color: '#B5651D', fontSize: '13px' }}>
          Upload en cours...
        </Text>
      )}

      {error && (
        <Text style={{ color: '#e74c3c', fontSize: '13px' }}>
          {error}
        </Text>
      )}

      {/* Manual URL input as fallback */}
      <Box mt="sm">
        <Text style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
          Ou saisir une URL manuellement :
        </Text>
        <Input
          value={record.params[property.path] || ''}
          onChange={handleUrlChange}
          placeholder="https://..."
          style={{ fontSize: '13px' }}
        />
      </Box>
    </Box>
  )
}

export default CoverEdit
