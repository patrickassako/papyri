require('dotenv').config();

module.exports = {
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY
  },

  // Cloudflare R2 (S3-compatible)
  r2: {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketContent: process.env.R2_BUCKET_CONTENT || 'biblio-content-private',
    bucketCovers: process.env.R2_BUCKET_COVERS || 'biblio-covers-public',
    cdnDomain: process.env.CLOUDFLARE_CDN_DOMAIN
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  },

  // Flutterwave
  flutterwave: {
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
    webhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH
  },

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY
  },

  // Brevo
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL || 'noreply@bibliotheque.com',
    senderName: process.env.BREVO_SENDER_NAME || 'Bibliothèque Numérique'
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
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
};
