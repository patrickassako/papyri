/**
 * Admin Invitations Routes — /api/admin/invitations
 * Invite un utilisateur par email avec un rôle pré-assigné
 * Supabase envoie l'email magic-link automatiquement
 */

const express = require('express');
const router  = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const { supabaseAdmin }          = require('../config/database');
const { logResourceCreated, logResourceDeleted } = require('../services/audit.service');

const isAdmin = [verifyJWT, requireRole('admin')];

// ── GET /api/admin/invitations — liste invitations en attente ─────────────────
router.get('/', ...isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .select('id, email, role, invited_by, accepted_at, expires_at, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ invitations: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/admin/invitations — envoyer une invitation ──────────────────────
router.post('/', ...isAdmin, express.json(), async (req, res) => {
  try {
    const { email, role = 'user' } = req.body;
    if (!email) return res.status(400).json({ error: 'email requis.' });

    // Vérifier que le rôle existe
    const { data: roleData } = await supabaseAdmin
      .from('roles').select('name').eq('name', role).single();
    if (!roleData) return res.status(400).json({ error: `Rôle inconnu : ${role}` });

    // Vérifier que l'utilisateur n'existe pas déjà
    const { data: existing } = await supabaseAdmin
      .from('profiles').select('id').eq('email', email).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Un compte existe déjà pour cet email.' });

    // Supabase envoie l'email d'invitation (magic link pour créer le mot de passe)
    // Le rôle est passé dans user_metadata → handle_new_user() trigger l'applique
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { role },
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invitation-acceptee`,
      }
    );
    if (inviteError) throw inviteError;

    // Enregistrer en base pour le suivi
    const { data: invitation, error: dbError } = await supabaseAdmin
      .from('invitations')
      .insert({
        email,
        role,
        invited_by: req.user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select().single();
    if (dbError) throw dbError;

    await logResourceCreated(req.user.id, 'invitations', invitation.id,
      { email, role },
      { ip_address: req.headers['x-forwarded-for'] || req.ip }
    );

    res.status(201).json({ success: true, invitation });
  } catch (e) {
    // Supabase renvoie une erreur spécifique si l'email a déjà une invitation en cours
    if (e.message?.includes('already been invited')) {
      return res.status(409).json({ error: 'Une invitation a déjà été envoyée à cet email.' });
    }
    res.status(400).json({ error: e.message });
  }
});

// ── DELETE /api/admin/invitations/:id — annuler une invitation ────────────────
router.delete('/:id', ...isAdmin, async (req, res) => {
  try {
    const { data: inv, error: fetchErr } = await supabaseAdmin
      .from('invitations').select('*').eq('id', req.params.id).single();
    if (fetchErr || !inv) return res.status(404).json({ error: 'Invitation introuvable.' });
    if (inv.accepted_at) return res.status(400).json({ error: 'Impossible d\'annuler une invitation déjà acceptée.' });

    await supabaseAdmin.from('invitations').delete().eq('id', req.params.id);

    await logResourceDeleted(req.user.id, 'invitations', req.params.id,
      { email: inv.email, role: inv.role },
      { ip_address: req.headers['x-forwarded-for'] || req.ip }
    );

    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── POST /api/admin/invitations/:id/resend — renvoyer l'email ─────────────────
router.post('/:id/resend', ...isAdmin, async (req, res) => {
  try {
    const { data: inv, error: fetchErr } = await supabaseAdmin
      .from('invitations').select('*').eq('id', req.params.id).single();
    if (fetchErr || !inv) return res.status(404).json({ error: 'Invitation introuvable.' });
    if (inv.accepted_at) return res.status(400).json({ error: 'Invitation déjà acceptée.' });

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      inv.email,
      {
        data: { role: inv.role },
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invitation-acceptee`,
      }
    );
    if (inviteError && !inviteError.message?.includes('already been invited')) throw inviteError;

    // Mettre à jour la date d'expiration
    await supabaseAdmin.from('invitations')
      .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
      .eq('id', req.params.id);

    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
