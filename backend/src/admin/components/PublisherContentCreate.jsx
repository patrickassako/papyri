import React, { useState, useEffect, useRef } from 'react'

const C = {
  terre: '#B5651D', indigo: '#2E4057', green: '#27ae60', red: '#e74c3c',
  blue: '#2196F3', orange: '#FF9800', grey: '#8c8c8c', lightGrey: '#f0f0f0',
  card: '#ffffff', bg: '#f4f1ec', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
}

const S = {
  page:    { width: '100%', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxSizing: 'border-box', background: C.bg, minHeight: '100vh' },
  card:    { background: C.card, borderRadius: '14px', padding: '28px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '20px' },
  row:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  label:   { display: 'block', fontSize: '13px', fontWeight: '600', color: C.textSecondary, marginBottom: '5px' },
  input:   { width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  btn:     { padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '7px' },
  chip:    { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  section: { fontSize: '15px', fontWeight: '700', color: C.textPrimary, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' },
}

// Feather-style SVG icons
function Icon({ n, size = 16, color = 'currentColor', style }) {
  const p = {
    'upload-cloud':  '<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>',
    'check-circle':  '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    'alert-circle':  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    file:            '<path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="13 2 13 8 20 8"/>',
    music:           '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    image:           '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    'arrow-left':    '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    send:            '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    loader:          '<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>',
    x:               '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    edit:            '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    book:            '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: p[n] || '' }}
    />
  )
}

// ─── Drop zone component ────────────────────────────────────────────────────
function DropZone({ accept, label, sublabel, icon, onFile, file, loading }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  function handleDrop(e) {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${drag ? C.terre : file ? C.green : '#d0d0d0'}`,
        borderRadius: '12px', padding: '28px 20px', textAlign: 'center',
        cursor: loading ? 'wait' : 'pointer', transition: 'border-color 0.2s',
        background: drag ? '#fff8f0' : file ? '#f0faf4' : '#fafafa',
      }}
    >
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]) }} />
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        {loading
          ? <Icon n="loader" size={28} color={C.terre} style={{ animation: 'spin 1s linear infinite' }} />
          : file
          ? <Icon n="check-circle" size={28} color={C.green} />
          : <Icon n={icon} size={28} color={C.grey} />
        }
      </div>
      <div style={{ fontWeight: '600', fontSize: '14px', color: file ? C.green : C.textPrimary }}>
        {loading ? 'Analyse en cours…' : file ? file.name : label}
      </div>
      <div style={{ fontSize: '12px', color: C.grey, marginTop: '4px' }}>
        {loading ? 'Extraction des métadonnées' : file ? `${(file.size / 1024 / 1024).toFixed(1)} Mo` : sublabel}
      </div>
    </div>
  )
}

// ─── Field component ────────────────────────────────────────────────────────
function Field({ label, required, children, autoFilled, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <label style={S.label}>
        {label}{required && <span style={{ color: C.red }}> *</span>}
        {autoFilled && (
          <span style={{ ...S.chip, background: '#e8f5e9', color: C.green, marginLeft: '8px', fontWeight: '600' }}>
            <Icon n="check-circle" size={11} color={C.green} /> Auto
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function PublisherContentCreate() {
  // Publisher context (passed via sessionStorage from PublishersManager)
  const [publisher, setPublisher] = useState(null)
  const [publishers, setPublishers] = useState([])
  const [publisherId, setPublisherId] = useState('')

  // File state
  const [mainFile, setMainFile]   = useState(null)   // EPUB or audio
  const [audioFile, setAudioFile] = useState(null)   // second audio if contentType = 'both'
  const [coverFile, setCoverFile] = useState(null)

  // Upload state
  const [extracting,      setExtracting]      = useState(false)
  const [uploadingFile,   setUploadingFile]   = useState(false)
  const [uploadingAudio,  setUploadingAudio]  = useState(false)
  const [uploadingCover,  setUploadingCover]  = useState(false)
  const [submitting,      setSubmitting]      = useState(false)

  // Uploaded keys
  const [fileKey,      setFileKey]      = useState('')
  const [audioFileKey, setAudioFileKey] = useState('')
  const [coverUrl,     setCoverUrl]     = useState('')

  // Auto-fill tracking
  const [autoFilled, setAutoFilled] = useState({})

  // Form fields
  const [form, setForm] = useState({
    title: '', author: '', description: '', language: 'fr',
    year: '', isbn: '', contentType: 'ebook',
    accessType: 'subscription', priceCents: '',
    categoryId: '',
  })

  const [categories, setCategories] = useState([])
  const [error, setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Restore publisher from sessionStorage
    const stored = sessionStorage.getItem('publisher_create_context')
    if (stored) {
      try { const p = JSON.parse(stored); setPublisher(p); setPublisherId(p.id) } catch {}
    }
    // Load publishers list for selector
    fetch('/admin/api/publishers', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPublishers(d.publishers || []))
      .catch(() => {})
    // Load categories
    fetch('/admin/api/categories', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCategories(d || []))
      .catch(() => {})
  }, [])

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  // ── Metadata extraction ─────────────────────────────────────────────────
  async function handleMainFile(file) {
    setMainFile(file)
    setExtracting(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/admin/api/extract-metadata', { method: 'POST', credentials: 'include', body: fd })
      const meta = await res.json()
      if (meta.error) { setError(`Extraction: ${meta.error}`); setExtracting(false); return }

      const filled = {}
      const updates = {}
      if (meta.title)       { updates.title       = meta.title;       filled.title = true }
      if (meta.author)      { updates.author      = meta.author;      filled.author = true }
      if (meta.description) { updates.description = meta.description; filled.description = true }
      if (meta.language)    { updates.language    = meta.language;    filled.language = true }
      if (meta.year)        { updates.year        = meta.year;        filled.year = true }
      if (meta.isbn)        { updates.isbn        = meta.isbn;        filled.isbn = true }
      if (meta.contentType) { updates.contentType = meta.contentType; filled.contentType = true }
      if (meta.duration)    { updates._duration   = meta.duration }

      setForm(f => ({ ...f, ...updates }))
      setAutoFilled(filled)
      if (meta.coverUrl) { setCoverUrl(meta.coverUrl); filled.coverUrl = true; setAutoFilled({ ...filled }) }
    } catch (e) {
      setError(`Erreur lors de l'extraction: ${e.message}`)
    }
    setExtracting(false)
  }

  // ── File uploads ────────────────────────────────────────────────────────
  // Returns the file key directly (don't rely on React state for sequencing)
  async function uploadFile(file, setLoading) {
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/admin/api/upload-content', { method: 'POST', credentials: 'include', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      return data.key || data.fileKey || data.url || ''
    } catch (e) {
      setError(`Upload: ${e.message}`)
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleCoverFile(file) {
    setCoverFile(file)
    setUploadingCover(true)
    try {
      const fd = new FormData()
      fd.append('cover', file)
      const res = await fetch('/admin/api/upload-cover', { method: 'POST', credentials: 'include', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCoverUrl(data.url)
    } catch (e) {
      setError(`Upload couverture: ${e.message}`)
    }
    setUploadingCover(false)
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!publisherId)      { setError('Sélectionner un éditeur'); return }
    if (!form.title.trim()) { setError('Le titre est requis'); return }

    setSubmitting(true)
    setError(null)
    try {
      // Upload files if not already done — capture keys directly (React state is async)
      let effectiveFileKey      = fileKey
      let effectiveAudioFileKey = audioFileKey

      const isAudioType = form.contentType === 'audiobook'
      const isBothType  = form.contentType === 'both'

      if (mainFile && !effectiveFileKey) {
        const ext = mainFile.name.split('.').pop().toLowerCase()
        const key = await uploadFile(mainFile, isAudioType ? setUploadingAudio : setUploadingFile)
        if (!key) { setSubmitting(false); return }
        if (isAudioType) {
          setAudioFileKey(key); effectiveAudioFileKey = key
        } else {
          setFileKey(key); effectiveFileKey = key
        }
      }
      if (audioFile && !effectiveAudioFileKey) {
        const key = await uploadFile(audioFile, setUploadingAudio)
        if (!key) { setSubmitting(false); return }
        setAudioFileKey(key); effectiveAudioFileKey = key
      }

      const res = await fetch('/admin/api/publisher-content', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publisherId,
          title:           form.title,
          author:          form.author       || null,
          description:     form.description  || null,
          language:        form.language     || 'fr',
          contentType:     form.contentType,
          coverUrl:        coverUrl          || null,
          fileKey:         effectiveFileKey  || null,
          audioFileKey:    effectiveAudioFileKey || null,
          durationSeconds: form._duration    || null,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuccess(true)
      sessionStorage.removeItem('publisher_create_context')
    } catch (e) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  function goBack() {
    window.history.back()
  }

  const isAudio    = form.contentType === 'audiobook'
  const isBoth     = form.contentType === 'both'
  const needsPrice = form.accessType === 'paid' || form.accessType === 'subscription_or_paid'
  const busy       = extracting || uploadingFile || uploadingAudio || uploadingCover || submitting

  // ── Success screen ───────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ ...S.page, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Icon n="check-circle" size={64} color={C.green} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: C.indigo, margin: '0 0 10px', fontFamily: 'Georgia, serif' }}>
            Contenu soumis
          </h2>
          <p style={{ color: C.textSecondary, fontSize: '15px', marginBottom: '28px' }}>
            Le contenu est en attente de validation. Il apparaîtra dans la file "Validation contenu".
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button style={{ ...S.btn, background: '#f5f5f5', color: C.textPrimary }} onClick={goBack}>
              <Icon n="arrow-left" size={14} color={C.textPrimary} /> Retour
            </button>
            <button style={{ ...S.btn, background: C.terre, color: 'white' }} onClick={() => {
              setSuccess(false); setMainFile(null); setAudioFile(null); setCoverFile(null)
              setFileKey(''); setAudioFileKey(''); setCoverUrl('')
              setAutoFilled({}); setError(null)
              setForm({ title: '', author: '', description: '', language: 'fr', year: '', isbn: '', contentType: 'ebook', accessType: 'subscription', priceCents: '', categoryId: '' })
            }}>
              <Icon n="book" size={14} color="white" /> Nouveau contenu
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <button style={{ ...S.btn, background: '#f5f5f5', color: C.textPrimary }} onClick={goBack}>
          <Icon n="arrow-left" size={14} color={C.textPrimary} /> Retour
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: C.indigo, margin: '0 0 2px', fontFamily: 'Georgia, serif' }}>
            Soumettre un contenu
          </h1>
          {publisher && (
            <p style={{ margin: 0, fontSize: '14px', color: C.textSecondary }}>
              Pour : <strong>{publisher.company_name}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: '#ffebee', border: `1px solid ${C.red}33`, borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#c62828', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon n="alert-circle" size={16} color="#c62828" /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
            <Icon n="x" size={14} color="#c62828" />
          </button>
        </div>
      )}

      {/* Publisher selector (if no context) */}
      {!publisher && (
        <div style={S.card}>
          <div style={S.section}><Icon n="book" size={16} color={C.terre} /> Éditeur</div>
          <Field label="Sélectionner l'éditeur" required>
            <select style={S.input} value={publisherId} onChange={e => setPublisherId(e.target.value)}>
              <option value="">— Choisir un éditeur —</option>
              {publishers.map(p => <option key={p.id} value={p.id}>{p.company_name}</option>)}
            </select>
          </Field>
        </div>
      )}

      {/* Step 1 — File upload + auto-extraction */}
      <div style={S.card}>
        <div style={S.section}><Icon n="upload-cloud" size={16} color={C.terre} /> Fichier principal</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={S.label}>Type de contenu</label>
            <select style={S.input} value={form.contentType} onChange={e => set('contentType', e.target.value)}>
              <option value="ebook">Ebook (EPUB / PDF)</option>
              <option value="audiobook">Audiobook (MP3 / M4A)</option>
              <option value="both">Ebook + Audiobook</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isBoth ? '1fr 1fr' : '1fr', gap: '16px' }}>
          <div>
            <label style={{ ...S.label, marginBottom: '8px' }}>
              {isAudio ? 'Fichier audio' : 'Fichier ebook'}
              {autoFilled.title && (
                <span style={{ ...S.chip, background: '#e8f5e9', color: C.green, marginLeft: '8px' }}>
                  <Icon n="check-circle" size={11} color={C.green} /> Métadonnées extraites
                </span>
              )}
            </label>
            <DropZone
              accept={isAudio ? '.mp3,.m4a,audio/*' : '.epub,application/epub+zip'}
              label={isAudio ? 'Déposer le fichier MP3 ou M4A' : 'Déposer le fichier EPUB'}
              sublabel={isAudio ? 'MP3, M4A — max 500 Mo' : 'EPUB — max 500 Mo'}
              icon={isAudio ? 'music' : 'file'}
              file={mainFile}
              loading={extracting}
              onFile={handleMainFile}
            />
            {mainFile && !fileKey && !isAudio && (
              <button
                style={{ ...S.btn, background: '#f0ede8', color: C.terre, marginTop: '10px', width: '100%', justifyContent: 'center', opacity: uploadingFile ? 0.7 : 1 }}
                onClick={async () => { const k = await uploadFile(mainFile, setUploadingFile); if (k) setFileKey(k) }}
                disabled={uploadingFile}
              >
                {uploadingFile ? <><Icon n="loader" size={14} color={C.terre} /> Upload en cours…</> : <><Icon n="upload-cloud" size={14} color={C.terre} /> Uploader vers R2</>}
              </button>
            )}
            {fileKey && <div style={{ marginTop: '8px', fontSize: '12px', color: C.green, display: 'flex', alignItems: 'center', gap: '5px' }}><Icon n="check-circle" size={13} color={C.green} /> Fichier uploadé</div>}
          </div>

          {isBoth && (
            <div>
              <label style={{ ...S.label, marginBottom: '8px' }}>Fichier audio (version audio)</label>
              <DropZone
                accept=".mp3,.m4a,audio/*"
                label="Déposer le fichier MP3 ou M4A"
                sublabel="MP3, M4A — max 500 Mo"
                icon="music"
                file={audioFile}
                loading={false}
                onFile={async f => { setAudioFile(f); const k = await uploadFile(f, setUploadingAudio); if (k) setAudioFileKey(k) }}
              />
              {audioFileKey && <div style={{ marginTop: '8px', fontSize: '12px', color: C.green, display: 'flex', alignItems: 'center', gap: '5px' }}><Icon n="check-circle" size={13} color={C.green} /> Audio uploadé</div>}
            </div>
          )}
        </div>
      </div>

      {/* Step 2 — Metadata form */}
      <div style={S.card}>
        <div style={S.section}><Icon n="edit" size={16} color={C.terre} /> Informations du contenu</div>
        <div style={{ ...S.row, marginBottom: '14px' }}>
          <Field label="Titre" required autoFilled={autoFilled.title} span={2}>
            <input style={S.input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Titre du livre" />
          </Field>
        </div>
        <div style={{ ...S.row, marginBottom: '14px' }}>
          <Field label="Auteur" autoFilled={autoFilled.author}>
            <input style={S.input} value={form.author} onChange={e => set('author', e.target.value)} placeholder="Prénom Nom" />
          </Field>
          <Field label="Langue" autoFilled={autoFilled.language}>
            <select style={S.input} value={form.language} onChange={e => set('language', e.target.value)}>
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
              <option value="es">Espagnol</option>
              <option value="ar">Arabe</option>
              <option value="de">Allemand</option>
              <option value="pt">Portugais</option>
            </select>
          </Field>
        </div>
        <div style={{ ...S.row, marginBottom: '14px' }}>
          <Field label="Catégorie">
            <select style={S.input} value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
              <option value="">— Choisir —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Année de publication" autoFilled={autoFilled.year}>
            <input style={S.input} type="number" min="1900" max="2099" value={form.year} onChange={e => set('year', e.target.value)} placeholder="2024" />
          </Field>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <Field label="Description / Synopsis" autoFilled={autoFilled.description} span={2}>
            <textarea
              style={{ ...S.input, minHeight: '90px', resize: 'vertical' }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Résumé du contenu…"
            />
          </Field>
        </div>
        <div style={{ ...S.row, marginBottom: '0' }}>
          <Field label="ISBN" autoFilled={autoFilled.isbn}>
            <input style={S.input} value={form.isbn} onChange={e => set('isbn', e.target.value)} placeholder="978-…" />
          </Field>
          {form._duration && (
            <Field label="Durée (détectée)">
              <input style={{ ...S.input, background: '#f5f5f5', color: C.grey }} readOnly
                value={`${Math.floor(form._duration / 60)} min ${form._duration % 60} s`} />
            </Field>
          )}
        </div>
      </div>

      {/* Step 3 — Cover image */}
      <div style={S.card}>
        <div style={S.section}><Icon n="image" size={16} color={C.terre} /> Couverture</div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Preview */}
          <div style={{ width: '180px', height: '250px', borderRadius: '10px', overflow: 'hidden', background: '#f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e0e0e0' }}>
            {coverUrl
              ? <img src={coverUrl} alt="Couverture" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Icon n="image" size={36} color={C.grey} />
            }
          </div>
          {/* Upload zone */}
          <div>
            {autoFilled.coverUrl && (
              <div style={{ ...S.chip, background: '#e8f5e9', color: C.green, marginBottom: '12px' }}>
                <Icon n="check-circle" size={12} color={C.green} /> Couverture extraite automatiquement du fichier
              </div>
            )}
            <DropZone
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              label="Déposer une image de couverture"
              sublabel="JPG, PNG, WebP — max 5 Mo (remplace la couverture extraite)"
              icon="image"
              file={coverFile}
              loading={uploadingCover}
              onFile={handleCoverFile}
            />
          </div>
        </div>
      </div>

      {/* Step 4 — Access & pricing */}
      <div style={S.card}>
        <div style={S.section}><Icon n="book" size={16} color={C.terre} /> Accès & tarification</div>
        <div style={{ ...S.row, alignItems: 'start' }}>
          <Field label="Type d'accès">
            <select style={S.input} value={form.accessType} onChange={e => set('accessType', e.target.value)}>
              <option value="subscription">Abonnement uniquement</option>
              <option value="paid">Achat à l'unité</option>
              <option value="subscription_or_paid">Abonnement ou Achat</option>
            </select>
          </Field>
          {needsPrice && (
            <Field label="Prix (centimes)" required>
              <input style={S.input} type="number" min="0" value={form.priceCents}
                onChange={e => set('priceCents', e.target.value)} placeholder="999 = 9,99 €" />
            </Field>
          )}
        </div>
      </div>

      {/* Submit */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button style={{ ...S.btn, background: '#f5f5f5', color: C.textPrimary }} onClick={goBack} disabled={busy}>
          Annuler
        </button>
        <button
          style={{ ...S.btn, background: C.terre, color: 'white', opacity: busy ? 0.7 : 1, padding: '12px 28px' }}
          onClick={handleSubmit}
          disabled={busy}
        >
          {submitting
            ? <><Icon n="loader" size={15} color="white" /> Soumission…</>
            : <><Icon n="send" size={15} color="white" /> Soumettre pour validation</>
          }
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
