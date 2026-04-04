import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Snackbar } from '@mui/material';
import ePub from 'epubjs';
import * as pdfjsLib from 'pdfjs-dist';
import { adminGetBook, adminApproveContent, adminRejectContent, adminPauseContent, adminResetContent, adminUpdateBookMetadata } from '../../services/publisher.service';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/* ── Palette ─────────────────────────────────────────────── */
const C = {
  terre: tokens.colors.primary, indigo: tokens.colors.accent,
  green: '#27ae60', red: '#e74c3c', orange: '#FF9800', grey: '#8c8c8c',
  lightGrey: '#f0f0f0', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
};

const VSTATUS = {
  pending:  { label: 'En attente', color: C.orange, bg: '#FFF3E0' },
  approved: { label: 'Approuvé',   color: C.green,  bg: '#E8F5E9' },
  rejected: { label: 'Rejeté',     color: C.red,    bg: '#FFEBEE' },
  paused:   { label: 'En pause',   color: C.grey,   bg: '#F5F5F5' },
};

/* ── Styles partagés ─────────────────────────────────────── */
const S = {
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontWeight: 700, fontSize: 13,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    transition: 'opacity .15s',
  },
  chip: {
    display: 'inline-block', padding: '3px 10px',
    borderRadius: 20, fontSize: 12, fontWeight: 700,
  },
  row: (i, total) => ({
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '9px 14px',
    background: i % 2 === 0 ? '#fafafa' : '#fff',
    borderBottom: i < total - 1 ? '1px solid #f0ede8' : 'none',
  }),
};

