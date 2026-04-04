/**
 * PublisherStatsPage — /publisher/stats
 * Statistiques de lecture par livre (lectures, lecteurs uniques, temps moyen, progression)
 */
import React, { useEffect, useState } from 'react';
import { CircularProgress } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const P   = tokens.colors.primary;
const B   = tokens.colors.accent;
const G   = tokens.colors.secondary;

const S = {
  page:    { minHeight: '100vh', backgroundColor: '#f5f4f1', padding: '28px', fontFamily: 'Inter, -apple-system, sans-serif', boxSizing: 'border-box' },
  header:  { marginBottom: 24 },
  title:   { margin: 0, fontSize: 26, fontWeight: 800, fontFamily: '"Playfair Display", Georgia, serif', color: '#111827' },
  sub:     { margin: '4px 0 0', fontSize: 13, color: '#9ca3af' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 },
  kpiCard: { background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.04)' },
  kpiVal:  { fontSize: 28, fontWeight: 800, color: '#111827', lineHeight: 1.1, marginBottom: 4 },
  kpiLab:  { fontSize: 12, color: '#9ca3af', fontWeight: 500 },
  card:    { background: '#fff', borderRadius: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: 20 },
  cardH:   { padding: '18px 22px', borderBottom: '1px solid #f5f5f5', fontSize: 14, fontWeight: 700, color: '#111827' },
  empty:   { textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 13 },
};

function fmtTime(seconds) {
  if (!seconds) return '0 min';
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', maxWidth: 200 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4, wordBreak: 'break-word' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ fontSize: 12, color: p.fill, fontWeight: 600 }}>
          {p.name === 'reads' ? 'Lectures' : 'Lecteurs uniques'} : {p.value}
        </div>
      ))}
    </div>
  );
};

export default function PublisherStatsPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    authFetch(`${API}/api/publisher/stats/reading`)
      .then(r => r.json())
      .then(d => { if (!d.success) throw new Error(d.message); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <CircularProgress sx={{ color: P }} />
    </div>
  );

  const stats   = data?.stats   || [];
  const totals  = data?.totals  || {};
  const chartData = stats.slice(0, 10).map(s => ({
    name:    s.title.length > 20 ? s.title.slice(0, 18) + '…' : s.title,
    reads:   s.reads,
    readers: s.uniqueReaders,
  }));

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>Statistiques de lecture</h1>
        <p style={S.sub}>Engagement des lecteurs sur vos livres</p>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPIs globaux */}
      <div style={S.kpiGrid}>
        {[
          { label: 'Lectures totales',    value: totals.reads || 0,         color: P },
          { label: 'Lecteurs uniques',    value: totals.uniqueReaders || 0, color: B },
          { label: 'Temps moyen / lecture', value: fmtTime(totals.avgTimeSeconds), color: G },
        ].map((k, i) => (
          <div key={i} style={S.kpiCard}>
            <div style={{ ...S.kpiVal, color: k.color }}>{k.value}</div>
            <div style={S.kpiLab}>{k.label}</div>
          </div>
        ))}
      </div>

      {stats.length === 0 ? (
        <div style={S.card}>
          <div style={S.empty}>
            Aucune donnée de lecture pour le moment.<br />
            <span style={{ fontSize: 12, color: '#d1d5db' }}>Les statistiques apparaissent dès qu'un abonné lit vos livres.</span>
          </div>
        </div>
      ) : (
        <>
          {/* Graphique lectures par livre */}
          <div style={S.card}>
            <div style={S.cardH}>Lectures par livre (top 10)</div>
            <div style={{ padding: '20px 22px 12px' }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RechartTooltip content={<ChartTip />} />
                  <Bar dataKey="reads" name="reads" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? P : `${P}99`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tableau détaillé */}
          <div style={S.card}>
            <div style={S.cardH}>Détail par livre</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['Livre', 'Lectures', 'Lecteurs uniques', 'Temps moyen', 'Progression moy.'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Livre' ? 'left' : 'right', fontSize: 12, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #f0f0f0' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={s.contentId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {s.coverUrl
                            ? <img src={s.coverUrl} alt="" style={{ width: 32, height: 44, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                            : <div style={{ width: 32, height: 44, borderRadius: 4, background: '#f3f4f6', flexShrink: 0 }} />
                          }
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{s.title}</div>
                            {s.author && <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.author}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: P }}>{s.reads}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: B }}>{s.uniqueReaders}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#374151' }}>{fmtTime(s.avgTimeSeconds)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div style={{ width: 60, height: 6, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, background: G, width: `${s.avgProgress}%` }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{s.avgProgress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
