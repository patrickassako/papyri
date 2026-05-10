// Stripe publishable key for the mobile app.
// Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in the build env (eas.json or .env)
// to override. Falls back to an empty string in dev so the app still boots.
export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// Merchant identifier for Apple Pay (iOS only).
export const STRIPE_MERCHANT_ID =
  process.env.EXPO_PUBLIC_STRIPE_MERCHANT_ID || 'merchant.com.papyri.app';
