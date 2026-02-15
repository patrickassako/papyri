/**
 * Script de test Flutterwave Service
 * Teste la configuration et les méthodes de base
 *
 * Usage: node src/scripts/test-flutterwave.js
 */

require('dotenv').config();
const flutterwaveService = require('../services/flutterwave.service');

async function main() {
  console.log('🚀 Test du service Flutterwave...\n');

  try {
    // Check if Flutterwave is configured
    console.log('1️⃣  Vérification de la configuration...');
    const isConfigured = flutterwaveService.isConfigured();

    if (!isConfigured) {
      console.log('⚠️  Flutterwave n\'est pas configuré (mode dev)');
      console.log('   Variables manquantes dans .env:');
      console.log('   - FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxx');
      console.log('   - FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxx');
      console.log('   - FLUTTERWAVE_WEBHOOK_HASH=xxx');
      console.log('\n💡 Pour tester avec Flutterwave:');
      console.log('   1. Créer un compte sur https://flutterwave.com');
      console.log('   2. Obtenir les clés TEST');
      console.log('   3. Ajouter dans .env');
      console.log('   4. Relancer ce script\n');
      process.exit(0);
    }

    console.log('✅ Flutterwave configuré\n');

    // Test formatAmount
    console.log('2️⃣  Test formatAmount...');
    const amount1 = flutterwaveService.formatAmount(5.00);
    const amount2 = flutterwaveService.formatAmount(50.00);
    console.log(`   Monthly: ${amount1} EUR`);
    console.log(`   Yearly: ${amount2} EUR`);
    console.log('   ✅ Amounts formatted\n');

    // Test webhook signature verification (mock)
    console.log('3️⃣  Test webhook signature verification...');
    const mockPayload = { event: 'charge.completed', data: { id: '123' } };
    const mockSignature = 'test-signature';
    const isValid = flutterwaveService.verifyWebhookSignature(mockPayload, mockSignature);
    console.log(`   Signature valid: ${isValid}`);
    console.log('   ✅ Verification tested (mock)\n');

    console.log('🎉 Tests Flutterwave terminés!\n');

    console.log('📝 Prochaines étapes:');
    console.log('   1. Appliquer migration 006 (subscriptions tables)');
    console.log('   2. Implémenter subscriptions.service.js');
    console.log('   3. Créer les endpoints API /api/subscriptions/*');
    console.log('   4. Implémenter webhook /webhooks/flutterwave');
    console.log('   5. Tester avec Flutterwave test mode\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
