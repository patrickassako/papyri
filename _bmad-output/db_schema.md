# Schema de base de donnees — Bibliotheque Numerique Privee

Version: 1.0
Reference contractuelle: Cahier de charge signe (Dimitri Talla / Afrik NoCode — 31/01/2026)
Reference produit: PRD v1.1
Reference technique: architecture.md
Base de donnees: **Supabase (PostgreSQL)**
Audience: Engineering, Backend, QA

---

## 1. Vue d'ensemble

### 1.1 Diagramme des entites (ERD simplifie)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  users   │────<│ subscriptions│     │  payments    │
│          │     │              │────<│              │
└────┬─────┘     └──────────────┘     └──────────────┘
     │
     │     ┌──────────────┐     ┌──────────────┐
     ├────<│  bookmarks   │     │  contents    │
     │     └──────────────┘     └──────┬───────┘
     │                                 │
     │     ┌──────────────┐            │     ┌──────────────────┐
     ├────<│  highlights  │            ├────<│ content_categories│
     │     └──────────────┘            │     └──────────────────┘
     │                                 │
     │     ┌──────────────┐            │     ┌──────────────┐
     ├────<│reading_history│           ├────<│   licenses   │
     │     └──────────────┘            │     └──────────────┘
     │                                 │
     │     ┌──────────────┐            │     ┌──────────────┐
     ├────<│  playlists   │────<───────┘     │  categories  │
     │     └──────────────┘                  └──────────────┘
     │
     │     ┌──────────────────┐     ┌──────────────────┐
     ├────<│offline_downloads │     │ rights_holders   │
     │     └──────────────────┘     └──────────────────┘
     │
     │     ┌──────────────────┐     ┌──────────────────┐
     ├────<│  notifications   │     │notification_prefs│
     │     └──────────────────┘     └──────────────────┘
     │
     │     ┌──────────────────┐
     └────<│ analytics_events │
            └──────────────────┘
```

### 1.2 Conventions

- Tous les identifiants primaires sont des **UUID v4** (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`)
- Tous les timestamps sont en **UTC** (`TIMESTAMPTZ`)
- Toutes les tables ont `created_at` et `updated_at`
- Soft delete via `deleted_at` la ou necessaire (users, contents)
- Les noms de tables et colonnes sont en **snake_case**

---

## 2. Tables principales

### 2.1 users

Utilisateurs de la plateforme (abonnes, visiteurs, admins).

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user',
    -- 'user' | 'admin'
  avatar_url    TEXT,
  language      VARCHAR(10) DEFAULT 'fr',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

---

### 2.2 subscriptions

Abonnements des utilisateurs.

```sql
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan            VARCHAR(20) NOT NULL,
    -- 'monthly' | 'yearly'
  status          VARCHAR(20) NOT NULL DEFAULT 'inactive',
    -- 'active' | 'inactive' | 'expired' | 'cancelled'
  price_eur       DECIMAL(10,2) NOT NULL,
  payment_gateway VARCHAR(20) NOT NULL,
    -- 'stripe' | 'flutterwave'
  gateway_subscription_id VARCHAR(255),
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE UNIQUE INDEX idx_subscriptions_active_user
  ON subscriptions(user_id) WHERE status = 'active';
```

---

### 2.3 payments

Historique de tous les paiements.

```sql
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id   UUID REFERENCES subscriptions(id),
  amount_eur        DECIMAL(10,2) NOT NULL,
  currency_original VARCHAR(10) NOT NULL DEFAULT 'EUR',
  amount_original   DECIMAL(10,2),
  payment_gateway   VARCHAR(20) NOT NULL,
    -- 'stripe' | 'flutterwave'
  gateway_payment_id VARCHAR(255) UNIQUE,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'succeeded' | 'failed' | 'refunded'
  webhook_event_id  VARCHAR(255) UNIQUE,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_subscription ON payments(subscription_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_gateway_id ON payments(gateway_payment_id);
```

---

### 2.4 contents

Catalogue de contenus (ebooks et audiobooks).

```sql
CREATE TABLE contents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(500) NOT NULL,
  author          VARCHAR(255) NOT NULL,
  description     TEXT,
  content_type    VARCHAR(20) NOT NULL,
    -- 'ebook' | 'audiobook'
  format          VARCHAR(10) NOT NULL,
    -- 'epub' | 'pdf' | 'mp3' | 'm4a'
  language        VARCHAR(10) NOT NULL DEFAULT 'fr',
  cover_url       TEXT,
  file_key        VARCHAR(500) NOT NULL,
    -- Cle S3 du fichier chiffre
  file_size_bytes BIGINT,
  duration_seconds INTEGER,
    -- Pour les audiobooks uniquement
  rights_holder_id UUID REFERENCES rights_holders(id),
  is_published    BOOLEAN DEFAULT FALSE,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_contents_type ON contents(content_type);
CREATE INDEX idx_contents_language ON contents(language);
CREATE INDEX idx_contents_published ON contents(is_published);
CREATE INDEX idx_contents_author ON contents(author);
```

