/**
 * LogoUpload — AdminJS custom edit component for invoice_logo_url
 * Provides image upload to R2 with live preview.
 * Used on: app_settings resource → invoice_logo_url property
 */
import React, { useState, useRef } from 'react'

const LogoUpload = (props) => {
  const { record, property, onChange } = props
  const currentUrl = record?.params?.[property?.path] || ''

  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(currentUrl)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  // ── Upload handler ────────────────────────────────────────────────────────
  const uploadFile = async (file) => {
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      setError('Format non supporté. Acceptés : JPG, PNG, WebP, SVG')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 2 Mo)')
      return
    }

    setError('')
    setUploading(true)

    // Show local preview immediately while uploading
    const localBlob = URL.createObjectURL(file)
    setPreviewUrl(localBlob)

    try {
      const formData = new FormData()
      formData.append('logo', file)

      const res = await fetch('/admin/api/upload-logo', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data = await res.json()

      if (data.success && data.url) {
        onChange(property.path, data.url)
        setPreviewUrl(data.url)
      } else {
        const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error || 'Erreur upload')
        setError(msg)
        // Revert preview to previous URL on error
        setPreviewUrl(currentUrl)
      }
    } catch (err) {
      setError('Erreur réseau : ' + err.message)
      setPreviewUrl(currentUrl)
    }

    setUploading(false)
    URL.revokeObjectURL(localBlob)
  }

  const handleFileInput = (e) => uploadFile(e.target.files[0])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    uploadFile(e.dataTransfer.files[0])
  }

  const handleRemove = () => {
    onChange(property.path, '')
    setPreviewUrl('')
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleManualUrl = (e) => {
    const url = e.target.value
    onChange(property.path, url)
    setPreviewUrl(url)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={styles.label}>
        {property?.label || 'Logo de la société'}
      </label>

      {/* ── Drop zone ──────────────────────────────────────────────────── */}
      <div
        style={{
          ...styles.dropZone,
          borderColor: dragOver ? '#B5651D' : uploading ? '#d1a06a' : '#d1d5db',
          background: dragOver ? '#fef3e2' : uploading ? '#fffbf5' : '#fafafa',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml"
          onChange={handleFileInput}
          disabled={uploading}
          style={{ display: 'none' }}
        />

        {uploading ? (
          <div style={styles.dropContent}>
            <div style={styles.spinner} />
            <p style={{ ...styles.dropHint, color: '#B5651D', marginTop: '10px' }}>
              Upload en cours…
            </p>
          </div>
        ) : (
          <div style={styles.dropContent}>
            {/* Upload icon */}
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={styles.dropHint}>
              <span style={{ color: '#B5651D', fontWeight: 600, cursor: 'pointer' }}>
                Cliquer pour choisir
              </span>
              {' '}ou glisser-déposer
            </p>
            <p style={styles.dropSub}>
              JPG, PNG, WebP, SVG — Max 2 Mo
            </p>
          </div>
        )}
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <p style={styles.errorText}>{error}</p>
      )}

      {/* ── Preview card ───────────────────────────────────────────────── */}
      {previewUrl && (
        <div style={styles.previewCard}>
          <div style={styles.previewImageWrap}>
            <img
              src={previewUrl}
              alt="Aperçu logo"
              style={styles.previewImage}
              onError={() => setPreviewUrl('')}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={styles.previewLabel}>Logo actuel</p>
            <p style={styles.previewUrl} title={previewUrl}>
              {previewUrl.length > 60 ? '…' + previewUrl.slice(-55) : previewUrl}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            style={styles.removeBtn}
            title="Supprimer le logo"
          >
            ✕ Retirer
          </button>
        </div>
      )}

      {/* ── Manual URL input ───────────────────────────────────────────── */}
      <div style={{ marginTop: '12px' }}>
        <p style={styles.manualLabel}>Ou coller une URL directement :</p>
        <input
          type="url"
          value={record?.params?.[property?.path] || ''}
          onChange={handleManualUrl}
          placeholder="https://cdn.exemple.com/logo.png"
          style={styles.urlInput}
        />
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  label: {
    display: 'block',
    fontWeight: 700,
    fontSize: '13px',
    color: '#374151',
    marginBottom: '10px',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  dropZone: {
    border: '2px dashed',
    borderRadius: '10px',
    padding: '28px 20px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    textAlign: 'center',
    userSelect: 'none',
  },
  dropContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  dropHint: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#6b7280',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  dropSub: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: '#9ca3af',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  errorText: {
    margin: '8px 0 0',
    fontSize: '13px',
    color: '#dc2626',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  previewCard: {
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 16px',
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0,0,0,.05)',
  },
  previewImageWrap: {
    width: '100px',
    height: '52px',
    background: '#f3f4f6',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
  },
  previewImage: {
    maxWidth: '96px',
    maxHeight: '48px',
    objectFit: 'contain',
  },
  previewLabel: {
    margin: '0 0 2px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  previewUrl: {
    margin: 0,
    fontSize: '11px',
    color: '#9ca3af',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  removeBtn: {
    flexShrink: 0,
    padding: '5px 12px',
    background: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: '7px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    whiteSpace: 'nowrap',
  },
  manualLabel: {
    margin: '0 0 5px',
    fontSize: '11px',
    color: '#9ca3af',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  urlInput: {
    width: '100%',
    padding: '8px 11px',
    border: '1px solid #d1d5db',
    borderRadius: '7px',
    fontSize: '13px',
    color: '#374151',
    boxSizing: 'border-box',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    outline: 'none',
  },
  spinner: {
    width: '30px',
    height: '30px',
    border: '3px solid #f3f4f6',
    borderTop: '3px solid #B5651D',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
}

export default LogoUpload
