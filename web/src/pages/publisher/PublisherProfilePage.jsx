import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, TextField,
  Button, Alert, CircularProgress, MenuItem, Select,
  FormControl, InputLabel, Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import tokens from '../../config/tokens';
import { getMe, updateMe, updatePayoutMethod } from '../../services/publisher.service';
import * as authService from '../../services/auth.service';

const PAYOUT_TYPES = [
  { value: 'bank_transfer', label: 'Virement bancaire (SWIFT/IBAN)' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'paypal', label: 'PayPal' },
];

const MOBILE_OPERATORS = ['MTN', 'Orange', 'Moov', 'Wave', 'Airtel'];

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

export default function PublisherProfilePage({ publisher: initialPublisher }) {
  const [tab, setTab] = useState(0);
  const [publisher, setPublisher] = useState(initialPublisher || null);
  const [loading, setLoading] = useState(!initialPublisher);

  // Onglet 1 — Informations
  const [info, setInfo] = useState({ company_name: '', contact_name: '', description: '', website: '' });
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState(null);

  // Onglet 2 — Sécurité
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);

  // Onglet 3 — Paiement
  const [payout, setPayout] = useState({ type: 'bank_transfer', iban: '', swift: '', bank: '', country: '', phone: '', operator: 'MTN', paypal_email: '' });
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState(null);

  useEffect(() => {
    async function load() {
      if (initialPublisher) { populate(initialPublisher); return; }
      try {
        const res = await getMe();
        setPublisher(res.publisher);
        populate(res.publisher);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [initialPublisher]);

  function populate(pub) {
    if (!pub) return;
    setInfo({ company_name: pub.company_name || '', contact_name: pub.contact_name || '', description: pub.description || '', website: pub.website || '' });
    if (pub.payout_method) setPayout({ ...payout, ...pub.payout_method });
  }

  async function saveInfo() {
    setInfoSaving(true);
    setInfoMsg(null);
    try {
      await updateMe(info);
      setInfoMsg({ type: 'success', text: 'Informations mises à jour.' });
    } catch (e) {
      setInfoMsg({ type: 'error', text: e.message });
    } finally {
      setInfoSaving(false);
    }
  }

  async function savePassword() {
    setPwdMsg(null);
    if (passwords.next !== passwords.confirm) {
      setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    if (passwords.next.length < 8) {
      setPwdMsg({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' });
      return;
    }
    setPwdSaving(true);
    try {
      await authService.updatePassword(passwords.current, passwords.next);
      setPwdMsg({ type: 'success', text: 'Mot de passe mis à jour.' });
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (e) {
      setPwdMsg({ type: 'error', text: e.message });
    } finally {
      setPwdSaving(false);
    }
  }

  async function savePayout() {
    setPayoutSaving(true);
    setPayoutMsg(null);
    try {
      await updatePayoutMethod(payout);
      setPayoutMsg({ type: 'success', text: 'Mode de paiement enregistré.' });
    } catch (e) {
      setPayoutMsg({ type: 'error', text: e.message });
    } finally {
      setPayoutSaving(false);
    }
  }

  if (loading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 4, maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, color: tokens.colors.onBackground.light, fontFamily: 'Playfair Display, serif', mb: 4 }}>
        Mon profil
      </Typography>

      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 2,
            borderBottom: `1px solid ${tokens.colors.surfaces.light.variant}`,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
            '& .Mui-selected': { color: tokens.colors.primary },
            '& .MuiTabs-indicator': { bgcolor: tokens.colors.primary },
          }}
        >
          <Tab label="Informations" />
          <Tab label="Sécurité" />
          <Tab label="Mode de paiement" />
        </Tabs>

        <CardContent sx={{ p: 4 }}>
          {/* Onglet 1 — Informations */}
          <TabPanel value={tab} index={0}>
            {infoMsg && <Alert severity={infoMsg.type} sx={{ mb: 3, borderRadius: '12px' }}>{infoMsg.text}</Alert>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Nom de la maison d'édition *"
                value={info.company_name}
                onChange={e => setInfo(i => ({ ...i, company_name: e.target.value }))}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <TextField
                label="Nom du responsable *"
                value={info.contact_name}
                onChange={e => setInfo(i => ({ ...i, contact_name: e.target.value }))}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <TextField
                label="Site web"
                value={info.website}
                onChange={e => setInfo(i => ({ ...i, website: e.target.value }))}
                fullWidth
                placeholder="https://..."
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <TextField
                label="Description"
                value={info.description}
                onChange={e => setInfo(i => ({ ...i, description: e.target.value }))}
                fullWidth
                multiline
                rows={4}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={saveInfo}
                  disabled={infoSaving}
                  startIcon={infoSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
                >
                  Enregistrer
                </Button>
              </Box>
            </Box>
          </TabPanel>

          {/* Onglet 2 — Sécurité */}
          <TabPanel value={tab} index={1}>
            {pwdMsg && <Alert severity={pwdMsg.type} sx={{ mb: 3, borderRadius: '12px' }}>{pwdMsg.text}</Alert>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Mot de passe actuel"
                type="password"
                value={passwords.current}
                onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <TextField
                label="Nouveau mot de passe"
                type="password"
                value={passwords.next}
                onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))}
                fullWidth
                helperText="Minimum 8 caractères"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <TextField
                label="Confirmer le nouveau mot de passe"
                type="password"
                value={passwords.confirm}
                onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={savePassword}
                  disabled={pwdSaving || !passwords.current || !passwords.next || !passwords.confirm}
                  startIcon={pwdSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
                >
                  Mettre à jour
                </Button>
              </Box>
            </Box>
          </TabPanel>

          {/* Onglet 3 — Mode de paiement */}
          <TabPanel value={tab} index={2}>
            {payoutMsg && <Alert severity={payoutMsg.type} sx={{ mb: 3, borderRadius: '12px' }}>{payoutMsg.text}</Alert>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <FormControl fullWidth>
                <InputLabel>Type de versement *</InputLabel>
                <Select
                  value={payout.type}
                  label="Type de versement *"
                  onChange={e => setPayout(p => ({ ...p, type: e.target.value }))}
                  sx={{ borderRadius: '12px' }}
                >
                  {PAYOUT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </Select>
              </FormControl>

              {payout.type === 'bank_transfer' && (
                <>
                  <Divider><Typography variant="caption" sx={{ color: '#9E9E9E' }}>Coordonnées bancaires</Typography></Divider>
                  <TextField label="IBAN / Numéro de compte" value={payout.iban} onChange={e => setPayout(p => ({ ...p, iban: e.target.value }))} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                  <TextField label="SWIFT / BIC" value={payout.swift} onChange={e => setPayout(p => ({ ...p, swift: e.target.value }))} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                  <TextField label="Banque" value={payout.bank} onChange={e => setPayout(p => ({ ...p, bank: e.target.value }))} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                  <TextField label="Pays" value={payout.country} onChange={e => setPayout(p => ({ ...p, country: e.target.value }))} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                </>
              )}

              {payout.type === 'mobile_money' && (
                <>
                  <Divider><Typography variant="caption" sx={{ color: '#9E9E9E' }}>Mobile Money</Typography></Divider>
                  <FormControl fullWidth>
                    <InputLabel>Opérateur</InputLabel>
                    <Select value={payout.operator} label="Opérateur" onChange={e => setPayout(p => ({ ...p, operator: e.target.value }))} sx={{ borderRadius: '12px' }}>
                      {MOBILE_OPERATORS.map(op => <MenuItem key={op} value={op}>{op}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField label="Numéro de téléphone" value={payout.phone} onChange={e => setPayout(p => ({ ...p, phone: e.target.value }))} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                </>
              )}

              {payout.type === 'paypal' && (
                <>
                  <Divider><Typography variant="caption" sx={{ color: '#9E9E9E' }}>PayPal</Typography></Divider>
                  <TextField label="Email PayPal" value={payout.paypal_email} onChange={e => setPayout(p => ({ ...p, paypal_email: e.target.value }))} type="email" fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
                </>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={savePayout}
                  disabled={payoutSaving}
                  startIcon={payoutSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
                >
                  Enregistrer
                </Button>
              </Box>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
}
