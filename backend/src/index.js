const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const setupAdminJS = require('./routes/admin.routes');
const { startScheduler } = require('./scheduler/subscription-scheduler');

const app = express();

// Security middleware (AdminJS needs relaxed CSP in dev)
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
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
const webhooksRoutes = require('./routes/webhooks.routes');
const errorHandler = require('./middleware/errorHandler');

// Start server with async AdminJS setup
const PORT = process.env.PORT || 3001;

async function startServer() {
  // 1. Mount admin custom routes BEFORE AdminJS (needs raw access)
  const uploadRoutes = require('./admin/upload.routes');
  const dashboardStatsRoutes = require('./admin/dashboard-stats.routes');
  const adminApiSessionCheck = (req, res, next) => {
    // Check admin session cookie exists (AdminJS session-based auth)
    if (!req.headers.cookie || !req.headers.cookie.includes('adminjs')) {
      return res.status(401).json({ error: 'Non autorise' });
    }
    next();
  };
  app.use('/admin/api', adminApiSessionCheck, uploadRoutes);
  app.use('/admin/api', adminApiSessionCheck, dashboardStatsRoutes);

  // 2. Mount AdminJS BEFORE body-parser (AdminJS handles its own parsing)
  try {
    const { admin, router: adminRouter } = await setupAdminJS();
    // Mount one-time invoice token endpoint BEFORE AdminJS router
    const { adminUtilRouter } = require('./routes/admin.routes');
    app.use('/admin', adminUtilRouter);
    app.use(admin.options.rootPath, adminRouter);
    app.locals.adminEnabled = true;
    console.log(`✅ AdminJS mounted on ${admin.options.rootPath}`);
  } catch (err) {
    console.error('⚠️  AdminJS failed to initialize:', err.message);
    console.error('   Back-office disabled. Server continues without /admin.');
  }

  // 2a. Stripe webhook — needs raw body BEFORE express.json() parses the request
  const { handleStripeWebhook } = require('./controllers/webhooks.controller');
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

  // 2b. Body parsing middleware (AFTER AdminJS, AFTER Stripe raw route)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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
  app.use('/webhooks', webhooksRoutes);
  app.use('/', homeRoutes);
  app.use('/', readingRoutes);

  // 5. Error handler (must be last)
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    if (app.locals.adminEnabled) {
      console.log(`📍 Back-office: http://localhost:${PORT}/admin`);
    }

    // Start subscription lifecycle scheduler
    startScheduler();
  });
}

startServer();

module.exports = app;
