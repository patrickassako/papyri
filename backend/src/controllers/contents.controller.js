/**
 * Contents Controller
 * Handlers pour les routes de catalogue
 */

const contentsService = require('../services/contents.service');
const subscriptionsService = require('../services/subscriptions.service');
const flutterwaveService = require('../services/flutterwave.service');
const stripeService = require('../services/stripe.service');
const contentAccessService = require('../services/content-access.service');
const geoService = require('../services/geo.service');
const familyProfilesService = require('../services/family-profiles.service');
const { supabaseAdmin } = require('../config/database');

async function ensurePaidContentUnlock({
  userId,
  content,
  paymentRecord,
  providerMetadata = {},
  profileId = null,
}) {
  const existingUnlock = await contentsService.getUserContentUnlock(userId, content.id, profileId);
  if (existingUnlock) return existingUnlock;

  const paymentMeta = paymentRecord?.metadata || {};
  const basePriceCents = Number(paymentMeta.base_price_cents ?? content.price_cents ?? 0);
  const paidAmountCents = Number(paymentMeta.final_price_cents ?? Math.round(Number(paymentRecord?.amount || 0) * 100));
  const discountPercent = Number(paymentMeta.discount_percent ?? 0);

  try {
    return await contentsService.createContentUnlock({
      user_id: userId,
      profile_id: profileId,
      content_id: content.id,
      source: 'paid',
      payment_id: paymentRecord.id,
      base_price_cents: basePriceCents,
      paid_amount_cents: paidAmountCents,
      currency: content.price_currency || paymentRecord.currency || 'USD',
      discount_applied_percent: discountPercent,
      metadata: providerMetadata,
    });
  } catch (error) {
    if (error?.code === '23505') {
      const concurrentUnlock = await contentsService.getUserContentUnlock(userId, content.id, profileId);
      if (concurrentUnlock) return concurrentUnlock;
    }
    throw error;
  }
}

/**
 * GET /contents
 * Get contents with pagination and filters
 */
async function listContents(req, res) {
  try {
    const { page, limit, type, language, category, sort } = req.query;

    const result = await contentsService.getContents({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      type,
      language,
      category,
      sort,
    });

    const geo = geoService.getGeoFromRequest(req);
    if ((geo.zone || geo.country) && result.contents) {
      result.contents = await geoService.attachLocalizedPrices(result.contents, geo);
    }

    // Appliquer la réduction abonné si l'utilisateur est connecté et a un abonnement actif
    const userId = req.user?.id;
    const NON_SUB_DEFAULT_MARKUP = 30;
    if (result.contents) {
      let hasActiveSub = false;
      if (userId) {
        const subStatus = await subscriptionsService.checkSubscriptionStatus(userId).catch(() => null);
        hasActiveSub = Boolean(subStatus?.isActive);
      }
      result.contents = result.contents.map(c => {
        const baseCents = Number(c.localized_price?.price_cents ?? c.price_cents ?? 0);
        const markupPct = Number(c.subscription_discount_percent ?? 0) > 0
          ? Number(c.subscription_discount_percent)
          : NON_SUB_DEFAULT_MARKUP;
        const finalCents = hasActiveSub
          ? baseCents
          : Math.round(baseCents * (100 + markupPct) / 100);
        return {
          ...c,
          // Keep legacy field name for compat with the mobile app — it now
          // carries the non-subscriber markup percent (0 for subscribers).
          subscriber_discount_percent: hasActiveSub ? 0 : markupPct,
          discounted_price_cents: finalCents,
        };
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('List contents error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_CONTENTS_FAILED',
        message: 'Impossible de récupérer les contenus.',
      },
    });
  }
}

/**
 * GET /contents/:id
 * Get single content by ID
 */
async function getContent(req, res) {
  try {
    const { id } = req.params;

    let content = await contentsService.getContentById(id);

    const geo = geoService.getGeoFromRequest(req);
    if (geo.zone || geo.country) {
      content = await geoService.attachLocalizedPrice(content, geo);
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error('Get content error:', error);

    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu introuvable.',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'GET_CONTENT_FAILED',
        message: 'Impossible de récupérer le contenu.',
      },
    });
  }
}

/**
 * GET /contents/:id/file-url
 * Get signed URL for content file
 */
