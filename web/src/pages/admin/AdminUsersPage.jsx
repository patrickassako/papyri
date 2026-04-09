import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, Typography, Card, TextField, InputAdornment, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Avatar, IconButton, Drawer,
  Button, CircularProgress, Alert, Tooltip, Skeleton,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import tokens from '../../config/tokens';
import * as adminService from '../../services/admin.service';
import * as authService from '../../services/auth.service';
import papyriExportLogoUrl from '../../assets/papyri-export-logo.jpg';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminUserInviteDialog from '../../components/admin/AdminUserInviteDialog';
import AdminPendingInvitations from '../../components/admin/AdminPendingInvitations';
import AdminUserPanel from '../../components/admin/AdminUserPanel';
import AdminRoleChip from '../../components/admin/AdminRoleChip';
import AdminActiveStatusChip from '../../components/admin/AdminActiveStatusChip';

const C = { primary: tokens.colors.primary, green: '#27ae60', red: '#e74c3c', blue: '#2196F3', indigo: tokens.colors.accent, or: tokens.colors.secondary, purple: '#7b1fa2' };

// ── Helpers ───────────────────────────────────────────────────────────────────
// Rôles par défaut (fallback si l'API n'est pas encore chargée)
const DEFAULT_ROLE_OPTS = [
  { value: 'user',      label: 'Utilisateur',   color: '#666',    bg: '#f5f5f5' },
  { value: 'admin',     label: 'Admin',          color: C.purple,  bg: '#ede7f6' },
  { value: 'publisher', label: 'Éditeur',        color: C.or,      bg: '#fff8e1' },
];

let ROLE_OPTS = DEFAULT_ROLE_OPTS; // sera remplacé dynamiquement
const PLAN_LABELS = { MONTHLY: 'Mensuel', YEARLY: 'Annuel', monthly: 'Mensuel', yearly: 'Annuel' };

