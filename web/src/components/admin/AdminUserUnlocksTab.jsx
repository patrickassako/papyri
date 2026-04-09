import React, { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import tokens from '../../config/tokens';
import * as adminService from '../../services/admin.service';

const C = {
  primary: tokens.colors.primary,
  green: '#27ae60',
  red: '#e74c3c',
  blue: '#2196F3',
  indigo: tokens.colors.accent,
  or: tokens.colors.secondary,
};

const SOURCE_LABELS = {
  quota: { label: 'Quota', color: C.blue, bg: '#e3f2fd' },
  bonus: { label: 'Bonus', color: C.or, bg: '#fff8e1' },
  paid: { label: 'Achat', color: C.green, bg: '#e8f5e9' },
  admin_grant: { label: 'Admin', color: C.primary, bg: '#fff3e0' },
};

export default function AdminUserUnlocksTab({ userId, unlocks, setUnlocks }) {
  const [grantOpen, setGrantOpen] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [msg, setMsg] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [granting, setGranting] = useState(null);
  const debounce = useRef(null);

  function searchContent(q) {
    clearTimeout(debounce.current);
    if (!q.trim()) {
      setSearchRes([]);
      return;
    }
    debounce.current = setTimeout(() => {
      setSearching(true);
      adminService.searchContents(q)
        .then((d) => setSearchRes(d.contents || []))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
  }

  async function revoke(unlock) {
    if (!window.confirm(`Retirer l'accès à "${unlock.contents?.title}" ?`)) return;
    setRevoking(unlock.id);
    try {
      await adminService.revokeBook(unlock.id);
      setUnlocks((prev) => prev.filter((item) => item.id !== unlock.id));
      setMsg({ type: 'success', text: 'Accès retiré.' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setRevoking(null);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function grant(content) {
    setGranting(content.id);
    try {
      const res = await adminService.grantBook(userId, content.id);
      setUnlocks((prev) => [res.unlock, ...prev]);
      setMsg({ type: 'success', text: `Accès accordé : ${content.title}` });
      setGrantOpen(false);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setGranting(null);
    }
  }

  return (
    <Box>
      {msg && <Alert severity={msg.type === 'error' ? 'error' : 'success'} sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button size="small" variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setGrantOpen(true)}
          sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
          Attribuer un livre
        </Button>
      </Box>

      {grantOpen && (
        <Box sx={{ mb: 2, p: 2, bgcolor: '#fafafa', borderRadius: '12px', border: '1px solid #eee' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Rechercher un titre ou un auteur…"
            value={searchQ}
            onChange={(e) => { setSearchQ(e.target.value); searchContent(e.target.value); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlinedIcon sx={{ fontSize: 18, color: '#aaa' }} /></InputAdornment> }}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            autoFocus
          />
          {searching && <Box sx={{ textAlign: 'center', py: 1 }}><CircularProgress size={18} /></Box>}
          {searchRes.map((content) => (
            <Box key={content.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid #f0f0f0' }}>
              {content.cover_url
                ? <img src={content.cover_url} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                : <Box sx={{ width: 28, height: 40, bgcolor: '#eee', borderRadius: '4px', flexShrink: 0 }} />
              }
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content.title}</Typography>
                <Typography variant="caption" sx={{ color: '#aaa' }}>{content.author}</Typography>
              </Box>
              <Button size="small" variant="contained" disabled={granting === content.id} onClick={() => grant(content)}
                sx={{ flexShrink: 0, borderRadius: '8px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' }, fontSize: '12px', py: 0.5 }}>
                {granting === content.id ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : 'Attribuer'}
              </Button>
            </Box>
          ))}
          {!searching && searchQ.trim() && searchRes.length === 0 && (
            <Typography variant="caption" sx={{ color: '#aaa', textAlign: 'center', display: 'block', py: 1 }}>Aucun résultat</Typography>
          )}
          <Button size="small" onClick={() => { setGrantOpen(false); setSearchQ(''); setSearchRes([]); }} sx={{ mt: 1, textTransform: 'none', color: '#aaa' }}>
            Fermer
          </Button>
        </Box>
      )}

      {unlocks.length === 0 ? (
        <Typography variant="body2" sx={{ color: '#aaa', textAlign: 'center', py: 3 }}>Aucun accès attribué</Typography>
      ) : unlocks.map((unlock) => {
        const content = unlock.contents;
        const src = SOURCE_LABELS[unlock.source] || { label: unlock.source, color: '#666', bg: '#f5f5f5' };
        return (
          <Box key={unlock.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.2, borderBottom: '1px solid #f5f5f5' }}>
            {content?.cover_url
              ? <img src={content.cover_url} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              : <Box sx={{ width: 28, height: 40, bgcolor: '#eee', borderRadius: '4px', flexShrink: 0 }} />
            }
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content?.title || '—'}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                <Typography variant="caption" sx={{ color: '#aaa' }}>{content?.author}</Typography>
                <Chip label={src.label} size="small" sx={{ bgcolor: src.bg, color: src.color, fontWeight: 700, fontSize: '10px', height: 18 }} />
              </Box>
            </Box>
            <Tooltip title="Retirer l'accès">
              <IconButton size="small" disabled={revoking === unlock.id} onClick={() => revoke(unlock)} sx={{ color: C.red, '&:hover': { bgcolor: '#ffebee' } }}>
                {revoking === unlock.id ? <CircularProgress size={14} /> : <DeleteOutlineOutlinedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
}