async function getContentFileUrl(req, res) {
  try {
    const content = req.contentAccessContext?.content || await contentsService.getContentById(req.params.id);

    // Determine expiration based on content type
    const expiresIn = content.content_type === 'audiobook' ? 3600 : 900; // 1h for audio, 15min for ebooks

    const signedUrl = await contentsService.generateSignedUrl(content.file_key, expiresIn, content.content_type);

    res.json({
      success: true,
      data: {
        url: signedUrl,
        expires_in: expiresIn,
      },
    });
  } catch (error) {
    console.error('Get file URL error:', error);

    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu introuvable.',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'GET_FILE_URL_FAILED',
        message: 'Impossible de générer l\'URL du fichier.',
      },
    });
  }
}

/**
 * GET /contents/:id/access
 * Get access/unlock status for current user
 */
async function getContentAccess(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const geo = geoService.getGeoFromRequest(req);
    const context = await contentAccessService.resolveContentAccess({
      userId,
      contentId: id,
      zone: geo,
      profileId: req.headers['x-profile-id'] || null,
    });

    res.json({
      success: true,
      data: context.access,
    });
  } catch (error) {
    console.error('Get content access error:', error);
    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'CONTENT_NOT_FOUND', message: 'Contenu introuvable.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'GET_CONTENT_ACCESS_FAILED', message: 'Impossible de verifier les acces.' },
    });
  }
}

/**
 * POST /contents/:id/unlock
 * Try unlocking content through quota -> bonus -> paid
 */
/**
 * POST /api/contents/:id/payment-sheet
 * Initiate a Stripe PaymentSheet for a paid content unlock (mobile in-app).
 * Returns the params needed by @stripe/stripe-react-native PaymentSheet.
 */
async function createContentPaymentSheet(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!stripeService.isConfigured()) {
      return res.status(503).json({ success: false, error: 'STRIPE_NOT_CONFIGURED' });
    }

    const content = await contentsService.getContentByIdForUnlock(id);
    if (!content) return res.status(404).json({ success: false, error: 'CONTENT_NOT_FOUND' });

    const familyContext = await familyProfilesService.resolveProfileForUser(userId, req.headers['x-profile-id']);
    const profileId = familyContext?.isFamilyContext ? familyContext.profileId : null;

    const existingUnlock = await contentsService.getUserContentUnlock(userId, id, profileId);
    if (existingUnlock) {
      return res.status(200).json({ success: true, alreadyUnlocked: true });
    }

    const subStatus = await subscriptionsService.checkSubscriptionStatus(userId).catch(() => null);
    const hasActiveSub = Boolean(subStatus?.isActive);
    const pricing = contentAccessService.computePricing(content, hasActiveSub);
    const finalPriceCents = pricing.final_price_cents;
    const basePriceCents = pricing.base_price_cents;

    if (!finalPriceCents || finalPriceCents <= 0) {
      return res.status(400).json({ success: false, error: 'INVALID_PRICE' });
    }

    if (!req.user.email) {
      return res.status(400).json({ success: false, error: 'MISSING_USER_EMAIL' });
    }

    const { data: prevStripe } = await supabaseAdmin
      .from('subscriptions')
      .select('provider_customer_id')
      .eq('user_id', userId)
      .eq('provider', 'stripe')
      .not('provider_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sheet = await stripeService.createPaymentIntentForSheet({
      userId,
      email: req.user.email,
      amountCents: finalPriceCents,
      currency: content.price_currency || 'CAD',
      description: `Papyri — ${content.title}`,
      existingCustomerId: prevStripe?.provider_customer_id || null,
      metadata: {
        payment_type: 'content_unlock',
        content_id: content.id,
        access_type: content.access_type || 'paid',
        ...(profileId ? { profile_id: profileId } : {}),
      },
    });

    await subscriptionsService.createPayment({
      userId,
      subscriptionId: null,
      amount: finalPriceCents / 100,
      currency: content.price_currency || 'CAD',
      status: 'pending',
      provider: 'stripe',
      providerPaymentId: sheet.paymentIntentId,
      providerCustomerId: sheet.customerId,
      paymentMethod: 'card',
      metadata: {
        payment_type: 'content_unlock',
        stripe_payment_intent_id: sheet.paymentIntentId,
        content_id: content.id,
        access_type: content.access_type || 'paid',
        ...(profileId ? { profile_id: profileId } : {}),
        base_price_cents: basePriceCents,
        discount_percent: pricing.discount_percent,
        markup_percent: pricing.markup_percent || 0,
        final_price_cents: finalPriceCents,
      },
    });

    return res.status(200).json({
      success: true,
      paymentIntent: sheet.paymentIntentClientSecret,
      ephemeralKey: sheet.ephemeralKeySecret,
      customer: sheet.customerId,
      publishableKey: sheet.publishableKey,
      paymentIntentId: sheet.paymentIntentId,
      contentId: id,
    });
  } catch (error) {
    console.error('❌ Content payment sheet error:', error);
    return res.status(500).json({ success: false, error: 'PAYMENT_SHEET_FAILED', message: error.message });
  }
}

