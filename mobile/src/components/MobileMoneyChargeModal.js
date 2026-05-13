/**
 * MobileMoneyChargeModal
 *
 * Multi-step in-app Mobile Money checkout (no browser redirect).
 * Steps:
 *  1. country picker
 *  2. operator picker (if the country exposes more than one)
 *  3. customer info (fullname + phone)
 *  4. submit → backend POST /payments/mobile-money/charge
 *  5. waiting screen with USSD instructions + polling GET /payments/:reference/status
 *  6. success or failure
 *
 * Props:
 *   visible            boolean
 *   onClose            () => void
 *   onSuccess          ({ type, reference, contentId? }) => void
 *   intent             'subscription' | 'content_unlock' | 'extra_seat'
 *   payload            { planId?, contentId?, targetUsersLimit?, usersLimit? }
 *   defaultFullname    string  (e.g. user's full_name)
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../config/supabase';
import API_BASE_URL from '../config/api';

const tokens = require('../config/tokens');
const C = {
  primary: tokens.colors.primary,
  bg: '#F5F2EE',
  card: '#fff',
  text: '#1a1a2e',
  textMuted: '#6b5d54',
  border: '#E5DCD3',
  success: '#1F7A39',
  error: '#ad3f3f',
};

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 36; // 3 minutes

export default function MobileMoneyChargeModal({
  visible,
  onClose,
  onSuccess,
  intent,
  payload = {},
  defaultFullname = '',
}) {
  const { t } = useTranslation();

  // ── state ────────────────────────────────────────────────────────
  const [step, setStep] = useState(1); // 1 country | 2 operator | 3 info | 4 confirming | 5 polling | 6 success | 7 failed
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState(null);   // catalogue entry
  const [operator, setOperator] = useState(null);
  const [fullname, setFullname] = useState(defaultFullname || '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chargeResp, setChargeResp] = useState(null);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const pollTimer = useRef(null);

  // ── reset on visible toggle ──────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setStep(1);
      setCountry(null);
      setOperator(null);
      setFullname(defaultFullname || '');
      setPhone('');
      setError('');
      setChargeResp(null);
      setPollAttempt(0);
      setStatusMessage('');
      loadCountries();
    } else {
      if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
    }
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, [visible]);

  async function loadCountries() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/payments/mobile-money/options`);
      const d = await r.json();
      if (d?.countries) setCountries(d.countries);
    } catch (_) {}
  }

  function pickCountry(c) {
    setCountry(c);
    if (c.operators?.length > 1) setStep(2);
    else { setOperator(c.operators?.[0] || null); setStep(3); }
  }

  // ── submit charge ───────────────────────────────────────────────
  async function submitCharge() {
    if (!fullname.trim()) { setError(t('mmModal.errFullname', 'Nom complet requis')); return; }
    if (!phone.trim()) { setError(t('mmModal.errPhone', 'Numéro requis')); return; }
    setError(''); setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Non authentifié');
      const body = {
        intent,
        country: country.country,
        operator: operator?.code || null,
        phone: phone.trim(),
        fullname: fullname.trim(),
        ...(payload.planId ? { planId: payload.planId } : {}),
        ...(payload.contentId ? { contentId: payload.contentId } : {}),
        ...(payload.targetUsersLimit ? { targetUsersLimit: payload.targetUsersLimit } : {}),
        ...(payload.usersLimit ? { usersLimit: payload.usersLimit } : {}),
      };
      const r = await fetch(`${API_BASE_URL}/api/payments/mobile-money/charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok || !d?.success) throw new Error(d?.error || 'Échec du paiement');
      setChargeResp(d);
      setStep(5);
      // If the gateway gives us a redirect URL (e.g. Wave), open it
      if (d.mode === 'redirect' && d.redirectUrl) {
        Linking.openURL(d.redirectUrl).catch(() => {});
      }
      // Start polling
      setTimeout(() => pollStatus(d.reference, 0), 4000);
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally { setBusy(false); }
  }

  async function pollStatus(reference, attempt) {
    if (!reference) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const r = await fetch(`${API_BASE_URL}/api/payments/${reference}/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const d = await r.json();
      if (d?.status === 'success') {
        setStep(6);
        if (typeof onSuccess === 'function') {
          onSuccess({ type: d.type, reference, contentId: d.contentId });
        }
        return;
      }
      if (d?.status === 'failed') {
        setStatusMessage(d.message || '');
        setStep(7);
        return;
      }
      // still pending
      if (attempt + 1 >= POLL_MAX_ATTEMPTS) {
        setStatusMessage(t('mmModal.timeoutBody', 'Le paiement est toujours en cours. Nous vous notifierons dès la confirmation.'));
        setStep(7);
        return;
      }
      setPollAttempt(attempt + 1);
      pollTimer.current = setTimeout(() => pollStatus(reference, attempt + 1), POLL_INTERVAL_MS);
    } catch (_) {
      // network glitch: retry until max
      if (attempt + 1 < POLL_MAX_ATTEMPTS) {
        pollTimer.current = setTimeout(() => pollStatus(reference, attempt + 1), POLL_INTERVAL_MS);
      }
    }
  }

  // ── render helpers ──────────────────────────────────────────────
  const Header = ({ title, subtitle, onBack }) => (
    <View style={styles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={{ padding: 6, marginRight: 6 }}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={C.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
        <MaterialCommunityIcons name="close" size={22} color={C.textMuted} />
      </TouchableOpacity>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Step 1 — pays */}
          {step === 1 && (
            <>
              <Header title={t('mmModal.country', 'Choisissez votre pays')} />
              <ScrollView style={{ maxHeight: 420 }}>
                {countries.map(c => (
                  <TouchableOpacity key={c.country} style={styles.row} onPress={() => pickCountry(c)}>
                    <Text style={styles.rowLabel}>{c.label}</Text>
                    <Text style={styles.rowMeta}>{c.currency} · +{c.dialingCode}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Step 2 — opérateur */}
          {step === 2 && country && (
            <>
              <Header
                title={t('mmModal.operator', 'Choisissez votre opérateur')}
                subtitle={`${country.label} · ${country.currency}`}
                onBack={() => setStep(1)}
              />
              <ScrollView style={{ maxHeight: 420 }}>
                {country.operators.map(op => (
                  <TouchableOpacity key={op.code} style={styles.row} onPress={() => { setOperator(op); setStep(3); }}>
                    <Text style={styles.rowLabel}>{op.label}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={C.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Step 3 — info */}
          {step === 3 && country && (
            <>
              <Header
                title={t('mmModal.info', 'Vos informations')}
                subtitle={`${country.label}${operator ? ` · ${operator.label}` : ''}`}
                onBack={() => setStep(country.operators?.length > 1 ? 2 : 1)}
              />
              <View style={{ padding: 16 }}>
                <Text style={styles.field}>{t('mmModal.fullname', 'Nom complet')}</Text>
                <TextInput
                  value={fullname} onChangeText={setFullname}
                  placeholder="Jean Mbarga" style={styles.input}
                />
                <Text style={styles.field}>{t('mmModal.phone', 'Numéro de téléphone')}</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.dial}>
                    <Text style={{ color: C.text, fontWeight: '700' }}>+{country.dialingCode}</Text>
                  </View>
                  <TextInput
                    value={phone} onChangeText={setPhone}
                    placeholder="6 71 23 45 67" keyboardType="phone-pad"
                    style={[styles.input, { flex: 1, marginLeft: 8 }]}
                  />
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <TouchableOpacity
                  style={[styles.cta, busy && { opacity: 0.6 }]}
                  onPress={submitCharge} disabled={busy}
                >
                  {busy
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.ctaText}>{t('mmModal.pay', 'Payer maintenant')}</Text>}
                </TouchableOpacity>
                <Text style={styles.note}>
                  {t('mmModal.noteSecure', 'Vous serez débité directement via votre opérateur. Aucune carte requise.')}
                </Text>
              </View>
            </>
          )}

          {/* Step 5 — polling */}
          {step === 5 && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.bigTitle}>
                {t('mmModal.waitingTitle', 'Confirmez sur votre téléphone')}
              </Text>
              <Text style={styles.bigBody}>
                {chargeResp?.instructions ||
                  t('mmModal.waitingBody', 'Un code USSD vient d\'être envoyé sur votre téléphone. Validez avec votre code PIN Mobile Money pour finaliser le paiement.')}
              </Text>
              {chargeResp?.ussdCode ? (
                <Text style={styles.ussdCode}>{chargeResp.ussdCode}</Text>
              ) : null}
              <Text style={styles.poll}>
                {t('mmModal.checking', 'Vérification…')} {pollAttempt}/{POLL_MAX_ATTEMPTS}
              </Text>
              {chargeResp?.amount && chargeResp?.currency ? (
                <Text style={styles.amount}>
                  {chargeResp.amount} {chargeResp.currency}
                </Text>
              ) : null}
            </View>
          )}

          {/* Step 6 — success */}
          {step === 6 && (
            <View style={styles.centerBox}>
              <MaterialCommunityIcons name="check-circle" size={64} color={C.success} />
              <Text style={[styles.bigTitle, { color: C.success }]}>
                {t('mmModal.successTitle', 'Paiement confirmé !')}
              </Text>
              <Text style={styles.bigBody}>
                {t('mmModal.successBody', 'Votre achat est validé. Vous pouvez fermer cette fenêtre.')}
              </Text>
              <TouchableOpacity style={styles.cta} onPress={onClose}>
                <Text style={styles.ctaText}>{t('mmModal.close', 'Fermer')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 7 — failed / timeout */}
          {step === 7 && (
            <View style={styles.centerBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={64} color={C.error} />
              <Text style={[styles.bigTitle, { color: C.error }]}>
                {t('mmModal.failedTitle', 'Paiement non confirmé')}
              </Text>
              <Text style={styles.bigBody}>
                {statusMessage || t('mmModal.failedBody', 'Nous n\'avons pas pu confirmer votre paiement. Réessayez ou choisissez un autre moyen.')}
              </Text>
              <TouchableOpacity style={[styles.cta, { backgroundColor: '#EDE8E2' }]} onPress={() => setStep(3)}>
                <Text style={[styles.ctaText, { color: C.text }]}>{t('mmModal.retry', 'Réessayer')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cta, { backgroundColor: 'transparent', marginTop: 8 }]} onPress={onClose}>
                <Text style={[styles.ctaText, { color: C.textMuted }]}>{t('mmModal.close', 'Fermer')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24, maxHeight: '90%' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.border, flexDirection: 'column' },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 4, marginLeft: 32 },
  row: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.card },
  rowLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  rowMeta: { fontSize: 13, color: C.textMuted },
  field: { fontSize: 13, fontWeight: '700', color: C.textMuted, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text },
  phoneRow: { flexDirection: 'row', alignItems: 'center' },
  dial: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  cta: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  note: { fontSize: 12, color: C.textMuted, marginTop: 10, textAlign: 'center' },
  error: { color: C.error, fontSize: 13, marginTop: 8 },
  centerBox: { alignItems: 'center', padding: 32 },
  bigTitle: { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center', marginTop: 12 },
  bigBody: { fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  ussdCode: { fontSize: 22, fontWeight: '800', color: C.primary, marginTop: 12 },
  poll: { fontSize: 12, color: C.textMuted, marginTop: 18 },
  amount: { fontSize: 16, fontWeight: '800', color: C.text, marginTop: 6 },
});
