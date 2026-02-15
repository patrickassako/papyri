# Story 10.5: Gestion Metadonnees, Categories & Licences

Status: ready-for-dev

## Story

As a administrateur,
I want gerer les categories, metadonnees et les licences/ayants droit,
So that le catalogue soit organise et les droits de diffusion soient traces.

## Acceptance Criteria

1. **AC1 — CRUD Categories** : Given un admin, When il gere les categories, Then il peut creer, modifier et supprimer des categories
2. **AC2 — Multi-categories** : Given un contenu, When l'admin edite, Then il peut associer une ou plusieurs categories
3. **AC3 — CRUD Ayants droit** : Given un admin, When il gere les ayants droit, Then il peut enregistrer editeurs/auteurs (nom, contact, contrat)
4. **AC4 — Association contenu-ayant droit** : Given un contenu, When l'admin edite, Then il peut associer un ayant droit
5. **AC5 — Avertissement** : Given un contenu sans ayant droit, When l'admin consulte, Then un avertissement visuel s'affiche
6. **AC6 — Audit trail** : Given une action, When effectuee, Then elle est loguee

## Tasks / Subtasks

- [ ] **Task 1 : Ressource Categories** (AC: #1, #2)
  - [ ] 1.1 Table `categories` : id, name, slug, description
  - [ ] 1.2 CRUD complet AdminJS
  - [ ] 1.3 Relation N:N avec contents via `content_categories`

- [ ] **Task 2 : Ressource Rights Holders** (AC: #3, #4)
  - [ ] 2.1 Table `rights_holders` : id, name, type, contact_email, contract_info
  - [ ] 2.2 CRUD complet AdminJS
  - [ ] 2.3 Relation 1:N avec contents (rights_holder_id)

- [ ] **Task 3 : Avertissement contenu sans licence** (AC: #5)
  - [ ] 3.1 Afficher badge "Sans licence" si rights_holder_id NULL
  - [ ] 3.2 Filtre "Contenus sans licence"

- [ ] **Task 4 : Tests** (AC: #1, #2, #3, #4, #5)
  - [ ] 4.1 Test CRUD categories
  - [ ] 4.2 Test multi-categories contenu
  - [ ] 4.3 Test CRUD ayants droit
  - [ ] 4.4 Test association contenu-ayant droit

## Dev Notes

### Tables

```sql
-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Categories (N:N)
CREATE TABLE content_categories (
  content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, category_id)
);

-- Rights Holders
CREATE TABLE rights_holders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'publisher' | 'author' | 'partner'
  contact_email VARCHAR(255),
  contract_info TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add to contents
ALTER TABLE contents ADD COLUMN rights_holder_id UUID REFERENCES rights_holders(id);
```

## Dev Agent Record

<!-- Agent will fill this -->