async function unlockContent(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const content = await contentsService.getContentByIdForUnlock(id);
    const familyContext = await familyProfilesService.resolveProfileForUser(userId, req.headers['x-profile-id']);
    const effectiveProfileId = familyContext?.isFamilyContext ? familyContext.profileId : null;

    // Idempotent return if already unlocked
    const existingUnlock = await contentsService.getUserContentUnlock(userId, id, effectiveProfileId);
    if (existingUnlock) {
      return res.json({
        success: true,
        data: {
          unlocked: true,
          source: existingUnlock.source,
          unlock: existingUnlock,
          already_unlocked: true,
        },
      });
    }

    const subscriptionMembership = await subscriptionsService.getActiveSubscriptionForMember(userId);
    const hasActiveSubscription = !!subscriptionMembership?.subscription;
    const subscription = subscriptionMembership?.subscription || null;

    // Catalogue illimité : pas d'unlock requis pour les contenus 'subscription'
    if (hasActiveSubscription && content.access_type === 'subscription') {
      return res.status(200).json({
        success: true,
        data: {
          unlocked: true,
          source: 'subscription',
          already_accessible: true,
        },
      });
    }

    // Pour les contenus payants/hybrides : tentative d'utilisation d'un crédit
    // (sauf si l'utilisateur demande explicitement le paiement via { useCredit: false })
    const useCreditOptIn = req.body?.useCredit !== false;

    if (subscription && useCreditOptIn && ['paid', 'subscription_or_paid'].includes(content.access_type)) {
      const nowIso = new Date().toISOString();
      // Family plans: only consume credits attributed to the active profile.
      // Solo plans: profile_id is NULL and effectiveProfileId is null too.
      let creditsQuery = supabaseAdmin
        .from('bonus_credits')
        .select('*')
        .eq('user_id', subscription.user_id)
        .eq('subscription_id', subscription.id)
        .gt('expires_at', nowIso)
        .order('expires_at', { ascending: true })
        .limit(20);
      creditsQuery = effectiveProfileId
        ? creditsQuery.eq('profile_id', effectiveProfileId)
        : creditsQuery.is('profile_id', null);
      const { data: credits, error: creditsError } = await creditsQuery;

      if (creditsError) throw creditsError;

      const usableCredit = (credits || []).find(
        (item) => Number(item.quantity_used || 0) < Number(item.quantity_total || 0)
      ) || null;

      if (usableCredit) {
        const nextUsed = Number(usableCredit.quantity_used || 0) + 1;
        const updatePayload = {
          quantity_used: nextUsed,
          updated_at: new Date().toISOString(),
        };
        if (nextUsed >= Number(usableCredit.quantity_total || 0)) {
          updatePayload.consumed_at = new Date().toISOString();
        }

        // Atomic decrement (concurrent-safe via the equality on quantity_used).
        const { data: updatedCredit, error: updateError } = await supabaseAdmin
          .from('bonus_credits')
          .update(updatePayload)
          .eq('id', usableCredit.id)
          .eq('quantity_used', usableCredit.quantity_used)
          .select('id, quantity_used, grants_lifetime_access')
          .maybeSingle();

        if (!updateError && updatedCredit) {
          const lifetimeAccess = Boolean(updatedCredit.grants_lifetime_access ?? usableCredit.grants_lifetime_access);
          const unlock = await contentsService.createContentUnlock({
            user_id: userId,
            profile_id: effectiveProfileId,
            content_id: content.id,
            source: 'bonus',
            bonus_credit_id: usableCredit.id,
            lifetime_access: lifetimeAccess,
            currency: content.price_currency || 'CAD',
            metadata: {
              subscription_id: subscription.id,
              credit_lifetime: lifetimeAccess,
            },
          });

          return res.status(200).json({
            success: true,
            data: {
              unlocked: true,
              source: 'bonus',
              unlock,
              credit_id: usableCredit.id,
              lifetime_access: lifetimeAccess,
              credits_remaining: Math.max(0, Number(usableCredit.quantity_total || 0) - nextUsed),
            },
          });
        }
      }
    }

    // Paid fallback path
    const canPay = !!content.is_purchasable || ['paid', 'subscription_or_paid'].includes(content.access_type);
    if (!canPay || !content.price_cents) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNLOCK_NOT_ALLOWED',
          message: 'Ce contenu necessite un abonnement actif pour etre debloque.',
        },
      });
    }

    const pricing = contentAccessService.computePricing(content, hasActiveSubscription);
    const discountPercent = pricing.discount_percent;
    const basePriceCents = pricing.base_price_cents;
    const finalPriceCents = pricing.final_price_cents;

    if (!req.user.email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_EMAIL',
          message: 'Adresse email requise pour initier le paiement.',
        },
      });
    }

    // Detect origin for correct redirect (Vite=5173, CRA=3000, etc.)
    const requestOrigin = req.headers.origin;
    const redirectBaseUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(requestOrigin || ''))
      ? requestOrigin
      : undefined;

    // If the caller is the mobile app, override the redirect URL with our
    // custom deep link scheme so the browser kicks the user back into the app
    // (which then runs verify-payment automatically).
    const isMobile = req.body?.source === 'mobile';
    const mobileCallbackBase = isMobile ? 'papyri://payment/callback' : null;

    const requestedProvider = req.body?.provider === 'stripe' ? 'stripe' : 'flutterwave';

    let paymentLink = null;
    let reference = null;
    let paymentProvider = requestedProvider;
    let paymentMethod = 'card';
    const paymentProfileId = familyContext?.isFamilyContext ? familyContext.profileId : null;

    if (requestedProvider === 'stripe') {
      if (!stripeService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'STRIPE_NOT_CONFIGURED',
            message: 'Stripe is not configured.',
          },
        });
      }

      const stripeSession = await stripeService.createPaymentCheckoutSession({
        userId,
        amountCents: finalPriceCents,
        currency: content.price_currency || 'CAD',
        title: 'Papyri - Déblocage contenu',
        description: `Déblocage: ${content.title}`,
        customerEmail: req.user.email,
        successPath: `/catalogue/${content.id}`,
        cancelPath: `/catalogue/${content.id}`,
        redirectBaseUrl,
        metadata: {
          payment_type: 'content_unlock',
          content_id: content.id,
          access_type: content.access_type || 'paid',
          ...(paymentProfileId ? { profile_id: paymentProfileId } : {}),
        },
      });

      paymentLink = stripeSession.sessionUrl;
      reference = stripeSession.sessionId;
      paymentProvider = 'stripe';
      paymentMethod = 'card';
    } else {
      if (!flutterwaveService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'FLUTTERWAVE_NOT_CONFIGURED',
            message: 'Flutterwave is not configured.',
          },
        });
      }

      const checkout = await flutterwaveService.initiateCheckout({
        amount: finalPriceCents / 100,
        currency: content.price_currency || 'CAD',
        email: req.user.email,
        name: req.user.full_name || req.user.email,
        userId,
        txPrefix: 'CNT',
        redirectPath: `/catalogue/${content.id}`,
        redirectBaseUrl,
        overrideRedirectUrl: mobileCallbackBase,
        title: 'Papyri - Déblocage contenu',
        description: `Déblocage: ${content.title}`,
        meta: {
          payment_type: 'content_unlock',
          content_id: content.id,
          access_type: content.access_type || 'paid',
          ...(paymentProfileId ? { profile_id: paymentProfileId } : {}),
        },
      });

      paymentLink = checkout.link;
      reference = checkout.reference;
      paymentProvider = 'flutterwave';
      paymentMethod = 'mobile_money';
    }

    const paymentRecord = await subscriptionsService.createPayment({
      userId,
      subscriptionId: subscription?.id || null,
      amount: finalPriceCents / 100,
      currency: content.price_currency || 'CAD',
      status: 'pending',
      provider: paymentProvider,
      providerPaymentId: reference,
      providerCustomerId: null,
      paymentMethod,
      metadata: {
        payment_type: 'content_unlock',
        content_id: content.id,
        access_type: content.access_type || 'paid',
        ...(paymentProfileId ? { profile_id: paymentProfileId } : {}),
        base_price_cents: basePriceCents,
        discount_percent: discountPercent,
        final_price_cents: finalPriceCents,
      },
    });

    const paymentRecordId = paymentRecord.id;

    return res.status(402).json({
      success: false,
      error: {
        code: 'PAYMENT_REQUIRED',
        message: 'Paiement requis pour debloquer ce contenu.',
      },
      data: {
        unlockable_via: 'paid',
        payment: {
          provider: paymentProvider,
          reference,
          payment_id: paymentRecordId,
          payment_link: paymentLink,
        },
        pricing: {
          currency: content.price_currency || 'CAD',
          base_price_cents: basePriceCents,
          discount_percent: discountPercent,
          final_price_cents: finalPriceCents,
        },
      },
    });
  } catch (error) {
    console.error('Unlock content error:', error);
    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'CONTENT_NOT_FOUND', message: 'Contenu introuvable.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'UNLOCK_CONTENT_FAILED', message: 'Impossible de debloquer ce contenu.' },
    });
  }
}

