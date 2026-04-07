const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const setupAdminJS = require('./routes/admin.routes');
const { startScheduler } = require('./scheduler/subscription-scheduler');
const logger = require('./utils/logger');

const app = express();

// Security middleware (AdminJS needs relaxed CSP in dev)
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'];
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true
}));

// Compression middleware
app.use(compression());

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const readingRoutes = require('./routes/reading');
const contentsRoutes = require('./routes/contents.routes');
const searchRoutes = require('./routes/search.routes');
const homeRoutes = require('./routes/home.routes');
const subscriptionsRoutes = require('./routes/subscriptions.routes');
const familyRoutes = require('./routes/family.routes');
const webhooksRoutes = require('./routes/webhooks.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const adminNotificationsRoutes = require('./routes/admin.notifications.routes');
const devicesRoutes = require('./routes/devices');
const publisherRoutes = require('./routes/publisher.routes');
const adminPublisherRoutes = require('./routes/admin.publisher.routes');
const adminGeneralRoutes       = require('./routes/admin.general.routes');
const adminRolesRoutes         = require('./routes/admin.roles.routes');
const adminInvitationsRoutes   = require('./routes/admin.invitations.routes');
const adminBooksRoutes         = require('./routes/admin.books.routes');
const adminSubscriptionsRoutes = require('./routes/admin.subscriptions.routes');
const adminCategoriesRoutes    = require('./routes/admin.categories.routes');
const adminPromoCodesRoutes    = require('./routes/admin.promoCodes.routes');
const adminSettingsRoutes      = require('./routes/admin.settings.routes');
const adminGeoRoutes           = require('./routes/admin.geo.routes');
const adminAnalyticsRoutes     = require('./routes/admin.analytics.routes');
const errorHandler = require('./middleware/errorHandler');

// Start server with async AdminJS setup
const PORT = process.env.PORT || 3001;

async function startServer() {
  // 1. Mount admin custom routes BEFORE AdminJS (needs raw access)
  const uploadRoutes = require('./admin/upload.routes');
  const dashboardStatsRoutes = require('./admin/dashboard-stats.routes');
  const { adminSessionGuard } = require('./routes/admin.routes');
  app.use('/admin/api', adminSessionGuard, uploadRoutes);
  app.use('/admin/api', adminSessionGuard, dashboardStatsRoutes);
  app.use('/admin/api/notifications', adminSessionGuard, express.json(), adminNotificationsRoutes.panel);

  // 2. Mount AdminJS BEFORE body-parser (AdminJS handles its own parsing)
  try {
    const { admin, router: adminRouter } = await setupAdminJS();
    // Mount one-time invoice token endpoint BEFORE AdminJS router
    const { adminUtilRouter } = require('./routes/admin.routes');
    app.use('/admin', adminUtilRouter);
    app.use(admin.options.rootPath, adminRouter);
    app.locals.adminEnabled = true;
    logger.info(`✅ AdminJS mounted on ${admin.options.rootPath}`);
  } catch (err) {
    logger.error('⚠️  AdminJS failed to initialize:', err.message);
    logger.error('   Back-office disabled. Server continues without /admin.');
  }

  // 2a. Stripe webhook — needs raw body BEFORE express.json() parses the request
  const { handleStripeWebhook } = require('./controllers/webhooks.controller');
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

  // 2b. Body parsing middleware (AFTER AdminJS, AFTER Stripe raw route)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
  app.use('/public', express.static(path.join(__dirname, '..', 'public')));

  // 3. Health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      admin: app.locals.adminEnabled || false,
    });
  });

  // OpenAPI spec
  app.get('/openapi.yaml', (req, res) => {
    const specPath = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
    return res.sendFile(specPath);
  });

  // Swagger UI
  app.get('/docs', (req, res) => {
    res
      .status(200)
      .type('html')
      .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>API Docs - Swagger UI</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    </script>
  </body>
</html>`);
  });

  // 4. API routes
  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);
  app.use('/api', contentsRoutes);
  app.use('/api', searchRoutes);
  app.use('/api/subscriptions', subscriptionsRoutes);
  app.use('/api/family', familyRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/devices', devicesRoutes);
  app.use('/api/admin/notifications', adminNotificationsRoutes);
  app.use('/webhooks', webhooksRoutes);
  app.use('/api/publisher', publisherRoutes);
  app.use('/api/admin/publishers',     adminPublisherRoutes);
  app.use('/api/admin/books-overview',      adminBooksRoutes);
  app.use('/api/admin/subscriptions-module', adminSubscriptionsRoutes);
  app.use('/api/admin/categories',           adminCategoriesRoutes);
  app.use('/api/admin/promo-codes',          adminPromoCodesRoutes);
  app.use('/api/admin/settings',             adminSettingsRoutes);
  app.use('/api/admin/geo-pricing',          adminGeoRoutes);
  app.use('/api/admin/analytics',            adminAnalyticsRoutes);
  app.use('/api/admin/roles',                adminRolesRoutes);
  app.use('/api/admin/invitations',          adminInvitationsRoutes);
  app.use('/api/admin',                      adminGeneralRoutes);
  app.use('/', homeRoutes);
  app.use('/', readingRoutes);

  // 5. Error handler (must be last)
  app.use(errorHandler);

  app.listen(PORT, async () => {
    logger.info(`✅ Server running on port ${PORT}`);
    logger.info(`📍 Health check: http://localhost:${PORT}/health`);

    // Startup config checks
    if (!process.env.BREVO_API_KEY) {
      logger.warn('⚠️  BREVO_API_KEY non configuré — les emails (bienvenue, factures, etc.) ne seront PAS envoyés.');
    } else {
      logger.info(`✅ Email provider: ${process.env.EMAIL_PROVIDER || 'brevo'} (sender: ${process.env.BREVO_SENDER_EMAIL || 'non défini'})`);
    }
    if (app.locals.adminEnabled) {
      logger.info(`📍 Back-office: http://localhost:${PORT}/admin`);
    }

    // Start subscription lifecycle scheduler
    startScheduler();

    // Initialize Meilisearch index (non-blocking)
    try {
      const meilisearch = require('./services/meilisearch.service');
      await meilisearch.initializeIndex();
      logger.info('🔍 Meilisearch index ready');
    } catch (err) {
      logger.warn('⚠️  Meilisearch unavailable (search will fallback to DB):', err.message);
    }
  });
}

startServer();

module.exports = app;
