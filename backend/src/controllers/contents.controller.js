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
    if (userId && result.contents) {
      const subStatus = await subscriptionsService.checkSubscriptionStatus(userId).catch(() => null);
      const hasActiveSub = Boolean(subStatus?.isActive);
      result.contents = result.contents.map(c => {
        const baseCents = Number(c.localized_price?.price_cents ?? c.price_cents ?? 0);
        const discountPct = hasActiveSub ? Number(c.subscription_discount_percent ?? 0) : 0;
        const discountedCents = discountPct > 0
          ? Math.max(0, Math.round(baseCents * (100 - discountPct) / 100))
          : baseCents;
        return {
          ...c,
          subscriber_discount_percent: discountPct,
          discounted_price_cents: discountedCents,
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
    const canSubscriptionAccess = hasActiveSubscription && ['subscription', 'subscription_or_paid'].includes(content.access_type);
    const isTextContent = content.content_type === 'ebook';

    if (canSubscriptionAccess && subscription) {
      await subscriptionsService.ensureOwnerMembership(subscription);
      const cycle = await subscriptionsService.ensureCurrentCycle(subscription);

      if (cycle) {
        const familyContext = await familyProfilesService.resolveProfileForUser(userId, req.headers['x-profile-id']);
        const useProfileScopedUsage = Boolean(
          familyContext?.isFamilyContext
          && familyContext?.subscription?.id === subscription.id
          && familyContext?.profileId
        );

        const usage = useProfileScopedUsage
          ? await subscriptionsService.ensureProfileCycleUsage(subscription, cycle, familyContext.profileId)
          : await subscriptionsService.ensureMemberCycleUsage(subscription, cycle, userId);

        const quotaField = isTextContent ? 'text_unlocked_count' : 'audio_unlocked_count';
        const quotaLimitField = isTextContent ? 'text_quota' : 'audio_quota';
        const currentCount = Number(usage[quotaField] || 0);
        const quotaLimit = Number(usage[quotaLimitField] || 0);
        const usageTable = useProfileScopedUsage ? 'profile_cycle_usage' : 'member_cycle_usage';

        if (currentCount < quotaLimit) {
          const nextCount = currentCount + 1;
          const { data: updatedUsageRow, error: usageError } = await supabaseAdmin
            .from(usageTable)
            .update({
              [quotaField]: nextCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', usage.id)
            .eq(quotaField, currentCount)
            .select('id, text_unlocked_count, audio_unlocked_count')
            .maybeSingle();

          if (!usageError && updatedUsageRow) {
            const unlock = await contentsService.createContentUnlock({
              user_id: userId,
              profile_id: effectiveProfileId,
              content_id: content.id,
              source: 'quota',
              currency: content.price_currency || 'USD',
              metadata: {
                cycle_id: cycle.id,
                subscription_id: subscription.id,
                ...(useProfileScopedUsage ? { profile_id: familyContext.profileId } : {}),
              },
            });

            return res.status(200).json({
              success: true,
              data: {
                unlocked: true,
                source: 'quota',
                unlock,
                cycle_usage: {
                  used: nextCount,
                  quota: quotaLimit,
                },
              },
            });
          }
        }

        if (useProfileScopedUsage) {
          const currentBonusUsed = Number(usage.bonus_used_count || 0);
          const bonusQuota = Number(usage.bonus_quota || 0);

          if (currentBonusUsed < bonusQuota) {
            const nextBonusUsed = currentBonusUsed + 1;
            const { data: updatedBonusUsageRow, error: bonusUsageError } = await supabaseAdmin
              .from('profile_cycle_usage')
              .update({
                bonus_used_count: nextBonusUsed,
                updated_at: new Date().toISOString(),
              })
              .eq('id', usage.id)
              .eq('bonus_used_count', currentBonusUsed)
              .select('id, bonus_used_count')
              .maybeSingle();

            if (!bonusUsageError && updatedBonusUsageRow) {
              const unlock = await contentsService.createContentUnlock({
                user_id: userId,
                profile_id: effectiveProfileId,
                content_id: content.id,
                source: 'bonus',
                currency: content.price_currency || 'USD',
                metadata: {
                  cycle_id: cycle.id,
                  subscription_id: subscription.id,
                  profile_id: familyContext.profileId,
                  profile_bonus: true,
                },
              });

              return res.status(200).json({
                success: true,
                data: {
                  unlocked: true,
                  source: 'bonus',
                  unlock,
                  profile_bonus_remaining: Math.max(0, bonusQuota - nextBonusUsed),
                },
              });
            }
          }
        } else {
          const nowIso = new Date().toISOString();
          const bonusType = isTextContent ? 'text' : 'audio';
          const { data: bonusCredits, error: bonusError } = await supabaseAdmin
            .from('bonus_credits')
            .select('*')
            .eq('user_id', userId)
            .gt('expires_at', nowIso)
            .in('bonus_type', [bonusType, 'flex'])
            .order('expires_at', { ascending: true })
            .limit(10);

          if (bonusError) throw bonusError;

          const bonusCredit = (bonusCredits || []).find(
            (item) => Number(item.quantity_used || 0) < Number(item.quantity_total || 0)
          ) || null;
          if (bonusCredit) {
            const nextUsed = Number(bonusCredit.quantity_used || 0) + 1;
            const updatePayload = {
              quantity_used: nextUsed,
              updated_at: new Date().toISOString(),
            };

            if (nextUsed >= Number(bonusCredit.quantity_total || 0)) {
              updatePayload.consumed_at = new Date().toISOString();
            }

            const { data: updatedBonusRow, error: bonusUpdateError } = await supabaseAdmin
              .from('bonus_credits')
              .update(updatePayload)
              .eq('id', bonusCredit.id)
              .eq('quantity_used', bonusCredit.quantity_used)
              .select('id, quantity_used')
              .maybeSingle();

            if (!bonusUpdateError && updatedBonusRow) {
              const unlock = await contentsService.createContentUnlock({
                user_id: userId,
                content_id: content.id,
                source: 'bonus',
                bonus_credit_id: bonusCredit.id,
                currency: content.price_currency || 'USD',
                metadata: {
                  cycle_id: cycle.id,
                  subscription_id: subscription.id,
                },
              });

              const { error: usageBonusError } = await supabaseAdmin
                .from('member_cycle_usage')
                .update({
                  bonus_used_count: Number(usage.bonus_used_count || 0) + 1,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', usage.id);

              if (usageBonusError) {
                console.warn('Unable to increment bonus_used_count:', usageBonusError.message);
              }

              return res.status(200).json({
                success: true,
                data: {
                  unlocked: true,
                  source: 'bonus',
                  unlock,
                  bonus_credit_id: bonusCredit.id,
                },
              });
            }
          }
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
        currency: content.price_currency || 'USD',
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
        currency: content.price_currency || 'USD',
        email: req.user.email,
        name: req.user.full_name || req.user.email,
        userId,
        txPrefix: 'CNT',
        redirectPath: `/catalogue/${content.id}`,
        redirectBaseUrl,
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
      currency: content.price_currency || 'USD',
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
          currency: content.price_currency || 'USD',
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

module.exports = {
  listContents,
  getContent,
  getContentFileUrl,
  getContentAccess,
  unlockContent,
  verifyUnlockPayment,
  listCategories,
  getCategory,
  createContent,
  updateContent,
  deleteContent,
  getContentRecommendations,
};
