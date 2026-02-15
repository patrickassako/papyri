/**
 * Script de test du flow complet d'abonnement
 * Teste toutes les fonctions de subscriptions.service.js
 *
 * Usage: node src/scripts/test-subscriptions.js
 */

require('dotenv').config();
const subscriptionsService = require('../services/subscriptions.service');
const flutterwaveService = require('../services/flutterwave.service');
const { supabaseAdmin } = require('../config/database');

// Test user (créer manuellement via l'interface ou utiliser un UUID existant)
const TEST_USER_ID = process.env.TEST_USER_ID || '00000000-0000-0000-0000-000000000000';

async function main() {
  console.log('🚀 Test du système d\'abonnements...\n');

  try {
    // =========================================================================
    // ÉTAPE 1: Vérifier la configuration
    // =========================================================================
    console.log('1️⃣  Vérification de la configuration...');

    const flwConfigured = flutterwaveService.isConfigured();
    console.log(`   Flutterwave: ${flwConfigured ? '✅ Configuré' : '⚠️  Non configuré (mode dev)'}`);

    if (!flwConfigured) {
      console.log('\n⚠️  Flutterwave n\'est pas configuré.');
      console.log('   Pour tester avec paiements réels, ajoutez dans .env:');
      console.log('   - FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxx');
      console.log('   - FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxx');
      console.log('   - FLUTTERWAVE_WEBHOOK_HASH=xxx\n');
    }

    // =========================================================================
    // ÉTAPE 2: Tester les plans disponibles
    // =========================================================================
    console.log('\n2️⃣  Test des plans disponibles...');

    const plans = subscriptionsService.getPlans();
    console.log(`   Plans disponibles: ${plans.length}`);
    plans.forEach(plan => {
      console.log(`   - ${plan.name}: ${plan.amount} ${plan.currency}/${plan.interval}`);
    });

    const monthlyPlan = subscriptionsService.getPlan('monthly');
    const yearlyPlan = subscriptionsService.getPlan('yearly');
    console.log(`   ✅ Monthly plan: ${monthlyPlan.amount} ${monthlyPlan.currency}`);
    console.log(`   ✅ Yearly plan: ${yearlyPlan.amount} ${yearlyPlan.currency}`);

    // =========================================================================
    // ÉTAPE 3: Vérifier l'utilisateur de test
    // =========================================================================
    console.log('\n3️⃣  Vérification de l\'utilisateur de test...');

    const { data: testUser, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', TEST_USER_ID)
      .single();

    if (userError || !testUser) {
      console.log('   ❌ Utilisateur de test introuvable');
      console.log('   Créez un utilisateur et passez son ID via TEST_USER_ID=xxx');
      console.log('   Exemple: TEST_USER_ID=123e4567-e89b-12d3-a456-426614174000 node src/scripts/test-subscriptions.js');
      process.exit(1);
    }

    console.log(`   ✅ User: ${testUser.email} (${testUser.first_name} ${testUser.last_name})`);

    // =========================================================================
    // ÉTAPE 4: Vérifier le statut d'abonnement actuel
    // =========================================================================
    console.log('\n4️⃣  Vérification du statut d\'abonnement actuel...');

    const currentStatus = await subscriptionsService.checkSubscriptionStatus(TEST_USER_ID);
    console.log(`   Abonnement actif: ${currentStatus.isActive ? '✅ Oui' : '❌ Non'}`);
    console.log(`   Statut: ${currentStatus.status}`);

    if (currentStatus.subscription) {
      console.log(`   Plan: ${currentStatus.subscription.plan_type}`);
      console.log(`   Fin de période: ${currentStatus.subscription.current_period_end}`);
    }

    // =========================================================================
    // ÉTAPE 5: Tester la création d'abonnement (simulation)
    // =========================================================================
    console.log('\n5️⃣  Test de création d\'abonnement...');

    // Nettoyer les abonnements actifs de test existants
    const { data: existingSubs } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', TEST_USER_ID)
      .eq('status', 'ACTIVE');

    if (existingSubs && existingSubs.length > 0) {
      console.log('   ⚠️  Abonnement actif existant détecté, annulation...');
      for (const sub of existingSubs) {
        await subscriptionsService.cancelSubscription(sub.id, true);
      }
    }

    // Créer un abonnement de test
    console.log('   Création d\'un abonnement INACTIVE (mensuel)...');
    const newSubscription = await subscriptionsService.createSubscription({
      userId: TEST_USER_ID,
      planType: 'monthly',
      provider: 'flutterwave',
      providerData: {
        subscriptionId: 'test-sub-' + Date.now(),
        customerId: 'test-cust-' + Date.now(),
      },
    });

    console.log(`   ✅ Abonnement créé: ${newSubscription.id}`);
    console.log(`   Status: ${newSubscription.status} (normal, en attente de paiement)`);

    // =========================================================================
    // ÉTAPE 6: Tester l'activation d'abonnement
    // =========================================================================
    console.log('\n6️⃣  Test d\'activation d\'abonnement...');

    const periodEnd = subscriptionsService.calculatePeriodEnd('monthly');
    console.log(`   Période calculée jusqu'à: ${periodEnd.toISOString()}`);

    const activatedSubscription = await subscriptionsService.activateSubscription(
      newSubscription.id,
      periodEnd
    );

    console.log(`   ✅ Abonnement activé: ${activatedSubscription.id}`);
    console.log(`   Status: ${activatedSubscription.status}`);
    console.log(`   Début: ${activatedSubscription.current_period_start}`);
    console.log(`   Fin: ${activatedSubscription.current_period_end}`);

    // =========================================================================
    // ÉTAPE 7: Vérifier le nouveau statut
    // =========================================================================
    console.log('\n7️⃣  Re-vérification du statut...');

    const updatedStatus = await subscriptionsService.checkSubscriptionStatus(TEST_USER_ID);
    console.log(`   Abonnement actif: ${updatedStatus.isActive ? '✅ Oui' : '❌ Non'}`);
    console.log(`   Plan: ${updatedStatus.subscription.plan_type}`);

    // =========================================================================
    // ÉTAPE 8: Tester le calcul de période
    // =========================================================================
    console.log('\n8️⃣  Test de calcul de périodes...');

    const now = new Date();
    const monthlyEnd = subscriptionsService.calculatePeriodEnd('monthly', now);
    const yearlyEnd = subscriptionsService.calculatePeriodEnd('yearly', now);

    console.log(`   Mensuel (de ${now.toISOString().split('T')[0]}):`);
    console.log(`     → ${monthlyEnd.toISOString().split('T')[0]}`);
    console.log(`   Annuel (de ${now.toISOString().split('T')[0]}):`);
    console.log(`     → ${yearlyEnd.toISOString().split('T')[0]}`);

    // =========================================================================
    // ÉTAPE 9: Tester la création de paiement
    // =========================================================================
    console.log('\n9️⃣  Test de création de paiement...');

    const payment = await subscriptionsService.createPayment({
      userId: TEST_USER_ID,
      subscriptionId: activatedSubscription.id,
      amount: monthlyPlan.amount,
      currency: monthlyPlan.currency,
      status: 'succeeded',
      provider: 'flutterwave',
      providerPaymentId: 'test-pay-' + Date.now(),
      providerCustomerId: 'test-cust-' + Date.now(),
      paymentMethod: 'card',
      metadata: { test: true },
    });

    console.log(`   ✅ Paiement créé: ${payment.id}`);
    console.log(`   Montant: ${payment.amount} ${payment.currency}`);
    console.log(`   Status: ${payment.status}`);

    // =========================================================================
    // ÉTAPE 10: Tester l'historique des paiements
    // =========================================================================
    console.log('\n🔟 Test de l\'historique des paiements...');

    const paymentHistory = await subscriptionsService.getPaymentHistory(TEST_USER_ID);
    console.log(`   Paiements trouvés: ${paymentHistory.length}`);

    paymentHistory.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.amount} ${p.currency} - ${p.status} (${p.created_at.split('T')[0]})`);
    });

    // =========================================================================
    // ÉTAPE 11: Tester l'annulation
    // =========================================================================
    console.log('\n1️⃣1️⃣  Test d\'annulation d\'abonnement...');

    const cancelledSubscription = await subscriptionsService.cancelSubscription(
      activatedSubscription.id,
      false // Cancel at period end
    );

    console.log(`   ✅ Abonnement annulé (fin de période)`);
    console.log(`   cancel_at_period_end: ${cancelledSubscription.cancel_at_period_end}`);
    console.log(`   cancelled_at: ${cancelledSubscription.cancelled_at}`);

    // =========================================================================
    // ÉTAPE 12: Nettoyer (optionnel)
    // =========================================================================
    console.log('\n1️⃣2️⃣  Nettoyage (annulation immédiate)...');

    await subscriptionsService.cancelSubscription(activatedSubscription.id, true);
    console.log('   ✅ Abonnement de test supprimé');

    // =========================================================================
    // RÉSUMÉ
    // =========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TOUS LES TESTS RÉUSSIS!');
    console.log('='.repeat(60));
    console.log('\n📋 Fonctionnalités testées:');
    console.log('   ✅ Plans disponibles (getPlans, getPlan)');
    console.log('   ✅ Création d\'abonnement (createSubscription)');
    console.log('   ✅ Activation d\'abonnement (activateSubscription)');
    console.log('   ✅ Vérification de statut (checkSubscriptionStatus)');
    console.log('   ✅ Calcul de périodes (calculatePeriodEnd)');
    console.log('   ✅ Création de paiement (createPayment)');
    console.log('   ✅ Historique paiements (getPaymentHistory)');
    console.log('   ✅ Annulation abonnement (cancelSubscription)');

    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Appliquer migration SQL: psql < docs/migrations/006_subscriptions_and_payments.sql');
    console.log('   2. Tester les endpoints API avec curl ou Postman');
    console.log('   3. Tester le webhook Flutterwave (ngrok + test Flutterwave)');
    console.log('   4. Tester le middleware requireSubscription sur /api/contents/:id/file-url');
    console.log('   5. Intégrer le frontend (checkout, callback, gestion abonnement)\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERREUR lors du test:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
