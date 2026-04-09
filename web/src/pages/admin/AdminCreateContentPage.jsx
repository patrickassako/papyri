import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import { authFetch } from '../../services/auth.service';
import { adminGetPublisher } from '../../services/publisher.service';
import tokens from '../../config/tokens';
import RichTextEditor from '../../components/RichTextEditor';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/* ── Palette & styles ────────────────────────────────────────── */
const C = {
  terre: tokens.colors.primary, indigo: tokens.colors.accent, green: '#27ae60', red: '#e74c3c',
  orange: '#FF9800', grey: '#8c8c8c', lightGrey: '#f0f0f0',
  card: '#ffffff', bg: '#f4f1ec', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
};
const S = {
  page:  { width: '100%', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxSizing: 'border-box', background: C.bg, minHeight: '100vh' },
  card:  { background: C.card, borderRadius: 14, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 20 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 5 },
  input: { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  btn:   { padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit' },
  row2:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  section: { fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 18 },
};

/* ── Helpers ──────────────────────────────────────────────────── */
function adminFetch(path, opts = {}) {
  return authFetch(`${API}/api/admin${path}`, opts);
}

function Lbl({ children, required, autoFilled }) {
  return (
    <label style={S.label}>
      {children}
      {required    && <span style={{ color: C.red }}> *</span>}
      {autoFilled  && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, padding: '2px 8px', borderRadius: 20, background: '#e8f5e9', color: C.green, fontSize: 11, fontWeight: 700 }}>✓ Auto</span>}
    </label>
  );
}

