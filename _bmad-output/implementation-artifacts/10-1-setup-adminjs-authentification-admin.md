# Story 10.1: Setup AdminJS & Authentification Admin

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a administrateur,
I want acceder a un back-office securise via /admin,
So that je puisse gerer la plateforme avec une interface dediee.

## Acceptance Criteria

1. **AC1 — Integration AdminJS** : Given un backend Express.js, When AdminJS est installe, Then il est accessible sur la route `/admin` et integre dans Express.js
2. **AC2 — Authentification Admin** : Given un utilisateur avec role `admin` en base, When il accede a `/admin`, Then l'authentification verifie le role `admin` via JWT
3. **AC3 — Protection 403** : Given un utilisateur non-admin, When il tente d'acceder a `/admin`, Then il recoit un 403 Forbidden
4. **AC4 — Audit Trail** : Given une action admin effectuee, When l'action est terminee, Then elle est loguee dans une table `audit_logs` (admin_id, action, resource, resource_id, timestamp, details JSON)
5. **AC5 — HTTPS uniquement** : Given le back-office en production, When il est deploye, Then il est accessible uniquement en HTTPS

## Tasks / Subtasks

- [ ] **Task 1 : Installer AdminJS et ses dependances** (AC: #1)
  - [ ] 1.1 Installer packages npm : `adminjs`, `@adminjs/express`, `@adminjs/sql`
  - [ ] 1.2 Creer fichier de configuration AdminJS : `backend/src/config/adminjs.js`
  - [ ] 1.3 Configurer branding de base (titre "Bibliotheque Admin", couleurs primary #B5651D)
  - [ ] 1.4 Connecter AdminJS a Supabase PostgreSQL (via connexion existante)

- [ ] **Task 2 : Creer la route /admin et integrer dans Express** (AC: #1)
  - [ ] 2.1 Creer fichier `backend/src/routes/admin.js`
  - [ ] 2.2 Initialiser AdminJS avec configuration
  - [ ] 2.3 Creer router Express pour AdminJS
  - [ ] 2.4 Monter le router sur `/admin` dans `backend/src/app.js`
  - [ ] 2.5 Tester acces a `http://localhost:3000/admin`

- [ ] **Task 3 : Implementer authentification admin** (AC: #2, #3)
  - [ ] 3.1 Modifier middleware `requireRole('admin')` dans `backend/src/middleware/auth.js` si necessaire
  - [ ] 3.2 Creer authentification provider AdminJS utilisant JWT existant
  - [ ] 3.3 Proteger toutes les routes AdminJS avec verification role `admin`
  - [ ] 3.4 Rediriger vers `/auth/login` si non authentifie
  - [ ] 3.5 Afficher erreur 403 si authentifie mais pas role admin

- [ ] **Task 4 : Creer table audit_logs** (AC: #4)
  - [ ] 4.1 Creer migration `backend/migrations/020_create_audit_logs.sql`
  - [ ] 4.2 Schema : id UUID, admin_id UUID, action VARCHAR(100), resource VARCHAR(100), resource_id UUID, timestamp TIMESTAMPTZ, details JSONB
  - [ ] 4.3 Executer migration sur base de donnees
  - [ ] 4.4 Creer indexes : idx_audit_admin, idx_audit_timestamp

- [ ] **Task 5 : Implementer audit trail logging** (AC: #4)
  - [ ] 5.1 Creer service `backend/src/services/audit.service.js`
  - [ ] 5.2 Fonction `logAuditEvent(adminId, action, resource, resourceId, details)`
  - [ ] 5.3 Integrer hooks AdminJS pour logger automatiquement les actions CRUD
  - [ ] 5.4 Logger : create, update, delete (avec details before/after en JSON)

- [ ] **Task 6 : Configurer dashboard de base AdminJS** (AC: #1)
  - [ ] 6.1 Creer dashboard avec menu lateral
  - [ ] 6.2 Ajouter ressources de base : Users, Subscriptions, Contents (lecture seule pour l'instant)
  - [ ] 6.3 Configurer navigation et labels en francais
  - [ ] 6.4 Tester navigation entre sections

- [ ] **Task 7 : Configuration securite production** (AC: #5)
  - [ ] 7.1 Ajouter variable d'environnement `ADMIN_BASE_PATH=/admin`
  - [ ] 7.2 Configurer cookie AdminJS : httpOnly, secure (HTTPS uniquement en prod)
  - [ ] 7.3 Ajouter CSRF protection
  - [ ] 7.4 Documenter acces admin en production (HTTPS obligatoire)

- [ ] **Task 8 : Tests et validation** (AC: #1, #2, #3, #4, #5)
  - [ ] 8.1 Test : acces `/admin` sans authentification → redirect login
  - [ ] 8.2 Test : acces `/admin` avec user role=user → 403 Forbidden
  - [ ] 8.3 Test : acces `/admin` avec user role=admin → dashboard OK
  - [ ] 8.4 Test : action CRUD loguee dans audit_logs
  - [ ] 8.5 Test : HTTPS force en production (variable NODE_ENV=production)

## Dev Notes

### AdminJS Configuration

**Installation :**
```bash
cd backend
npm install adminjs @adminjs/express @adminjs/sql @adminjs/postgresql
```

**Architecture :**
```
backend/src/
├── config/
│   └── adminjs.js           → Configuration AdminJS (branding, ressources)
├── routes/
│   └── admin.js             → Route /admin protegee
├── services/
│   └── audit.service.js     → Service audit trail
└── middleware/
    └── auth.js              → Middleware requireRole('admin')
```

### Configuration AdminJS de Base

**backend/src/config/adminjs.js :**
```javascript
const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const AdminJSSequelize = require('@adminjs/sql');

AdminJS.registerAdapter({
  Resource: AdminJSSequelize.Resource,
  Database: AdminJSSequelize.Database,
});

const adminOptions = {
  resources: [],
  rootPath: '/admin',
  branding: {
    companyName: 'Bibliotheque Numerique Privee',
    logo: false, // URL logo si disponible
    theme: {
      colors: {
        primary100: '#B5651D', // Terre d'Afrique
        primary80: '#D4A017',  // Or du Sahel
        primary60: '#2E4057',  // Indigo Adire
      },
    },
  },
  locale: {
    language: 'fr',
    translations: {
      fr: {
        labels: {
          loginWelcome: 'Connexion Back-Office',
        },
      },
    },
  },
};

module.exports = { adminOptions };
```

### Route Admin avec Authentification

**backend/src/routes/admin.js :**
```javascript
const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const { adminOptions } = require('../config/adminjs');
const { verifyJWT, requireRole } = require('../middleware/auth');

const adminJs = new AdminJS(adminOptions);

// Authentification custom utilisant notre JWT existant
const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  adminJs,
  {
    authenticate: async (email, password) => {
      // Utiliser le service auth existant
      const authService = require('../services/auth.service');
      try {
        const result = await authService.login(email, password);

        // Verifier role admin
        if (result.user.role !== 'admin') {
          return null; // Refuse connexion si pas admin
        }

        return result.user; // Retourne user si admin
      } catch (error) {
        return null;
      }
    },
    cookiePassword: process.env.ADMIN_COOKIE_SECRET || 'secret-temp-dev',
  },
  null,
  {
    resave: false,
    saveUninitialized: true,
    secret: process.env.ADMIN_SESSION_SECRET || 'secret-temp-dev',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    },
  }
);

// Alternative : protection via middleware JWT existant
// router.use('/admin', verifyJWT, requireRole('admin'), adminJs.router);

module.exports = adminRouter;
```

### Integration dans Express

**backend/src/app.js :**
```javascript
const express = require('express');
const adminRouter = require('./routes/admin');

const app = express();

// ... autres middlewares ...

// Mount admin router
app.use(adminRouter);

// ... autres routes ...

module.exports = app;
```

### Table Audit Logs

**backend/migrations/020_create_audit_logs.sql :**
```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
    -- 'create' | 'update' | 'delete' | 'login' | 'logout' | 'custom'
  resource      VARCHAR(100) NOT NULL,
    -- 'users' | 'contents' | 'subscriptions' | 'categories' | etc.
  resource_id   UUID,
  details       JSONB,
    -- Before/after values, additional context
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_admin ON audit_logs(admin_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource);
```

### Service Audit Trail

**backend/src/services/audit.service.js :**
```javascript
const { supabaseAdmin } = require('../config/database');

async function logAuditEvent(adminId, action, resource, resourceId = null, details = {}) {
  try {
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action,
        resource,
        resource_id: resourceId,
        details,
      });

    console.log(`Audit: ${action} on ${resource} by admin ${adminId}`);
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Ne pas bloquer l'action si le logging echoue
  }
}

module.exports = {
  logAuditEvent,
};
```

### Hooks AdminJS pour Audit

**backend/src/config/adminjs.js (ajout hooks) :**
```javascript
const { logAuditEvent } = require('../services/audit.service');

const adminOptions = {
  resources: [
    {
      resource: Users,
      options: {
        actions: {
          new: {
            after: async (response, request, context) => {
              await logAuditEvent(
                context.currentAdmin.id,
                'create',
                'users',
                response.record.id,
                { data: response.record.params }
              );
              return response;
            },
          },
          edit: {
            after: async (response, request, context) => {
              await logAuditEvent(
                context.currentAdmin.id,
                'update',
                'users',
                response.record.id,
                {
                  before: request.payload.record,
                  after: response.record.params
                }
              );
              return response;
            },
          },
          delete: {
            after: async (response, request, context) => {
              await logAuditEvent(
                context.currentAdmin.id,
                'delete',
                'users',
                response.record.id,
                { data: request.payload.record }
              );
              return response;
            },
          },
        },
      },
    },
  ],
  // ... reste de la config
};
```

### Ressources AdminJS de Base

**Ressources a exposer (lecture seule pour Story 10.1) :**
- `users` : Liste utilisateurs (id, email, full_name, role, created_at)
- `subscriptions` : Liste abonnements (id, user_id, plan, status, current_period_end)
- `contents` : Liste contenus (id, title, author, content_type, format, is_published)

**CRUD complet sera ajoute dans stories suivantes (10.2, 10.3, 10.4)**

### Securite

**Variables d'environnement :**
```env
# .env
ADMIN_COOKIE_SECRET=your-secret-key-32-chars-min
ADMIN_SESSION_SECRET=your-session-secret-32-chars-min
NODE_ENV=production  # Force HTTPS cookies
```

**Production checklist :**
- ✅ HTTPS obligatoire (`secure: true` cookies)
- ✅ CSRF protection activee
- ✅ Session secret fort (32+ caracteres)
- ✅ Rate limiting sur route `/admin` (10 req/min/IP)
- ✅ Audit trail toutes actions admin

### Testing

**Tests manuels :**
```bash
# 1. User role=user tente acces
curl -H "Authorization: Bearer <user-token>" http://localhost:3000/admin
# Expected: 403 Forbidden

# 2. Admin role=admin accede
curl -H "Authorization: Bearer <admin-token>" http://localhost:3000/admin
# Expected: 200 + dashboard HTML

# 3. Action CRUD
# → Verifier audit_logs en DB
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

### Creer un Utilisateur Admin Initial

**Migration ou script seed :**
```sql
-- backend/migrations/021_create_initial_admin.sql
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'admin@bibliotheque.app',
  '$2b$12$...',  -- Hasher avec bcrypt
  'Admin System',
  'admin',
  true
)
ON CONFLICT (email) DO NOTHING;
```

Ou via script Node.js :
```javascript
// backend/scripts/create-admin.js
const bcrypt = require('bcrypt');
const { supabaseAdmin } = require('../src/config/database');

async function createAdmin(email, password) {
  const passwordHash = await bcrypt.hash(password, 12);

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      email,
      password_hash: passwordHash,
      full_name: 'Admin System',
      role: 'admin',
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  console.log('Admin created:', data.email);
}

// Usage: node scripts/create-admin.js admin@bibliotheque.app SecurePassword123
createAdmin(process.argv[2], process.argv[3]);
```

### Dependencies

**Epic 1 (DONE) :**
- ✅ Table `users` avec colonne `role`
- ✅ Middleware `verifyJWT` et `requireRole`
- ✅ Service auth.service.js pour login

**External Services :**
- ✅ Supabase PostgreSQL (connection existante)
- ✅ Express.js (backend running)

### References

- [AdminJS Documentation](https://docs.adminjs.co/)
- [AdminJS Express Integration](https://docs.adminjs.co/installation/plugins/express)
- [Source: _bmad-output/architecture.md#Section 13 — Back-Office AdminJS]
- [Source: _bmad-output/db_schema.md#Table audit_logs]
- [Source: _bmad-output/api_spec.md#Admin Routes]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.1]

## Dev Agent Record

### Agent Model Used

<!-- Agent will fill this -->

### Debug Log References

<!-- Agent will fill this -->

### Completion Notes List

<!-- Agent will fill this as tasks are completed -->

### File List

<!-- Agent will list all files created/modified -->

### Change Log

<!-- Agent will summarize changes made -->