---

### 2.5 categories

Categories pour organiser le catalogue.

```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  parent_id   UUID REFERENCES categories(id),
    -- Pour les sous-categories
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
```

---

### 2.6 content_categories

Relation N:N entre contenus et categories.

```sql
CREATE TABLE content_categories (
  content_id  UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, category_id)
);

CREATE INDEX idx_cc_content ON content_categories(content_id);
CREATE INDEX idx_cc_category ON content_categories(category_id);
```

---

### 2.7 rights_holders

Editeurs et ayants droit.

```sql
CREATE TABLE rights_holders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(20) NOT NULL,
    -- 'publisher' | 'author' | 'partner'
  contact_email VARCHAR(255),
  contract_info TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rh_name ON rights_holders(name);
CREATE INDEX idx_rh_type ON rights_holders(type);
```

---

### 2.8 bookmarks

Marque-pages utilisateur dans les ebooks.

> **Migration** : `docs/migrations/026_bookmarks_highlights.sql`

```sql
CREATE TABLE bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id  UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  position    JSONB NOT NULL,
    -- {cfi: "epubcfi(...)", percent: 42, chapter_label: "Chapitre 3"}
  label       VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookmarks_user_content ON bookmarks(user_id, content_id);
```

---

### 2.9 highlights

Surlignages utilisateur dans les ebooks.

> **Migration** : `docs/migrations/026_bookmarks_highlights.sql`

```sql
CREATE TABLE highlights (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id  UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  cfi_range   TEXT NOT NULL,
    -- CFI range epub.js pour restauration visuelle
  position    JSONB NOT NULL,
    -- {start_cfi: "...", end_cfi: "...", chapter: "ch3"}
  color       VARCHAR(20) DEFAULT 'yellow',
    -- 'yellow' | 'green' | 'blue' | 'pink'
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_highlights_user_content ON highlights(user_id, content_id);
```

---

### 2.10 reading_history

Historique et progression de lecture / ecoute.

```sql
CREATE TABLE reading_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id      UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  progress_percent DECIMAL(5,2) DEFAULT 0,
    -- 0.00 a 100.00
  last_position   JSONB,
    -- Ebook: {chapter: "ch3", cfi: "/4/2/8"}
    -- Audio: {position_seconds: 1234}
  total_time_seconds INTEGER DEFAULT 0,
  is_completed    BOOLEAN DEFAULT FALSE,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  last_read_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_rh_user_content ON reading_history(user_id, content_id);
CREATE INDEX idx_rh_user ON reading_history(user_id);
CREATE INDEX idx_rh_last_read ON reading_history(last_read_at DESC);
```

---

### 2.11 playlists

Playlists audio personnelles.

```sql
CREATE TABLE playlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL DEFAULT 'Ma playlist',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_playlists_user ON playlists(user_id);
```

---

### 2.12 playlist_items

Contenus dans une playlist (ordonnee).

```sql
CREATE TABLE playlist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  content_id  UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  added_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pi_playlist ON playlist_items(playlist_id);
CREATE UNIQUE INDEX idx_pi_playlist_content ON playlist_items(playlist_id, content_id);
```

---

### 2.13 offline_downloads

Suivi des telechargements hors-ligne (mobile).

```sql
CREATE TABLE offline_downloads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id    UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  device_id     VARCHAR(255) NOT NULL,
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
    -- downloaded_at + 72h par defaut
  status        VARCHAR(20) DEFAULT 'active',
    -- 'active' | 'expired' | 'purged'
  purged_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_od_user ON offline_downloads(user_id);
CREATE INDEX idx_od_user_status ON offline_downloads(user_id, status);
CREATE INDEX idx_od_expires ON offline_downloads(expires_at);
```

---

### 2.14 notifications

Notifications envoyees aux utilisateurs.

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
    -- 'new_content' | 'resume_reading' | 'expiration_warning'
    -- | 'payment_failed' | 'maintenance' | 'welcome'
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,
    -- Payload additionnel (content_id, lien, etc.)
  is_read     BOOLEAN DEFAULT FALSE,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_user_unread ON notifications(user_id) WHERE is_read = FALSE;
```

---

### 2.15 notification_preferences

Preferences de notification par utilisateur.

```sql
CREATE TABLE notification_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_enabled      BOOLEAN DEFAULT TRUE,
  email_enabled     BOOLEAN DEFAULT TRUE,
  fcm_token         TEXT,
  new_content       BOOLEAN DEFAULT TRUE,
  resume_reading    BOOLEAN DEFAULT TRUE,
  expiration_warning BOOLEAN DEFAULT TRUE,
  marketing         BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_np_user ON notification_preferences(user_id);
