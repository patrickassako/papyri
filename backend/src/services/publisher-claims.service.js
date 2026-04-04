/**
 * Publisher Claims Service
 * Gestion des réclamations / tickets support éditeurs
 */

const { supabaseAdmin } = require('../config/database');
const { sendClaimReplyEmail } = require('./email.service');
const config = require('../config/env');

// ── Éditeur ───────────────────────────────────────────────────

async function createClaim(publisherId, { category, subject, message }) {
  if (!subject?.trim()) throw new Error('Le sujet est requis.');
  if (!message?.trim()) throw new Error('Le message est requis.');

  const { data, error } = await supabaseAdmin
    .from('publisher_claims')
    .insert({
      publisher_id: publisherId,
      category: category || 'other',
      subject: subject.trim(),
      message: message.trim(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getClaims(publisherId, { page = 1, limit = 20, status } = {}) {
  let query = supabaseAdmin
    .from('publisher_claims')
    .select('*')
    .eq('publisher_id', publisherId)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return { claims: data || [] };
}

// ── Admin ─────────────────────────────────────────────────────

async function adminGetClaims({ page = 1, limit = 30, status, publisherId } = {}) {
  let query = supabaseAdmin
    .from('publisher_claims')
    .select('*, publishers(company_name, contact_name, email)')
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq('status', status);
  if (publisherId) query = query.eq('publisher_id', publisherId);

  const { data, error } = await query;
  if (error) throw error;
  return { claims: data || [] };
}

async function adminReplyClaim(claimId, adminUserId, { reply, status }) {
  if (!reply?.trim()) throw new Error('La réponse est requise.');

  const { data, error } = await supabaseAdmin
    .from('publisher_claims')
    .update({
      admin_reply: reply.trim(),
      status: status || 'resolved',
      replied_by: adminUserId,
      replied_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .select('*, publishers(company_name, contact_name, email)')
    .single();

  if (error) throw error;

  // Notifier l'éditeur par email
  const pub = data.publishers;
  if (pub?.email) {
    const dashboardUrl = `${config.frontendUrl || 'http://localhost:5173'}/publisher/support`;
    sendClaimReplyEmail(pub.email, pub.contact_name || pub.email, {
      subject: data.subject,
      reply: reply.trim(),
      status: status || 'resolved',
      dashboardUrl,
    }).catch(e => console.warn('[email] sendClaimReplyEmail failed:', e.message));
  }

  return data;
}

async function adminUpdateClaimStatus(claimId, status) {
  const { data, error } = await supabaseAdmin
    .from('publisher_claims')
    .update({ status })
    .eq('id', claimId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  createClaim,
  getClaims,
  adminGetClaims,
  adminReplyClaim,
  adminUpdateClaimStatus,
};