/* ── Helpers formulaire ──────────────────────────────────── */
const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #e0e0e0', fontSize: 13, boxSizing: 'border-box',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  outline: 'none',
};
function EditLabel({ children }) {
  return <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, mb: 0.5 }}>{children}</Typography>;
}
function EditField({ label, value, onChange, type = 'text' }) {
  return (
    <Box>
      <EditLabel>{label}</EditLabel>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Main page                                                   */
/* ─────────────────────────────────────────────────────────── */
export default function AdminBookDetailPage() {
  const { publisherId, bookId } = useParams();
  const navigate = useNavigate();

  const [book,        setBook]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState('');
  const [fileBuffer,  setFileBuffer]  = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileErr,     setFileErr]     = useState('');
  const [pdfUrl,      setPdfUrl]      = useState(null);

  const [status,       setStatus]       = useState('');
  const [pendingAction,setPendingAction] = useState(null); // 'reject' | null
  const [reason,       setReason]       = useState('');
  const [actLoading,   setActLoading]   = useState(false);
  const [actMsg,       setActMsg]       = useState(null);

  // Mode édition
  const [editing,     setEditing]     = useState(false);
  const [editForm,    setEditForm]    = useState({});
  const [editSaving,  setEditSaving]  = useState(false);
  const [editMsg,     setEditMsg]     = useState(null);
  const [liveContent, setLiveContent] = useState(null); // métadonnées à jour après save
  const [toc,         setToc]         = useState([]); // table des matières extraite du fichier
  const [tocOpen,     setTocOpen]     = useState(true);
  const [pdfPageNum,  setPdfPageNum]  = useState(null);
  const epubNavRef = useRef(null); // ref vers EPUBReader pour navigation

  /* ── Load metadata ── */
  useEffect(() => { load(); }, [bookId]); // eslint-disable-line

  async function load() {
    setLoading(true); setErr('');
    try {
      const { book: b } = await adminGetBook(bookId);
      setBook(b);
      setStatus(b.validation_status || 'pending');
      setReason(b.rejection_reason || '');
      const ct = b.contents || {};
      setLiveContent(ct);
      setEditForm({
        title: ct.title || '',
        author: ct.author || '',
        description: ct.description || '',
        language: ct.language || 'fr',
        access_type: ct.access_type || 'subscription',
        is_purchasable: Boolean(ct.is_purchasable),
        price_cents: ct.price_cents != null ? String(ct.price_cents) : '',
        price_currency: ct.price_currency || 'EUR',
        subscription_discount_percent: ct.subscription_discount_percent != null ? String(ct.subscription_discount_percent) : '',
        cover_url: ct.cover_url || '',
      });
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  /* ── Load file ── */
  useEffect(() => {
    if (!book?.contents?.format) return;
    loadFile();
  }, [book]); // eslint-disable-line

  async function loadFile() {
    setFileLoading(true); setFileErr(''); setToc([]);
    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await authFetch(`${API}/api/admin/books/${bookId}/file`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const buf = await res.arrayBuffer();
      setFileBuffer(buf);

      const fmt = book?.contents?.format;

      // Extraire TDM EPUB
      if (fmt === 'epub' || (!fmt && book?.contents?.content_type === 'ebook')) {
        try {
          const epubBook = ePub(buf.slice(0));
          await epubBook.loaded.navigation;
          const items = epubBook.navigation?.toc || [];
          function flatToc(list, depth = 0) {
            return list.flatMap(item => [
              { id: item.id, label: (item.label || '').trim(), href: item.href, depth },
              ...flatToc(item.subitems || [], depth + 1),
            ]);
          }
          setToc(flatToc(items));
          epubBook.destroy();
        } catch (_) { /* TDM non disponible */ }
      }

      // Extraire TDM PDF
      if (fmt === 'pdf') {
        try {
          const blob = new Blob([buf], { type: 'application/pdf' });
          setPdfUrl(URL.createObjectURL(blob));
          const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
          const outline = await pdf.getOutline();
          async function flatOutline(list, depth = 0) {
            if (!list) return [];
            const result = [];
            for (let i = 0; i < list.length; i++) {
              const item = list[i];
              let pageNum = null;
              try {
                const dest = typeof item.dest === 'string'
                  ? await pdf.getDestination(item.dest)
                  : item.dest;
                if (dest) pageNum = (await pdf.getPageIndex(dest[0])) + 1;
              } catch (_) {}
              result.push({ id: `${depth}-${i}`, label: item.title || '—', depth, pageNum });
              result.push(...await flatOutline(item.items, depth + 1));
            }
            return result;
          }
          setToc(await flatOutline(outline));
        } catch (_) { /* outline non disponible */ }
      }
    } catch (e) { setFileErr(e.message); }
    finally { setFileLoading(false); }
  }

  // Cleanup PDF blob URL on unmount
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  /* ── Download ── */
  function handleDownload() {
    if (!fileBuffer) return;
    const c   = book?.contents || {};
    const ext = c.format || 'bin';
    const name = `${(c.title || 'livre').replace(/[^a-z0-9]/gi, '_')}.${ext}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([fileBuffer]));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  }

  /* ── Sauvegarde édition ── */
  async function saveEdit() {
    setEditMsg(null);
    const needsPrice = editForm.access_type !== 'subscription' && editForm.access_type !== 'free';
    const priceCents = editForm.price_cents !== '' ? parseInt(editForm.price_cents, 10) : null;
    if (needsPrice && (!priceCents || isNaN(priceCents) || priceCents <= 0)) {
      setEditMsg({ type: 'error', text: `Le type "${editForm.access_type}" exige un prix > 0 (en centimes, ex: 990 = 9,90 EUR).` });
      return;
    }
    setEditSaving(true);
    try {
      const payload = {
        title:       editForm.title.trim()       || undefined,
        author:      editForm.author.trim()      || undefined,
        description: editForm.description.trim() || undefined,
        language:    editForm.language           || undefined,
        access_type: editForm.access_type        || undefined,
        is_purchasable: needsPrice ? true : editForm.is_purchasable,
        price_cents:    needsPrice ? priceCents : (editForm.price_cents !== '' ? priceCents : undefined),
        price_currency: editForm.price_currency || 'EUR',
        subscription_discount_percent: editForm.subscription_discount_percent !== ''
          ? parseInt(editForm.subscription_discount_percent, 10) : 0,
        cover_url: editForm.cover_url.trim() || undefined,
      };
      const { content } = await adminUpdateBookMetadata(bookId, payload);
      setLiveContent(prev => ({ ...prev, ...content }));
      setEditing(false);
      setEditMsg({ type: 'success', text: 'Modifications enregistrées.' });
    } catch (e) {
      setEditMsg({ type: 'error', text: e.message });
    } finally {
      setEditSaving(false);
    }
  }

  /* ── Admin actions ── */
  async function doAction(action) {
    if ((action === 'reject' || action === 'pause') && !reason.trim()) {
      setActMsg({ type: 'error', text: 'Veuillez saisir un motif.' }); return;
    }
    setActLoading(true); setActMsg(null);
    try {
      const MESSAGES = {
        approve: 'Contenu approuvé et publié.',
        reject:  'Contenu rejeté.',
        pause:   'Contenu mis en pause.',
        pending: 'Contenu remis en attente.',
      };
      if (action === 'approve')      await adminApproveContent(bookId);
      else if (action === 'reject')  await adminRejectContent(bookId, reason.trim());
      else if (action === 'pause')   await adminPauseContent(bookId, reason.trim());
      else if (action === 'pending') await adminResetContent(bookId);
      const newStatus = action === 'pending' ? 'pending' : action === 'approve' ? 'approved' : action;
      setStatus(newStatus); setPendingAction(null); setReason('');
      setActMsg({ type: 'success', text: MESSAGES[action] });
    } catch (e) { setActMsg({ type: 'error', text: e.message }); }
    finally { setActLoading(false); }
  }

  /* ── States ── */
  if (loading) return (
    <Box sx={{ p: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
      <CircularProgress size={20} />
      <Typography>Chargement…</Typography>
    </Box>
  );
  if (err || !book) return (
    <Box sx={{ p: 4 }}>
      <Alert severity="error">{err || 'Livre introuvable.'}</Alert>
      <button style={{ ...S.btn, marginTop: 16, background: C.lightGrey, color: C.textPrimary }}
        onClick={() => navigate(-1)}>← Retour</button>
    </Box>
  );

  const c   = liveContent     || book.contents || {};
  const pub = book.publishers || {};
  const vs  = VSTATUS[status] || VSTATUS.pending;
  const isAudio = ['mp3', 'm4a', 'audiobook'].includes(c.format) || c.content_type === 'audiobook';
  const isPDF   = c.format === 'pdf';
  const isEPUB  = !isAudio && !isPDF;
  const langLabel = { fr: 'Français', en: 'Anglais', ar: 'Arabe', es: 'Espagnol', pt: 'Portugais', de: 'Allemand', it: 'Italien' }[c.language] || c.language || '—';

  const accessTypeLabel = {
    subscription:          'Abonnement',
    paid:                  'Achat direct',
    subscription_or_paid:  'Abo. ou Achat',
    free:                  'Gratuit',
  }[c.access_type] || c.access_type || '—';

  const metaRows = [
    ['Éditeur',       pub.company_name],
    ['Type',          isAudio ? 'Audiobook' : 'Ebook'],
    ['Format',        (c.format || '—').toUpperCase()],
    ['Langue',        langLabel],
    ['Type de vente', accessTypeLabel],
    c.price_cents != null
      ? ['Prix de base', `${(c.price_cents / 100).toFixed(2)} ${c.price_currency || 'EUR'}`]
      : null,
    c.subscription_discount_percent
      ? ['Remise abonnés', `${c.subscription_discount_percent} %`]
      : null,
    c.duration_seconds
      ? ['Durée', `${Math.floor(c.duration_seconds / 60)} min`]
      : null,
    ['Soumis le',     book.submitted_at ? new Date(book.submitted_at).toLocaleDateString('fr-FR') : '—'],
    book.reviewed_at
      ? [status === 'approved' ? 'Approuvé le' : 'Examiné le', new Date(book.reviewed_at).toLocaleDateString('fr-FR')]
      : null,
    ['Publié',        c.is_published ? 'Oui' : 'Non'],
    c.file_key ? ['Clé R2', c.file_key] : null,
  ].filter(Boolean);

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 56px)', /* 56px = AdminHeader */
      overflow: 'hidden',
      bgcolor: '#f4f1ec',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>

      {/* ── Barre du haut ─────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        px: 3, height: 60, flexShrink: 0,
        bgcolor: '#fff', borderBottom: '1px solid #e5e0d8',
      }}>
        {/* Retour */}
        <button style={{ ...S.btn, background: C.lightGrey, color: C.textPrimary, flexShrink: 0 }}
          onClick={() => navigate(`/admin/publishers/${publisherId}`)}>
          ← Retour
        </button>

        {/* Titre + auteur */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, overflow: 'hidden' }}>
          <Typography sx={{
            fontWeight: 800, fontSize: 17, color: C.indigo,
            fontFamily: 'Georgia, serif',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {c.title || 'Sans titre'}
          </Typography>
          {c.author && (
            <Typography sx={{ fontSize: 14, color: C.textSecondary, whiteSpace: 'nowrap', flexShrink: 0 }}>
              — {c.author}
            </Typography>
          )}
        </Box>

        {/* Badges */}
        <span style={{ ...S.chip, background: vs.color + '20', color: vs.color, flexShrink: 0 }}>
          {vs.label}
        </span>
        <span style={{ ...S.chip, background: '#f0ede8', color: '#5d4037', flexShrink: 0 }}>
          {(c.format || (isAudio ? 'Audio' : 'Ebook')).toUpperCase()}
        </span>

        {/* Télécharger */}
        <button
          style={{ ...S.btn, background: C.lightGrey, color: C.textPrimary, flexShrink: 0, opacity: fileBuffer ? 1 : 0.4 }}
          disabled={!fileBuffer}
          onClick={handleDownload}
        >
          ↓ Télécharger
        </button>
      </Box>

      {/* ── Corps : lecteur + sidebar ──────────────────────── */}
      <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', overflow: 'hidden' }}>

        {/* ── Gauche : TDM + lecteur ── */}
        <Box sx={{ display: 'flex', overflow: 'hidden' }}>

          {/* Panel TDM latéral gauche */}
          {toc.length > 0 && !isAudio && (
            <TocSidePanel
              toc={toc}
              open={tocOpen}
              onToggle={() => setTocOpen(o => !o)}
              onNavigate={item => {
                if (isEPUB && item.href)    epubNavRef.current?.navigateTo(item.href);
                if (isPDF  && item.pageNum) setPdfPageNum(item.pageNum);
              }}
            />
          )}

          {/* Lecteur */}
          <Box sx={{ flex: 1, overflow: 'hidden', bgcolor: isAudio ? '#1a1a2e' : '#fff', position: 'relative' }}>
          {fileLoading && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, bgcolor: isAudio ? '#1a1a2e' : '#fff' }}>
              <CircularProgress sx={{ color: isAudio ? '#555' : C.terre }} />
              <Typography variant="body2" sx={{ color: isAudio ? '#888' : '#999' }}>
                Chargement du fichier {(c.format || '').toUpperCase()}…
              </Typography>
            </Box>
          )}
          {fileErr && (
            <Box sx={{ p: 4 }}>
              <Alert severity="warning">{fileErr}</Alert>
            </Box>
          )}
          {!fileLoading && !fileErr && (
            <>
              {isEPUB  && fileBuffer && <EPUBReader ref={epubNavRef} buffer={fileBuffer} />}
              {isPDF   && pdfUrl     && <PDFViewer  url={pdfUrl} pageNum={pdfPageNum} />}
              {isAudio && fileBuffer && <AudioPlayer buffer={fileBuffer} title={c.title} author={c.author} cover={c.cover_url} />}
              {!fileBuffer && !fileLoading && !fileErr && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography color="text.secondary">Aucun fichier disponible.</Typography>
                </Box>
              )}
            </>
          )}
          </Box> {/* fin lecteur */}
        </Box> {/* fin TDM + lecteur */}

        {/* ── Droite : infos + actions ── */}
        <Box sx={{ borderLeft: '1px solid #e5e0d8', overflowY: 'auto', bgcolor: '#fff' }}>

          {/* Couverture + titre + bouton Modifier */}
          {!isAudio && (
            <Box sx={{ p: '20px 24px', borderBottom: '1px solid #f0ede8', display: 'flex', gap: 2, alignItems: 'flex-start', bgcolor: '#fdf8f3' }}>
              {c.cover_url
                ? <Box component="img" src={c.cover_url} alt=""
                    sx={{ width: 64, height: 92, objectFit: 'cover', borderRadius: 1.5, boxShadow: '0 4px 12px rgba(0,0,0,.2)', flexShrink: 0 }}
                    onError={e => { e.target.style.display = 'none'; }} />
                : <Box sx={{ width: 64, height: 92, bgcolor: '#f0ede8', borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📖</Box>
              }
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: C.indigo, fontFamily: 'Georgia, serif', lineHeight: 1.3, mb: 0.5 }}>
                  {c.title || '—'}
                </Typography>
                {c.author && <Typography sx={{ fontSize: 13, color: C.textSecondary, mb: 0.75 }}>{c.author}</Typography>}
                <span style={{ ...S.chip, background: vs.color + '20', color: vs.color, fontSize: 11 }}>{vs.label}</span>
              </Box>
              {/* Bouton Modifier */}
              <button
                onClick={() => { setEditing(e => !e); setEditMsg(null); }}
                style={{ ...S.btn, padding: '6px 12px', fontSize: 11, flexShrink: 0,
                  background: editing ? C.terre + '18' : '#f0ede8',
                  color: C.terre, border: `1px solid ${C.terre}44` }}>
                ✏ {editing ? 'Annuler' : 'Modifier'}
              </button>
            </Box>
          )}

          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* Feedback édition */}
            {editMsg && (
              <Box sx={{
                p: '10px 14px', borderRadius: 2, fontSize: 13,
                bgcolor: editMsg.type === 'error' ? '#ffebee' : '#e8f5e9',
                border: `1px solid ${editMsg.type === 'error' ? '#ef9a9a' : '#a5d6a7'}`,
                color: editMsg.type === 'error' ? '#c62828' : '#2e7d32',
              }}>
                {editMsg.text}
              </Box>
            )}

            {/* Formulaire d'édition */}
            {editing && (
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: C.terre, textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
                  Modification du livre
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
                  <EditField label="Titre" value={editForm.title} onChange={v => setEditForm(f => ({ ...f, title: v }))} />
                  <EditField label="Auteur" value={editForm.author} onChange={v => setEditForm(f => ({ ...f, author: v }))} />
                </Box>

                <Box sx={{ mb: 1 }}>
                  <EditLabel>Description</EditLabel>
                  <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
                  <Box>
                    <EditLabel>Langue</EditLabel>
                    <select value={editForm.language} onChange={e => setEditForm(f => ({ ...f, language: e.target.value }))} style={inputStyle}>
                      {[['fr','Français'],['en','Anglais'],['ar','Arabe'],['es','Espagnol'],['pt','Portugais'],['de','Allemand'],['it','Italien']].map(([v,l]) =>
                        <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Box>
                  <Box>
                    <EditLabel>Type de vente</EditLabel>
                    <select value={editForm.access_type} onChange={e => setEditForm(f => ({ ...f, access_type: e.target.value }))} style={inputStyle}>
                      <option value="subscription">Abonnement</option>
                      <option value="paid">Achat direct</option>
                      <option value="subscription_or_paid">Abo. ou Achat</option>
                      <option value="free">Gratuit</option>
                    </select>
                  </Box>
                </Box>

                {editForm.access_type !== 'subscription' && editForm.access_type !== 'free' && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
                    <Box>
                      <EditLabel>Prix (centimes) *</EditLabel>
                      <input type="number" min="0" placeholder="ex: 990" style={inputStyle}
                        value={editForm.price_cents} onChange={e => setEditForm(f => ({ ...f, price_cents: e.target.value }))} />
                      {editForm.price_cents && !isNaN(parseInt(editForm.price_cents)) && (
                        <Typography sx={{ fontSize: 11, color: C.terre, mt: 0.25 }}>
                          = {(parseInt(editForm.price_cents)/100).toFixed(2)} {editForm.price_currency}
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      <EditLabel>Devise</EditLabel>
                      <select value={editForm.price_currency} onChange={e => setEditForm(f => ({ ...f, price_currency: e.target.value }))} style={inputStyle}>
                        {['EUR','USD','XAF','XOF','GBP','CAD','MAD','TND'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Box>
                  </Box>
                )}

                <Box sx={{ mb: 1 }}>
                  <EditLabel>URL de couverture</EditLabel>
                  <input type="url" placeholder="https://…" style={inputStyle}
                    value={editForm.cover_url} onChange={e => setEditForm(f => ({ ...f, cover_url: e.target.value }))} />
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                  <button style={{ ...S.btn, flex: 1, justifyContent: 'center', background: C.lightGrey, color: C.textPrimary }}
                    onClick={() => { setEditing(false); setEditMsg(null); }}>
                    Annuler
                  </button>
                  <button style={{ ...S.btn, flex: 1, justifyContent: 'center', background: C.terre, color: '#fff', opacity: editSaving ? 0.6 : 1 }}
                    disabled={editSaving} onClick={saveEdit}>
                    {editSaving ? '…' : '✓ Enregistrer'}
                  </button>
                </Box>
              </Box>
            )}

            {/* Description (lecture seule) */}
            {!editing && c.description && (
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>Description</Typography>
                <Typography sx={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.7, bgcolor: '#fdf8f3', borderRadius: 2, p: '12px 14px' }}>
                  {c.description}
                </Typography>
              </Box>
            )}

            {/* Métadonnées */}
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>Informations</Typography>
              <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #f0ede8' }}>
                {metaRows.map(([label, value], i) => (
                  <Box key={label} sx={S.row(i, metaRows.length)}>
                    <Typography sx={{ fontSize: 12, color: C.grey, fontWeight: 600 }}>{label}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, textAlign: 'right', wordBreak: 'break-word', maxWidth: 200 }}>{value || '—'}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Séparateur */}
            <Box sx={{ borderTop: '2px solid #f0ede8' }} />

            {/* ── Décision Admin ── */}
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.indigo, textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
                Décision Admin
              </Typography>

              {/* Feedback */}
              {actMsg && (
                <Box sx={{
                  p: '11px 14px', borderRadius: 2, mb: 1.5, fontSize: 13,
                  bgcolor: actMsg.type === 'error' ? '#ffebee' : '#e8f5e9',
                  border: `1px solid ${actMsg.type === 'error' ? '#ef9a9a' : '#a5d6a7'}`,
                  color: actMsg.type === 'error' ? '#c62828' : '#2e7d32',
                }}>
                  {actMsg.text}
                </Box>
              )}

              {/* Statut actuel — badge grand */}
              <Box sx={{ p: '14px 16px', borderRadius: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: vs.bg, border: `1px solid ${vs.color}40` }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: vs.color, flexShrink: 0, boxShadow: `0 0 0 3px ${vs.color}30` }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 10, color: C.grey, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Statut actuel</Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: vs.color, lineHeight: 1.2 }}>{vs.label}</Typography>
                </Box>
              </Box>

              {/* Motif affiché (rejet ou pause) */}
              {(status === 'rejected' || status === 'paused') && book.rejection_reason && !pendingAction && (
                <Box sx={{ bgcolor: status === 'rejected' ? '#fff5f5' : '#f9f9f9', border: `1px solid ${vs.color}33`, borderRadius: 2, p: '10px 14px', mb: 2 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: vs.color, textTransform: 'uppercase', mb: 0.5, letterSpacing: 0.4 }}>
                    {status === 'rejected' ? 'Motif du rejet' : 'Raison de la pause'}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: C.textPrimary, lineHeight: 1.6 }}>{book.rejection_reason}</Typography>
                </Box>
              )}

              {/* Formulaire motif (rejet ou pause) */}
              {(pendingAction === 'reject' || pendingAction === 'pause') && (
                <Box sx={{ borderRadius: 2, p: 2, mb: 2,
                  bgcolor: pendingAction === 'reject' ? '#fff5f5' : '#f9f9f9',
                  border: `1px solid ${pendingAction === 'reject' ? C.red : C.grey}33`,
                }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, mb: 1 }}>
                    {pendingAction === 'reject' ? 'Motif du rejet *' : 'Raison de la pause (optionnel)'}
                  </Typography>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={pendingAction === 'reject'
                      ? 'Expliquez le motif de rejet (visible par l\'éditeur)…'
                      : 'Ex : en cours de vérification des droits…'}
                    autoFocus
                    style={{
                      width: '100%', minHeight: 72, padding: '9px 12px',
                      borderRadius: 8, border: '1px solid #e0e0e0',
                      fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
                      fontFamily: 'inherit', outline: 'none', marginBottom: 10,
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <button style={{ ...S.btn, flex: 1, justifyContent: 'center', background: C.lightGrey, color: C.textPrimary }}
                      onClick={() => { setPendingAction(null); setReason(''); }}>
                      Annuler
                    </button>
                    <button
                      style={{ ...S.btn, flex: 1, justifyContent: 'center', opacity: actLoading ? 0.6 : 1,
                        background: pendingAction === 'reject' ? C.red : '#607D8B', color: '#fff' }}
                      disabled={actLoading || (pendingAction === 'reject' && !reason.trim())}
                      onClick={() => doAction(pendingAction)}>
                      {actLoading ? '…' : 'Confirmer'}
                    </button>
                  </Box>
                </Box>
              )}

              {/* Grille 2×2 des 4 statuts */}
              {!pendingAction && (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  {[
                    { key: 'pending',  label: '⏳ En attente', color: C.orange, bg: '#FFF3E0', action: () => doAction('pending') },
                    { key: 'approved', label: '✓ Approuver',   color: C.green,  bg: '#E8F5E9', action: () => doAction('approve') },
                    { key: 'paused',   label: '⏸ Pause',       color: '#607D8B', bg: '#ECEFF1', action: () => { setPendingAction('pause'); setReason(''); } },
                    { key: 'rejected', label: '✕ Rejeter',      color: C.red,    bg: '#FFEBEE', action: () => { setPendingAction('reject'); setReason(''); } },
                  ].map(({ key, label, color, bg, action }) => {
                    const isCurrent = status === key;
                    return (
                      <button key={key}
                        style={{
                          ...S.btn, justifyContent: 'center', padding: '10px 8px', fontSize: 12,
                          background: isCurrent ? bg : C.lightGrey,
                          color: isCurrent ? color : C.textSecondary,
                          border: `1px solid ${isCurrent ? color + '55' : '#e0e0e0'}`,
                          fontWeight: isCurrent ? 800 : 500,
                          opacity: actLoading ? 0.5 : 1,
                          outline: isCurrent ? `2px solid ${color}33` : 'none',
                          outlineOffset: 1,
                        }}
                        disabled={actLoading || isCurrent}
                        onClick={action}>
                        {label}
                      </button>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* ── Chapitres audio ── */}
            {c.id && (c.content_type === 'audiobook' || c.content_type === 'both') && (
              <ChaptersPanel contentId={c.id} />
            )}

            {/* ── Prix & Restrictions Géographiques ── */}
            {c.id && <GeoPanel contentId={c.id} />}

          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  TocSidePanel — Table des matières (panneau gauche)          */
/* ─────────────────────────────────────────────────────────── */

function TocSidePanel({ toc, open, onToggle, onNavigate }) {
  const [activeId, setActiveId] = useState(null);

  function handleClick(item) {
    setActiveId(item.id);
    onNavigate(item);
  }

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      width: open ? 240 : 36,
      flexShrink: 0,
      borderRight: '1px solid #e8e3db',
      bgcolor: '#fdfaf6',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      height: '100%',
    }}>
      {/* Toggle button */}
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: open ? 'space-between' : 'center',
          px: open ? 1.5 : 0, py: 1.2, flexShrink: 0,
          borderBottom: '1px solid #ede8e0',
          bgcolor: '#f7f3ee', cursor: 'pointer',
          '&:hover': { bgcolor: '#f0ebe3' },
        }}>
        {open && (
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: C.terre, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>
            📑 Table des matières
          </Typography>
        )}
        <Typography sx={{ fontSize: 14, color: C.grey, lineHeight: 1 }}>
          {open ? '◀' : '▶'}
        </Typography>
      </Box>

      {/* Liste */}
      {open && (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {toc.map((item, idx) => (
            <Box
              key={item.id || idx}
              onClick={() => handleClick(item)}
              sx={{
                display: 'flex', alignItems: 'center',
                pl: `${10 + item.depth * 12}px`, pr: 1.5, py: '7px',
                cursor: 'pointer',
                borderBottom: '1px solid #f2ede6',
                bgcolor: activeId === item.id ? `${C.terre}18` : 'transparent',
                borderLeft: activeId === item.id ? `3px solid ${C.terre}` : '3px solid transparent',
                '&:hover': { bgcolor: `${C.terre}10` },
              }}>
              {item.depth > 0 && (
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: `${C.terre}66`, mr: 0.8, flexShrink: 0 }} />
              )}
              <Typography sx={{
                fontSize: item.depth === 0 ? 12 : 11,
                fontWeight: item.depth === 0 ? 700 : 400,
                color: activeId === item.id ? C.terre : item.depth === 0 ? C.textPrimary : C.textSecondary,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}>
                {item.label}
              </Typography>
              {item.pageNum && (
                <Typography sx={{ ml: 'auto', fontSize: 10, color: '#bbb', flexShrink: 0, pl: 0.5 }}>
                  {item.pageNum}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  ChaptersPanel — Chapitres audio                            */
/* ─────────────────────────────────────────────────────────── */

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function chapCall(path, opts = {}) {
  return authFetch(`${API}/api/admin${path}`, opts).then(r => r.json());
}

function fmtDuration(s) {
  if (!s) return '';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function ChaptersPanel({ contentId }) {
  const [chapters,  setChapters]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editId,    setEditId]    = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [saving,    setSaving]    = useState(false);
  const [adding,    setAdding]    = useState(false);
  const [newTitle,  setNewTitle]  = useState('');
  const [newFile,   setNewFile]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'error' });
  const showError = (msg) => setSnack({ open: true, msg, severity: 'error' });

  async function load() {
    setLoading(true);
    try {
      const data = await chapCall(`/content/${contentId}/chapters`);
      setChapters(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [contentId]); // eslint-disable-line

  async function saveTitle(id) {
    setSaving(true);
    try {
      await chapCall(`/content/chapters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle }),
      });
      setChapters(prev => prev.map(c => c.id === id ? { ...c, title: editTitle } : c));
      setEditId(null);
    } finally { setSaving(false); }
  }

  async function deleteChapter(id) {
    if (!window.confirm('Supprimer ce chapitre ?')) return;
    await chapCall(`/content/chapters/${id}`, { method: 'DELETE' });
    setChapters(prev => prev.filter(c => c.id !== id));
  }

  async function moveChapter(id, dir) {
    const idx = chapters.findIndex(c => c.id === id);
    const next = idx + dir;
    if (next < 0 || next >= chapters.length) return;
    const arr = [...chapters];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    // Mettre à jour les positions
    await Promise.all([
      chapCall(`/content/chapters/${arr[idx].id}`,  { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: idx + 1 }) }),
      chapCall(`/content/chapters/${arr[next].id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: next + 1 }) }),
    ]);
    setChapters(arr.map((c, i) => ({ ...c, position: i + 1 })));
  }

  async function handleAddFile(file) {
    setNewFile(file); setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await authFetch(`${API}/api/admin/upload-content`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Créer le chapitre
      const position = chapters.length + 1;
      const title = newTitle || `Chapitre ${position}`;
      const ch = await chapCall(`/content/${contentId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, fileKey: data.key, position }),
      });
      setChapters(prev => [...prev, ch]);
      setNewTitle(''); setNewFile(null); setAdding(false);
    } catch (e) { showError(e.message); }
    finally { setUploading(false); }
  }

  return (
    <Box sx={{ mt: 2, border: '1px solid #f0ede8', borderRadius: '14px', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.5, bgcolor: '#fdf8f4', borderBottom: '1px solid #f0ede8' }}>
        <Typography sx={{ fontWeight: 800, fontSize: 13, color: C.indigo }}>
          🎵 Chapitres ({chapters.length})
        </Typography>
        <button
          style={{ ...S.btn, padding: '4px 12px', background: C.terre, color: '#fff', fontSize: 12 }}
          onClick={() => setAdding(a => !a)}>
          {adding ? '✕ Annuler' : '+ Ajouter'}
        </button>
      </Box>

      {/* Formulaire ajout */}
      {adding && (
        <Box sx={{ px: 2, py: 1.5, bgcolor: '#fffdf9', borderBottom: '1px solid #f0ede8', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <input
            placeholder="Titre du chapitre (optionnel)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
          />
          <input ref={fileRef} type="file" accept=".mp3,.m4a,audio/*" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && handleAddFile(e.target.files[0])} />
          <button
            style={{ ...S.btn, background: uploading ? C.lightGrey : '#e8f5e9', color: uploading ? C.grey : C.green, justifyContent: 'center', opacity: uploading ? 0.7 : 1 }}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}>
            {uploading ? '⏳ Upload en cours…' : '☁ Choisir fichier audio (MP3/M4A)'}
          </button>
        </Box>
      )}

      {/* Liste */}
      {loading ? (
        <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={20} sx={{ color: C.terre }} />
        </Box>
      ) : chapters.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: '#bbb' }}>Aucun chapitre</Typography>
        </Box>
      ) : (
        chapters.map((ch, idx) => (
          <Box key={ch.id} sx={{
            display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
            borderBottom: idx < chapters.length - 1 ? '1px solid #f5f0eb' : 'none',
            bgcolor: idx % 2 === 0 ? '#fafafa' : '#fff',
            '&:hover': { bgcolor: '#fff8f2' },
          }}>
            {/* Numéro */}
            <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: `${C.terre}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: C.terre }}>{idx + 1}</Typography>
            </Box>

            {/* Titre / edit */}
            {editId === ch.id ? (
              <input
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(ch.id); if (e.key === 'Escape') setEditId(null); }}
                style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 13 }}
              />
            ) : (
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ch.title}
                </Typography>
                {ch.duration_seconds && (
                  <Typography sx={{ fontSize: 11, color: C.grey }}>{fmtDuration(ch.duration_seconds)}</Typography>
                )}
              </Box>
            )}

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              {editId === ch.id ? (
                <>
                  <button style={{ ...S.btn, padding: '3px 8px', background: '#e8f5e9', color: C.green, fontSize: 11 }}
                    onClick={() => saveTitle(ch.id)} disabled={saving}>✓</button>
                  <button style={{ ...S.btn, padding: '3px 8px', background: C.lightGrey, color: C.grey, fontSize: 11 }}
                    onClick={() => setEditId(null)}>✕</button>
                </>
              ) : (
                <>
                  <button style={{ ...S.btn, padding: '3px 6px', background: 'transparent', color: '#aaa', fontSize: 13 }}
                    onClick={() => { setEditId(ch.id); setEditTitle(ch.title); }} title="Renommer">✏</button>
                  <button style={{ ...S.btn, padding: '3px 6px', background: 'transparent', color: '#ccc', fontSize: 13 }}
                    onClick={() => moveChapter(ch.id, -1)} disabled={idx === 0} title="Monter">↑</button>
                  <button style={{ ...S.btn, padding: '3px 6px', background: 'transparent', color: '#ccc', fontSize: 13 }}
                    onClick={() => moveChapter(ch.id, 1)} disabled={idx === chapters.length - 1} title="Descendre">↓</button>
                  <button style={{ ...S.btn, padding: '3px 6px', background: 'transparent', color: '#ffb3b3', fontSize: 13 }}
                    onClick={() => deleteChapter(ch.id)} title="Supprimer">🗑</button>
                </>
              )}
            </Box>
          </Box>
        ))
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  GeoPanel — Prix & Restrictions géographiques               */
/* ─────────────────────────────────────────────────────────── */

const GEO_ZONES = [
  { value: 'africa',        label: 'Afrique' },
  { value: 'europe',        label: 'Europe' },
  { value: 'north_america', label: 'Amérique du Nord' },
  { value: 'south_america', label: 'Amérique du Sud' },
  { value: 'asia',          label: 'Asie' },
  { value: 'middle_east',   label: 'Moyen-Orient' },
  { value: 'oceania',       label: 'Océanie' },
];
const GEO_COUNTRIES = [
  { value: 'CM', label: 'Cameroun' }, { value: 'SN', label: 'Sénégal' },
  { value: 'CI', label: "Côte d'Ivoire" }, { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' }, { value: 'MA', label: 'Maroc' },
  { value: 'DZ', label: 'Algérie' }, { value: 'TN', label: 'Tunisie' },
  { value: 'EG', label: 'Égypte' }, { value: 'ZA', label: 'Afrique du Sud' },
  { value: 'CD', label: 'Congo-Kinshasa' }, { value: 'ET', label: 'Éthiopie' },
  { value: 'KE', label: 'Kenya' }, { value: 'TZ', label: 'Tanzanie' },
  { value: 'FR', label: 'France' }, { value: 'BE', label: 'Belgique' },
  { value: 'CH', label: 'Suisse' }, { value: 'CA', label: 'Canada' },
  { value: 'US', label: 'États-Unis' }, { value: 'GB', label: 'Royaume-Uni' },
  { value: 'DE', label: 'Allemagne' }, { value: 'PT', label: 'Portugal' },
  { value: 'BR', label: 'Brésil' }, { value: 'AE', label: 'Émirats arabes unis' },
];
const GEO_CURRENCIES = ['EUR', 'USD', 'XAF', 'XOF', 'GBP', 'CAD', 'MAD', 'TND'];

function geoCall(path, options = {}) {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  return authFetch(`${API}/api/admin${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }).then(r => r.json());
}

function GeoPanel({ contentId }) {
  const [tab,            setTab]            = useState(0); // 0=prix 1=restrictions
  const [pricing,        setPricing]        = useState([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [showPriceForm,  setShowPriceForm]  = useState(false);
  const [pForm,          setPForm]          = useState({ type: 'zone', zone: '', country: '', price: '', currency: 'EUR' });
  const [pSaving,        setPSaving]        = useState(false);
  const [geoConfig,      setGeoConfig]      = useState(null);
  const [geoZones,       setGeoZones]       = useState([]);
  const [geoLoading,     setGeoLoading]     = useState(true);
  const [showZoneForm,   setShowZoneForm]   = useState(false);
  const [zForm,          setZForm]          = useState({ type: 'zone', zone: '', country: '', reason: '' });
  const [zSaving,        setZSaving]        = useState(false);

  useEffect(() => {
    loadPricing();
    loadRestrictions();
  }, [contentId]); // eslint-disable-line

  async function loadPricing() {
    setPricingLoading(true);
    const r = await geoCall(`/content/${contentId}/geo-pricing`);
    setPricing(Array.isArray(r.prices) ? r.prices : []);
    setPricingLoading(false);
  }
  async function loadRestrictions() {
    setGeoLoading(true);
    const r = await geoCall(`/content/${contentId}/geo-restrictions`);
    setGeoConfig(r.config || null);
    setGeoZones(Array.isArray(r.zones) ? r.zones : []);
    setGeoLoading(false);
  }

  async function addPricing() {
    const key = pForm.type === 'country' ? pForm.country : pForm.zone;
    const labelMap = pForm.type === 'country' ? GEO_COUNTRIES : GEO_ZONES;
    const label = labelMap.find(x => x.value === key)?.label || key;
    if (!key || !pForm.price) return;
    setPSaving(true);
    await geoCall(`/content/${contentId}/geo-pricing`, {
      method: 'POST',
      body: JSON.stringify({ zone: key, zone_label: label, price_cents: Math.round(parseFloat(pForm.price) * 100), currency: pForm.currency, is_active: true }),
    });
    setPSaving(false); setShowPriceForm(false); setPForm({ type: 'zone', zone: '', country: '', price: '', currency: 'EUR' });
    loadPricing();
  }

  async function deletePricing(id) {
    await geoCall(`/content/geo-pricing/${id}`, { method: 'DELETE' });
    loadPricing();
  }

  async function setMode(mode) {
    await geoCall(`/content/${contentId}/geo-restrictions/config`, { method: 'POST', body: JSON.stringify({ mode }) });
    loadRestrictions();
  }

  async function removeAllRestrictions() {
    if (!window.confirm('Supprimer toutes les restrictions géographiques ?')) return;
    await geoCall(`/content/${contentId}/geo-restrictions`, { method: 'DELETE' });
    loadRestrictions();
  }

  async function addZone() {
    const key = zForm.type === 'country' ? zForm.country : zForm.zone;
    const labelMap = zForm.type === 'country' ? GEO_COUNTRIES : GEO_ZONES;
    const label = labelMap.find(x => x.value === key)?.label || key;
    if (!key) return;
    setZSaving(true);
    await geoCall(`/content/${contentId}/geo-restrictions/zones`, {
      method: 'POST',
      body: JSON.stringify({ zone: key, zone_label: label, is_active: true, reason: zForm.reason || null }),
    });
    setZSaving(false); setShowZoneForm(false); setZForm({ type: 'zone', zone: '', country: '', reason: '' });
    loadRestrictions();
  }

  async function toggleZone(z) {
    await geoCall(`/content/geo-restrictions/zones/${z.id}`, {
      method: 'PUT', body: JSON.stringify({ is_active: !z.is_active }),
    });
    loadRestrictions();
  }

  async function deleteZone(id) {
    await geoCall(`/content/geo-restrictions/zones/${id}`, { method: 'DELETE' });
    loadRestrictions();
  }

  const usedPricingKeys = pricing.map(p => p.zone);
  const usedZoneKeys    = geoZones.map(z => z.zone);
  const isWhitelist     = geoConfig?.mode === 'whitelist';

  const tabStyle = (i) => ({
    padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: tab === i ? 700 : 500,
    color: tab === i ? C.terre : C.grey,
    borderBottom: `2px solid ${tab === i ? C.terre : 'transparent'}`,
    fontFamily: 'inherit',
  });

  return (
    <Box>
      <Box sx={{ borderTop: '2px solid #f0ede8', pt: 2.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.indigo, textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
          🌍 Géolocalisation
        </Typography>

        {/* Onglets */}
        <Box sx={{ display: 'flex', borderBottom: '1px solid #f0ede8', mb: 2 }}>
          <button style={tabStyle(0)} onClick={() => setTab(0)}>Prix par zone</button>
          <button style={tabStyle(1)} onClick={() => setTab(1)}>Restrictions d'accès</button>
        </Box>

        {/* ── Onglet Prix ── */}
        {tab === 0 && (
          <Box>
            {pricingLoading
              ? <Typography sx={{ fontSize: 12, color: C.grey, textAlign: 'center', py: 2 }}>Chargement…</Typography>
              : pricing.length === 0
                ? <Typography sx={{ fontSize: 12, color: C.grey, textAlign: 'center', py: 1.5 }}>Aucun prix spécifique. Prix global appliqué.</Typography>
                : (
                  <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #f0ede8', mb: 1.5 }}>
                    {pricing.map((p, i) => (
                      <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '9px 12px', bgcolor: i % 2 === 0 ? '#fafafa' : '#fff', borderBottom: i < pricing.length - 1 ? '1px solid #f0ede8' : 'none' }}>
                        <Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.textPrimary }}>{p.zone_label || p.zone}</Typography>
                          <Typography sx={{ fontSize: 11, color: C.grey }}>{(p.price_cents / 100).toFixed(2)} {p.currency}</Typography>
                        </Box>
                        <button onClick={() => deletePricing(p.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 16, padding: '2px 6px' }}>✕</button>
                      </Box>
                    ))}
                  </Box>
                )
            }

            {/* Formulaire ajout prix */}
            {showPriceForm ? (
              <Box sx={{ bgcolor: '#fdf8f3', borderRadius: 2, p: 1.5, border: '1px solid #e5e0d8' }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  {['zone', 'country'].map(t => (
                    <button key={t} onClick={() => setPForm(f => ({ ...f, type: t }))}
                      style={{ ...S.btn, flex: 1, justifyContent: 'center', fontSize: 11, padding: '5px 8px',
                        background: pForm.type === t ? C.terre : C.lightGrey, color: pForm.type === t ? '#fff' : C.textPrimary }}>
                      {t === 'zone' ? 'Continent' : 'Pays'}
                    </button>
                  ))}
                </Box>
                <select value={pForm.type === 'country' ? pForm.country : pForm.zone}
                  onChange={e => setPForm(f => pForm.type === 'country' ? { ...f, country: e.target.value } : { ...f, zone: e.target.value })}
                  style={{ ...inputStyle, marginBottom: 8, fontSize: 12 }}>
                  <option value="">Sélectionner…</option>
                  {(pForm.type === 'country' ? GEO_COUNTRIES : GEO_ZONES)
                    .filter(x => !usedPricingKeys.includes(x.value))
                    .map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <input type="number" min="0" step="0.01" placeholder="Prix (ex: 9.90)"
                    value={pForm.price} onChange={e => setPForm(f => ({ ...f, price: e.target.value }))}
                    style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
                  <select value={pForm.currency} onChange={e => setPForm(f => ({ ...f, currency: e.target.value }))}
                    style={{ ...inputStyle, width: 80, fontSize: 12 }}>
                    {GEO_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <button style={{ ...S.btn, flex: 1, justifyContent: 'center', background: C.lightGrey, color: C.textPrimary, fontSize: 12 }}
                    onClick={() => setShowPriceForm(false)}>Annuler</button>
                  <button style={{ ...S.btn, flex: 1, justifyContent: 'center', background: C.terre, color: '#fff', fontSize: 12, opacity: pSaving ? 0.6 : 1 }}
                    disabled={pSaving} onClick={addPricing}>{pSaving ? '…' : 'Ajouter'}</button>
                </Box>
              </Box>
            ) : (
              <button style={{ ...S.btn, width: '100%', justifyContent: 'center', background: C.lightGrey, color: C.textPrimary, fontSize: 12 }}
                onClick={() => setShowPriceForm(true)}>+ Ajouter un prix géographique</button>
            )}
          </Box>
        )}

        {/* ── Onglet Restrictions ── */}
        {tab === 1 && (
          <Box>
            {/* Mode whitelist / blacklist */}
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              {[['blacklist', 'Liste noire (bloquer)'], ['whitelist', 'Liste blanche (autoriser)']].map(([m, l]) => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ ...S.btn, flex: 1, justifyContent: 'center', fontSize: 11, padding: '6px',
                    background: geoConfig?.mode === m ? C.indigo : C.lightGrey,
                    color: geoConfig?.mode === m ? '#fff' : C.textPrimary }}>
                  {l}
                </button>
              ))}
            </Box>

            {geoConfig && (
              <Typography sx={{ fontSize: 11, color: C.grey, mb: 1.5, textAlign: 'center' }}>
                Mode actuel : <strong style={{ color: C.indigo }}>{isWhitelist ? 'Liste blanche' : 'Liste noire'}</strong>
                {' — '}{isWhitelist ? 'seules les zones listées peuvent accéder' : 'les zones listées sont bloquées'}
              </Typography>
            )}

            {geoLoading
              ? <Typography sx={{ fontSize: 12, color: C.grey, textAlign: 'center', py: 2 }}>Chargement…</Typography>
              : geoZones.length === 0
                ? <Typography sx={{ fontSize: 12, color: C.grey, textAlign: 'center', py: 1.5 }}>Aucune restriction. Accessible partout.</Typography>
                : (
                  <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #f0ede8', mb: 1.5 }}>
                    {geoZones.map((z, i) => (
                      <Box key={z.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '9px 12px', bgcolor: i % 2 === 0 ? '#fafafa' : '#fff', borderBottom: i < geoZones.length - 1 ? '1px solid #f0ede8' : 'none' }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.textPrimary }}>{z.zone_label || z.zone}</Typography>
                          {z.reason && <Typography sx={{ fontSize: 11, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.reason}</Typography>}
                        </Box>
                        <button onClick={() => toggleZone(z)}
                          style={{ background: 'none', border: `1px solid ${z.is_active ? C.green : '#ccc'}`, borderRadius: 20, padding: '2px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: z.is_active ? C.green : C.grey }}>
                          {z.is_active ? 'Actif' : 'Inactif'}
                        </button>
                        <button onClick={() => deleteZone(z.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 16, padding: '2px 4px' }}>✕</button>
                      </Box>
                    ))}
                  </Box>
                )
            }

            {/* Formulaire ajout zone */}
            {showZoneForm ? (
              <Box sx={{ bgcolor: '#fdf8f3', borderRadius: 2, p: 1.5, border: '1px solid #e5e0d8', mb: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  {['zone', 'country'].map(t => (
                    <button key={t} onClick={() => setZForm(f => ({ ...f, type: t }))}
                      style={{ ...S.btn, flex: 1, justifyContent: 'center', fontSize: 11, padding: '5px 8px',
                        background: zForm.type === t ? C.terre : C.lightGrey, color: zForm.type === t ? '#fff' : C.textPrimary }}>
                      {t === 'zone' ? 'Continent' : 'Pays'}
                    </button>
                  ))}
                </Box>
                <select value={zForm.type === 'country' ? zForm.country : zForm.zone}
                  onChange={e => setZForm(f => zForm.type === 'country' ? { ...f, country: e.target.value } : { ...f, zone: e.target.value })}
                  style={{ ...inputStyle, marginBottom: 8, fontSize: 12 }}>
                  <option value="">Sélectionner…</option>
                  {(zForm.type === 'country' ? GEO_COUNTRIES : GEO_ZONES)
                    .filter(x => !usedZoneKeys.includes(x.value))
                    .map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
                <input placeholder="Raison (optionnel)" value={zForm.reason}
                  onChange={e => setZForm(f => ({ ...f, reason: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: 8, fontSize: 12 }} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <button style={{ ...S.btn, flex: 1, justifyContent: 'center', background: C.lightGrey, color: C.textPrimary, fontSize: 12 }}
                    onClick={() => setShowZoneForm(false)}>Annuler</button>
                  <button style={{ ...S.btn, flex: 1, justifyContent: 'center', background: C.terre, color: '#fff', fontSize: 12, opacity: zSaving ? 0.6 : 1 }}
                    disabled={zSaving} onClick={addZone}>{zSaving ? '…' : 'Ajouter'}</button>
                </Box>
              </Box>
            ) : (
              <button style={{ ...S.btn, width: '100%', justifyContent: 'center', background: C.lightGrey, color: C.textPrimary, fontSize: 12 }}
                onClick={() => setShowZoneForm(true)}>+ Ajouter une zone</button>
            )}

            {/* Supprimer toutes */}
            {(geoZones.length > 0 || geoConfig) && (
              <button onClick={removeAllRestrictions}
                style={{ ...S.btn, width: '100%', justifyContent: 'center', background: '#ffebee', color: C.red, fontSize: 11, marginTop: 6 }}>
                Supprimer toutes les restrictions
              </button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  EPUB Reader                                                 */
/* ─────────────────────────────────────────────────────────── */
const EPUBReader = forwardRef(function EPUBReader({ buffer }, ref) {
  const viewerId = useRef('epub-viewer-' + Math.random().toString(36).slice(2));
  const bookRef  = useRef(null);
  const rendRef  = useRef(null);
  const [ready,   setReady]   = useState(false);
  const [epubErr, setEpubErr] = useState('');

  useImperativeHandle(ref, () => ({
    navigateTo: (href) => { try { rendRef.current?.display(href); } catch (_) {} },
  }));

  useEffect(() => {
    if (!buffer) return;
    let mounted = true;
    const id = viewerId.current;

    const raf = requestAnimationFrame(() => {
      if (!mounted) return;
      try {
        const book = ePub(buffer); // ArrayBuffer directement
        bookRef.current = book;

        book.on('openFailed', (e) => {
          if (mounted) setEpubErr('Fichier non accessible : ' + (e?.message || ''));
        });

        const rend = book.renderTo(id, {
          width: '100%', height: '100%',
          spread: 'none', allowScriptedContent: false,
        });
        rendRef.current = rend;

        rend.on('rendered', () => { if (mounted) setReady(true); });

        rend.display()
          .then(() => { if (mounted) setReady(true); })
          .catch((e) => { if (mounted) setEpubErr('Erreur de rendu : ' + (e?.message || e)); });

      } catch (e) {
        if (mounted) setEpubErr('Impossible d\'ouvrir ce fichier EPUB : ' + e.message);
      }
    });

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      try { rendRef.current?.destroy(); } catch (_) {}
      try { bookRef.current?.destroy(); } catch (_) {}
      rendRef.current = null;
      bookRef.current = null;
    };
  }, [buffer]); // eslint-disable-line

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#fdf8f3' }}>
      {epubErr && <Alert severity="error" sx={{ m: 2 }}>{epubErr}</Alert>}

      {/* Zone de lecture — flex: 1 */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!ready && !epubErr && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 10, bgcolor: '#fdf8f3',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          }}>
            <CircularProgress size={36} sx={{ color: C.terre }} />
            <Typography variant="body2" color="text.secondary">Ouverture du livre EPUB…</Typography>
          </Box>
        )}
        <div id={viewerId.current} style={{ width: '100%', height: '100%' }} />
      </Box>

      {/* Barre de navigation */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        px: 3, py: 1.5, flexShrink: 0,
        borderTop: '1px solid #eee', bgcolor: '#fff',
      }}>
        <button style={{ ...S.btn, background: C.lightGrey, color: C.textPrimary, opacity: ready ? 1 : 0.4 }}
          disabled={!ready} onClick={() => rendRef.current?.prev()}>
          ← Précédent
        </button>
        <Typography variant="caption" color="text.secondary">← →</Typography>
        <button style={{ ...S.btn, background: C.lightGrey, color: C.textPrimary, opacity: ready ? 1 : 0.4 }}
          disabled={!ready} onClick={() => rendRef.current?.next()}>
          Suivant →
        </button>
      </Box>
    </Box>
  );
});

/* ─────────────────────────────────────────────────────────── */
/*  PDF Viewer (iframe natif du navigateur)                     */
/* ─────────────────────────────────────────────────────────── */
function PDFViewer({ url, pageNum }) {
  const src = pageNum ? `${url}#page=${pageNum}` : url;
  return (
    <iframe
      key={src}
      src={src}
      title="Lecteur PDF"
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
    />
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Audio Player                                                */
/* ─────────────────────────────────────────────────────────── */
function AudioPlayer({ buffer, title, author, cover }) {
  const audioRef = useRef(null);
  const [url,         setUrl]         = useState(null);
  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolume]      = useState(1);
  const [muted,       setMuted]       = useState(false);

  useEffect(() => {
    if (!buffer) return;
    const u = URL.createObjectURL(new Blob([buffer]));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [buffer]);

  function fmt(s) {
    const t = Math.floor(s || 0);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = t % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function togglePlay() {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  }

  function skip(s) {
    const a = audioRef.current; if (!a) return;
    a.currentTime = Math.max(0, Math.min(duration, a.currentTime + s));
  }

  function seek(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = ratio * duration;
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  }

  function changeVolume(e) {
    const v = parseFloat(e.target.value);
    setVolume(v); setMuted(v === 0);
    if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = v === 0; }
  }

  function toggleMute() {
    const a = audioRef.current; if (!a) return;
    const next = !muted; setMuted(next); a.muted = next;
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <Box sx={{
      width: '100%', height: '100%',
      background: `linear-gradient(160deg,#1a1a2e 0%,${C.indigo} 60%,#1a2535 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 4, px: { xs: 3, md: 5 },
    }}>
      {url && (
        <audio ref={audioRef} src={url}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        />
      )}

      {/* Pochette */}
      <Box sx={{ transition: 'transform .3s', transform: playing ? 'scale(1.03)' : 'scale(1)' }}>
        {cover
          ? <Box component="img" src={cover} alt=""
              sx={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 3,
                boxShadow: playing ? '0 28px 64px rgba(0,0,0,.7),0 0 0 3px rgba(181,101,29,.5)' : '0 16px 48px rgba(0,0,0,.55)',
                transition: 'box-shadow .4s' }} />
          : <Box sx={{ width: 200, height: 200, bgcolor: 'rgba(255,255,255,.06)', borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72 }}>🎧</Box>
        }
      </Box>

      {/* Titre */}
      <Box sx={{ textAlign: 'center', maxWidth: 360 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif', lineHeight: 1.3 }}>
          {title || 'Sans titre'}
        </Typography>
        {author && <Typography sx={{ fontSize: 15, color: 'rgba(255,255,255,.55)', mt: 0.5 }}>{author}</Typography>}
      </Box>

      {/* Barre de progression */}
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Box onClick={seek}
          sx={{ height: 6, bgcolor: 'rgba(255,255,255,.12)', borderRadius: 1, cursor: 'pointer', position: 'relative', mb: 1.25 }}>
          <Box sx={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg,${C.terre},${C.or})`, borderRadius: 1, transition: 'width .2s linear' }} />
          <Box sx={{ position: 'absolute', top: '50%', left: `calc(${progress}% - 7px)`, transform: 'translateY(-50%)', width: 14, height: 14, bgcolor: '#fff', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,.5)', pointerEvents: 'none' }} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,.4)', fontVariantNumeric: 'tabular-nums' }}>
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </Box>
      </Box>

      {/* Contrôles */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3.5 }}>
        <button onClick={() => skip(-15)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 6 }}>
          <span style={{ fontSize: 22, color: 'rgba(255,255,255,.7)' }}>⏮</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', fontWeight: 700 }}>−15s</span>
        </button>

        <button onClick={togglePlay} disabled={!url}
          style={{ width: 76, height: 76, borderRadius: '50%', background: C.terre, border: 'none', cursor: url ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 28px rgba(181,101,29,.55)', fontSize: 32, opacity: url ? 1 : 0.4 }}>
          {playing ? '⏸' : '▶'}
        </button>

        <button onClick={() => skip(15)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 6 }}>
          <span style={{ fontSize: 22, color: 'rgba(255,255,255,.7)' }}>⏭</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', fontWeight: 700 }}>+15s</span>
        </button>
      </Box>

      {/* Volume */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', maxWidth: 400 }}>
        <button onClick={toggleMute} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'rgba(255,255,255,.5)', padding: 4, display: 'flex' }}>
          {muted || volume === 0 ? '🔇' : '🔊'}
        </button>
        <input type="range" min="0" max="1" step="0.02" value={muted ? 0 : volume} onChange={changeVolume}
          style={{ flex: 1, accentColor: C.terre, cursor: 'pointer', height: 4 }} />
      </Box>
    </Box>
  );
}