```

---

### 2.16 analytics_events

Evenements analytics stockes localement (complement Google Analytics).

```sql
CREATE TABLE analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  event_name  VARCHAR(100) NOT NULL,
    -- 'sign_up' | 'login' | 'subscribe' | 'start_reading'
    -- | 'start_listening' | 'search' | 'download_offline' | etc.
  event_data  JSONB,
    -- {content_id: "...", duration: 120, query: "...", etc.}
  device_type VARCHAR(20),
    -- 'web' | 'android' | 'ios'
  session_id  VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ae_user ON analytics_events(user_id);
CREATE INDEX idx_ae_event ON analytics_events(event_name);
CREATE INDEX idx_ae_created ON analytics_events(created_at DESC);
```

---

### 2.17 password_reset_tokens

Tokens de reinitialisation de mot de passe.

```sql
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(255) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
    -- created_at + 1 heure
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prt_token ON password_reset_tokens(token);
CREATE INDEX idx_prt_user ON password_reset_tokens(user_id);
```

---

## 3. Vues utiles (statistiques back-office)

### 3.1 Vue abonnes actifs

```sql
CREATE VIEW v_active_subscribers AS
SELECT
  u.id, u.email, u.full_name,
  s.plan, s.price_eur, s.current_period_end
FROM users u
JOIN subscriptions s ON u.id = s.user_id
WHERE s.status = 'active' AND u.is_active = TRUE;
```

### 3.2 Vue contenus populaires

```sql
CREATE VIEW v_popular_contents AS
SELECT
  c.id, c.title, c.author, c.content_type,
  COUNT(rh.id) AS total_readers,
  AVG(rh.progress_percent) AS avg_progress
FROM contents c
LEFT JOIN reading_history rh ON c.id = rh.content_id
WHERE c.is_published = TRUE
GROUP BY c.id
ORDER BY total_readers DESC;
```

### 3.3 Vue revenus mensuels (MRR)

```sql
CREATE VIEW v_monthly_revenue AS
SELECT
  DATE_TRUNC('month', p.paid_at) AS month,
  p.payment_gateway,
  COUNT(p.id) AS total_payments,
  SUM(p.amount_eur) AS total_revenue_eur
FROM payments p
WHERE p.status = 'succeeded'
GROUP BY DATE_TRUNC('month', p.paid_at), p.payment_gateway
ORDER BY month DESC;
```

---

## 4. Policies Supabase (Row Level Security)

### 4.1 Principe

Supabase utilise les **Row Level Security (RLS)** de PostgreSQL. Les policies garantissent que chaque utilisateur n'accede qu'a ses propres donnees.

```sql
-- Activer RLS sur toutes les tables utilisateur
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Exemple policy : lecture uniquement de ses propres donnees
CREATE POLICY "Users read own data" ON reading_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own data" ON reading_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own data" ON reading_history
  FOR UPDATE USING (auth.uid() = user_id);
```

### 4.2 Acces admin

```sql
-- Les admins ont acces a toutes les donnees
CREATE POLICY "Admins full access" ON reading_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## 5. Recapitulatif des tables

| # | Table | Description | Relations principales |
|---|-------|-------------|---------------------|
| 1 | **users** | Utilisateurs | → subscriptions, reading_history, bookmarks, etc. |
| 2 | **subscriptions** | Abonnements | → users, payments |
| 3 | **payments** | Paiements | → users, subscriptions |
| 4 | **contents** | Catalogue (ebooks + audio) | → categories, rights_holders, reading_history |
| 5 | **categories** | Categories | → content_categories, self-ref (parent) |
| 6 | **content_categories** | N:N contenu-categorie | → contents, categories |
| 7 | **rights_holders** | Editeurs / ayants droit | → contents |
| 8 | **bookmarks** | Marque-pages ebook | → users, contents |
| 9 | **highlights** | Surlignages ebook | → users, contents |
| 10 | **reading_history** | Historique + progression | → users, contents |
| 11 | **playlists** | Playlists audio | → users |
| 12 | **playlist_items** | Items de playlist | → playlists, contents |
| 13 | **offline_downloads** | Suivi hors-ligne | → users, contents |
| 14 | **notifications** | Notifications envoyees | → users |
| 15 | **notification_preferences** | Preferences notif | → users |
| 16 | **analytics_events** | Events tracking | → users |
| 17 | **password_reset_tokens** | Tokens reset password | → users |

**17 tables couvrant 100% du cahier de charge.**
