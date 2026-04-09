import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, TextField,
  MenuItem, Select, FormControl, InputLabel, Stepper,
  Step, StepLabel, Alert, CircularProgress, Chip, LinearProgress,
  Tooltip, Divider,
} from '@mui/material';
import CloudUploadIcon        from '@mui/icons-material/CloudUpload';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowBackIcon          from '@mui/icons-material/ArrowBack';
import AutoFixHighIcon        from '@mui/icons-material/AutoFixHigh';
import InfoOutlinedIcon       from '@mui/icons-material/InfoOutlined';
import tokens from '../../config/tokens';
import RichTextEditor from '../../components/RichTextEditor';
import { stripRichText } from '../../utils/richText';
import {
  uploadCover, uploadContent, extractMetadata,
  submitBook, saveDraft, submitDraft,
} from '../../services/publisher.service';

const P = tokens.colors.primary;
const STEPS = ['Fichiers', 'Métadonnées', 'Confirmation'];

const CONTENT_TYPES = [
  { value: 'ebook',     label: 'Ebook (EPUB)' },
  { value: 'audiobook', label: 'Livre audio (MP3/M4A)' },
  { value: 'both',      label: 'Ebook + Audio' },
];

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'Anglais' },
  { value: 'es', label: 'Espagnol' },
  { value: 'ar', label: 'Arabe' },
  { value: 'de', label: 'Allemand' },
  { value: 'pt', label: 'Portugais' },
  { value: 'it', label: 'Italien' },
  { value: 'zh', label: 'Chinois' },
];

const LANG_VALUES = LANGUAGES.map(l => l.value);

