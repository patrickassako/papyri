/**
 * NotificationsTest — Page de test push notifications dans l'admin Papyri
 * Accessible via /admin/pages/test-notifications
 */
import React, { useState, useEffect } from 'react'

// ─── Couleurs Papyri ───
const C = {
  terre: '#B5651D',
  or: '#D4A017',
  indigo: '#2E4057',
  bg: '#f4f1ec',
  card: '#ffffff',
  green: '#27ae60',
  red: '#e74c3c',
  grey: '#8c8c8c',
  lightGrey: '#f0f0f0',
  textPrimary: '#1a1a2e',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
}

const S = {
  page: {
    width: '100%',
    padding: '32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box',
    background: C.bg,
    minHeight: '100vh',
  },
  header: { marginBottom: '28px' },
  headerTitle: { fontSize: '26px', fontWeight: '700', color: C.indigo, margin: '0 0 4px' },
  headerSub: { fontSize: '14px', color: C.textSecondary, margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' },
  card: {
    background: C.card,
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: { fontSize: '13px', fontWeight: '600', color: C.textSecondary, marginBottom: '6px', display: 'block' },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${C.border}`,
    fontSize: '14px',
    color: C.textPrimary,
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '14px',
    background: '#fafafa',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${C.border}`,
    fontSize: '14px',
    color: C.textPrimary,
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '14px',
    background: '#fafafa',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${C.border}`,
    fontSize: '14px',
    color: C.textPrimary,
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '14px',
    background: '#fafafa',
    resize: 'vertical',
    minHeight: '80px',
  },
  btn: (color = C.terre, disabled = false) => ({
    padding: '10px 24px',
    borderRadius: '8px',
    background: disabled ? '#ccc' : color,
    color: '#fff',
    fontWeight: '700',
    fontSize: '14px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.2s',
    width: '100%',
    opacity: disabled ? 0.7 : 1,
  }),
  alert: (type) => ({
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '14px',
    fontSize: '13px',
    fontWeight: '500',
    background: type === 'success' ? '#ecfdf5' : type === 'error' ? '#fef2f2' : '#eff6ff',
    color: type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#1d4ed8',
    border: `1px solid ${type === 'success' ? '#bbf7d0' : type === 'error' ? '#fecaca' : '#bfdbfe'}`,
  }),
  quickBtn: (color) => ({
    padding: '8px 14px',
    borderRadius: '8px',
    background: `${color}15`,
    color: color,
    fontWeight: '600',
    fontSize: '13px',
    border: `1px solid ${color}40`,
    cursor: 'pointer',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
  }),
  tag: (color) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: '600',
    background: `${color}20`,
    color: color,
  }),
  divider: { borderTop: `1px solid ${C.lightGrey}`, margin: '16px 0' },
}

const TYPES = [
  { value: 'system',               label: '🔔 Système',            color: C.grey },
  { value: 'new_content',          label: '📚 Nouveau contenu',     color: C.indigo },
  { value: 'promo',                label: '🎁 Offre spéciale',      color: C.green },
  { value: 'expiration_reminder',  label: '⏰ Rappel abonnement',   color: C.or },
  { value: 'subscription_expired', label: '🔴 Abonnement expiré',   color: C.red },
  { value: 'payment_failed',       label: '💳 Paiement échoué',     color: C.red },
  { value: 'subscription_update',  label: '📋 Mise à jour',         color: C.indigo },
]

const QUICK_TEMPLATES = [
  {
    label: '📚 Nouveau contenu',
    type: 'new_content',
    title: 'Nouveau livre disponible !',
    body: 'Un nouveau titre vient d\'être ajouté à la bibliothèque. Découvrez-le maintenant.',
  },
  {
    label: '🎁 Promo flash',
    type: 'promo',
    title: '48h seulement — Abonnement annuel à -30%',
    body: 'Profitez de notre offre exclusive : abonnement annuel à seulement 35€ jusqu\'à demain soir.',
  },
  {
    label: '⏰ Rappel expiration',
    type: 'expiration_reminder',
    title: 'Votre abonnement expire bientôt',
    body: 'Votre abonnement Papyri expire dans 3 jours. Renouvelez maintenant pour ne pas perdre l\'accès.',
  },
  {
    label: '🔔 Message système',
    type: 'system',
    title: 'Maintenance prévue',
    body: 'Une maintenance est prévue ce soir de 23h à 01h. L\'accès sera temporairement interrompu.',
  },
]

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

// ─── Send Form Component ───
const SendForm = ({ onSent }) => {
  const [form, setForm] = useState({
    target: 'all',
    userEmail: '',
    type: 'system',
    title: '',
    body: '',
    saveToDb: true,
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const applyTemplate = (tpl) => {
    setForm(f => ({ ...f, type: tpl.type, title: tpl.title, body: tpl.body }))
    setResult(null)
  }

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setResult({ type: 'error', message: 'Titre et message sont requis.' })
      return
    }
    if (form.target === 'user' && !form.userEmail.trim()) {
      setResult({ type: 'error', message: 'Veuillez entrer l\'email de l\'utilisateur cible.' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const payload = {
        target: form.target === 'user' ? 'user' : 'all',
        type: form.type,
        title: form.title,
        body: form.body,
        saveToDb: form.saveToDb,
      }
      if (form.target === 'user') payload.userEmail = form.userEmail

      const res = await fetch('/admin/api/notifications/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setResult({ type: 'success', message: data.message || 'Notification envoyée !' })
      if (onSent) onSent()
    } catch (err) {
      setResult({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  const typeColor = TYPES.find(t => t.value === form.type)?.color || C.grey

  return (
    <div>
      {/* Quick templates */}
      <div style={{ marginBottom: '18px' }}>
        <label style={S.label}>Templates rapides</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {QUICK_TEMPLATES.map((tpl) => (
            <button key={tpl.label} style={S.quickBtn(C.terre)} onClick={() => applyTemplate(tpl)}>
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      <div style={S.divider} />

      {/* Target */}
      <label style={S.label}>Destinataires</label>
      <select
        style={S.select}
        value={form.target}
        onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
      >
        <option value="all">Tous les utilisateurs</option>
        <option value="user">Un utilisateur spécifique</option>
      </select>

      {form.target === 'user' && (
        <>
          <label style={S.label}>Email de l'utilisateur</label>
          <input
            style={S.input}
            type="email"
            placeholder="user@example.com"
            value={form.userEmail}
            onChange={e => setForm(f => ({ ...f, userEmail: e.target.value }))}
          />
        </>
      )}

      {/* Type */}
      <label style={S.label}>Type de notification</label>
      <select
        style={{ ...S.select, borderLeft: `4px solid ${typeColor}` }}
        value={form.type}
        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
      >
        {TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Title */}
      <label style={S.label}>Titre</label>
      <input
        style={S.input}
        placeholder="Titre de la notification"
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
      />

      {/* Body */}
      <label style={S.label}>Message</label>
      <textarea
        style={S.textarea}
        placeholder="Contenu du message..."
        value={form.body}
        onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
      />

      {/* Save to DB */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <input
          type="checkbox"
          id="saveToDb"
          checked={form.saveToDb}
          onChange={e => setForm(f => ({ ...f, saveToDb: e.target.checked }))}
          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
        />
        <label htmlFor="saveToDb" style={{ fontSize: '13px', color: C.textSecondary, cursor: 'pointer' }}>
          Sauvegarder dans l'historique in-app
        </label>
      </div>

      {result && (
        <div style={S.alert(result.type)}>
          {result.type === 'success' ? '✅' : '❌'} {result.message}
        </div>
      )}

      <button style={S.btn(C.terre, loading)} onClick={handleSend} disabled={loading}>
        {loading ? '⏳ Envoi en cours...' : '🚀 Envoyer la notification'}
      </button>
    </div>
  )
}

// ─── Recent Notifications Component ───
const RecentNotifications = ({ refresh }) => {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/admin/api/notifications/stats', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setNotifs(data.recent || [])
        setStats(data.stats || null)
      }
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [refresh])

  const typeInfo = (type) => TYPES.find(t => t.value === type) || { label: type, color: C.grey }

  return (
    <div>
      {/* Stats row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total envoyées', value: stats.total || 0, color: C.indigo },
            { label: 'Non lues', value: stats.unread || 0, color: C.or },
            { label: 'Utilisateurs avec push', value: stats.pushEnabled || 0, color: C.green },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: `${color}10`, borderRadius: '10px', padding: '14px',
              border: `1px solid ${color}30`, textAlign: 'center',
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
              <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: C.textSecondary, padding: '32px' }}>Chargement...</div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.textSecondary, padding: '32px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔔</div>
          <div>Aucune notification envoyée</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notifs.map((n, i) => {
            const info = typeInfo(n.type)
            return (
              <div key={i} style={{
                background: '#fafafa', borderRadius: '10px', padding: '12px 14px',
                border: `1px solid ${C.border}`, borderLeft: `4px solid ${info.color}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={S.tag(info.color)}>{info.label}</span>
                      {!n.is_read && <span style={S.tag(C.or)}>non lue</span>}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: C.textPrimary }}>{n.title}</div>
                    <div style={{ fontSize: '13px', color: C.textSecondary, marginTop: '2px', lineHeight: '1.4' }}>{n.body}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: C.textSecondary, marginLeft: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {timeAgo(n.sent_at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button
        style={{ ...S.btn(C.indigo, false), marginTop: '16px', opacity: 0.85 }}
        onClick={load}
      >
        🔄 Actualiser
      </button>
    </div>
  )
}

// ─── Main Page ───
const NotificationsTest = () => {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.headerTitle}>🔔 Test Notifications Push</h1>
        <p style={S.headerSub}>
          Envoyez des notifications push de test à tous les utilisateurs ou à un utilisateur spécifique.
          Les notifications apparaissent dans la cloche de l'app web et comme notification système sur mobile.
        </p>
      </div>

      <div style={S.grid}>
        {/* Left: Send form */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <span style={{ fontSize: '20px' }}>📤</span> Envoyer une notification
          </div>
          <SendForm onSent={() => setRefreshKey(k => k + 1)} />
        </div>

        {/* Right: Recent + stats */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <span style={{ fontSize: '20px' }}>📋</span> Notifications récentes
          </div>
          <RecentNotifications refresh={refreshKey} />
        </div>
      </div>

      {/* Info box */}
      <div style={{
        background: `${C.indigo}08`, border: `1px solid ${C.indigo}25`,
        borderRadius: '12px', padding: '20px 24px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: C.indigo, marginBottom: '10px' }}>
          ℹ️ Comment ça marche
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            { icon: '🌐', title: 'Web (Chrome/Firefox)', desc: 'L\'utilisateur doit avoir autorisé les notifications dans son navigateur. La cloche in-app fonctionne sans Firebase.' },
            { icon: '📱', title: 'Mobile (Expo Go)', desc: 'Fonctionne uniquement sur appareil physique. Le token Expo est enregistré automatiquement à la connexion.' },
            { icon: '🔑', title: 'Firebase requis', desc: 'Les push natifs nécessitent FIREBASE_PROJECT_ID, CLIENT_EMAIL et PRIVATE_KEY dans backend/.env.' },
          ].map(({ icon, title, desc }) => (
            <div key={title}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: C.textPrimary, marginBottom: '4px' }}>{title}</div>
              <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: '1.5' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default NotificationsTest