/**
 * POST /contents/:id/unlock/verify-payment
 * Verify content unlock payment and create unlock record
 */
async function verifyUnlockPayment(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      provider = 'flutterwave',
      transactionId,
      reference,
      sessionId,
    } = req.body;
    const resolvedProvider = provider === 'stripe' ? 'stripe' : 'flutterwave';

    const content = await contentsService.getContentByIdForUnlock(id);
    const familyContext = await familyProfilesService.resolveProfileForUser(userId, req.headers['x-profile-id']);
    const effectiveProfileId = familyContext?.isFamilyContext ? familyContext.profileId : null;
    const existingUnlock = await contentsService.getUserContentUnlock(userId, id, effectiveProfileId);
    if (existingUnlock) {
      return res.status(200).json({
        success: true,
        data: {
          unlocked: true,
          source: existingUnlock.source,
          unlock: existingUnlock,
          already_unlocked: true,
        },
      });
    }

    let paymentRecord = null;
    let providerMetadata = {};

    if (resolvedProvider === 'stripe') {
      const effectiveSessionId = sessionId || reference;
      if (!effectiveSessionId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_PARAMETERS', message: 'sessionId est requis pour Stripe.' },
        });
      }
      if (!stripeService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured.' },
        });
      }

      const session = await stripeService.retrieveSession(effectiveSessionId);
      if ((session.metadata?.user_id || null) !== userId || (session.metadata?.content_id || null) !== id) {
        return res.status(403).json({
          success: false,
          error: { code: 'UNAUTHORIZED_PAYMENT', message: 'Ce paiement ne correspond pas a cet utilisateur/contenu.' },
        });
      }

      const { data: foundPayment, error: paymentRecordError } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'stripe')
        .eq('provider_payment_id', effectiveSessionId)
        .maybeSingle();

      if (paymentRecordError) throw paymentRecordError;
      if (!foundPayment) {
        return res.status(404).json({
          success: false,
          error: { code: 'PAYMENT_NOT_FOUND', message: 'Paiement introuvable.' },
        });
      }

      if (session.paymentStatus !== 'paid') {
        return res.status(200).json({
          success: false,
          status: 'pending',
          message: 'Paiement en cours de traitement.',
        });
      }

      paymentRecord = foundPayment;
      providerMetadata = {
        provider: 'stripe',
        session_id: effectiveSessionId,
      };
    } else {
      if (!transactionId || !reference) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_PARAMETERS', message: 'transactionId et reference sont requis.' },
        });
      }

      const paymentDetails = await flutterwaveService.verifyPayment(transactionId);
      if (paymentDetails.meta?.user_id !== userId || paymentDetails.meta?.content_id !== id) {
        return res.status(403).json({
          success: false,
          error: { code: 'UNAUTHORIZED_PAYMENT', message: 'Ce paiement ne correspond pas a cet utilisateur/contenu.' },
        });
      }

      const { data: foundPayment, error: paymentRecordError } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'flutterwave')
        .eq('provider_payment_id', reference)
        .maybeSingle();

      if (paymentRecordError) throw paymentRecordError;
      if (!foundPayment) {
        return res.status(404).json({
          success: false,
          error: { code: 'PAYMENT_NOT_FOUND', message: 'Paiement introuvable.' },
        });
      }

      if (paymentDetails.status === 'failed') {
        if (foundPayment.status !== 'failed') {
          await subscriptionsService.updatePaymentStatus(foundPayment.id, 'failed', 'Payment failed');
        }
        return res.status(400).json({
          success: false,
          error: { code: 'PAYMENT_FAILED', message: 'Le paiement a echoue.' },
        });
      }

      if (paymentDetails.status !== 'successful') {
        return res.status(200).json({
          success: false,
          status: 'pending',
          message: 'Paiement en cours de traitement.',
        });
      }

      paymentRecord = foundPayment;
      providerMetadata = {
        provider: 'flutterwave',
        reference,
        transaction_id: transactionId,
      };
    }

    if (paymentRecord.status !== 'succeeded') {
      await subscriptionsService.updatePaymentStatus(paymentRecord.id, 'succeeded');
    }

    const unlock = await ensurePaidContentUnlock({
      userId,
      content,
      paymentRecord,
      providerMetadata,
      profileId: effectiveProfileId,
    });

    return res.status(200).json({
      success: true,
      data: {
        unlocked: true,
        source: 'paid',
        unlock,
      },
    });
  } catch (error) {
    console.error('Verify unlock payment error:', error);
    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'CONTENT_NOT_FOUND', message: 'Contenu introuvable.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'VERIFY_UNLOCK_PAYMENT_FAILED', message: 'Impossible de verifier le paiement.' },
    });
  }
}

