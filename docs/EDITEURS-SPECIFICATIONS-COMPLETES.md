# Spécifications Complètes — Module Éditeurs (Epics 13-17)

> **Version:** 1.0 — 2026-03-23
> **Demandé par:** Dimitri Talla (client)
> **Rédigé par:** Patrick Essomba (Afrik NoCode)
> **Budget additionnel:** +3 500 EUR | **Délai additionnel:** +7 semaines
> **Total projet:** 6 800 EUR | 15 semaines

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Rôles et hiérarchie](#2-rôles-et-hiérarchie)
3. [Panel Éditeur — Toutes les pages](#3-panel-éditeur--toutes-les-pages)
4. [Panel Admin — Ajouts pour les éditeurs](#4-panel-admin--ajouts-pour-les-éditeurs)
5. [Logique de répartition des revenus](#5-logique-de-répartition-des-revenus)
6. [Workflow de validation de contenu](#6-workflow-de-validation-de-contenu)
7. [Codes promo — Règles métier](#7-codes-promo--règles-métier)
8. [Schéma de base de données](#8-schéma-de-base-de-données)
9. [Routes API nécessaires](#9-routes-api-nécessaires)
10. [Epics et User Stories](#10-epics-et-user-stories)

---

## 1. Vue d'ensemble

### Transformation du modèle

```
AVANT                          APRÈS
──────────────────────         ────────────────────────────────
Admin upload → Users lisent    Admin invite Éditeurs
                               Éditeurs uploadent leurs livres
                               Admin valide avant publication
                               Ventes → Revenus → Versements
```

### Trois rôles utilisateur

| Rôle | Accès | Créé par |
|------|-------|----------|
| `user` | Lecture seule (abonné) | Inscription publique |
| `publisher` | Panel éditeur | Invitation admin |
| `admin` | Panel admin complet | Seeder / autre admin |

---

## 2. Rôles et hiérarchie

```
ADMIN
 ├── Crée et invite des éditeurs (email)
 ├── Valide / rejette le contenu éditeur
 ├── Gère les grilles de revenus par éditeur
 ├── Déclenche les versements
 └── Voit tout ce que l'éditeur voit + management

ÉDITEUR (publisher)
 ├── Upload livres (ebook + audio)
 ├── Suit ses ventes et revenus
 ├── Crée des codes promo (limités)
 └── Gère son profil et mode de paiement

USER
 └── Lit / écoute (inchangé)
```

---

## 3. Panel Éditeur — Toutes les pages

### Navigation principale (Sidebar)

```
┌─────────────────────────┐
│  [Logo Papyri]          │
│  ─────────────────────  │
│  Tableau de bord        │
│  Mes livres             │
│  Ajouter un livre       │
│  Revenus                │
│  Codes promo            │
│  Mon profil             │
│  ─────────────────────  │
│  [Solde : X CAD]        │
│  [Se déconnecter]       │
└─────────────────────────┘
```

---

### 3.1 Tableau de bord

**URL :** `/publisher/dashboard`

**Contenu :**

```
┌──────────────────────────────────────────────────────────────┐
│  Bonjour, [Nom Éditeur]                    [Filtre période ▼]│
│  ─────────────────────────────────────────────────────────── │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Solde        │  │  Livres      │  │  Ventes       │       │
│  │  245.50 CAD   │  │  12 publiés  │  │  143 ce mois  │       │
│  │  à percevoir  │  │  3 en attente│  │               │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  LIVRES LES PLUS VENDUS (Top 5)                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ # │ Titre            │ Ventes │ Revenu    │ Tendance    │ │
│  │ 1 │ Titre du livre   │   45   │ 225 CAD   │ ↑ +12%     │ │
│  │ 2 │ ...              │   38   │ 190 CAD   │ ↔           │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  REVENU PAR LIVRE (graphique barres)                         │
│  [Graphique mensuel avec filtre période]                     │
└──────────────────────────────────────────────────────────────┘
```

**Filtres période disponibles :** 7 jours, 30 jours, 3 mois, 6 mois, 12 mois, personnalisé (date début/fin)

---

### 3.2 Mes livres

**URL :** `/publisher/books`

**Colonnes du tableau :**

| Colonne | Description |
|---------|-------------|
| Couverture | Miniature |
| Titre | Nom du livre |
| Type | Ebook / Audio / Les deux |
| Statut | Publié / En attente / Rejeté / En pause |
| Ventes | Nombre total |
| Revenu total | CAD |
| Date ajout | |
| Actions | Modifier / Voir stats / Supprimer (si rejeté) |

**Codes couleur des statuts :**

```
🟢 Publié    — visible dans le catalogue
⚪ En attente — soumis, validation admin requise
🔴 Rejeté    — admin a refusé (motif affiché)
🟠 En pause  — éditeur a mis en pause
```

**Filtres :** Par statut, par type, par période

---

### 3.3 Ajouter un livre

**URL :** `/publisher/books/new`

**Formulaire en 3 étapes :**

#### Étape 1 — Upload du fichier

```
┌─────────────────────────────────────────────────────┐
│  Type de contenu                                     │
│  ○ Ebook (EPUB)   ○ Livre audio (MP3/M4A)  ○ Les deux│
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │                                              │   │
│  │     Glisser-déposer votre fichier ici        │   │
│  │     ou cliquer pour parcourir                │   │
│  │                                              │   │
│  │     EPUB (.epub) — max 500 MB                │   │
│  │     Audio (.mp3, .m4a, .ogg) — max 2 GB     │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [← Annuler]                    [Suivant →]         │
└─────────────────────────────────────────────────────┘
```

#### Étape 2 — Métadonnées (extraites automatiquement + modifiables)

```
┌─────────────────────────────────────────────────────┐
│  MÉTADONNÉES EXTRAITES AUTOMATIQUEMENT               │
│  (modifiables avant soumission)                     │
│                                                      │
│  Titre *          [Titre extrait de l'EPUB ______ ] │
│  Auteur *         [Auteur extrait ________________ ] │
│  ISBN             [ISBN extrait _________________  ] │
│  Langue *         [FR ▼]                            │
│  Catégorie *      [Roman ▼]                         │
│  Description *    [Résumé extrait ______________ ]  │
│                   [________________________________] │
│  Couverture       [Image extraite / Upload manuel]  │
│  Année parution   [2024]                            │
│  Éditeur          [Nom auto-rempli]                 │
│                                                      │
│  [← Retour]                     [Suivant →]         │
└─────────────────────────────────────────────────────┘
```

**Algorithme d'extraction des métadonnées :**

- **EPUB** : lecture du fichier `content.opf` → champs `dc:title`, `dc:creator`, `dc:description`, `dc:identifier` (ISBN), `dc:language`, `dc:date` + image de couverture dans le manifest
- **Audio (MP3/M4A)** : lecture des tags ID3v2 (MP3) ou iTunes atoms (M4A) → `TIT2` (titre), `TPE1` (artiste/auteur), `TALB` (album), `TYER` (année), `COMM` (description), image de couverture `APIC`
- Bibliothèque backend : `epub` (npm) pour EPUB, `music-metadata` (npm) pour audio

#### Étape 3 — Confirmation et soumission

```
┌─────────────────────────────────────────────────────┐
│  RÉSUMÉ AVANT SOUMISSION                            │
│                                                      │
│  [Couverture]   Titre du livre                      │
│                 par Auteur                          │
│                 Catégorie — Langue                  │
│                 Type : Ebook + Audio                │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  ℹ️  Votre contenu sera examiné par notre     │   │
│  │  équipe avant d'être publié dans le          │   │
│  │  catalogue. Délai habituel : 24-48h.         │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [← Modifier]              [Soumettre pour validation]│
└─────────────────────────────────────────────────────┘
```

---

### 3.4 Revenus

**URL :** `/publisher/revenue`

**Structure de la page :**

```
┌──────────────────────────────────────────────────────────────┐
│  REVENUS                                   [Filtre période ▼]│
│  ─────────────────────────────────────────────────────────── │
│  ┌─────────────────────┐   ┌─────────────────────┐          │
│  │  Ventes normales     │   │  Bonus               │          │
│  │  1 245.00 CAD        │   │  180.00 CAD          │          │
│  └─────────────────────┘   └─────────────────────┘          │
│  ┌──────────────────────────────────────┐                    │
│  │  TOTAL À PERCEVOIR : 1 425.00 CAD   │                    │
│  └──────────────────────────────────────┘                    │
│                                                               │
│  DÉTAIL PAR LIVRE (du plus vendu au moins vendu)             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Titre         │ Ventes norm. │ Bonus │ Total   │ Statut │ │
│  │ Titre livre 1 │ 225.00 CAD   │ 25 CAD│ 250 CAD │ ✅ payé│ │
│  │ Titre livre 2 │ 190.00 CAD   │ 0     │ 190 CAD │ ⏳ att. │ │
│  │ ...           │ ...          │ ...   │ ...     │ ...    │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  HISTORIQUE DES VERSEMENTS                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Date       │ Montant    │ Méthode    │ Référence        │ │
│  │ 01/03/2026 │ 500.00 CAD │ Virement   │ VRS-20260301-001 │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Distinction des sources :**

| Type | Description |
|------|-------------|
| Vente normale | Achat d'abonnement → revenu alloué au livre |
| Bonus | Codes promo utilisés, campagnes marketing |

---

### 3.5 Codes promo

**URL :** `/publisher/promo-codes`

**Règles métier strictes :**
- Maximum **50 codes actifs par mois** par éditeur
- Réduction maximum **80%** par code
- Un code peut être : pourcentage (`%`) ou montant fixe (CAD)
- Durée de validité : date début + date fin obligatoires

**Interface :**

```
┌──────────────────────────────────────────────────────────────┐
│  CODES PROMO                          [+ Créer un code]     │
│  Utilisés ce mois : 12 / 50                                  │
│  ─────────────────────────────────────────────────────────── │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Code       │ Réduction │ Utilisations │ Valide jusqu'au │ │
│  │ SUMMER25   │ 25%       │ 45 / 100    │ 30/04/2026      │ │
│  │ WELCOME10  │ 10%       │ 12 / 50     │ 31/03/2026      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Formulaire de création :**

```
Code promo *       [SUMMER2026___________]  (auto-générable)
Type de réduction  ○ Pourcentage  ○ Montant fixe
Valeur *           [25] %  (max 80%)
Nb utilisations max [100]  (vide = illimité)
Applicable sur     ○ Tous mes livres  ○ Livres spécifiques [choisir]
Date début *       [01/04/2026]
Date fin *         [30/04/2026]
```

---

### 3.6 Mon profil

**URL :** `/publisher/profile`

**Onglets :**

#### Onglet 1 — Informations

```
Nom de la maison d'édition *   [________________]
Nom du responsable *           [________________]
Email *                        [________________] (non modifiable)
Site web                       [________________]
Description                    [________________]
                               [________________]
Logo                           [Upload image]
```

#### Onglet 2 — Sécurité

```
Mot de passe actuel            [________________]
Nouveau mot de passe           [________________]
Confirmer nouveau mot de passe [________________]
                               [Mettre à jour]

Authentification à deux facteurs
○ Désactivé  ○ Par email  ○ Par application (TOTP)
```

#### Onglet 3 — Mode de paiement (pour les versements)

```
Type de versement *
○ Virement bancaire international (SWIFT/IBAN)
○ Mobile Money (MTN, Orange, Moov)
○ PayPal

──── Si Virement ────
IBAN / Numéro de compte   [________________]
SWIFT / BIC               [________________]
Banque                    [________________]
Pays                      [________________]

──── Si Mobile Money ────
Opérateur                 [MTN ▼]
Numéro                    [________________]
Nom du titulaire          [________________]

──── Si PayPal ────
Email PayPal              [________________]
```

---

## 4. Panel Admin — Ajouts pour les éditeurs

### 4.1 Nouvelle section : Gestion des éditeurs

**URL admin :** `/admin/publishers`

#### 4.1.1 Liste des éditeurs

```
┌──────────────────────────────────────────────────────────────────────┐
│  ÉDITEURS                                         [+ Inviter]        │
│  ─────────────────────────────────────────────────────────────────── │
│  Filtres : [Tous ▼] [Statut ▼] [Période ▼]      [🔍 Rechercher]    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────── │
│  │ Éditeur         │ Livres │ Ventes │ Revenu dû │ Statut │ Actions│ │
│  │ Maison Alpha    │  23    │  450   │ 2 250 CAD │ 🟢 Actif│  ...  │ │
│  │ Éditions Beta   │   5    │   12   │   60 CAD  │ ⚪ Attente│ ...  │ │
│  │ Gamma Livres    │  18    │  200   │ 1 000 CAD │ 🟠 Pause │ ...  │ │
│  └──────────────────────────────────────────────────────────────── │
└──────────────────────────────────────────────────────────────────────┘
```

**Codes couleur statut éditeur :**

| Couleur | Statut | Description |
|---------|--------|-------------|
| 🟢 Vert | `active` | Éditeur actif, peut publier |
| ⚪ Gris | `pending` | Invitation envoyée, compte non activé |
| 🟠 Orange | `paused` | Compte suspendu temporairement |

#### 4.1.2 Formulaire d'invitation d'un éditeur

```
┌──────────────────────────────────────────────┐
│  INVITER UN ÉDITEUR                          │
│                                              │
│  Nom de la maison d'édition *                │
│  [__________________________________________]│
│                                              │
│  Nom du responsable *                        │
│  [__________________________________________]│
│                                              │
│  Email *                                     │
│  [__________________________________________]│
│                                              │
│  Description (optionnel)                     │
│  [__________________________________________]│
│  [__________________________________________]│
│                                              │
│  Grille de revenus *                         │
│  ○ Standard (>5 CAD → 5 CAD | ≤5 CAD → 2.50)│
│  ○ Personnalisée                             │
│    Seuil : [5___] CAD                        │
│    Au-dessus : [5___] CAD                    │
│    En-dessous : [2.5_] CAD                   │
│                                              │
│  [Annuler]        [Envoyer l'invitation]     │
└──────────────────────────────────────────────┘
```

**Email d'invitation envoyé automatiquement :** Nom, description de Papyri, lien d'activation (valable 7 jours)

#### 4.1.3 Fiche éditeur (vue admin)

Contient **tout ce que l'éditeur voit** (dashboard, livres, revenus) **plus** :

- Modifier le statut (actif / pause / banni)
- Modifier la grille de revenus
- Voir l'historique des versements
- Gérer le contenu (approuver, rejeter, dépublier)
- Envoyer un message à l'éditeur

---

### 4.2 Nouvelle section : Validation de contenu

**URL admin :** `/admin/content-validation`

```
┌──────────────────────────────────────────────────────────────┐
│  CONTENU EN ATTENTE DE VALIDATION               [12 en attente]│
│  ─────────────────────────────────────────────────────────── │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Couv. │ Titre        │ Éditeur      │ Soumis le  │ Action│ │
│  │ [img] │ Titre livre 1│ Maison Alpha │ 22/03/2026 │ [Voir]│ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Actions sur un livre en attente :**

```
┌────────────────────────────────────────────────┐
│  VALIDATION — Titre livre 1                    │
│                                                │
│  [Couverture]  Titre, Auteur, Description...   │
│                Fichier EPUB : ✅ lisible        │
│                Fichier Audio : ✅ lisible       │
│                                                │
│  [Prévisualiser]                               │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  Motif de rejet (si rejet) :             │  │
│  │  [______________________________________]│  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [Rejeter]              [Approuver et publier] │
└────────────────────────────────────────────────┘
```

---

### 4.3 Nouvelle section : Versements

**URL admin :** `/admin/payouts`

```
┌──────────────────────────────────────────────────────────────┐
│  RÉPARTITION DES REVENUS                  [Filtre période ▼] │
│  ─────────────────────────────────────────────────────────── │
│  TOTAL À VERSER CE MOIS : 4 250.00 CAD                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Éditeur       │ Ventes norm. │ Bonus  │ Total dû │ Statut│ │
│  │ Maison Alpha  │ 2 000 CAD    │ 250 CAD│ 2 250 CAD│ ⏳ att│ │
│  │ Éditions Beta │   800 CAD    │  50 CAD│   850 CAD│ ✅ payé│ │
│  │ Gamma Livres  │ 1 000 CAD    │   0    │ 1 000 CAD│ ⏳ att│ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  [Exporter CSV]          [Marquer sélection comme payé]      │
└──────────────────────────────────────────────────────────────┘
```

**Statuts de paiement éditeur :** `pending` → `processing` → `paid` | `failed`

---

## 5. Logique de répartition des revenus

### Règle standard (modifiable par éditeur)

```
SI prix_livre > 5 CAD
  → éditeur reçoit : 5.00 CAD par vente

SI prix_livre ≤ 5 CAD
  → éditeur reçoit : 2.50 CAD par vente
```

### Personnalisation par éditeur

Chaque éditeur peut avoir sa propre grille définie par l'admin :

```json
{
  "publisher_id": "uuid",
  "revenue_grid": {
    "threshold_cad": 5.00,
    "above_threshold_cad": 5.00,
    "below_threshold_cad": 2.50
  }
}
```

### Calcul mensuel

```
revenu_editeur = SUM(
  pour chaque vente du livre :
    SI prix > seuil → montant_au_dessus
    SINON → montant_en_dessous
) + bonus_campagnes
```

### Exemple concret

| Livre | Prix | Ventes | Grille | Revenu éditeur |
|-------|------|--------|--------|---------------|
| Livre A | 9.99 CAD | 45 | standard | 45 × 5.00 = 225 CAD |
| Livre B | 3.99 CAD | 38 | standard | 38 × 2.50 = 95 CAD |
| Livre C | 12.00 CAD | 20 | custom (6 CAD) | 20 × 6.00 = 120 CAD |

---

## 6. Workflow de validation de contenu

```
Éditeur soumet
      │
      ▼
Statut : "pending" ──────────────────────────────────────────┐
      │                                                       │
      │  Notification email + admin panel                    │
      ▼                                                       │
Admin examine (prévisualisation + métadonnées)               │
      │                                                       │
      ├──── APPROUVE ──────────────────────────────────────► │
      │           │                                          │
      │           ▼                                          │
      │     Statut : "published"                             │
      │     Visible dans le catalogue                        │
      │     Email notif éditeur : "Approuvé ✅"             │
      │                                                       │
      └──── REJETTE ─────────────────────────────────────► │
                  │                                          │
                  ▼                                          │
            Statut : "rejected"                             │
            Motif de rejet sauvegardé                      │
            Email notif éditeur : "Rejeté — motif : [...]" │
            Éditeur peut corriger et re-soumettre          │
```

**Délai cible de validation :** 24-48h ouvrables

---

## 7. Codes promo — Règles métier

| Règle | Valeur |
|-------|--------|
| Maximum de codes actifs | 50 par mois par éditeur |
| Réduction maximale | 80% |
| Types autorisés | Pourcentage (%) ou montant fixe (CAD) |
| Validité | Date début + date fin obligatoires |
| Scope | Tous les livres de l'éditeur OU livres spécifiques |
| Cumulable | Non (un seul code par commande) |

**Compteur de codes :** reset le 1er de chaque mois. Les codes créés en janvier comptent dans janvier même s'ils sont actifs en février.

---

## 8. Schéma de base de données

### Nouvelles tables

#### `publishers`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id          UUID REFERENCES auth.users(id) UNIQUE
company_name     TEXT NOT NULL
contact_name     TEXT NOT NULL
description      TEXT
logo_url         TEXT
website          TEXT
status           TEXT DEFAULT 'pending'  -- pending | active | paused | banned
revenue_grid     JSONB DEFAULT '{"threshold_cad":5,"above_threshold_cad":5,"below_threshold_cad":2.5}'
payout_method    JSONB  -- {type, iban, swift, phone, paypal_email, ...}
invited_by       UUID REFERENCES auth.users(id)
invitation_token TEXT
invitation_sent_at TIMESTAMPTZ
activated_at     TIMESTAMPTZ
created_at       TIMESTAMPTZ DEFAULT now()
updated_at       TIMESTAMPTZ DEFAULT now()
```

#### `publisher_books`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
publisher_id     UUID REFERENCES publishers(id)
content_id       UUID REFERENCES contents(id)  -- lien avec table existante
validation_status TEXT DEFAULT 'pending'  -- pending | approved | rejected
rejection_reason TEXT
submitted_at     TIMESTAMPTZ DEFAULT now()
reviewed_at      TIMESTAMPTZ
reviewed_by      UUID REFERENCES auth.users(id)
```

#### `publisher_revenue`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
publisher_id     UUID REFERENCES publishers(id)
content_id       UUID REFERENCES contents(id)
payment_id       UUID REFERENCES payments(id)
sale_type        TEXT  -- 'normal' | 'bonus'
book_price_cad   DECIMAL(10,2)
publisher_amount_cad DECIMAL(10,2)
period_month     DATE  -- premier jour du mois (ex: 2026-03-01)
created_at       TIMESTAMPTZ DEFAULT now()
```

#### `publisher_payouts`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
publisher_id     UUID REFERENCES publishers(id)
amount_cad       DECIMAL(10,2)
period_start     DATE
period_end       DATE
status           TEXT DEFAULT 'pending'  -- pending | processing | paid | failed
payout_method    JSONB  -- snapshot du mode de paiement au moment du versement
reference        TEXT  -- ex: VRS-20260301-001
processed_at     TIMESTAMPTZ
processed_by     UUID REFERENCES auth.users(id)
notes            TEXT
created_at       TIMESTAMPTZ DEFAULT now()
```

#### `publisher_promo_codes`
Utiliser la table `promo_codes` existante (migration 032) + colonne `publisher_id`

---

## 9. Routes API nécessaires

### Éditeur (authentifié, rôle `publisher`)

```
POST   /api/publishers/register          Compléter le profil après invitation
GET    /api/publishers/me                Mon profil éditeur
PUT    /api/publishers/me                Modifier mon profil
PUT    /api/publishers/me/payout-method  Modifier mon mode de paiement

GET    /api/publishers/books             Mes livres (avec filtres)
POST   /api/publishers/books             Soumettre un livre
PUT    /api/publishers/books/:id         Modifier un livre (si pending/rejected)
DELETE /api/publishers/books/:id         Supprimer un livre (si rejected)

GET    /api/publishers/revenue           Mon tableau de revenus
GET    /api/publishers/revenue/summary   Résumé solde (normal + bonus + total)
GET    /api/publishers/payouts           Mon historique de versements

GET    /api/publishers/promo-codes       Mes codes promo
POST   /api/publishers/promo-codes       Créer un code
DELETE /api/publishers/promo-codes/:id  Supprimer un code
GET    /api/publishers/promo-codes/quota Quota restant ce mois
```

### Admin (authentifié, rôle `admin`)

```
GET    /api/admin/publishers             Liste des éditeurs
POST   /api/admin/publishers/invite      Inviter un éditeur
GET    /api/admin/publishers/:id         Fiche éditeur complète
PUT    /api/admin/publishers/:id/status  Changer statut (active/paused/banned)
PUT    /api/admin/publishers/:id/revenue-grid  Modifier grille revenus

GET    /api/admin/content-validation     Contenu en attente
PUT    /api/admin/content-validation/:bookId/approve  Approuver
PUT    /api/admin/content-validation/:bookId/reject   Rejeter (+ motif)

GET    /api/admin/payouts                Tableau des versements
PUT    /api/admin/payouts/:id/status     Modifier statut versement
GET    /api/admin/payouts/export         Export CSV
```

### Public (invitation)

```
GET    /api/auth/publisher-invitation/:token  Vérifier token invitation
POST   /api/auth/publisher-activate           Activer le compte éditeur
```

---

## 10. Epics et User Stories

### EPIC-13 — Gestion Éditeurs (côté Admin) — 8j

| Story | Description | Priorité |
|-------|-------------|----------|
| US-13.1 | Admin crée et invite un éditeur par email | MUST |
| US-13.2 | Email d'invitation avec lien d'activation (7j) | MUST |
| US-13.3 | Liste des éditeurs avec codes couleur statut | MUST |
| US-13.4 | Fiche éditeur : stats + management contenu | MUST |
| US-13.5 | Modifier statut éditeur (actif/pause/banni) | MUST |
| US-13.6 | Modifier grille de revenus par éditeur | MUST |

### EPIC-14 — Dashboard Éditeur — 10j

| Story | Description | Priorité |
|-------|-------------|----------|
| US-14.1 | Activation compte éditeur via token invitation | MUST |
| US-14.2 | Dashboard : solde, nb livres, ventes top 5 | MUST |
| US-14.3 | Filtre par période sur toutes les stats | MUST |
| US-14.4 | Page revenus : détail par livre, distinction normal/bonus | MUST |
| US-14.5 | Historique des versements reçus | MUST |
| US-14.6 | Profil éditeur : infos, sécurité, mode paiement | MUST |

### EPIC-15 — Codes Promo Éditeur — 4j

| Story | Description | Priorité |
|-------|-------------|----------|
| US-15.1 | Créer un code promo (% ou montant fixe, max 80%) | MUST |
| US-15.2 | Limite 50 codes/mois avec compteur visible | MUST |
| US-15.3 | Appliquer sur tous les livres ou sélection | SHOULD |
| US-15.4 | Désactiver / supprimer un code | MUST |

### EPIC-16 — Upload & Métadonnées Contenu — 7j

| Story | Description | Priorité |
|-------|-------------|----------|
| US-16.1 | Upload EPUB avec extraction métadonnées automatique | MUST |
| US-16.2 | Upload audio (MP3/M4A) avec extraction tags ID3 | MUST |
| US-16.3 | Formulaire métadonnées pré-rempli et modifiable | MUST |
| US-16.4 | Soumission pour validation admin | MUST |
| US-16.5 | Notification éditeur : approuvé / rejeté + motif | MUST |

### EPIC-17 — Répartition Revenus & Versements — 5j

| Story | Description | Priorité |
|-------|-------------|----------|
| US-17.1 | Calcul automatique revenu par vente selon grille | MUST |
| US-17.2 | Admin : tableau de répartition mensuelle | MUST |
| US-17.3 | Admin : marquer versements comme payés | MUST |
| US-17.4 | Export CSV des versements | SHOULD |
| US-17.5 | Notification éditeur à chaque versement | SHOULD |

---

## Annexe — Design system (cohérent avec l'existant)

| Élément | Valeur |
|---------|--------|
| Couleur primaire | `#B5651D` (Terre d'Afrique) |
| Couleur accent | `#D4A017` (Or du Sahel) |
| Couleur foncée | `#2E4057` (Indigo Adire) |
| Statut actif | `#4CAF50` vert |
| Statut attente | `#9E9E9E` gris |
| Statut pause | `#FF9800` orange |
| Statut rejeté | `#F44336` rouge |
| Font titres | Playfair Display |
| Font texte | Inter |
| Framework web | React + MUI v5 |
| Framework mobile | React Native Paper |