/* ── Upload zone ─────────────────────────────────────────────── */
function UploadZone({ label, accept, file, onChange, disabled, hint }) {
  return (
    <Box>
      <Box
        component="label"
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${file ? P : '#E0E0E0'}`,
          borderRadius: '14px', p: { xs: 3, sm: 4 }, cursor: disabled ? 'not-allowed' : 'pointer',
          bgcolor: file ? `${P}08` : '#FAFAFA',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s',
          '&:hover': !disabled ? { borderColor: P, bgcolor: `${P}08` } : {},
        }}
      >
        <input type="file" accept={accept} hidden disabled={disabled} onChange={e => onChange(e.target.files[0])} />
        {file ? (
          <>
            <CheckCircleOutlineIcon sx={{ color: P, fontSize: 36, mb: 1 }} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: P, textAlign: 'center', wordBreak: 'break-all' }}>
              {file.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </Typography>
          </>
        ) : (
          <>
            <CloudUploadIcon sx={{ color: '#BDBDBD', fontSize: 36, mb: 1 }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#757575', textAlign: 'center' }}>{label}</Typography>
            <Typography variant="caption" sx={{ color: '#BDBDBD' }}>Glisser-déposer ou cliquer</Typography>
          </>
        )}
      </Box>
      {hint && (
        <Typography variant="caption" sx={{ color: '#BDBDBD', mt: 0.5, display: 'block', pl: 0.5 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}

/* ── Progress bar ────────────────────────────────────────────── */
function UploadProgress({ label, progress }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>{label}</Typography>
        <Typography variant="caption" sx={{ color: P, fontWeight: 700 }}>{progress}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={progress}
        sx={{ borderRadius: 4, height: 6, bgcolor: '#F0EDE8', '& .MuiLinearProgress-bar': { bgcolor: P } }} />
    </Box>
  );
}

/* ── Champ métadonnée avec badge "auto-extrait" ──────────────── */
function MetaField({ label, required, extracted, children }) {
  return (
    <Box sx={{ position: 'relative' }}>
      {children}
      {extracted && (
        <Chip
          icon={<AutoFixHighIcon sx={{ fontSize: '12px !important' }} />}
          label="Auto-extrait"
          size="small"
          sx={{
            position: 'absolute', top: -10, right: 8,
            bgcolor: '#E8F5E9', color: '#4CAF50', fontWeight: 600, fontSize: '0.65rem', height: 20,
          }}
        />
      )}
    </Box>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function PublisherAddBookPage() {
  const navigate = useNavigate();
  const { draftId: urlDraftId } = useParams();
  const [step, setStep]               = useState(urlDraftId ? 1 : 0);
  const [contentType, setContentType] = useState('ebook');
  const [epubFile, setEpubFile]       = useState(null);
  const [audioFile, setAudioFile]     = useState(null);
  const [coverFile, setCoverFile]     = useState(null);

  const [epubKey, setEpubKey]   = useState(null);
  const [audioKey, setAudioKey] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);

  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [epubProgress, setEpubProgress]   = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [coverProgress, setCoverProgress] = useState(0);
  const [extracting, setExtracting]   = useState(false);
  const [extractInfo, setExtractInfo] = useState(null); // { fieldsFound: [], coverFound: bool }

  const [meta, setMeta] = useState({
    title: '', author: '', description: '', language: 'fr', isbn: '', year: '',
  });
  // Track which fields were auto-extracted
  const [autoExtracted, setAutoExtracted] = useState({});

  const [loading, setLoading]           = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [error, setError]               = useState(null);
  const [done, setDone]                 = useState(false);
  const [draftId, setDraftId]           = useState(urlDraftId || null);

  // Charger le brouillon existant
  useEffect(() => {
    if (!urlDraftId) return;
    import('../../services/publisher.service').then(async m => {
      try {
        const res = await m.getBooks({ status: 'draft' });
        const pb  = (res.books || []).find(b => b.contents?.id === urlDraftId);
        if (pb?.contents) {
          const c = pb.contents;
          setMeta({
            title: c.title || '', author: c.author || '',
            description: c.description || '', language: c.language || 'fr',
            isbn: '', year: '',
          });
          if (c.cover_url) setCoverUrl(c.cover_url);
          setContentType(c.content_type === 'audiobook' ? 'audiobook' : 'ebook');
        }
      } catch (e) { console.error('loadDraft:', e); }
    });
  }, [urlDraftId]);

  const handleMetaChange = (field) => e =>
    setMeta(prev => ({ ...prev, [field]: e.target.value }));

  /* ── Étape 0 → 1 : upload + extraction ── */
  async function handleUploadAndNext() {
    setUploadError(null);
    setUploading(true);
    setEpubProgress(0); setAudioProgress(0); setCoverProgress(0);
    setExtractInfo(null); setAutoExtracted({});

    try {
      let newEpubKey  = epubKey;
      let newAudioKey = audioKey;

      // Upload EPUB
      if ((contentType === 'ebook' || contentType === 'both') && epubFile) {
        const res = await uploadContent(epubFile, setEpubProgress);
        newEpubKey = res.key;
        setEpubKey(res.key);

        // Extraction métadonnées
        setExtracting(true);
        try {
          const extracted = await extractMetadata(epubFile);
          const found = [];
          const newMeta = { ...meta };
          const newAuto = {};

          if (extracted.title)       { newMeta.title       = extracted.title;       found.push('Titre');       newAuto.title = true; }
          if (extracted.author)      { newMeta.author      = extracted.author;      found.push('Auteur');      newAuto.author = true; }
          if (extracted.description) { newMeta.description = extracted.description; found.push('Description'); newAuto.description = true; }
          if (extracted.isbn)        { newMeta.isbn        = extracted.isbn;        found.push('ISBN');        newAuto.isbn = true; }
          if (extracted.year)        { newMeta.year        = String(extracted.year);found.push('Année');       newAuto.year = true; }

          // Language : only if it matches our list
          if (extracted.language && LANG_VALUES.includes(extracted.language)) {
            newMeta.language = extracted.language;
            found.push('Langue');
            newAuto.language = true;
          }

          setMeta(newMeta);
          setAutoExtracted(newAuto);

          if (extracted.coverUrl) {
            setCoverUrl(extracted.coverUrl);
            found.push('Couverture');
          }

          setExtractInfo({
            fieldsFound: found,
            coverFound: !!extracted.coverUrl,
            partial: found.length < 3,
          });
        } catch (extractErr) {
          setExtractInfo({ error: 'Extraction échouée — remplissez les champs manuellement.' });
        } finally {
          setExtracting(false);
        }
      }

      // Upload audio
      if ((contentType === 'audiobook' || contentType === 'both') && audioFile) {
        const res = await uploadContent(audioFile, setAudioProgress);
        newAudioKey = res.key;
        setAudioKey(res.key);
      }

      setStep(1);
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  }

  /* ── Étape 1 → 2 : upload cover si fournie ── */
  async function handleCoverAndNext() {
    if (coverFile) {
      setUploading(true);
      setCoverProgress(0);
      try {
        const res = await uploadCover(coverFile, setCoverProgress);
        setCoverUrl(res.url);
      } catch (e) {
        setUploadError(e.message);
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    setStep(2);
  }

  function buildBookPayload() {
    return {
      title:        meta.title,
      author:       meta.author,
      description:  meta.description || null,
      language:     meta.language,
      isbn:         meta.isbn || null,
      year:         meta.year ? parseInt(meta.year) : null,
      contentType,
      coverUrl:     coverUrl || null,
      fileKey:      epubKey  || null,
      audioFileKey: audioKey || null,
    };
  }

  async function handleSaveDraft() {
    setDraftLoading(true); setError(null);
    try {
      const payload = buildBookPayload();
      if (draftId) {
        await import('../../services/publisher.service').then(m => m.updateDraft(draftId, payload));
      } else {
        const res = await saveDraft(payload);
        const id = res?.content?.id || res?.[0]?.content?.id;
        if (id) setDraftId(id);
      }
      navigate('/publisher/books');
    } catch (e) { setError(e.message); }
    finally { setDraftLoading(false); }
  }

  async function handleSubmit() {
    setLoading(true); setError(null);
    try {
      if (draftId) {
        await submitDraft(draftId, buildBookPayload());
      } else {
        await submitBook(buildBookPayload());
      }
      setDone(true);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const needsEpub  = contentType === 'ebook'    || contentType === 'both';
  const needsAudio = contentType === 'audiobook' || contentType === 'both';
  const canGoNext  = (!needsEpub || epubFile) && (!needsAudio || audioFile);

  /* ── Succès ── */
  if (done) {
    return (
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 80, color: '#4CAF50', mb: 3 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#1A1A2E', mb: 1, textAlign: 'center', fontFamily: 'Playfair Display, serif' }}>
          Livre soumis avec succès !
        </Typography>
        <Typography variant="body1" sx={{ color: '#757575', mb: 4, textAlign: 'center', maxWidth: 400 }}>
          Votre livre est en attente de validation. Notre équipe vous répondra sous 24-48h.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/publisher/books')}
          sx={{ bgcolor: P, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}>
          Retour à mes livres
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 760, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/publisher/books')}
          sx={{ color: '#757575', textTransform: 'none' }}>
          Retour
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#1A1A2E', fontFamily: 'Playfair Display, serif' }}>
          {urlDraftId ? 'Continuer le brouillon' : 'Ajouter un livre'}
        </Typography>
      </Box>

      <Stepper activeStep={step} sx={{ mb: 4 }} alternativeLabel>
        {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      {uploadError && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{uploadError}</Alert>}
      {error       && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

      {/* ══ Étape 0 : Fichiers ══════════════════════════════════ */}
      {step === 0 && (
        <Card sx={{ borderRadius: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Type de contenu</Typography>
            <Typography variant="body2" sx={{ color: '#9E9E9E', mb: 3 }}>
              Sélectionnez le type puis déposez votre fichier. Les métadonnées seront extraites automatiquement depuis l'EPUB.
            </Typography>

            <FormControl fullWidth sx={{ mb: 4 }}>
              <InputLabel>Type de contenu</InputLabel>
              <Select value={contentType} label="Type de contenu" onChange={e => {
                setContentType(e.target.value);
                setEpubFile(null); setAudioFile(null);
                setEpubKey(null);  setAudioKey(null);
              }} sx={{ borderRadius: '12px' }}>
                {CONTENT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>

            {needsEpub && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Fichier EPUB *
                  <Tooltip title="Le titre, auteur, description, langue et couverture seront extraits automatiquement">
                    <InfoOutlinedIcon sx={{ fontSize: 14, color: '#BDBDBD', ml: 0.5, verticalAlign: 'middle', cursor: 'help' }} />
                  </Tooltip>
                </Typography>
                <UploadZone
                  label="Fichier EPUB (.epub)"
                  accept=".epub,application/epub+zip"
                  file={epubFile}
                  onChange={setEpubFile}
                  disabled={uploading}
                  hint="Max 500 MB — Les métadonnées seront lues automatiquement"
                />
              </Box>
            )}

            {needsAudio && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Fichier Audio *</Typography>
                <UploadZone
                  label="Fichier audio (.mp3, .m4a)"
                  accept=".mp3,.m4a,.ogg,audio/mpeg,audio/mp4"
                  file={audioFile}
                  onChange={setAudioFile}
                  disabled={uploading}
                  hint="Max 500 MB — MP3 ou M4A"
                />
              </Box>
            )}

            {/* Progress */}
            {uploading && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#FAFAFA', borderRadius: '12px' }}>
                {needsEpub  && epubFile  && <UploadProgress label="Upload EPUB…"  progress={epubProgress} />}
                {needsAudio && audioFile && <UploadProgress label="Upload Audio…" progress={audioProgress} />}
                {extracting && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <CircularProgress size={14} sx={{ color: P }} />
                    <Typography variant="caption" sx={{ color: P, fontWeight: 600 }}>
                      Extraction des métadonnées en cours…
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="contained" onClick={handleUploadAndNext}
                disabled={!canGoNext || uploading}
                startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : null}
                sx={{ bgcolor: P, borderRadius: '12px', textTransform: 'none', fontWeight: 700, px: 4 }}>
                {uploading ? 'Upload en cours…' : 'Suivant'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ══ Étape 1 : Métadonnées ════════════════════════════════ */}
      {step === 1 && (
        <Card sx={{ borderRadius: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Métadonnées</Typography>
            </Box>

            {/* Résultat de l'extraction */}
            {extractInfo && !extractInfo.error && (
              <Alert
                severity={extractInfo.partial ? 'warning' : 'success'}
                icon={<AutoFixHighIcon />}
                sx={{ mb: 3, borderRadius: '12px' }}
              >
                {extractInfo.fieldsFound.length > 0
                  ? <><strong>{extractInfo.fieldsFound.join(', ')}</strong> extraits depuis le fichier.</>
                  : 'Aucun champ extrait — remplissez manuellement.'}
                {extractInfo.partial && extractInfo.fieldsFound.length > 0 && ' Vérifiez et complétez les champs manquants.'}
              </Alert>
            )}
            {extractInfo?.error && (
              <Alert severity="warning" sx={{ mb: 3, borderRadius: '12px' }}>{extractInfo.error}</Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

              <MetaField extracted={autoExtracted.title}>
                <TextField
                  required label="Titre" value={meta.title}
                  onChange={handleMetaChange('title')} fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </MetaField>

              <MetaField extracted={autoExtracted.author}>
                <TextField
                  required label="Auteur(s)" value={meta.author}
                  onChange={handleMetaChange('author')} fullWidth
                  placeholder="Prénom Nom (séparer par virgule si plusieurs)"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </MetaField>

              <MetaField extracted={autoExtracted.description}>
                <RichTextEditor
                  value={meta.description}
                  onChange={(nextValue) => setMeta((m) => ({ ...m, description: nextValue }))}
                  placeholder="Résumé du livre visible dans le catalogue…"
                  helperText="Mise en forme disponible: titres, gras, italique, listes et citation."
                  minHeight={220}
                />
              </MetaField>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <MetaField extracted={autoExtracted.language}>
                  <FormControl sx={{ minWidth: 160 }}>
                    <InputLabel>Langue *</InputLabel>
                    <Select value={meta.language} label="Langue *"
                      onChange={handleMetaChange('language')} sx={{ borderRadius: '12px' }}>
                      {LANGUAGES.map(l => <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </MetaField>

                <MetaField extracted={autoExtracted.isbn}>
                  <TextField label="ISBN" value={meta.isbn}
                    onChange={handleMetaChange('isbn')}
                    placeholder="978-…"
                    sx={{ flex: 1, minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                </MetaField>

                <MetaField extracted={autoExtracted.year}>
                  <TextField label="Année de publication" value={meta.year}
                    onChange={handleMetaChange('year')} type="number"
                    inputProps={{ min: 1900, max: new Date().getFullYear() }}
                    sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                </MetaField>
              </Box>

              {/* Couverture */}
              <Divider sx={{ borderColor: '#F0EDE8' }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Couverture
                  {coverUrl && <Chip label="Auto-extraite ✓" size="small" sx={{ ml: 1, bgcolor: '#E8F5E9', color: '#4CAF50', fontWeight: 600, fontSize: '0.7rem', height: 20 }} />}
                </Typography>

                {coverUrl && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2, p: 2, bgcolor: '#F8FBF8', borderRadius: '12px', border: '1px solid #E8F5E9' }}>
                    <Box component="img" src={coverUrl}
                      sx={{ height: 100, maxWidth: 80, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', objectFit: 'cover', flexShrink: 0 }} />
                    <Box>
                      <Typography variant="body2" fontWeight={600} color="#4CAF50" sx={{ mb: 0.5 }}>
                        Couverture extraite du fichier
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                        Vous pouvez la remplacer en téléversant une image ci-dessous.
                      </Typography>
                    </Box>
                  </Box>
                )}

                <UploadZone
                  label={coverUrl ? 'Remplacer la couverture (JPG, PNG)' : 'Image de couverture (JPG, PNG) — optionnel'}
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  file={coverFile}
                  onChange={f => { setCoverFile(f); setCoverUrl(null); }}
                  disabled={uploading}
                  hint="Recommandé : 600×900 px minimum, format portrait"
                />
                {uploading && coverFile && <UploadProgress label="Upload couverture…" progress={coverProgress} />}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, gap: 1, flexWrap: 'wrap' }}>
              <Button onClick={() => setStep(0)} sx={{ color: '#757575', textTransform: 'none' }}>
                ← Retour
              </Button>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="outlined" onClick={handleSaveDraft}
                  disabled={!meta.title || draftLoading || uploading}
                  startIcon={draftLoading ? <CircularProgress size={16} /> : null}
                  sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600,
                    color: '#757575', borderColor: '#C8C8C8', '&:hover': { bgcolor: '#F5F5F5' } }}>
                  {draftLoading ? 'Sauvegarde…' : 'Enregistrer en brouillon'}
                </Button>
                <Button variant="contained" onClick={handleCoverAndNext}
                  disabled={!meta.title || !meta.author || uploading}
                  startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : null}
                  sx={{ bgcolor: P, borderRadius: '12px', textTransform: 'none', fontWeight: 700, px: 4 }}>
                  {uploading ? 'Upload…' : 'Suivant →'}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ══ Étape 2 : Confirmation ═══════════════════════════════ */}
      {step === 2 && (
        <Card sx={{ borderRadius: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Résumé avant soumission</Typography>

            <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
              {/* Couverture */}
              <Box sx={{
                width: 90, height: 125, bgcolor: '#F5F5F5', borderRadius: '10px',
                flexShrink: 0, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              }}>
                {coverUrl ? (
                  <Box component="img" src={coverUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#BDBDBD', textAlign: 'center', px: 1 }}>
                      Pas de couverture
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#1A1A2E', mb: 0.5 }}>{meta.title}</Typography>
                <Typography variant="body2" sx={{ color: '#757575', mb: 1.5 }}>par {meta.author}</Typography>
                {meta.description && (
                  <Typography variant="caption" sx={{ color: '#9E9E9E', display: 'block', mb: 1.5, lineHeight: 1.5 }}>
                    {(() => {
                      const plainDescription = stripRichText(meta.description);
                      return `${plainDescription.substring(0, 180)}${plainDescription.length > 180 ? '…' : ''}`;
                    })()}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={CONTENT_TYPES.find(t => t.value === contentType)?.label} size="small" sx={{ bgcolor: '#F0EDE8', color: '#5D4037' }} />
                  <Chip label={LANGUAGES.find(l => l.value === meta.language)?.label || meta.language} size="small" sx={{ bgcolor: '#F0EDE8', color: '#5D4037' }} />
                  {meta.isbn && <Chip label={`ISBN ${meta.isbn}`} size="small" sx={{ bgcolor: '#F0EDE8', color: '#5D4037' }} />}
                  {meta.year && <Chip label={meta.year} size="small" sx={{ bgcolor: '#F0EDE8', color: '#5D4037' }} />}
                  {epubKey   && <Chip label="EPUB ✓" size="small" sx={{ bgcolor: '#E8F5E9', color: '#4CAF50' }} />}
                  {audioKey  && <Chip label="Audio ✓" size="small" sx={{ bgcolor: '#E8F5E9', color: '#4CAF50' }} />}
                </Box>
              </Box>
            </Box>

            <Alert severity="info" sx={{ mb: 4, borderRadius: '12px' }}>
              Votre contenu sera examiné par notre équipe avant publication dans le catalogue. Délai habituel : <strong>24-48h</strong>.
            </Alert>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Button onClick={() => setStep(1)} sx={{ color: '#757575', textTransform: 'none' }}>
                ← Modifier
              </Button>
              <Button variant="contained" onClick={handleSubmit} disabled={loading}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                sx={{ bgcolor: P, borderRadius: '12px', textTransform: 'none', fontWeight: 700, px: 4 }}>
                {loading ? 'Soumission…' : 'Soumettre pour validation'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
