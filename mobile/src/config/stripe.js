// Stripe publishable key for the mobile app.
// The pk_* key is *publishable* by design — Stripe distributes it for use in
// public clients (web/mobile), so embedding it here is safe. Replace with the
// live key for production builds.
//
// EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY env override is honored when the bundle
// is produced via Expo Metro (e.g. eas build). When running gradle directly,
// Metro doesn't inline the env var, so we keep an explicit fallback below.
const FALLBACK_PK =
  'pk_test_51T2fP6J6h8QnDjRzilP9WjthGHC8rgNTBUJkufHbeStf7iSsYJ6lQPXIeMv7sT9c7ZycYyFLnDWWjhMsAkUirhCN00hhDTZ4SL';

export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || FALLBACK_PK;

// Merchant identifier for Apple Pay (iOS only).
export const STRIPE_MERCHANT_ID =
  process.env.EXPO_PUBLIC_STRIPE_MERCHANT_ID || 'merchant.com.papyri.app';