/* ── Drop zone ────────────────────────────────────────────────── */
function DropZone({ accept, label, sublabel, icon, file, loading, onFile }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();

  function handleDrop(e) { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }

  const emoji = { file: '📄', music: '🎵', image: '🖼️' }[icon] || '📁';
  const borderColor = drag ? C.terre : file ? C.green : '#d0d0d0';
  const bg          = drag ? '#fff8f0' : file ? '#f0faf4' : '#fafafa';

  return (
    <div
      onClick={() => !loading && ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      style={{ border: `2px dashed ${borderColor}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: loading ? 'wait' : 'pointer', background: bg, transition: 'all 0.2s' }}
    >
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
      <div style={{ fontSize: 32, marginBottom: 10 }}>
        {loading ? <CircularProgress size={28} sx={{ color: C.terre }} /> : emoji}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, color: file ? C.green : C.textPrimary }}>
        {loading ? 'Analyse en cours…' : file ? file.name : label}
      </div>
      <div style={{ fontSize: 12, color: C.grey, marginTop: 4 }}>
        {loading ? 'Extraction des métadonnées…' : file ? `${(file.size / 1024 / 1024).toFixed(1)} Mo` : sublabel}
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export default function AdminCreateContentPage() {
  const { publisherId } = useParams();
  const navigate = useNavigate();

  const [publisher, setPublisher] = useState(null);
  const [categories, setCategories] = useState([]);

  // Files
  const [mainFile,  setMainFile]  = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  // Upload state
  const [extracting,     setExtracting]     = useState(false);
  const [uploadingFile,  setUploadingFile]  = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [submitting,     setSubmitting]     = useState(false);

  // Uploaded keys / URLs
  const [fileKey,  setFileKey]  = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [fileFormat, setFileFormat] = useState('');

  // Chapitres audio : [{ _id, title, file, fileKey, uploading, duration }]
  const [chapters, setChapters] = useState([]);

  // Auto-fill tracking
  const [autoFilled, setAutoFilled] = useState({});

  // Form
  const [form, setForm] = useState({
    title: '', author: '', description: '', language: 'fr',
    year: '', contentType: 'ebook', accessType: 'subscription', priceCents: '',
    categoryId: '',
  });

  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(false);

  const isOrphan = publisherId === 'orphan';

  useEffect(() => {
    if (!isOrphan) {
      adminGetPublisher(publisherId)
        .then(d => setPublisher(d.publisher || d))
        .catch(() => {});
    }
    adminFetch('/categories')
      .then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [publisherId, isOrphan]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  /* ── Extraction de métadonnées + upload automatique ── */
  async function handleMainFile(file) {
    setMainFile(file); setExtracting(true); setError(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await adminFetch('/extract-metadata', { method: 'POST', body: fd });
      const meta = await res.json();
      if (meta.error) { setError(`Extraction : ${meta.error}`); return; }
      const filled = {};
      const up = {};
      if (meta.title)       { up.title = meta.title;             filled.title = true; }
      if (meta.author)      { up.author = meta.author;           filled.author = true; }
      if (meta.description) { up.description = meta.description; filled.description = true; }
      if (meta.language)    { up.language = meta.language;       filled.language = true; }
      if (meta.year)        { up.year = meta.year;               filled.year = true; }
      if (meta.contentType) { up.contentType = meta.contentType; filled.contentType = true; }
      if (meta.duration)    { up._duration = meta.duration; }
      setForm(f => ({ ...f, ...up }));
      setAutoFilled(filled);
      if (meta.coverUrl) { setCoverUrl(meta.coverUrl); setAutoFilled(f => ({ ...f, coverUrl: true })); }
    } catch (e) { setError(`Extraction : ${e.message}`); return; }
    finally { setExtracting(false); }

    // Upload automatique vers R2 après extraction
    const k = await uploadFileFn(file, setUploadingFile);
    if (k) {
      setFileKey(k);
      setFileFormat(String(file.name || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub');
    }
  }

  /* ── Upload fichier vers R2 ── */
  async function uploadFileFn(file, setLoading) {
    if (setLoading) setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await adminFetch('/upload-content', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.key || '';
    } catch (e) { setError(`Upload : ${e.message}`); return null; }
    finally { if (setLoading) setLoading(false); }
  }

  /* ── Gestion des chapitres ── */
  function addChapter() {
    setChapters(prev => [...prev, {
      _id: Date.now(),
      title: `Chapitre ${prev.length + 1}`,
      file: null, fileKey: '', uploading: false, duration: null,
    }]);
  }

  function removeChapter(_id) {
    setChapters(prev => prev.filter(c => c._id !== _id));
  }

  function updateChapterTitle(_id, title) {
    setChapters(prev => prev.map(c => c._id === _id ? { ...c, title } : c));
  }

  function moveChapter(_id, dir) {
    setChapters(prev => {
      const idx = prev.findIndex(c => c._id === _id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  async function handleChapterFile(_id, file) {
    setChapters(prev => prev.map(c => c._id === _id ? { ...c, file, uploading: true } : c));
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await adminFetch('/upload-content', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChapters(prev => prev.map(c => c._id === _id
        ? { ...c, fileKey: data.key || '', uploading: false }
        : c));
    } catch (e) {
      setError(`Chapitre upload : ${e.message}`);
      setChapters(prev => prev.map(c => c._id === _id ? { ...c, uploading: false } : c));
    }
  }

  /* ── Upload couverture ── */
  async function handleCoverFile(file) {
    setCoverFile(file); setUploadingCover(true);
    try {
      const fd = new FormData(); fd.append('cover', file);
      const res = await adminFetch('/upload-cover', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCoverUrl(data.url);
    } catch (e) { setError(`Couverture : ${e.message}`); }
    finally { setUploadingCover(false); }
  }

  /* ── Soumission ── */
  async function handleSubmit() {
    if (!form.title.trim()) { setError('Le titre est requis'); return; }

    const isAudioType = form.contentType === 'audiobook';
    const isBothType  = form.contentType === 'both';
    const needsChapters = isAudioType || isBothType;
    const normalizedPriceCents = needsPrice ? Number(form.priceCents) || 0 : 0;

    if (needsPrice && normalizedPriceCents <= 0) {
      setError(`Le type d'accès "${form.accessType}" exige un prix > 0 en centimes.`);
      return;
    }

    // Vérification chapitres
    if (needsChapters) {
      if (chapters.length === 0) { setError('Ajoutez au moins un chapitre audio'); return; }
      const missing = chapters.find(c => !c.fileKey);
      if (missing) { setError(`Le chapitre "${missing.title}" n'a pas encore de fichier uploadé`); return; }
    }

    setSubmitting(true); setError(null);

    let effectiveFileKey = fileKey;

    // Upload ebook si pas encore fait
    if ((form.contentType === 'ebook' || isBothType) && mainFile && !effectiveFileKey) {
      const key = await uploadFileFn(mainFile, setUploadingFile);
      if (!key) { setSubmitting(false); return; }
      setFileKey(key); effectiveFileKey = key;
    }

    try {
      const payload = {
        publisherId,
        title:           form.title,
        author:          form.author       || null,
        description:     form.description  || null,
        language:        form.language     || 'fr',
        contentType:     form.contentType,
        coverUrl:        coverUrl          || null,
        fileKey:         effectiveFileKey  || null,
        durationSeconds: form._duration    || null,
        accessType:      form.accessType   || 'subscription',
        priceCents:      normalizedPriceCents,
      };

      if (needsChapters) {
        payload.chapters = chapters.map((c, i) => ({
          title:           c.title,
          fileKey:         c.fileKey,
          durationSeconds: c.duration || null,
          position:        i + 1,
        }));
      }

      const res = await adminFetch('/publisher-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccess(true);
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  function resetForm() {
    setSuccess(false); setMainFile(null); setCoverFile(null);
    setFileKey(''); setFileFormat(''); setCoverUrl(''); setAutoFilled({}); setError(null);
    setChapters([]);
    setForm({ title: '', author: '', description: '', language: 'fr', year: '', contentType: 'ebook', accessType: 'subscription', priceCents: '', categoryId: '' });
  }

  const isAudio    = form.contentType === 'audiobook';
  const isBoth     = form.contentType === 'both';
  const needsPrice = form.accessType === 'paid' || form.accessType === 'subscription_or_paid';
  const chaptersUploading = chapters.some(c => c.uploading);
  const busy       = extracting || uploadingFile || uploadingCover || submitting || chaptersUploading;

  /* ── Écran succès ── */
  if (success) {
    return (
      <div style={{ ...S.page, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.indigo, margin: '0 0 10px', fontFamily: 'Georgia, serif' }}>
            Contenu soumis
          </h2>
          <p style={{ color: C.textSecondary, fontSize: 15, marginBottom: 28 }}>
            Le contenu est en attente de validation. Il apparaîtra dans la liste des livres de l'éditeur.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button style={{ ...S.btn, background: C.lightGrey, color: C.textPrimary }}
              onClick={() => navigate(isOrphan ? '/admin/books/publisher/orphan' : `/admin/publishers/${publisherId}`)}>
              ← {isOrphan ? 'Retour aux livres directs' : "Retour à l'éditeur"}
            </button>
            <button style={{ ...S.btn, background: C.terre, color: '#fff' }} onClick={resetForm}>
              📖 Nouveau contenu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button style={{ ...S.btn, background: C.lightGrey, color: C.textPrimary }}
          onClick={() => navigate(isOrphan ? '/admin/books/publisher/orphan' : `/admin/publishers/${publisherId}`)}>
          ← Retour
        </button>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.indigo, margin: '0 0 2px', fontFamily: 'Georgia, serif' }}>
            Soumettre un contenu
          </h1>
          {isOrphan ? (
            <p style={{ margin: 0, fontSize: 14, color: C.textSecondary }}>
              Contenu direct — <strong>Papyri</strong>
            </p>
          ) : publisher ? (
            <p style={{ margin: 0, fontSize: 14, color: C.textSecondary }}>
              Pour : <strong>{publisher.company_name}</strong>
            </p>
          ) : null}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{ background: '#ffebee', border: `1px solid ${C.red}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#c62828', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          ⚠ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#c62828' }}>✕</button>
        </div>
      )}

      {/* ── Étape 1 : Fichier principal ── */}
      <div style={S.card}>
        <div style={S.section}>📁 Fichier principal</div>
        <div style={{ ...S.row2, marginBottom: 14 }}>
          <div>
            <Lbl>Type de contenu</Lbl>
            <select style={S.input} value={form.contentType} onChange={e => set('contentType', e.target.value)}>
              <option value="ebook">Ebook (EPUB / PDF)</option>
              <option value="audiobook">Audiobook (MP3 / M4A)</option>
              <option value="both">Ebook + Audiobook</option>
            </select>
          </div>
        </div>

        {/* Fichier ebook — seulement si ebook ou les deux */}
        {!isAudio && (
          <div style={{ marginBottom: isBoth ? 20 : 0 }}>
            <Lbl autoFilled={autoFilled.title}>Fichier ebook</Lbl>
            <DropZone
              accept=".epub,.pdf,application/epub+zip,application/pdf"
              label="Déposer le fichier EPUB ou PDF"
              sublabel="EPUB, PDF — max 500 Mo"
              icon="file"
              file={mainFile} loading={extracting}
              onFile={handleMainFile}
            />
            {uploadingFile && <div style={{ marginTop: 8, fontSize: 12, color: C.textSecondary }}>⏳ Upload en cours…</div>}
            {fileKey && <div style={{ marginTop: 8, fontSize: 12, color: C.green }}>✓ Fichier uploadé</div>}
            {fileFormat && <div style={{ marginTop: 4, fontSize: 12, color: C.textSecondary }}>Format détecté: {fileFormat.toUpperCase()}</div>}
          </div>
        )}

        {/* Chapitres audio — si audiobook ou les deux */}
        {(isAudio || isBoth) && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Lbl>{isBoth ? 'Chapitres audio' : 'Chapitres'}</Lbl>
              <button
                type="button"
                onClick={addChapter}
                style={{ ...S.btn, background: C.terre, color: '#fff', padding: '6px 14px', fontSize: 12 }}>
                + Ajouter un chapitre
              </button>
            </div>

            {chapters.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 16px', border: '2px dashed #e0e0e0', borderRadius: 12, color: C.grey, fontSize: 13 }}>
                🎵 Aucun chapitre — cliquez sur "Ajouter un chapitre" pour commencer
              </div>
            )}

            {chapters.map((ch, idx) => (
              <div key={ch._id} style={{ border: '1px solid #e8e8e8', borderRadius: 12, padding: 16, marginBottom: 10, background: ch.fileKey ? '#f0faf4' : '#fafafa' }}>
                {/* En-tête chapitre */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ background: C.terre, color: '#fff', borderRadius: 20, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {idx + 1}
                  </span>
                  <input
                    style={{ ...S.input, flex: 1, fontWeight: 600 }}
                    value={ch.title}
                    onChange={e => updateChapterTitle(ch._id, e.target.value)}
                    placeholder={`Chapitre ${idx + 1}`}
                  />
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button type="button" onClick={() => moveChapter(ch._id, -1)} disabled={idx === 0}
                      style={{ ...S.btn, padding: '4px 8px', background: '#f0f0f0', color: idx === 0 ? '#ccc' : '#555', fontSize: 12 }}>↑</button>
                    <button type="button" onClick={() => moveChapter(ch._id, 1)} disabled={idx === chapters.length - 1}
                      style={{ ...S.btn, padding: '4px 8px', background: '#f0f0f0', color: idx === chapters.length - 1 ? '#ccc' : '#555', fontSize: 12 }}>↓</button>
                    <button type="button" onClick={() => removeChapter(ch._id)}
                      style={{ ...S.btn, padding: '4px 8px', background: '#ffebee', color: C.red, fontSize: 12 }}>✕</button>
                  </div>
                </div>

                {/* Drop zone chapitre */}
                {!ch.fileKey ? (
                  <DropZone
                    accept=".mp3,.m4a,audio/*"
                    label="Déposer le fichier audio"
                    sublabel="MP3, M4A — max 500 Mo"
                    icon="music"
                    file={ch.file}
                    loading={ch.uploading}
                    onFile={f => handleChapterFile(ch._id, f)}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#e8f5e9', borderRadius: 8, fontSize: 13 }}>
                    <span style={{ color: C.green, fontWeight: 700 }}>✓</span>
                    <span style={{ color: '#2e7d32', flex: 1 }}>{ch.file?.name || 'Fichier uploadé'}</span>
                    <button type="button" onClick={() => setChapters(prev => prev.map(c => c._id === ch._id ? { ...c, file: null, fileKey: '' } : c))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16 }}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Étape 2 : Métadonnées ── */}
      <div style={S.card}>
        <div style={S.section}>✏ Informations du contenu</div>

        <div style={{ marginBottom: 14 }}>
          <Lbl required autoFilled={autoFilled.title}>Titre</Lbl>
          <input style={S.input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Titre du livre" />
        </div>

        <div style={{ ...S.row2, marginBottom: 14 }}>
          <div>
            <Lbl autoFilled={autoFilled.author}>Auteur</Lbl>
            <input style={S.input} value={form.author} onChange={e => set('author', e.target.value)} placeholder="Prénom Nom" />
          </div>
          <div>
            <Lbl autoFilled={autoFilled.language}>Langue</Lbl>
            <select style={S.input} value={form.language} onChange={e => set('language', e.target.value)}>
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
              <option value="es">Espagnol</option>
              <option value="ar">Arabe</option>
              <option value="de">Allemand</option>
              <option value="pt">Portugais</option>
            </select>
          </div>
        </div>

        <div style={{ ...S.row2, marginBottom: 14 }}>
          <div>
            <Lbl>Catégorie</Lbl>
            <select style={S.input} value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
              <option value="">— Choisir —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Lbl autoFilled={autoFilled.year}>Année de publication</Lbl>
            <input style={S.input} type="number" min="1900" max="2099" value={form.year} onChange={e => set('year', e.target.value)} placeholder="2024" />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <Lbl autoFilled={autoFilled.description}>Description / Synopsis</Lbl>
          <RichTextEditor
            value={form.description}
            onChange={(nextValue) => set('description', nextValue)}
            placeholder="Résumé du contenu…"
            helperText="Mise en forme disponible: titres, gras, italique, listes et citation."
            minHeight={220}
          />
        </div>

        {form._duration && (
          <div>
            <Lbl>Durée (détectée)</Lbl>
            <input style={{ ...S.input, background: '#f5f5f5', color: C.grey }} readOnly
              value={`${Math.floor(form._duration / 60)} min ${form._duration % 60} s`} />
          </div>
        )}
      </div>

      {/* ── Étape 3 : Couverture ── */}
      <div style={S.card}>
        <div style={S.section}>🖼 Couverture</div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24, alignItems: 'start' }}>
          <div style={{ width: 180, height: 250, borderRadius: 10, overflow: 'hidden', background: '#f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e0e0e0' }}>
            {coverUrl
              ? <img src={coverUrl} alt="Couverture" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 36 }}>🖼</span>
            }
          </div>
          <div>
            {autoFilled.coverUrl && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: '#e8f5e9', color: C.green, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                ✓ Couverture extraite automatiquement du fichier
              </div>
            )}
            <DropZone
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              label="Déposer une image de couverture"
              sublabel="JPG, PNG, WebP — max 5 Mo"
              icon="image"
              file={coverFile} loading={uploadingCover}
              onFile={handleCoverFile}
            />
          </div>
        </div>
      </div>

      {/* ── Étape 4 : Accès & tarification ── */}
      <div style={S.card}>
        <div style={S.section}>💰 Accès & tarification</div>
        <div style={S.row2}>
          <div>
            <Lbl>Type d'accès</Lbl>
            <select style={S.input} value={form.accessType} onChange={e => set('accessType', e.target.value)}>
              <option value="subscription">Abonnement uniquement</option>
              <option value="paid">Achat à l'unité</option>
              <option value="subscription_or_paid">Abonnement ou Achat</option>
            </select>
          </div>
          {needsPrice && (
            <div>
              <Lbl required>Prix (centimes)</Lbl>
              <input style={S.input} type="number" min="0" value={form.priceCents}
                onChange={e => set('priceCents', e.target.value)} placeholder="999 = 9,99 €" />
              {form.priceCents && !isNaN(parseInt(form.priceCents)) && (
                <div style={{ fontSize: 11, color: C.terre, marginTop: 3 }}>
                  = {(parseInt(form.priceCents) / 100).toFixed(2)} EUR
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Boutons ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button style={{ ...S.btn, background: C.lightGrey, color: C.textPrimary }}
          onClick={() => navigate(isOrphan ? '/admin/books/publisher/orphan' : `/admin/publishers/${publisherId}`)} disabled={busy}>
          Annuler
        </button>
        <button style={{ ...S.btn, background: C.terre, color: '#fff', padding: '12px 28px', opacity: busy ? 0.7 : 1 }}
          onClick={handleSubmit} disabled={busy}>
          {submitting ? '⏳ Création…' : isOrphan ? '🚀 Créer le contenu' : '🚀 Soumettre pour validation'}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
