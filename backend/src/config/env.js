require('dotenv').config();

module.exports = {
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  },

  // Cloudflare R2 (S3-compatible)
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketContent: process.env.R2_BUCKET_CONTENT || 'biblio-content-private',
    bucketCovers: process.env.R2_BUCKET_COVERS || 'biblio-covers-public',
    cdnDomain: process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_CDN_DOMAIN
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  },

  // Flutterwave
  flutterwave: {
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
    webhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH
  },

  // Firebase
  firebase: {
    projectId:   process.env.FIREBASE_PROJECT_ID,
    privateKey:  process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  },

  // Email (provider-agnostic)
  email: {
    provider: process.env.EMAIL_PROVIDER || 'brevo', // 'brevo' | 'ses'
    senderEmail: process.env.SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL || 'noreply@papyri.com',
    senderName: process.env.SENDER_NAME || process.env.BREVO_SENDER_NAME || 'Papyri',
  },

  // Brevo (used when EMAIL_PROVIDER=brevo)
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL || 'noreply@papyri.com',
    senderName: process.env.BREVO_SENDER_NAME || 'Papyri',
  },

  // AWS SES (used when EMAIL_PROVIDER=ses)
  ses: {
    region: process.env.AWS_SES_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  // Meilisearch
  meilisearch: {
    host: process.env.MEILISEARCH_HOST,
    apiKey: process.env.MEILISEARCH_API_KEY
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET
  },

  // App
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3001,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  },

  // Frontend URL (for emails)
  // IMPORTANT: set FRONTEND_URL=https://www.papyrihub.net in production env vars
  frontendUrl: (() => {
    const url = process.env.FRONTEND_URL || '';
    if (!url || url.includes('localhost') || url.includes('127.0.0.1')) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('[config] FRONTEND_URL not set or is localhost in production — emails will have broken links');
      }
      return url || 'http://localhost:3000';
    }
    return url;
  })(),
};
