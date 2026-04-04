import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, Chip, Avatar, useTheme, useMediaQuery } from '@mui/material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer,
} from 'recharts';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const P = tokens.colors.primary;
const G = tokens.colors.secondary;
const B = tokens.colors.accent;

/* ── Status configs ───────────────────────────────────────────── */
const BOOK_STATUS = {
  approved: { label: 'Publié',     color: '#16a34a', bg: '#dcfce7' },
  pending:  { label: 'En attente', color: '#d97706', bg: '#fef3c7' },
  draft:    { label: 'Brouillon',  color: '#6b7280', bg: '#f3f4f6' },
  rejected: { label: 'Rejeté',     color: '#dc2626', bg: '#fee2e2' },
  paused:   { label: 'Suspendu',   color: '#475569', bg: '#f1f5f9' },
};

const PAYOUT_STATUS = {
  paid:       { label: 'Versé',      color: '#16a34a', bg: '#dcfce7' },
  failed:     { label: 'Échoué',     color: '#dc2626', bg: '#fee2e2' },
  processing: { label: 'En cours',   color: '#d97706', bg: '#fef3c7' },
  pending:    { label: 'En attente', color: '#6b7280', bg: '#f3f4f6' },
};

/* ── Styles CSS-in-JS ─────────────────────────────────────────── */
const S = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f5f4f1',
    fontFamily: 'Inter, -apple-system, sans-serif',
    padding: '28px',
    boxSizing: 'border-box',
  },

  /* Header */
  header: {
    background: `linear-gradient(135deg, ${B} 0%, #1e3a54 50%, #7c3d12 100%)`,
    borderRadius: '20px',
    padding: '28px 32px',
    marginBottom: '24px',
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
  },
  headerDeco1: {
    position: 'absolute', right: -30, top: -30,
    width: 180, height: 180, borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)',
    pointerEvents: 'none',
  },
  headerDeco2: {
    position: 'absolute', right: 80, bottom: -50,
    width: 120, height: 120, borderRadius: '50%',
    background: 'rgba(212,160,23,0.1)',
    pointerEvents: 'none',
  },
  headerTop: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    position: 'relative', zIndex: 1,
  },
  headerTitle: {
    margin: 0, fontSize: 26, fontWeight: 800,
    fontFamily: '"Playfair Display", Georgia, serif',
  },
  headerSub: {
    margin: '4px 0 0', fontSize: 13, opacity: 0.65, textTransform: 'capitalize',
  },
  headerBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: G, color: '#fff', border: 'none',
    padding: '10px 20px', borderRadius: 12, fontWeight: 700,
    fontSize: 14, cursor: 'pointer', flexShrink: 0,
    boxShadow: '0 4px 14px rgba(212,160,23,0.4)',
    transition: 'background .15s, transform .1s',
  },
  headerStats: {
    display: 'flex', gap: 28, flexWrap: 'wrap',
    marginTop: 20, paddingTop: 20,
    borderTop: '1px solid rgba(255,255,255,0.12)',
    position: 'relative', zIndex: 1,
  },
  headerStat: {
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  headerStatLabel: { fontSize: 11, opacity: 0.6, fontWeight: 500 },
  headerStatValue: { fontSize: 15, fontWeight: 800 },

  /* Alert */
  alert: {
    background: '#fef3c7', border: '1px solid #fcd34d',
    borderRadius: 12, padding: '12px 16px',
    marginBottom: 20, display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  alertText: { fontSize: 13, color: '#92400e', fontWeight: 500 },
  alertBtn: {
    background: 'none', border: '1px solid #d97706',
    color: '#d97706', padding: '4px 12px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  },

  /* KPI grid */
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    background: '#fff', borderRadius: 16,
    padding: '20px 22px',
    boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.04)',
    transition: 'transform .15s, box-shadow .15s',
    cursor: 'default',
  },
  kpiIcon: {
    width: 40, height: 40, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, marginBottom: 14,
  },
  kpiValue: {
    fontSize: 22, fontWeight: 800, color: '#111827', lineHeight: 1.1, marginBottom: 4,
  },
  kpiLabel: { fontSize: 12, color: '#9ca3af', fontWeight: 500 },
  kpiSub: { fontSize: 11, color: '#d1d5db', marginTop: 3 },

  /* Body 2-column */
  body: {
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gap: 20,
    alignItems: 'start',
  },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 20 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 16 },

  /* Cards */
  card: {
    background: '#fff', borderRadius: 16,
    boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 22px', borderBottom: '1px solid #f5f5f5',
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#111827' },
  cardLink: {
    background: 'none', border: 'none', color: P,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 3,
  },
  cardBody: { padding: '18px 22px' },

  /* Book row */
  bookRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 22px', cursor: 'pointer',
    transition: 'background .12s',
  },
  bookCover: {
    width: 38, height: 50, borderRadius: 6,
    objectFit: 'cover', flexShrink: 0,
    background: '#f3f4f6', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 16,
  },
  bookTitle: { fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bookAuthor: { fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  /* Payment cards */
  payCard: {
    background: '#fff', borderRadius: 16,
    boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  payCardHead: {
    padding: '14px 18px',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  payCardBody: { padding: '14px 18px' },

  /* Catalogue bar */
  barTrack: {
    height: 6, borderRadius: 4, background: '#f3f4f6',
    marginBottom: 12, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },

  /* Stat row */
  statRow: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  statDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },

  /* Quick actions */
  actionBtn: {
    background: '#fff', border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 12, padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: 10,
    cursor: 'pointer', width: '100%', textAlign: 'left',
    transition: 'background .12s, border-color .12s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, flexShrink: 0,
  },
  actionLabel: { fontSize: 13, fontWeight: 600, color: '#111827' },
  actionArrow: { marginLeft: 'auto', color: '#d1d5db', fontSize: 12 },

  emptyState: {
    textAlign: 'center', padding: '32px 0',
    color: '#9ca3af', fontSize: 13,
  },
};

/* ── Chart tooltip ────────────────────────────────────────────── */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ fontSize: 12, color: p.color, fontWeight: 600 }}>
          {p.name === 'normal' ? 'Ventes' : 'Bonus'} : {Number(p.value).toFixed(2)} CAD
        </div>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════ */
