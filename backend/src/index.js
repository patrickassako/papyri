const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// AdminJS temporarily disabled - Node.js 22 compatibility issue
// const setupAdminJS = require('./routes/admin.routes');

const app = express();

// Security middleware (AdminJS needs special CSP configuration)
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true
}));

// AdminJS routes (must be BEFORE body parsing middleware for file uploads)
// Temporarily disabled - Node.js 22 compatibility issue
// const { admin, router: adminRouter } = setupAdminJS();
// app.use(admin.options.rootPath, adminRouter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OpenAPI spec (generated file in ../docs)
app.get('/openapi.yaml', (req, res) => {
  const specPath = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
  return res.sendFile(specPath);
});

// Swagger UI (CDN-based, no extra backend dependency required)
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

// API routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/api', contentsRoutes);  // Catalogue routes
app.use('/api', searchRoutes);    // Search routes
app.use('/api/subscriptions', subscriptionsRoutes);  // Subscriptions routes
app.use('/webhooks', webhooksRoutes);  // Webhooks routes (Flutterwave)
app.use('/', homeRoutes);         // Home route
app.use('/', readingRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