/**
 * GET /categories
 * Get all categories
 */
async function listCategories(req, res) {
  try {
    const categories = await contentsService.getCategories();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('List categories error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_CATEGORIES_FAILED',
        message: 'Impossible de récupérer les catégories.',
      },
    });
  }
}

/**
 * GET /categories/:slug
 * Get category by slug
 */
async function getCategory(req, res) {
  try {
    const { slug } = req.params;

    const category = await contentsService.getCategoryBySlug(slug);

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Get category error:', error);

    if (error.message === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'Catégorie introuvable.',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'GET_CATEGORY_FAILED',
        message: 'Impossible de récupérer la catégorie.',
      },
    });
  }
}

/**
 * POST /contents (admin only)
 * Create new content
 */
async function createContent(req, res) {
  try {
    const contentData = req.body;

    const newContent = await contentsService.createContent(contentData);

    res.status(201).json({
      success: true,
      data: newContent,
    });
  } catch (error) {
    console.error('Create content error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_CONTENT_FAILED',
        message: 'Impossible de créer le contenu.',
      },
    });
  }
}

/**
 * PUT /contents/:id (admin only)
 * Update content
 */
async function updateContent(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedContent = await contentsService.updateContent(id, updates);

    res.json({
      success: true,
      data: updatedContent,
    });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_CONTENT_FAILED',
        message: 'Impossible de mettre à jour le contenu.',
      },
    });
  }
}

