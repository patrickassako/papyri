/**
 * AdminSettingsPage — /admin/settings
 * Paramètres globaux de l'application (société, facturation, apparence)
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  Box, Card, Typography, Button,
  TextField, CircularProgress, Alert, Snackbar, Tooltip, IconButton,
} from '@mui/material';
import SettingsOutlinedIcon  from '@mui/icons-material/SettingsOutlined';
import BusinessOutlinedIcon  from '@mui/icons-material/BusinessOutlined';
import ReceiptOutlinedIcon   from '@mui/icons-material/ReceiptOutlined';
import PaletteOutlinedIcon   from '@mui/icons-material/PaletteOutlined';
import SaveOutlinedIcon      from '@mui/icons-material/SaveOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineIcon     from '@mui/icons-material/DeleteOutline';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  indigo: tokens.colors.accent, primary: tokens.colors.primary, green: '#27ae60',
  red: '#e74c3c', grey: '#8c8c8c', bg: '#F7F6F3',
  textPrimary: '#1a1a2e', textSecondary: '#6b7280',
};

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } };

const DEFAULTS = {
  company_name: '', company_tagline: '', company_address: '',
  company_email: '', company_website: '', company_phone: '', company_vat_id: '',
  invoice_prefix: 'INV', invoice_footer_text: '', invoice_logo_url: '', invoice_notes: '',
  invoice_primary_color: '#B5651D', invoice_accent_color: '#D4A017',
};

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: `${C.indigo}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon sx={{ fontSize: 18, color: C.indigo }} />
      </Box>
      <Box>
        <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} sx={{ lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" color={C.textSecondary}>{subtitle}</Typography>}
      </Box>
    </Box>
  );
}

// ── Logo Upload Zone ──────────────────────────────────────────
function LogoUploader({ logoUrl, onUploaded, onRemove }) {
  const inputRef        = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver]   = useState(false);

  async function upload(file) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      setUploadError('Format non supporté. Acceptés : JPG, PNG, WebP, SVG'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Fichier trop volumineux (max 2 Mo)'); return;
    }
    setUploading(true); setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res  = await authFetch(`${API}/api/admin/settings/upload-logo`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur upload');
      onUploaded(data.url);
    } catch (e) { setUploadError(e.message); }
    finally { setUploading(false); }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  return (
    <Box>
      <Typography variant="caption" color={C.textSecondary} fontWeight={600} sx={{ display: 'block', mb: 1 }}>
        Logo de la société
      </Typography>

      {logoUrl ? (
        /* ── Logo présent — aperçu ── */
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 2,
          p: 2, borderRadius: '14px', bgcolor: '#fff',
          border: '1px solid #e5e0d8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <Box sx={{ width: 100, height: 56, borderRadius: '8px', bgcolor: '#faf9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e5e0d8' }}>
            <img
              src={logoUrl}
              alt="Logo"
              onError={e => { e.target.style.display = 'none'; }}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={700} color={C.textPrimary}>Logo actuel</Typography>
            <Typography variant="caption" color={C.textSecondary} noWrap sx={{ maxWidth: 260, display: 'block' }}>
              {logoUrl.split('/').pop()}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={uploading ? <CircularProgress size={13} color="inherit" /> : <CloudUploadOutlinedIcon />}
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', bgcolor: `${C.indigo}10`, color: C.indigo, '&:hover': { bgcolor: `${C.indigo}18` } }}
            >
              Changer
            </Button>
            <Tooltip title="Supprimer le logo">
              <IconButton size="small" onClick={onRemove} sx={{ color: C.red, '&:hover': { bgcolor: `${C.red}10` } }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      ) : (
        /* ── Zone de dépôt ── */
        <Box
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          sx={{
            border: `2px dashed ${dragOver ? C.primary : '#d1ccc5'}`,
            borderRadius: '14px',
            bgcolor: dragOver ? `${C.primary}06` : '#faf9f7',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            cursor: uploading ? 'wait' : 'pointer',
            transition: 'all 0.15s',
            '&:hover': { borderColor: C.primary, bgcolor: `${C.primary}06` },
            minHeight: 110,
          }}
        >
          {uploading ? (
            <CircularProgress size={28} sx={{ color: C.primary }} />
          ) : (
            <>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: `${C.indigo}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CloudUploadOutlinedIcon sx={{ color: C.indigo, fontSize: 22 }} />
              </Box>
              <Typography variant="body2" fontWeight={700} color={C.textPrimary}>
                Glisser-déposer ou cliquer pour importer
              </Typography>
              <Typography variant="caption" color={C.textSecondary}>
                JPG, PNG, WebP, SVG — max 2 Mo
              </Typography>
            </>
          )}
        </Box>
      )}

      {uploadError && (
        <Alert severity="error" sx={{ mt: 1, borderRadius: '10px', py: 0.5 }}>{uploadError}</Alert>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
      />
    </Box>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const [form, setForm]       = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [toast, setToast]     = useState(false);

  useEffect(() => {
    authFetch(`${API}/api/admin/settings`)
      .then(r => r.json())
      .then(d => setForm({ ...DEFAULTS, ...d }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const res  = await authFetch(`${API}/api/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setForm(f => ({ ...DEFAULTS, ...f, ...data }));
      setToast(true);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: C.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>

      {/* Header sticky */}
      <Box sx={{ bgcolor: '#fff', height: 60, display: 'flex', alignItems: 'center', px: 3, borderBottom: '1px solid #e5e0d8', position: 'sticky', top: 0, zIndex: 10, gap: 1 }}>
        <SettingsOutlinedIcon sx={{ color: C.indigo, mr: 1 }} />
        <Typography variant="h6" fontWeight={700} color={C.textPrimary} sx={{ flex: 1 }}>
          Paramètres
        </Typography>
        <Button
          variant="contained" size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon />}
          onClick={handleSave} disabled={saving}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, bgcolor: C.indigo, boxShadow: 'none', '&:hover': { bgcolor: '#1a2d47' } }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 800, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>

        {error && <Alert severity="error" sx={{ borderRadius: '12px' }}>{error}</Alert>}

        {/* ── Section Société ── */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3 }}>
          <SectionHeader icon={BusinessOutlinedIcon} title="Informations société" subtitle="Affichées sur les factures et communications" />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Logo uploader en premier */}
            <LogoUploader
              logoUrl={form.invoice_logo_url}
              onUploaded={url => set('invoice_logo_url', url)}
              onRemove={() => set('invoice_logo_url', '')}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Nom de la société" size="small" fullWidth sx={inputSx}
                value={form.company_name} onChange={e => set('company_name', e.target.value)} />
              <TextField label="Slogan / Tagline" size="small" fullWidth sx={inputSx}
                value={form.company_tagline} onChange={e => set('company_tagline', e.target.value)} />
            </Box>
            <TextField label="Adresse" size="small" fullWidth sx={inputSx}
              value={form.company_address} onChange={e => set('company_address', e.target.value)}
              placeholder="Ex : Rue des Bougainvillées, Yaoundé, Cameroun" />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Email" size="small" fullWidth sx={inputSx} type="email"
                value={form.company_email} onChange={e => set('company_email', e.target.value)} />
              <TextField label="Téléphone" size="small" fullWidth sx={inputSx}
                value={form.company_phone} onChange={e => set('company_phone', e.target.value)} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Site web" size="small" fullWidth sx={inputSx}
                value={form.company_website} onChange={e => set('company_website', e.target.value)}
                placeholder="papyri.app" />
              <TextField label="N° TVA / RCCM" size="small" fullWidth sx={inputSx}
                value={form.company_vat_id} onChange={e => set('company_vat_id', e.target.value)} />
            </Box>
          </Box>
        </Card>

        {/* ── Section Facturation ── */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3 }}>
          <SectionHeader icon={ReceiptOutlinedIcon} title="Facturation" subtitle="Paramètres des factures PDF générées automatiquement" />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Préfixe de facture" size="small" sx={{ width: 220, ...inputSx }}
              value={form.invoice_prefix} onChange={e => set('invoice_prefix', e.target.value)}
              helperText="Ex : INV → INV-20260101-0001"
              inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700 } }} />
            <TextField label="Pied de page des factures" size="small" fullWidth multiline rows={2} sx={inputSx}
              value={form.invoice_footer_text} onChange={e => set('invoice_footer_text', e.target.value)}
              placeholder="Cette facture a été générée automatiquement…" />
            <TextField label="Notes / Conditions" size="small" fullWidth multiline rows={2} sx={inputSx}
              value={form.invoice_notes} onChange={e => set('invoice_notes', e.target.value)}
              placeholder="Mentions légales, conditions de remboursement…" />
          </Box>
        </Card>

        {/* ── Section Apparence ── */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3 }}>
          <SectionHeader icon={PaletteOutlinedIcon} title="Apparence des factures" subtitle="Couleurs utilisées dans les PDF générés" />
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {[
              { key: 'invoice_primary_color', label: 'Couleur principale', hint: 'Titres, accents' },
              { key: 'invoice_accent_color',  label: 'Couleur secondaire', hint: 'Sous-titres, séparateurs' },
            ].map(({ key, label, hint }) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: '#faf9f7', borderRadius: '12px', border: '1px solid #e5e0d8', flex: 1, minWidth: 220 }}>
                <Tooltip title="Cliquer pour changer">
                  <Box
                    component="input" type="color"
                    value={form[key]} onChange={e => set(key, e.target.value)}
                    sx={{ width: 44, height: 44, border: 'none', borderRadius: '10px', cursor: 'pointer', p: 0, bgcolor: 'transparent' }}
                  />
                </Tooltip>
                <Box>
                  <Typography variant="body2" fontWeight={700} color={C.textPrimary}>{label}</Typography>
                  <Typography variant="caption" color={C.textSecondary}>{hint}</Typography>
                  <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', color: C.grey, mt: 0.25 }}>
                    {form[key]}
                  </Typography>
                </Box>
                <Box sx={{ ml: 'auto', width: 28, height: 28, borderRadius: '8px', bgcolor: form[key], boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
              </Box>
            ))}
          </Box>
        </Card>

        {/* Bouton bas */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained" size="large"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
            onClick={handleSave} disabled={saving}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, bgcolor: C.indigo, px: 4, '&:hover': { bgcolor: '#1a2d47' } }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={toast} autoHideDuration={3000} onClose={() => setToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message="✅ Paramètres enregistrés"
      />
    </Box>
  );
}
