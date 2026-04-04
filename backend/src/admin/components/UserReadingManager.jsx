import React, { useState, useEffect, useRef, useCallback } from 'react'

const C = {
  terre: '#B5651D', or: '#D4A017', indigo: '#2E4057',
  green: '#27ae60', red: '#e74c3c', blue: '#2196F3',
  purple: '#7b1fa2', orange: '#FF9800', grey: '#8c8c8c', lightGrey: '#f0f0f0',
  card: '#ffffff', bg: '#f4f1ec',
  textPrimary: '#1a1a2e', textSecondary: '#6b7280',
}

const S = {
  page:    { width: '100%', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxSizing: 'border-box', background: C.bg, minHeight: '100vh' },
  card:    { background: C.card, borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' },
  btn:     { padding: '9px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btnSm:   { padding: '5px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  btnOut:  { padding: '8px 14px', borderRadius: '10px', border: '1.5px solid', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent' },
  input:   { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  select:  { padding: '10px 14px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: 'white', cursor: 'pointer' },
  label:   { display: 'block', fontSize: '13px', fontWeight: '600', color: C.textSecondary, marginBottom: '5px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal:   { background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '540px', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' },
  thCell:  { padding: '11px 16px', fontSize: '12px', fontWeight: '700', color: C.grey, textTransform: 'uppercase', letterSpacing: '0.4px', background: '#fafafa', whiteSpace: 'nowrap' },
  tdCell:  { padding: '13px 16px', fontSize: '13px', borderBottom: `1px solid ${C.lightGrey}`, verticalAlign: 'middle' },
  tab:     { padding: '10px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', border: 'none', background: 'transparent', borderBottom: '3px solid transparent', transition: 'all 0.15s' },
  row:     { display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' },
  field:   { flex: 1, minWidth: '180px' },
}

const SOURCE_LABELS = {
  quota:       { label: 'Quota abonnement', color: C.blue,   bg: '#e3f2fd' },
  bonus:       { label: 'Bonus',            color: C.or,     bg: '#fff8e1' },
  paid:        { label: 'Achat',            color: C.green,  bg: '#e8f5e9' },
  admin_grant: { label: 'Don admin',        color: C.terre,  bg: '#fff3e0' },
}

function Icon({ n, size = 16, color = 'currentColor', style }) {
  const p = {
    search:         '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    user:           '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'user-check':   '<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
    'user-x':       '<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>',
    edit:           '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    save:           '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    'book-open':    '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>',
    plus:           '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    x:              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    trash:          '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>',
    check:          '<polyline points="20 6 9 17 4 12"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    clock:          '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    calendar:       '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    headphones:     '<path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z"/><path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>',
    'credit-card':  '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'plus-circle':  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    shield:         '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'ban':          '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: p[n] || '' }}
    />
  )
}

function ProgressBar({ percent }) {
  const pct = Math.min(100, Math.max(0, Number(percent) || 0))
  const color = pct >= 100 ? C.green : pct >= 50 ? C.blue : C.terre
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '7px', background: C.lightGrey, borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: '700', color, minWidth: '34px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function SourceChip({ source }) {
  const s = SOURCE_LABELS[source] || { label: source, color: C.grey, bg: C.lightGrey }
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: s.bg, color: s.color }}>{s.label}</span>
}

function BookCover({ url, size = 40 }) {
  if (url) return <img src={url} alt="" style={{ width: size, height: size * 1.4, objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
  return <div style={{ width: size, height: size * 1.4, background: '#f0ede8', borderRadius: '4px', flexShrink: 0 }} />
}

function formatTime(sec) {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function Alert({ type, text, onClose }) {
  const ok = type !== 'error'
  return (
    <div style={{ background: ok ? '#e8f5e9' : '#ffebee', border: `1px solid ${ok ? C.green : C.red}33`, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: ok ? C.green : '#c62828', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Icon n={ok ? 'check-circle' : 'alert-circle'} size={14} color={ok ? C.green : '#c62828'} />
      <span style={{ flex: 1 }}>{text}</span>
      {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.grey }}><Icon n="x" size={14} /></button>}
    </div>
  )
}

// ─── Grant Modal ──────────────────────────────────────────────────────────────
function GrantModal({ userId, onClose, onGranted }) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [granting, setGranting]   = useState(null)
  const [msg, setMsg]             = useState(null)
  const debounce                  = useRef(null)

  function search(q) {
    clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); return }
    debounce.current = setTimeout(() => {
      setSearching(true)
      fetch(`/admin/api/contents-search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => setResults(d.contents || []))
        .catch(() => {})
        .finally(() => setSearching(false))
    }, 300)
  }

  async function grant(content) {
    setGranting(content.id)
    const res = await fetch('/admin/api/user-reading/grant', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, contentId: content.id }),
    }).then(r => r.json())
    setGranting(null)
    if (res.error) { setMsg({ type: 'error', text: res.error }); return }
    setMsg({ type: 'success', text: `Accès accordé : ${content.title}` })
    onGranted(res.unlock)
  }

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: C.indigo, fontSize: '18px' }}>Attribuer l'accès à un livre</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Icon n="x" size={20} color={C.grey} /></button>
        </div>

        {msg && <Alert type={msg.type} text={msg.text} onClose={() => setMsg(null)} />}

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Icon n="search" size={16} color={C.grey} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            style={{ ...S.input, paddingLeft: '38px' }}
            placeholder="Rechercher un titre ou un auteur…"
            value={query}
            onChange={e => { setQuery(e.target.value); search(e.target.value) }}
            autoFocus
          />
        </div>

        {searching && <div style={{ textAlign: 'center', padding: '16px', color: C.grey, fontSize: '13px' }}>Recherche…</div>}

        {results.length > 0 && (
          <div style={{ border: `1px solid ${C.lightGrey}`, borderRadius: '10px', overflow: 'hidden' }}>
            {results.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderBottom: i < results.length - 1 ? `1px solid ${C.lightGrey}` : 'none', background: 'white' }}>
                <BookCover url={c.cover_url} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                  <div style={{ fontSize: '12px', color: C.grey }}>{c.author} · {c.content_type === 'audiobook' ? 'Audio' : 'Ebook'}</div>
                </div>
                <button
                  style={{ ...S.btnSm, background: C.terre, color: 'white', flexShrink: 0, opacity: granting === c.id ? 0.7 : 1 }}
                  onClick={() => grant(c)} disabled={!!granting}
                >
                  {granting === c.id ? '…' : <><Icon n="plus" size={12} color="white" /> Attribuer</>}
                </button>
              </div>
            ))}
          </div>
        )}

        {!searching && query.trim() && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: C.grey, fontSize: '13px' }}>Aucun résultat pour « {query} »</div>
        )}
        {!query.trim() && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.grey, fontSize: '13px' }}>
            <Icon n="search" size={28} color={C.lightGrey} style={{ display: 'block', margin: '0 auto 8px' }} />
            Tapez un titre ou le nom d'un auteur
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab Profil ───────────────────────────────────────────────────────────────
function TabProfile({ profile, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState(null)
  const [form, setForm]       = useState({ display_name: profile.display_name || '', role: profile.role || 'user', is_active: profile.is_active })

  useEffect(() => {
    setForm({ display_name: profile.display_name || '', role: profile.role || 'user', is_active: profile.is_active })
    setEditing(false)
  }, [profile.id])

  async function save() {
    setSaving(true); setMsg(null)
    const res = await fetch(`/admin/api/user-update/${profile.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json())
    setSaving(false)
    if (res.error) { setMsg({ type: 'error', text: res.error }); return }
    setMsg({ type: 'success', text: 'Profil mis à jour.' })
    setEditing(false)
    onUpdated(res.profile)
    setTimeout(() => setMsg(null), 3000)
  }

  const ROLE_OPTIONS = [
    { value: 'user',      label: 'Utilisateur' },
    { value: 'admin',     label: 'Administrateur' },
    { value: 'publisher', label: 'Éditeur' },
  ]

  return (
    <div>
      {msg && <Alert type={msg.type} text={msg.text} onClose={() => setMsg(null)} />}

      <div style={{ ...S.card, padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: C.indigo }}>Informations du compte</h3>
          {!editing && (
            <button style={{ ...S.btnOut, borderColor: C.indigo, color: C.indigo }} onClick={() => setEditing(true)}>
              <Icon n="edit" size={14} color={C.indigo} /> Modifier
            </button>
          )}
        </div>

        {/* Email — toujours readonly */}
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input style={{ ...S.input, background: '#fafafa', color: C.grey }} value={profile.email || ''} readOnly />
          </div>
          <div style={S.field}>
            <label style={S.label}>Nom d'affichage</label>
            {editing
              ? <input style={S.input} value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Nom…" />
              : <input style={{ ...S.input, background: '#fafafa', color: C.textPrimary }} value={profile.display_name || '—'} readOnly />
            }
          </div>
        </div>

        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Rôle</label>
            {editing
              ? (
                <select style={S.select} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )
              : (
                <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fafafa', fontSize: '14px' }}>
                  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700',
                    background: profile.role === 'admin' ? '#ede7f6' : profile.role === 'publisher' ? '#fff8e1' : '#f5f5f5',
                    color: profile.role === 'admin' ? C.purple : profile.role === 'publisher' ? C.or : C.grey,
                  }}>
                    {ROLE_OPTIONS.find(o => o.value === profile.role)?.label || profile.role}
                  </span>
                </div>
              )
            }
          </div>
          <div style={S.field}>
            <label style={S.label}>Statut du compte</label>
            {editing
              ? (
                <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
                  {[{ v: true, label: 'Actif', icon: 'user-check', color: C.green }, { v: false, label: 'Bloqué', icon: 'ban', color: C.red }].map(opt => (
                    <button key={opt.v}
                      style={{ ...S.btn, flex: 1, justifyContent: 'center',
                        background: form.is_active === opt.v ? (opt.v ? '#e8f5e9' : '#ffebee') : '#f5f5f5',
                        color: form.is_active === opt.v ? opt.color : C.grey,
                        border: `2px solid ${form.is_active === opt.v ? opt.color : '#e0e0e0'}`,
                      }}
                      onClick={() => setForm(f => ({ ...f, is_active: opt.v }))}
                    >
                      <Icon n={opt.icon} size={14} color={form.is_active === opt.v ? opt.color : C.grey} /> {opt.label}
                    </button>
                  ))}
                </div>
              )
              : (
                <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fafafa', fontSize: '14px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700',
                    background: profile.is_active ? '#e8f5e9' : '#ffebee', color: profile.is_active ? C.green : C.red }}>
                    <Icon n={profile.is_active ? 'user-check' : 'ban'} size={11} color={profile.is_active ? C.green : C.red} />
                    {profile.is_active ? 'Actif' : 'Bloqué'}
                  </span>
                </div>
              )
            }
          </div>
        </div>

        <div style={{ ...S.row, marginBottom: 0 }}>
          <div style={S.field}>
            <label style={S.label}>ID utilisateur</label>
            <input style={{ ...S.input, background: '#fafafa', color: C.grey, fontSize: '12px', fontFamily: 'monospace' }} value={profile.id || ''} readOnly />
          </div>
          <div style={S.field}>
            <label style={S.label}>Membre depuis</label>
            <input style={{ ...S.input, background: '#fafafa', color: C.grey }} value={profile.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} readOnly />
          </div>
        </div>

        {editing && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${C.lightGrey}` }}>
            <button style={{ ...S.btnOut, borderColor: C.grey, color: C.grey }} onClick={() => { setEditing(false); setForm({ display_name: profile.display_name || '', role: profile.role || 'user', is_active: profile.is_active }) }}>
              Annuler
            </button>
            <button style={{ ...S.btn, background: C.terre, color: 'white', opacity: saving ? 0.7 : 1 }} onClick={save} disabled={saving}>
              {saving ? '…' : <><Icon n="save" size={14} color="white" /> Enregistrer</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab Abonnement ───────────────────────────────────────────────────────────
function TabSubscription({ userId, subscription, onUpdated }) {
  const [extending, setExtending] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [msg, setMsg]             = useState(null)

  async function extend(months) {
    setExtending(true); setMsg(null)
    const res = await fetch('/admin/api/subscription-extend', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, months }),
    }).then(r => r.json())
    setExtending(false)
    if (res.error) { setMsg({ type: 'error', text: res.error }); return }
    setMsg({ type: 'success', text: `Abonnement prolongé de ${months} mois.` })
    onUpdated({ subscription: res.subscription })
    setTimeout(() => setMsg(null), 4000)
  }

  async function cancel() {
    if (!window.confirm('Annuler l\'abonnement actif de cet utilisateur ?')) return
    setCancelling(true); setMsg(null)
    const res = await fetch(`/admin/api/subscription-cancel/${userId}`, {
      method: 'POST', credentials: 'include',
    }).then(r => r.json())
    setCancelling(false)
    if (res.error) { setMsg({ type: 'error', text: res.error }); return }
    setMsg({ type: 'success', text: 'Abonnement annulé.' })
    onUpdated({ subscription: null })
    setTimeout(() => setMsg(null), 3000)
  }

  const PLAN_LABELS = { MONTHLY: 'Mensuel', YEARLY: 'Annuel', monthly: 'Mensuel', yearly: 'Annuel' }

  return (
    <div>
      {msg && <Alert type={msg.type} text={msg.text} onClose={() => setMsg(null)} />}

      {subscription ? (
        <div style={{ ...S.card, padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: C.indigo }}>Abonnement actif</h3>
              <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#e8f5e9', color: C.green }}>
                Actif
              </span>
            </div>
            <Icon n="credit-card" size={28} color={C.terre} />
          </div>

          <div style={S.row}>
            <div style={{ flex: 1, minWidth: '140px', padding: '16px', background: '#f9f9f9', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: C.grey, textTransform: 'uppercase', marginBottom: '4px' }}>Plan</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: C.textPrimary }}>{PLAN_LABELS[subscription.plan_type] || subscription.plan_type}</div>
            </div>
            <div style={{ flex: 1, minWidth: '140px', padding: '16px', background: '#f9f9f9', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: C.grey, textTransform: 'uppercase', marginBottom: '4px' }}>Montant</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: C.textPrimary }}>
                {subscription.amount ? `${Math.round(subscription.amount / 100)} ${subscription.currency || 'XAF'}` : '—'}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '140px', padding: '16px', background: '#f9f9f9', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: C.grey, textTransform: 'uppercase', marginBottom: '4px' }}>Début</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.textPrimary }}>
                {subscription.current_period_start ? new Date(subscription.current_period_start).toLocaleDateString('fr-FR') : '—'}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '140px', padding: '16px', background: '#fff3e0', borderRadius: '12px', border: `1px solid ${C.terre}33` }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: C.terre, textTransform: 'uppercase', marginBottom: '4px' }}>Expire le</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: C.terre }}>
                {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${C.lightGrey}` }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: C.textSecondary, marginBottom: '12px' }}>
              <Icon n="calendar" size={13} style={{ marginRight: '6px' }} />Prolonger l'abonnement
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[{ months: 1, label: '+1 mois' }, { months: 3, label: '+3 mois' }, { months: 6, label: '+6 mois' }, { months: 12, label: '+1 an' }].map(opt => (
                <button key={opt.months}
                  style={{ ...S.btnOut, borderColor: C.blue, color: C.blue, opacity: extending ? 0.6 : 1 }}
                  onClick={() => extend(opt.months)} disabled={extending}
                >
                  {extending ? '…' : opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              style={{ ...S.btnOut, borderColor: C.red, color: C.red, opacity: cancelling ? 0.6 : 1 }}
              onClick={cancel} disabled={cancelling}
            >
              {cancelling ? '…' : <><Icon n="ban" size={14} color={C.red} /> Annuler l'abonnement</>}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
          <Icon n="credit-card" size={40} color={C.lightGrey} style={{ display: 'block', margin: '0 auto 14px' }} />
          <div style={{ fontWeight: '700', color: C.grey, fontSize: '15px', marginBottom: '6px' }}>Aucun abonnement actif</div>
          <div style={{ fontSize: '13px', color: C.grey }}>Cet utilisateur n'a pas d'abonnement en cours.</div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Accès livres ─────────────────────────────────────────────────────────
function TabUnlocks({ userId, unlocks, setUnlocks }) {
  const [grantModal, setGrantModal] = useState(false)
  const [revoking, setRevoking]     = useState(null)
  const [msg, setMsg]               = useState(null)

  async function revoke(unlockId, title) {
    if (!window.confirm(`Retirer l'accès à "${title}" ?\nL'utilisateur ne pourra plus lire ce livre.`)) return
    setRevoking(unlockId)
    const res = await fetch(`/admin/api/user-reading/revoke/${unlockId}`, {
      method: 'DELETE', credentials: 'include',
    }).then(r => r.json())
    setRevoking(null)
    if (res.error) { setMsg({ type: 'error', text: res.error }); return }
    setUnlocks(prev => prev.filter(u => u.id !== unlockId))
    setMsg({ type: 'success', text: `Accès retiré : ${title}` })
    setTimeout(() => setMsg(null), 3000)
  }

  function handleGranted(unlock) {
    setUnlocks(prev => [unlock, ...prev])
    setGrantModal(false)
  }

  return (
    <>
      {msg && <Alert type={msg.type} text={msg.text} onClose={() => setMsg(null)} />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button style={{ ...S.btn, background: C.terre, color: 'white' }} onClick={() => setGrantModal(true)}>
          <Icon n="plus" size={14} color="white" /> Attribuer un livre
        </button>
      </div>

      {unlocks.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '48px' }}>
          <Icon n="book-open" size={36} color={C.lightGrey} style={{ display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontWeight: '600', color: C.grey }}>Aucun accès attribué</div>
          <div style={{ fontSize: '13px', color: C.grey, marginTop: '4px' }}>Cet utilisateur n'a pas encore déverrouillé de livre</div>
        </div>
      ) : (
        <div style={S.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Livre', 'Type', 'Source', 'Attribué le', ''].map((h, i) => (
                  <th key={i} style={{ ...S.thCell, textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unlocks.map(u => {
                const c = u.contents
                return (
                  <tr key={u.id}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={S.tdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BookCover url={c?.cover_url} size={28} />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '13px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.title || '—'}</div>
                          <div style={{ fontSize: '12px', color: C.grey }}>{c?.author}</div>
                        </div>
                      </div>
                    </td>
                    <td style={S.tdCell}>
                      <span style={{ fontSize: '12px', color: C.grey }}>
                        {c?.content_type === 'audiobook' ? <><Icon n="headphones" size={12} style={{ marginRight: '3px' }} />Audio</> : <><Icon n="book-open" size={12} style={{ marginRight: '3px' }} />Ebook</>}
                      </span>
                    </td>
                    <td style={S.tdCell}><SourceChip source={u.source} /></td>
                    <td style={{ ...S.tdCell, fontSize: '12px', color: C.grey }}>
                      {u.unlocked_at ? new Date(u.unlocked_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ ...S.tdCell, textAlign: 'right' }}>
                      <button
                        style={{ ...S.btnSm, background: '#ffebee', color: C.red, opacity: revoking === u.id ? 0.6 : 1 }}
                        onClick={() => revoke(u.id, c?.title)} disabled={revoking === u.id}
                      >
                        {revoking === u.id ? '…' : <><Icon n="trash" size={11} color={C.red} /> Retirer</>}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {grantModal && (
        <GrantModal userId={userId} onClose={() => setGrantModal(false)} onGranted={handleGranted} />
      )}
    </>
  )
}

// ─── Tab Historique ───────────────────────────────────────────────────────────
function TabHistory({ history }) {
  return (
    <>
      {history.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '48px' }}>
          <Icon n="clock" size={36} color={C.lightGrey} style={{ display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontWeight: '600', color: C.grey }}>Aucune lecture enregistrée</div>
        </div>
      ) : (
        <div style={S.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Livre', 'Progression', 'Temps passé', 'Dernière lecture', 'Statut'].map((h, i) => (
                  <th key={i} style={{ ...S.thCell, textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(h => {
                const c = h.contents
                return (
                  <tr key={h.id}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={S.tdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BookCover url={c?.cover_url} size={28} />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.title || '—'}</div>
                          <div style={{ fontSize: '12px', color: C.grey }}>{c?.author}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...S.tdCell, minWidth: '160px' }}><ProgressBar percent={h.progress_percent} /></td>
                    <td style={{ ...S.tdCell, fontSize: '13px', color: C.textSecondary }}>{formatTime(h.total_time_seconds)}</td>
                    <td style={{ ...S.tdCell, fontSize: '12px', color: C.grey }}>
                      {h.last_read_at ? new Date(h.last_read_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td style={S.tdCell}>
                      {h.is_completed
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: '#e8f5e9', color: C.green }}>
                            <Icon n="check" size={10} color={C.green} /> Terminé
                          </span>
                        : <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: '#e3f2fd', color: C.blue }}>En cours</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UserManager() {
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]         = useState(false)
  const [showDropdown, setShowDropdown]   = useState(false)
  const [selectedUser, setSelectedUser]   = useState(null)
  const [data, setData]                   = useState(null)  // { profile, subscription, unlocks, history }
  const [unlocks, setUnlocks]             = useState([])
  const [loadingData, setLoadingData]     = useState(false)
  const [dataError, setDataError]         = useState(null)
  const [tab, setTab]                     = useState('profile')
  const debounce = useRef(null)
  const searchRef = useRef(null)

  function searchUsers(q) {
    clearTimeout(debounce.current)
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return }
    setSearching(true)
    debounce.current = setTimeout(() => {
      fetch(`/admin/api/users-search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => { setSearchResults(d.users || []); setShowDropdown(true) })
        .catch(() => {})
        .finally(() => setSearching(false))
    }, 300)
  }

  function selectUser(user) {
    setSelectedUser(user)
    setSearchQuery(user.email || user.display_name)
    setShowDropdown(false)
    setData(null); setUnlocks([]); setDataError(null); setTab('profile')
    loadUserData(user.id)
  }

  const loadUserData = useCallback((userId) => {
    setLoadingData(true); setDataError(null)
    fetch(`/admin/api/user-reading/${userId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
        setUnlocks(d.unlocks || [])
      })
      .catch(e => setDataError(e.message))
      .finally(() => setLoadingData(false))
  }, [])

  function handleProfileUpdated(updatedProfile) {
    setData(prev => ({ ...prev, profile: updatedProfile }))
  }

  function handleSubUpdated({ subscription }) {
    setData(prev => ({ ...prev, subscription }))
  }

  useEffect(() => {
    function handler(e) { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const TABS = [
    { id: 'profile',      label: 'Profil',           icon: 'user' },
    { id: 'subscription', label: 'Abonnement',        icon: 'credit-card' },
    { id: 'unlocks',      label: `Accès livres${data ? ` (${unlocks.length})` : ''}`,  icon: 'book-open' },
    { id: 'history',      label: `Historique${data ? ` (${data.history?.length || 0})` : ''}`, icon: 'clock' },
  ]

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: C.indigo, margin: '0 0 4px', fontFamily: 'Georgia, serif' }}>
          Gestion des utilisateurs
        </h1>
        <p style={{ fontSize: '14px', color: C.textSecondary, margin: 0 }}>
          Modifier le profil, gérer l'abonnement, attribuer ou retirer l'accès aux livres
        </p>
      </div>

      {/* Recherche */}
      <div style={{ ...S.card, padding: '20px 24px', marginBottom: '24px', overflow: 'visible', position: 'relative', zIndex: 10 }}>
        <label style={{ ...S.label, marginBottom: '10px', fontSize: '14px', color: C.textPrimary }}>Rechercher un utilisateur</label>
        <div ref={searchRef} style={{ position: 'relative', maxWidth: '500px' }}>
          <Icon n="search" size={16} color={C.grey} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
          <input
            style={{ ...S.input, paddingLeft: '40px', paddingRight: searching ? '36px' : '14px' }}
            placeholder="Email ou nom d'affichage…"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); searchUsers(e.target.value) }}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          />
          {searching && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: C.grey }}>…</span>}

          {showDropdown && searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: `1px solid ${C.lightGrey}`, borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
              {searchResults.map((u, i) => (
                <div key={u.id} onClick={() => selectUser(u)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', cursor: 'pointer', borderBottom: i < searchResults.length - 1 ? `1px solid ${C.lightGrey}` : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: C.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>
                    {(u.display_name || u.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name || '—'}</div>
                    <div style={{ fontSize: '12px', color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  </div>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: u.role === 'admin' ? '#ede7f6' : u.role === 'publisher' ? '#fff8e1' : '#f5f5f5', color: u.role === 'admin' ? C.purple : u.role === 'publisher' ? C.or : C.grey, fontWeight: '700', flexShrink: 0 }}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
          {showDropdown && !searching && searchQuery.trim() && searchResults.length === 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: `1px solid ${C.lightGrey}`, borderRadius: '12px', padding: '16px', textAlign: 'center', color: C.grey, fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 100 }}>
              Aucun utilisateur trouvé
            </div>
          )}
        </div>
      </div>

      {/* État vide */}
      {!selectedUser && !loadingData && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.grey }}>
          <Icon n="user" size={48} color={C.lightGrey} style={{ display: 'block', margin: '0 auto 16px' }} />
          <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '6px' }}>Sélectionnez un utilisateur</div>
          <div style={{ fontSize: '13px' }}>Recherchez par email ou nom pour accéder à la gestion complète</div>
        </div>
      )}

      {loadingData && <div style={{ textAlign: 'center', padding: '40px', color: C.grey, fontSize: '14px' }}>Chargement…</div>}

      {dataError && <Alert type="error" text={dataError} />}

      {data && selectedUser && (
        <>
          {/* Bannière utilisateur */}
          <div style={{ ...S.card, padding: '18px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: C.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '18px', flexShrink: 0 }}>
              {(data.profile.display_name || data.profile.email || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '800', fontSize: '16px', color: C.textPrimary }}>{data.profile.display_name || '—'}</div>
              <div style={{ fontSize: '13px', color: C.grey }}>{data.profile.email}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                background: data.profile.is_active ? '#e8f5e9' : '#ffebee',
                color: data.profile.is_active ? C.green : C.red }}>
                {data.profile.is_active ? 'Actif' : 'Bloqué'}
              </span>
              <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                background: data.profile.role === 'admin' ? '#ede7f6' : data.profile.role === 'publisher' ? '#fff8e1' : '#f5f5f5',
                color: data.profile.role === 'admin' ? C.purple : data.profile.role === 'publisher' ? C.or : C.grey }}>
                {data.profile.role}
              </span>
              {data.subscription
                ? <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#e3f2fd', color: C.blue }}>
                    Abonnement actif jusqu'au {new Date(data.subscription.current_period_end).toLocaleDateString('fr-FR')}
                  </span>
                : <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#f5f5f5', color: C.grey }}>
                    Sans abonnement
                  </span>
              }
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: `2px solid ${C.lightGrey}` }}>
            {TABS.map(t => (
              <button key={t.id}
                style={{ ...S.tab, color: tab === t.id ? C.terre : C.grey, borderBottom: `3px solid ${tab === t.id ? C.terre : 'transparent'}` }}
                onClick={() => setTab(t.id)}>
                <Icon n={t.icon} size={13} color={tab === t.id ? C.terre : C.grey} style={{ marginRight: '6px' }} />
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'profile' && (
            <TabProfile profile={data.profile} onUpdated={handleProfileUpdated} />
          )}
          {tab === 'subscription' && (
            <TabSubscription userId={selectedUser.id} subscription={data.subscription} onUpdated={handleSubUpdated} />
          )}
          {tab === 'unlocks' && (
            <TabUnlocks userId={selectedUser.id} unlocks={unlocks} setUnlocks={setUnlocks} />
          )}
          {tab === 'history' && (
            <TabHistory history={data.history || []} />
          )}
        </>
      )}
    </div>
  )
}