/**
 * DELETE /contents/:id (admin only)
 * Soft delete content
 */
async function deleteContent(req, res) {
  try {
    const { id } = req.params;

    await contentsService.deleteContent(id);

    res.json({
      success: true,
      message: 'Contenu supprimé avec succès.',
    });
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_CONTENT_FAILED',
        message: 'Impossible de supprimer le contenu.',
      },
    });
  }
}

/**
 * GET /contents/:id/recommendations
 * Returns same-genre and same-author recommendations
 */
async function getContentRecommendations(req, res) {
  try {
    const { id } = req.params;
    const result = await contentsService.getRecommendations(id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'RECOMMENDATIONS_FAILED', message: 'Impossible de charger les recommandations.' },
    });
  }
}

/**
 * GET /api/contents/unlocks/me
 * List all content unlocks for current user, scoped to active profile when present.
 * Returns the joined content for "my library" / purchased books view.
 */
async function getMyUnlocks(req, res) {
  try {
    const userId = req.user.id;
    const familyContext = await familyProfilesService.resolveProfileForUser(userId, req.headers['x-profile-id']);
    const effectiveProfileId = familyContext?.isFamilyContext ? familyContext.profileId : null;

    let query = supabaseAdmin
      .from('content_unlocks')
      .select(`
        id, content_id, source, unlocked_at, lifetime_access,
        base_price_cents, paid_amount_cents, currency, discount_applied_percent,
        bonus_credit_id, payment_id, profile_id,
        contents:content_id (
          id, title, author, cover_url, content_type, format, language, duration_seconds
        )
      `)
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false })
      .limit(200);

    query = effectiveProfileId
      ? query.eq('profile_id', effectiveProfileId)
      : query.is('profile_id', null);

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: data || [],
      count: (data || []).length,
    });
  } catch (error) {
    console.error('❌ Get my unlocks error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_GET_UNLOCKS',
      message: error.message,
    });
  }
}

module.exports = {
  listContents,
  getContent,
  getContentFileUrl,
  getContentAccess,
  unlockContent,
  createContentPaymentSheet,
  verifyUnlockPayment,
  getMyUnlocks,
  listCategories,
  getCategory,
  createContent,
  updateContent,
  deleteContent,
  getContentRecommendations,
};