export default function PublisherDashboardPage({ publisher }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('md'));

  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    authFetch(`${API}/api/publisher/dashboard-data`)
      .then(r => r.json())
      .then(d => { if (!d.success) throw new Error(d.message); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: P }} />
      </div>
    );
  }

  const kpis         = data?.kpis         || {};
  const series       = data?.monthlySeries || [];
  const next         = data?.nextPayoutDate;
  const lastPay      = data?.lastPayout;
  const scheduled    = data?.scheduledPayout;
  const books        = data?.recentBooks  || [];
  const byStatus     = data?.booksByStatus || {};
  const lastStatus   = lastPay ? (PAYOUT_STATUS[lastPay.status] || PAYOUT_STATUS.pending) : null;
  const approvedRate = kpis.booksTotal ? Math.round(((kpis.booksTotal - (kpis.booksPending || 0)) / kpis.booksTotal) * 100) : 100;

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  /* Responsive: empile sur mobile */
  const bodyStyle = isSmall
    ? { display: 'flex', flexDirection: 'column', gap: 16 }
    : S.body;
  const kpiStyle = isSmall
    ? { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }
    : S.kpiGrid;

  return (
    <div style={S.page}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={S.header}>
        <div style={S.headerDeco1} />
        <div style={S.headerDeco2} />
        <div style={S.headerTop}>
          <div>
            <h1 style={S.headerTitle}>Bonjour, {publisher?.company_name || 'Éditeur'}</h1>
            <p style={S.headerSub}>{today}</p>
          </div>
          <button style={S.headerBtn} onClick={() => navigate('/publisher/books/new')}>
            <span>＋</span> Ajouter un livre
          </button>
        </div>
        <div style={S.headerStats}>
          {[
            { label: 'Solde à percevoir', value: `${(kpis.pending || 0).toFixed(2)} CAD` },
            { label: 'Revenus totaux',    value: `${(kpis.total   || 0).toFixed(2)} CAD` },
            { label: 'Livres publiés',    value: kpis.booksTotal || 0 },
          ].map((s, i) => (
            <React.Fragment key={i}>
              <div style={S.headerStat}>
                <span style={S.headerStatLabel}>{s.label}</span>
                <span style={S.headerStatValue}>{s.value}</span>
              </div>
              {i < 2 && <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', alignSelf: 'stretch' }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Alert livres en attente ──────────────────────────────── */}
      {kpis.booksPending > 0 && (
        <div style={S.alert}>
          <span style={S.alertText}>
            <strong>{kpis.booksPending} livre{kpis.booksPending > 1 ? 's' : ''}</strong> en attente de validation — délai habituel 24–48h
          </span>
          <button style={S.alertBtn} onClick={() => navigate('/publisher/books')}>Voir</button>
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────────── */}
      <div style={kpiStyle}>
        {[
          { icon: '$', label: 'Solde à percevoir', value: `${(kpis.pending    || 0).toFixed(2)} CAD`, sub: 'Non encore versé',  color: P,        bg: `${P}18` },
          { icon: '↑', label: 'Revenus totaux',    value: `${(kpis.total      || 0).toFixed(2)} CAD`, sub: `Ventes · Bonus`,    color: '#16a34a', bg: '#dcfce7' },
          { icon: '✓', label: 'Total versé',       value: `${(kpis.totalPaid  || 0).toFixed(2)} CAD`, sub: 'Depuis le début',   color: B,        bg: '#dbeafe' },
          { icon: '#', label: 'Livres publiés',    value: kpis.booksTotal || 0,                         sub: kpis.booksPending > 0 ? `${kpis.booksPending} en attente` : 'Catalogue actif', color: G, bg: '#fef3c7' },
        ].map((k, i) => (
          <div key={i} style={S.kpiCard}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.06)'; }}
          >
            <div style={{ ...S.kpiIcon, background: k.bg }}>{k.icon}</div>
            <div style={S.kpiValue}>{k.value}</div>
            <div style={S.kpiLabel}>{k.label}</div>
            {k.sub && <div style={S.kpiSub}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div style={bodyStyle}>

        {/* Colonne gauche */}
        <div style={S.leftCol}>

          {/* Graphique revenus */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.cardTitle}>Évolution des revenus — 6 mois</span>
              <button style={S.cardLink} onClick={() => navigate('/publisher/revenue')}>
                Rapport complet ›
              </button>
            </div>
            <div style={{ padding: '16px 22px 10px' }}>
              {series.length === 0 ? (
                <div style={S.emptyState}>Aucun revenu sur cette période</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                    {[{ color: P, label: 'Ventes' }, { color: G, label: 'Bonus' }].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={series} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={P} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={P} stopOpacity={0}   />
                        </linearGradient>
                        <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={G} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={G} stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={36} />
                      <RechartTooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="normal" stroke={P} strokeWidth={2} fill="url(#gN)" name="normal" dot={false} activeDot={{ r: 4 }} />
                      <Area type="monotone" dataKey="bonus"  stroke={G} strokeWidth={2} fill="url(#gB)" name="bonus"  dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </div>

          {/* Livres récents */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.cardTitle}>Mes derniers livres</span>
              <button style={S.cardLink} onClick={() => navigate('/publisher/books')}>Voir tout ›</button>
            </div>
            {books.length === 0 ? (
              <div style={S.emptyState}>
                Aucun livre — <button style={{ ...S.cardLink, fontSize: 13, padding: 0 }} onClick={() => navigate('/publisher/books/new')}>Ajouter votre premier</button>
              </div>
            ) : (
              books.map((book, i) => {
                const st = BOOK_STATUS[book.validation_status] || BOOK_STATUS.draft;
                return (
                  <div key={book.id}
                    style={{ ...S.bookRow, borderTop: i === 0 ? 'none' : '1px solid #f5f5f5' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#faf7f3'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                    onClick={() => navigate(`/publisher/books/${book.id}`)}
                  >
                    <div style={{ ...S.bookCover, background: book.cover_url ? 'transparent' : '#f3f4f6' }}>
                      {book.cover_url
                        ? <img src={book.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                        : <span style={{ fontSize: 11, color: '#9ca3af' }}>{book.content_type === 'audiobook' ? 'Audio' : 'Livre'}</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.bookTitle}>{book.title}</div>
                      {book.author && <div style={S.bookAuthor}>{book.author}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: st.bg, color: st.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {st.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Colonne droite */}
        <div style={S.rightCol}>

          {/* Prochain versement */}
          <div style={S.payCard}>
            <div style={{ ...S.payCardHead, background: `linear-gradient(135deg, ${P}, #8B4513)` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Prochain versement</span>
              {scheduled && (
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>
                  Auto
                </span>
              )}
            </div>
            <div style={S.payCardBody}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
                {next
                  ? new Date(next + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'}
              </div>
              {scheduled && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>Planifié automatiquement</div>}
              <div style={{ background: '#faf7f2', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f0ede8', marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{scheduled ? 'Montant planifié' : 'Montant estimé'}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: P }}>
                    {(scheduled ? Number(scheduled.amount_cad) : (kpis.pending || 0)).toFixed(2)} CAD
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Solde actuel</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{(kpis.pending || 0).toFixed(2)} CAD</div>
                </div>
              </div>
            </div>
          </div>

          {/* Dernier versement */}
          <div style={S.payCard}>
            <div style={{ ...S.payCardHead, borderBottom: '1px solid #f5f5f5' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Dernier versement</span>
            </div>
            <div style={S.payCardBody}>
              {lastPay ? (
                <>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: lastStatus.bg, color: lastStatus.color }}>
                    {lastStatus.label}
                  </span>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '10px 0 4px' }}>
                    {Number(lastPay.amount_cad).toFixed(2)} CAD
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {new Date(lastPay.paid_at || lastPay.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '12px 0' }}>
                  <div style={{ fontSize: 13 }}>Aucun versement encore</div>
                </div>
              )}
            </div>
          </div>

          {/* Statut du catalogue */}
          {kpis.booksTotal > 0 && (
            <div style={S.payCard}>
              <div style={{ ...S.payCardHead, borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Statut du catalogue</span>
              </div>
              <div style={S.payCardBody}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Livres approuvés</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>{approvedRate}%</span>
                </div>
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: `${approvedRate}%`, background: '#16a34a' }} />
                </div>
                {Object.entries(byStatus).filter(([, v]) => v > 0).map(([status, count]) => {
                  const s = BOOK_STATUS[status] || BOOK_STATUS.draft;
                  return (
                    <div key={status} style={S.statRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ ...S.statDot, background: s.color }} />
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions rapides */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { emoji: '↑', label: 'Voir mes revenus',  color: '#16a34a', bg: '#dcfce7', path: '/publisher/revenue' },
              { emoji: '+', label: 'Ajouter un livre',  color: P,         bg: `${P}18`, path: '/publisher/books/new' },
              { emoji: '·', label: 'Mon profil',        color: B,         bg: '#dbeafe', path: '/publisher/profile' },
            ].map(a => (
              <button key={a.path} style={S.actionBtn} onClick={() => navigate(a.path)}
                onMouseEnter={e => { e.currentTarget.style.background = '#faf7f3'; e.currentTarget.style.borderColor = `${a.color}40`; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.07)'; }}
              >
                <div style={{ ...S.actionIcon, background: a.bg }}>{a.emoji}</div>
                <span style={S.actionLabel}>{a.label}</span>
                <span style={S.actionArrow}>›</span>
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