// ── Filter chips definition ───────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',       label: 'Tous',        role: undefined, is_active: undefined },
  { key: 'user',      label: 'Utilisateurs', role: 'user',   is_active: undefined },
  { key: 'admin',     label: 'Admins',       role: 'admin',  is_active: undefined },
  { key: 'publisher', label: 'Éditeurs',     role: 'publisher', is_active: undefined },
  { key: 'blocked',   label: 'Bloqués',      role: undefined, is_active: false },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers]               = useState([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [selectedId, setSelectedId]     = useState(null);
  const [activeFilter, setActiveFilter]   = useState('all');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [roleOpts, setRoleOpts]           = useState(DEFAULT_ROLE_OPTS);
  const [inviteOpen, setInviteOpen]       = useState(false);
  const [invitations, setInvitations]     = useState([]);
  const LIMIT = 20;
  const debounce = useRef(null);
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf' | null

  // Récupère TOUS les utilisateurs correspondant aux filtres actifs
  async function fetchAllForExport() {
    const f = FILTERS.find(x => x.key === activeFilter) || FILTERS[0];
    const params = { q: search, page: 1, limit: 9999 };
    if (f.role      !== undefined) params.role      = f.role;
    if (f.is_active !== undefined) params.is_active = f.is_active;
    const d = await adminService.getUsers(params);
    return d.users || [];
  }

  function userToRow(u) {
    const sub = u.subscription;
    const planLabel = sub
      ? (PLAN_LABELS[sub.plan_type] || sub.plan_type || 'Actif')
      : '—';
    const subStatus = sub
      ? (sub.status === 'active' ? 'Actif' : sub.status === 'cancelled' ? 'Annulé' : sub.status || 'Inactif')
      : '—';
    return {
      Nom:               u.full_name  || '—',
      Email:             u.email      || '—',
      Rôle:              u.role       || '—',
      Statut:            u.is_active === false ? 'Bloqué' : 'Actif',
      'Type abonnement': planLabel,
      'Statut abonnement': subStatus,
      Inscription:       u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—',
    };
  }

  async function loadLogoBase64() {
    const res = await fetch(papyriExportLogoUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  async function handleExportExcel() {
    setExporting('excel');
    try {
      const XLSX = await import('xlsx');
      const all = await fetchAllForExport();
      const filterLabel = FILTERS.find(f => f.key === activeFilter)?.label || 'Tous';
      const dateStr = new Date().toLocaleDateString('fr-FR');

      // Lignes d'en-tête branding
      const headerRows = [
        ['Papyri — Export Utilisateurs'],
        [`Filtre : ${filterLabel}${search ? ` | Recherche : "${search}"` : ''} | Exporté le ${dateStr} | ${all.length} utilisateur${all.length > 1 ? 's' : ''}`],
        [], // ligne vide
      ];

      const dataRows = all.map(userToRow);
      const ws = XLSX.utils.aoa_to_sheet(headerRows);
      XLSX.utils.sheet_add_json(ws, dataRows, { origin: headerRows.length, skipHeader: false });

      // Style largeurs colonnes
      ws['!cols'] = [{ wch: 28 }, { wch: 34 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];

      // Fusionner la ligne titre
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Utilisateurs');
      XLSX.writeFile(wb, `papyri_utilisateurs_${filterLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { setError(e.message); }
    finally { setExporting(null); }
  }

  async function handleExportPDF() {
    setExporting('pdf');
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const [all, logoBase64] = await Promise.all([fetchAllForExport(), loadLogoBase64()]);
      const rows = all.map(userToRow);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const filterLabel = FILTERS.find(f => f.key === activeFilter)?.label || 'Tous';
      const dateStr = new Date().toLocaleDateString('fr-FR');
      const pageW = doc.internal.pageSize.getWidth();

      // Logo 120×65 mm
      doc.addImage(logoBase64, 'JPEG', 14, 6, 120, 65);

      // Ligne de séparation
      doc.setDrawColor(220, 220, 220);
      doc.line(14, 75, pageW - 14, 75);

      // Infos export à droite
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(`Exporté le ${dateStr}`, pageW - 14, 20, { align: 'right' });
      doc.text(`${rows.length} utilisateur${rows.length > 1 ? 's' : ''}`, pageW - 14, 27, { align: 'right' });

      // Titre + filtre
      doc.setFontSize(11);
      doc.setTextColor(44, 62, 80);
      doc.setFont('helvetica', 'bold');
      doc.text('Gestion des utilisateurs', 14, 83);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Filtre : ${filterLabel}${search ? ` · Recherche : "${search}"` : ''}`, 14, 90);

      autoTable(doc, {
        startY: 95,
        head: [Object.keys(rows[0] || userToRow({}))],
        body: rows.map(r => Object.values(r)),
        headStyles: {
          fillColor: [26, 26, 46],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8.5,
          cellPadding: 3,
        },
        bodyStyles: { fontSize: 8.5, cellPadding: 2.5, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [248, 249, 252] },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 55 },
          2: { cellWidth: 22 },
          3: { cellWidth: 18 },
          4: { cellWidth: 28 },
          5: { cellWidth: 28 },
          6: { cellWidth: 24 },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          // Pied de page
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(180, 180, 180);
          doc.text(
            `Papyri · Page ${data.pageNumber} / ${pageCount}`,
            pageW / 2, doc.internal.pageSize.getHeight() - 6,
            { align: 'center' }
          );
        },
      });

      doc.save(`papyri_utilisateurs_${filterLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) { setError(e.message); }
    finally { setExporting(null); }
  }

  const loadInvitations = useCallback(() => {
    adminService.getInvitations()
      .then(d => setInvitations(d.invitations || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    authService.getUser().then(u => { if (u?.id) setCurrentUserId(u.id); }).catch(() => {});
    // Charger les rôles dynamiquement
    adminService.getRoles()
      .then(d => {
        const opts = (d.roles || []).map(r => {
          const style =
            r.name === 'admin' ? { color: C.purple, bg: '#ede7f6' }
            : r.name === 'publisher' ? { color: C.or, bg: '#fff8e1' }
            : r.name === 'user' ? { color: '#666', bg: '#f5f5f5' }
            : { color: C.indigo, bg: '#e8eaf6' };
          return { value: r.name, label: r.display_name, ...style };
        });
        setRoleOpts(opts.length ? opts : DEFAULT_ROLE_OPTS);
        ROLE_OPTS = opts.length ? opts : DEFAULT_ROLE_OPTS;
      })
      .catch(() => {});
    loadInvitations();
  }, [loadInvitations]);

  function fetchUsers(q, p, filterKey = activeFilter) {
    const f = FILTERS.find(x => x.key === filterKey) || FILTERS[0];
    const params = { q, page: p, limit: LIMIT };
    if (f.role      !== undefined) params.role      = f.role;
    if (f.is_active !== undefined) params.is_active = f.is_active;
    setLoading(true); setError(null);
    adminService.getUsers(params)
      .then(d => { setUsers(d.users || []); setTotal(d.total || 0); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchUsers('', 1, 'all'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(q) {
    setSearch(q); setPage(1);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchUsers(q, 1), 350);
  }

  function handleFilterChange(key) {
    setActiveFilter(key); setSearch(''); setPage(1);
    fetchUsers('', 1, key);
  }

  function handleUserUpdated(id, updatedData) {
    setUsers(prev => prev.map(u =>
      u.id === id ? { ...u, ...updatedData.profile } : u
    ));
  }

  async function handleCancelInvitation(inv) {
    try {
      await adminService.cancelInvitation(inv.id);
      setInvitations(prev => prev.filter(i => i.id !== inv.id));
    } catch (e) { setError(e.message); }
  }

  async function handleResendInvitation(inv) {
    try {
      await adminService.resendInvitation(inv.id);
      loadInvitations();
    } catch (e) { setError(e.message); }
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <Box sx={{ p: 4 }}>
      <AdminPageHeader
        title="Gestion des utilisateurs"
        subtitle={`${total.toLocaleString('fr-FR')} utilisateur${total > 1 ? 's' : ''}`}
        actions={
          <>
            <Tooltip title="Exporter Excel (filtre actif)">
              <Button
                variant="outlined"
                size="small"
                startIcon={exporting === 'excel' ? <CircularProgress size={14} /> : <FileDownloadOutlinedIcon />}
                onClick={handleExportExcel}
                disabled={!!exporting}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: '#27ae60', color: '#27ae60', '&:hover': { bgcolor: '#e8f5e9', borderColor: '#27ae60' } }}
              >
                Excel
              </Button>
            </Tooltip>
            <Tooltip title="Exporter PDF (filtre actif)">
              <Button
                variant="outlined"
                size="small"
                startIcon={exporting === 'pdf' ? <CircularProgress size={14} /> : <FileDownloadOutlinedIcon />}
                onClick={handleExportPDF}
                disabled={!!exporting}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: '#e74c3c', color: '#e74c3c', '&:hover': { bgcolor: '#ffebee', borderColor: '#e74c3c' } }}
              >
                PDF
              </Button>
            </Tooltip>
            <Button variant="contained" startIcon={<PersonAddOutlinedIcon />}
              onClick={() => setInviteOpen(true)}
              sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
              Inviter
            </Button>
          </>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

      {/* Invitations en attente */}
      <AdminPendingInvitations
        invitations={invitations}
        roleOpts={roleOpts}
        onCancel={handleCancelInvitation}
        onResend={handleResendInvitation}
      />

      {/* Search + Filters */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Rechercher par email ou nom…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          sx={{ maxWidth: 320, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchOutlinedIcon sx={{ color: '#aaa', fontSize: 20 }} /></InputAdornment>
          }}
        />
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <Chip
              key={f.key}
              label={f.label}
              size="small"
              onClick={() => handleFilterChange(f.key)}
              sx={{
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '12px',
                height: 28,
                bgcolor: activeFilter === f.key ? C.indigo : '#f0f0f0',
                color:   activeFilter === f.key ? '#fff' : '#666',
                '&:hover': { bgcolor: activeFilter === f.key ? C.indigo : '#e0e0e0' },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Table */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              {['Utilisateur', 'Rôle', 'Statut', 'Abonnement', 'Inscription', ''].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', border: 0, py: 1.5 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((_, j) => (
                      <TableCell key={j} sx={{ border: 0, py: 1.5 }}><Skeleton height={24} /></TableCell>
                    ))}
                  </TableRow>
                ))
              : users.map(u => (
                  <TableRow key={u.id}
                    onClick={() => setSelectedId(u.id)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#fafafa' }, bgcolor: selectedId === u.id ? '#fff8f0' : 'transparent', transition: 'background 0.1s' }}>
                    <TableCell sx={{ border: 0, py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: C.indigo, fontSize: 13, fontWeight: 700 }}>
                          {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{u.full_name || '—'}</Typography>
                          <Typography variant="caption" sx={{ color: '#999' }}>{u.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 1.5 }}><AdminRoleChip role={u.role} roleOpts={roleOpts} /></TableCell>
                    <TableCell sx={{ border: 0, py: 1.5 }}><AdminActiveStatusChip active={u.is_active} /></TableCell>
                    <TableCell sx={{ border: 0, py: 1.5 }}>
                      {u.subscription
                        ? <Chip label={PLAN_LABELS[u.subscription.plan_type] || u.subscription.plan_type} size="small"
                            sx={{ bgcolor: '#e3f2fd', color: C.blue, fontWeight: 700, fontSize: '11px', height: 22 }} />
                        : <Typography variant="caption" sx={{ color: '#ccc' }}>—</Typography>
                      }
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#999' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 1.5, textAlign: 'right' }}>
                      <IconButton size="small" sx={{ color: C.primary }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>

        {/* Pagination */}
        {pages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, p: 2, borderTop: '1px solid #f0f0f0' }}>
            <Button size="small" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchUsers(search, p); }}
              sx={{ borderRadius: '8px', textTransform: 'none' }}>← Préc.</Button>
            <Typography variant="body2" sx={{ color: '#888' }}>Page {page} / {pages}</Typography>
            <Button size="small" disabled={page >= pages} onClick={() => { const p = page + 1; setPage(p); fetchUsers(search, p); }}
              sx={{ borderRadius: '8px', textTransform: 'none' }}>Suiv. →</Button>
          </Box>
        )}
      </Card>

      {/* Side Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        PaperProps={{ sx: { width: 600, boxShadow: '-4px 0 24px rgba(0,0,0,0.08)' } }}
      >
        {selectedId && (
          <AdminUserPanel
            userId={selectedId}
            onClose={() => setSelectedId(null)}
            onUserUpdated={handleUserUpdated}
            currentUserId={currentUserId}
            roleOpts={roleOpts}
          />
        )}
      </Drawer>

      {/* Dialog invitation */}
      <AdminUserInviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roleOpts={roleOpts}
        onInvited={loadInvitations}
      />
    </Box>
  );
}
