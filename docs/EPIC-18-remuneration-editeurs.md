# Epic 18 — Système de Rémunération des Éditeurs (Publisher Royalty System)

**Date de création :** 2026-04-02
**Statut :** PLANIFIÉ
**Priorité :** Haute (bloquant pour relations commerciales éditeurs)
**Estimation totale :** ~4 semaines (Patrick, développeur solo)
**Dépendances :** Epic 13 (Publisher Feature), tables `reading_history`, `contents`, `publishers`, `subscriptions`

---

## Contexte & Motivation

Le client souhaite rémunérer les éditeurs partenaires en fonction de la **consommation réelle** de leurs contenus sur la plateforme Papyri, sur le modèle d'Audible Plus / Spotify for Books.

Le modèle retenu est le **Pro Rata avec Plancher Garanti** :
- Un "Pool de Redevances" est constitué chaque mois (50% du CA net des abonnements)
- Ce pool est réparti entre éditeurs au prorata des minutes/pages qualifiées consommées
- Un tarif plancher garanti protège les éditeurs : **0,002 €/min audio**, **0,004 €/page normalisée ebook**
- Une logique anti-fraude filtre les consommations non qualifiées avant tout calcul

---

## Périmètre de l'Epic

### Ce qui est inclus
- Tracking granulaire des sessions de lecture/écoute
- Logique de qualification des sessions (seuils anti-fraude)
- Synchronisation des sessions hors-ligne (heartbeat)
- Calcul mensuel automatique du Pool et des redevances
- Plafond Fair Use par utilisateur (anti-siphonnage)
- Pages normalisées pour les ebooks
- Dashboard éditeur avec stats temps réel
- Rapport mensuel PDF pour chaque éditeur
- Audit trail des calculs de redevances

### Ce qui est exclu
- Virement bancaire automatique (géré manuellement dans un premier temps)
- Audit externe tiers (clause contractuelle uniquement)
- Système de crédits à l'achat unitaire (hors périmètre Papyri v1)

---

## Architecture des nouvelles données

### Nouvelle table : `reading_sessions`
```
id, user_id, content_id, publisher_id,
session_start, session_end, duration_seconds,
content_type (ebook|audiobook),
start_position, end_position,
normalized_pages_read (ebook uniquement),
is_qualified (bool), qualification_reason,
is_offline, synced_at,
created_at
```

### Nouvelle table : `royalty_periods`
```
id, period_month (YYYY-MM),
total_revenue_eur, pool_eur (50% du CA net),
pool_audio_eur (60% du pool), pool_ebook_eur (40% du pool),
total_audio_minutes, total_ebook_pages,
rate_per_minute_eur, rate_per_page_eur,
floor_applied (bool), status (pending|calculated|paid),
calculated_at, paid_at, created_at
```

### Nouvelle table : `publisher_royalties`
```
id, royalty_period_id, publisher_id,
audio_minutes_qualified, ebook_pages_qualified,
gross_amount_eur, floor_supplement_eur, net_amount_eur,
payment_status (pending|paid|suspended_fraud),
report_sent_at, paid_at, created_at
```

### Nouvelle table : `royalty_fraud_flags`
```
id, user_id, content_id, session_date,
flag_type (speed_ebook|daily_cap_exceeded|bot_ip|no_interaction),
details JSONB, reviewed (bool), created_at
```

---

## Stories

---

### Story 18.1 — Table `reading_sessions` et tracking granulaire

**En tant que** plateforme,
**je veux** enregistrer chaque session de lecture/écoute avec un début, une fin et une durée réelle,
**afin de** calculer les redevances sur la consommation effective et non sur la progression totale.

**Contexte technique :**
Actuellement, `reading_history` stocke seulement `progress_percent` et `last_read_at`. Ce n'est pas assez précis pour facturer à la minute ou à la page. Il faut une table dédiée aux sessions avec timestamp de début/fin.

**Critères d'acceptation :**
- [ ] Migration SQL `048_reading_sessions.sql` créée avec la table `reading_sessions` et ses index
- [ ] Le backend expose `POST /api/reading/sessions/start` → crée une session, retourne `session_id`
- [ ] Le backend expose `POST /api/reading/sessions/end` → clôt la session, calcule `duration_seconds`, stocke `end_position`
- [ ] Le backend expose `POST /api/reading/sessions/heartbeat` → met à jour `end_position` et `duration_seconds` toutes les 60s (audio) ou toutes les 3 pages (ebook) sans clore la session
- [ ] `publisher_id` est résolu automatiquement depuis `contents.rights_holder_id`
- [ ] Le champ `is_qualified` est initialisé à `false` — la qualification est déclenchée par Story 18.2
- [ ] Les endpoints sont protégés par `verifyJWT` + abonnement actif
- [ ] Le web et le mobile appellent `session/start` à l'ouverture du reader/player et `session/end` à la fermeture

**Fichiers impactés :**
- `docs/migrations/048_reading_sessions.sql` (NOUVEAU)
- `backend/src/routes/reading.js` (MODIFIÉ — 3 nouveaux endpoints)
- `web/src/services/contents.service.js` (MODIFIÉ — appels start/end/heartbeat)
- `mobile/src/services/reading.service.js` (MODIFIÉ — appels start/end/heartbeat)

**Dépendances :** Aucune (fondation de tout l'epic)

---

### Story 18.2 — Logique "Qualified Listen" (anti-fraude — seuils)

**En tant que** plateforme,
**je veux** ne comptabiliser une session que si elle dépasse un seuil minimal de consommation réelle,
**afin de** ne pas payer les éditeurs pour des "rebonds" (clics accidentels, zapping, fermeture immédiate).

**Contexte technique :**
Seuils retenus (conformes à la clause contractuelle) :
- **Audio :** 60 secondes continues d'écoute → session qualifiée
- **Ebook :** 5 Pages Normalisées lues (= 9 000 caractères de progression) → session qualifiée
- Une fois le seuil franchi, la totalité de la session est comptabilisée (y compris les premières secondes/pages)

**Critères d'acceptation :**
- [ ] À chaque appel `heartbeat` ou `session/end`, le backend évalue si le seuil est atteint et met à jour `is_qualified = true` si oui
- [ ] Les sessions non qualifiées restent en base avec `is_qualified = false` (pour audit) mais **ne sont pas** incluses dans le calcul du Pool
- [ ] La vitesse de lecture ebook est vérifiée : si `normalized_pages_read / duration_seconds > 3 pages/sec`, la session est marquée suspecte (`qualification_reason = 'speed_anomaly'`) et `is_qualified = false`
- [ ] Les sessions audio dont la position de fin = position de début (lecture sans progression) sont ignorées
- [ ] Un log `royalty_fraud_flags` est créé pour toute session suspecte
- [ ] Tests unitaires : session audio 30s → non qualifiée, 90s → qualifiée, ebook 3 pages → non qualifiée, 6 pages → qualifiée

**Fichiers impactés :**
- `backend/src/services/reading-sessions.service.js` (NOUVEAU)
- `backend/src/routes/reading.js` (MODIFIÉ — appel service qualification)
- `docs/migrations/048_reading_sessions.sql` (MODIFIÉ — ajout table `royalty_fraud_flags`)

**Dépendances :** Story 18.1

---

### Story 18.3 — Pages Normalisées pour les Ebooks

**En tant que** système de calcul,
**je veux** convertir la progression ebook en Pages Normalisées (unité standard = 1 800 caractères),
**afin de** avoir une mesure de consommation cohérente indépendante du format d'affichage (taille police, écran).

**Contexte technique :**
L'epub.js retourne une position CFI (Canonical Fragment Identifier). La progression brute en % n'est pas suffisante car un livre de 100 000 mots ≠ un livre de 10 000 mots à 50% de progression.
Solution : au moment de l'upload d'un ebook, on extrait le nombre total de caractères et on stocke `total_normalized_pages` dans `contents`. À la lecture, on calcule `normalized_pages_read = progress_delta_chars / 1800`.

**Critères d'acceptation :**
- [ ] Migration : colonne `total_normalized_pages INTEGER` ajoutée à la table `contents`
- [ ] Le service d'upload (`upload.routes.js` admin) extrait le nombre de caractères du fichier EPUB/PDF et calcule `total_normalized_pages = total_chars / 1800` (arrondi supérieur)
- [ ] Pour les PDFs, estimation : `total_pages_pdf × 1800` (approximation acceptable)
- [ ] Les livres déjà en base ont `total_normalized_pages = NULL` → le calcul de redevance ebook les ignore jusqu'à ré-upload ou saisie manuelle
- [ ] Le frontend envoie `chars_read` (ou `progress_delta_percent`) dans le heartbeat → le backend calcule `normalized_pages_read = (chars_read / 1800)` et l'incrémente sur la session
- [ ] La valeur `normalized_pages_read` sur la session est **cumulative** (on ne re-paie pas si l'utilisateur relit les mêmes pages dans le même mois) — cf. Story 18.5 pour le plafond mensuel

**Fichiers impactés :**
- `docs/migrations/049_normalized_pages.sql` (NOUVEAU)
- `backend/src/admin/upload.routes.js` (MODIFIÉ — extraction chars EPUB)
- `backend/src/services/reading-sessions.service.js` (MODIFIÉ)
- `web/src/pages/EReaderPage.jsx` (MODIFIÉ — envoi chars_read dans heartbeat)
- `mobile/src/screens/BookReaderScreen.js` (MODIFIÉ — envoi chars_read dans heartbeat)

**Dépendances :** Story 18.1

---

### Story 18.4 — Synchronisation Hors-Ligne (Heartbeat Offline)

**En tant que** utilisateur mobile,
**je veux** que mes sessions de lecture hors-ligne soient correctement enregistrées et rémunèrent les éditeurs dès que je me reconnecte,
**afin de** ne pas frauder involontairement les éditeurs lors d'une utilisation offline.

**Contexte technique :**
Actuellement `offline.service.js` télécharge les fichiers mais ne journalise pas les sessions. Il faut un système de log local (fichier JSON chiffré dans AsyncStorage) qui accumule les sessions hors-ligne et les synchronise au retour en ligne.

Format du log local :
```json
[
  { "content_id": "...", "start": "2026-04-01T10:00:00Z", "end": "2026-04-01T11:00:00Z",
    "duration_seconds": 3600, "content_type": "audiobook", "start_pos": 0, "end_pos": 3600 }
]
```

**Critères d'acceptation :**
- [ ] `offline.service.js` mobile : à chaque ouverture d'un contenu offline, un log de session est créé en AsyncStorage (`papyri_offline_sessions`)
- [ ] Le log est mis à jour toutes les 60s (audio) / 3 pages (ebook) même sans connexion
- [ ] Au retour en ligne, l'app appelle `POST /api/reading/sessions/sync-offline` avec le tableau de logs
- [ ] Le backend traite le tableau, crée les sessions en base et applique la logique de qualification (Story 18.2)
- [ ] Les sessions offline acceptées sont effacées du log local ; les sessions rejetées (fraude) restent avec un flag `rejected`
- [ ] Si la reconnexion ne se fait pas dans **7 jours**, le reader/player bloque l'accès au contenu offline avec le message : _"Synchronisation requise. Reconnectez-vous pour continuer."_
- [ ] Le token de session offline est valide 7 jours (chiffré, stocké dans AsyncStorage)

**Fichiers impactés :**
- `backend/src/routes/reading.js` (MODIFIÉ — endpoint sync-offline)
- `mobile/src/services/offline.service.js` (MODIFIÉ — log sessions + sync)
- `mobile/src/screens/BookReaderScreen.js` (MODIFIÉ — blocage à 7 jours)
- `mobile/src/screens/AudioPlayerScreen.js` (MODIFIÉ — blocage à 7 jours)

**Dépendances :** Story 18.1, 18.2

---

### Story 18.5 — Plafond Fair Use (Anti-Siphonnage)

**En tant que** plateforme,
**je veux** plafonner la consommation rémunérée à 12 heures audio ou 600 pages normalisées par utilisateur par jour,
**afin de** protéger le budget du Pool contre les comptes robotisés, partagés ou malveillants.

**Contexte technique :**
Un utilisateur humain écoute rarement plus de 8h/jour. Au-delà de 12h/jour par compte, la probabilité de fraude ou de partage de compte est très élevée. La consommation excédentaire est autorisée pour l'utilisateur (pas de blocage d'accès) mais ne génère aucune redevance au-delà du plafond.

**Critères d'acceptation :**
- [ ] À chaque appel `heartbeat` ou `session/end`, le backend calcule la consommation cumulée du user pour la journée en cours (depuis minuit UTC)
- [ ] Si la consommation dépasse 12h audio ou 600 pages ebook : la session reste ouverte (pas de coupure) mais `is_qualified` est forcé à `false` pour la partie excédentaire
- [ ] Un log `royalty_fraud_flags` est créé avec `flag_type = 'daily_cap_exceeded'`
- [ ] Preuve d'attention : si aucune interaction UI n'est reçue pendant 3h consécutives d'audio, le heartbeat doit inclure un champ `user_interaction: false` → le backend cesse de comptabiliser les minutes jusqu'au prochain heartbeat avec `user_interaction: true`
- [ ] Le web/mobile envoient `user_interaction: true` sur chaque événement tactile/clavier dans les 3 dernières minutes
- [ ] Les règles de plafond sont configurables dans `app_settings` (admin) : `royalty_daily_cap_hours`, `royalty_daily_cap_pages`, `royalty_interaction_timeout_minutes`

**Fichiers impactés :**
- `backend/src/services/reading-sessions.service.js` (MODIFIÉ)
- `backend/src/routes/reading.js` (MODIFIÉ — champ user_interaction dans heartbeat)
- `docs/migrations/050_royalty_settings.sql` (NOUVEAU — colonnes dans app_settings)
- `web/src/pages/EReaderPage.jsx` (MODIFIÉ — envoi user_interaction)
- `web/src/pages/AudiobookPlayerPage.jsx` (MODIFIÉ — envoi user_interaction)
- `mobile/src/screens/BookReaderScreen.js` (MODIFIÉ)
- `mobile/src/screens/AudioPlayerScreen.js` (MODIFIÉ)

**Dépendances :** Story 18.2

---

### Story 18.6 — Calcul Mensuel du Pool de Redevances (Cron)

**En tant que** plateforme,
**je veux** qu'un processus automatique calcule chaque mois le Pool de Redevances et la part de chaque éditeur,
**afin de** produire des résultats de paiement précis, reproductibles et auditables.

**Contexte technique :**
Le Pool = 50% du CA net mensuel (HT, hors frais bancaires estimés à 3%).
- 60% du Pool → catalogue Audio
- 40% du Pool → catalogue Ebook

Formule par éditeur :
```
Redevance Audio = (minutes_qualifiées_éditeur / total_minutes_qualifiées) × Pool_Audio
Redevance Ebook = (pages_qualifiées_éditeur / total_pages_qualifiées) × Pool_Ebook
```

Plancher garanti :
- Si `Redevance Audio / minutes_éditeur < 0,002 €/min` → complément versé
- Si `Redevance Ebook / pages_éditeur < 0,004 €/page` → complément versé
- Le complément est prélevé sur la marge plateforme (les 50% retenus), pas sur les autres éditeurs

**Critères d'acceptation :**
- [ ] Nouveau service `royalty-calculator.service.js`
- [ ] Cron mensuel déclenché le 1er de chaque mois à 02h00 UTC (via `payout-scheduler.service.js`)
- [ ] Le cron crée une ligne dans `royalty_periods` avec le mois précédent
- [ ] Il agrège toutes les `reading_sessions` qualifiées (`is_qualified = true`) du mois pour chaque éditeur
- [ ] Il calcule le CA net mensuel depuis les paiements `status = 'succeeded'` du mois
- [ ] Il crée une ligne `publisher_royalties` par éditeur avec `gross_amount_eur`, `floor_supplement_eur`, `net_amount_eur`
- [ ] Si un éditeur n'a aucune consommation qualifiée ce mois → aucune ligne créée (pas de paiement de 0€)
- [ ] Le statut de `royalty_periods` passe à `calculated` en fin de calcul
- [ ] Un email de récapitulatif est envoyé à l'admin (`ADMIN_EMAIL` en env) avec : nombre d'éditeurs, pool total, total distribué, complément plancher versé
- [ ] Fonction `recalculateRoyaltyPeriod(month)` exposée en admin pour re-calcul manuel si nécessaire

**Fichiers impactés :**
- `backend/src/services/royalty-calculator.service.js` (NOUVEAU)
- `backend/src/scheduler/subscription-scheduler.js` (MODIFIÉ — ajout cron royalties)
- `docs/migrations/051_royalty_tables.sql` (NOUVEAU — tables royalty_periods + publisher_royalties)
- `backend/src/routes/admin.publisher.routes.js` (MODIFIÉ — endpoint recalcul manuel)

**Dépendances :** Story 18.1, 18.2, 18.3, 18.5

---

### Story 18.7 — Audit Trail des Redevances

**En tant qu'** éditeur ou administrateur,
**je veux** avoir accès à un journal détaillé et immuable de chaque calcul de redevance,
**afin de** pouvoir contester, vérifier ou auditer les montants versés.

**Contexte technique :**
Conformément à la clause contractuelle (Article Y.3), chaque éditeur peut mandater un auditeur externe une fois par an. L'audit trail doit être exportable et ne jamais être modifiable après création.

**Critères d'acceptation :**
- [ ] Chaque ligne `publisher_royalties` est immuable après `status = 'paid'` (contrainte DB : trigger qui refuse les UPDATE sur les colonnes financières si paid)
- [ ] Endpoint admin `GET /api/admin/royalties/periods` → liste des périodes avec statut
- [ ] Endpoint admin `GET /api/admin/royalties/periods/:month` → détail complet d'une période (pool, taux, liste éditeurs, montants)
- [ ] Endpoint admin `GET /api/admin/royalties/publishers/:publisherId` → historique complet des redevances d'un éditeur
- [ ] Endpoint admin `GET /api/admin/royalties/sessions?month=&publisherId=` → export CSV de toutes les sessions qualifiées utilisées dans le calcul
- [ ] Endpoint `GET /api/publisher/royalties` (éditeur authentifié) → ses propres royalties avec le détail de chaque période
- [ ] Le CSV d'export inclut : `session_id, user_id_anonymisé, content_id, content_title, date, duration_minutes, normalized_pages, is_qualified`
- [ ] L'`user_id` est **anonymisé** dans les exports éditeur (remplacé par un hash SHA-256 du user_id + salt mensuel)
- [ ] Toute consultation de l'audit trail est loggée dans `audit_logs`

**Fichiers impactés :**
- `backend/src/routes/admin.royalties.routes.js` (NOUVEAU)
- `backend/src/routes/publisher.routes.js` (MODIFIÉ — endpoint royalties éditeur)
- `docs/migrations/051_royalty_tables.sql` (MODIFIÉ — trigger immuabilité)
- `backend/src/index.js` (MODIFIÉ — montage route audit royalties)

**Dépendances :** Story 18.6

---

### Story 18.8 — Rapport Mensuel Éditeur (PDF)

**En tant qu'** éditeur partenaire,
**je veux** recevoir chaque mois un rapport PDF professionnel détaillant mes statistiques de consommation et le montant de ma redevance,
**afin de** comprendre mes revenus et maintenir une relation de confiance avec la plateforme.

**Contexte technique :**
La librairie `pdfkit` est déjà installée et utilisée pour les factures. Le rapport PDF éditeur suit le même pattern que `invoice.service.js`.

**Contenu du rapport mensuel :**
- En-tête Papyri (logo, coordonnées)
- Période couverte (ex : Mars 2026)
- Tableau par titre : titre, type, minutes qualifiées, pages normalisées, montant calculé
- Pool du mois : total plateforme, taux de la minute/page, pool éditeur
- Montant brut, complément plancher, montant net
- Statut du paiement
- Note légale (référence clause contractuelle)

**Critères d'acceptation :**
- [ ] Service `publisher-report.service.js` avec fonction `generateMonthlyReport(publisherId, month)`
- [ ] Le rapport PDF est généré après chaque calcul mensuel (Story 18.6)
- [ ] Il est stocké dans Cloudflare R2 sous la clé `reports/publisher/{publisherId}/{YYYY-MM}.pdf`
- [ ] Un email est envoyé à l'éditeur (via Brevo) avec le PDF en pièce jointe
- [ ] Endpoint éditeur `GET /api/publisher/reports/:month` → téléchargement du rapport PDF (URL signée R2, TTL 1h)
- [ ] Endpoint admin `GET /api/admin/royalties/reports/:publisherId/:month` → même PDF accessible par l'admin
- [ ] Si aucune consommation qualifiée ce mois → email court envoyé : _"Aucune écoute qualifiée ce mois. Vous figurerez dans le prochain rapport dès que votre catalogue sera consommé."_

**Fichiers impactés :**
- `backend/src/services/publisher-report.service.js` (NOUVEAU)
- `backend/src/services/royalty-calculator.service.js` (MODIFIÉ — appel génération rapport)
- `backend/src/services/email.service.js` (MODIFIÉ — template rapport mensuel éditeur)
- `backend/src/routes/publisher.routes.js` (MODIFIÉ — endpoint téléchargement rapport)
- `backend/src/routes/admin.royalties.routes.js` (MODIFIÉ — endpoint admin rapport)

**Dépendances :** Story 18.6, 18.7

---

### Story 18.9 — Dashboard Éditeur : Stats de Consommation Temps Réel

**En tant qu'** éditeur partenaire,
**je veux** voir en temps quasi-réel les statistiques de consommation de mon catalogue sur la plateforme,
**afin de** comprendre quels titres performent et anticiper mes revenus du mois.

**Contexte technique :**
Le dashboard publisher existe (`PublishersDashboard.jsx`). Il faut l'enrichir avec les métriques royalty issues de `reading_sessions`.

**Critères d'acceptation :**
- [ ] Endpoint `GET /api/publisher/stats/royalty?month=YYYY-MM` retourne :
  - `total_audio_minutes_qualified` (mois en cours, sessions qualifiées uniquement)
  - `total_ebook_pages_qualified`
  - `estimated_amount_eur` (estimation au taux plancher = montant minimum garanti)
  - `top_contents` : top 5 titres par minutes/pages ce mois
  - `daily_trend` : tableau de 30 jours `[{date, audio_min, ebook_pages}]`
- [ ] Le dashboard publisher affiche :
  - Carte "Revenus estimés ce mois" (montant plancher garanti + mention "peut augmenter selon le pool final")
  - Graphique courbe : évolution quotidienne des écoutes du mois en cours
  - Tableau top 5 titres : couverture, titre, type, minutes/pages, % du catalogue éditeur
  - Historique des paiements : liste des `publisher_royalties` passées avec statut (payé / en attente)
- [ ] Les données sont rafraîchies automatiquement toutes les 60 secondes (polling)
- [ ] L'estimation est clairement labellisée "Estimation (plancher garanti)" pour éviter toute confusion avec le montant final

**Fichiers impactés :**
- `backend/src/routes/publisher.routes.js` (MODIFIÉ — endpoint stats royalty)
- `web/src/pages/publisher/PublisherDashboard.jsx` (MODIFIÉ — section royalties)
- `web/src/services/publisher.service.js` (MODIFIÉ — getRoyaltyStats)

**Dépendances :** Story 18.6

---

### Story 18.10 — Panel Admin : Gestion des Redevances

**En tant qu'** administrateur Papyri,
**je veux** un panel dédié à la gestion des redevances éditeurs,
**afin de** valider les calculs, marquer les paiements effectués, gérer les suspensions fraude et forcer un recalcul si nécessaire.

**Critères d'acceptation :**
- [ ] Nouvelle page admin `AdminRoyaltiesPage.jsx` accessible depuis le sidebar admin
- [ ] Onglet **Périodes** : liste des mois calculés avec pool total, nombre d'éditeurs, total distribué, statut. Bouton "Recalculer" (recalcul forcé du mois sélectionné)
- [ ] Onglet **Éditeurs** : par période, tableau de chaque éditeur : minutes, pages, montant brut, complément plancher, montant net, statut paiement. Bouton "Marquer comme payé" (déclenche envoi email confirmation éditeur)
- [ ] Onglet **Fraudes** : liste des `royalty_fraud_flags` non traités. Pour chaque flag : user_id (anonymisé), type de fraude, date, contenu concerné. Boutons : "Confirmer fraude" (bannir le compte et annuler redevances liées) / "Faux positif" (réhabiliter la session)
- [ ] Onglet **Sessions** : recherche par éditeur + mois → tableau paginé des sessions qualifiées utilisées dans le calcul. Export CSV.
- [ ] Toutes les actions admin sont loggées dans `audit_logs`
- [ ] Route : `/admin/royalties` ajoutée dans `App.js`
- [ ] Lien ajouté dans `AdminPublisherSidebar.jsx` sous la section "Éditeurs"

**Fichiers impactés :**
- `web/src/pages/admin/AdminRoyaltiesPage.jsx` (NOUVEAU)
- `web/src/services/admin.service.js` (MODIFIÉ — fonctions royalty)
- `web/src/components/AdminPublisherSidebar.jsx` (MODIFIÉ — lien Redevances)
- `web/src/App.js` (MODIFIÉ — route /admin/royalties)
- `backend/src/routes/admin.royalties.routes.js` (MODIFIÉ — endpoints gestion)
- `backend/src/index.js` (MODIFIÉ — montage route)

**Dépendances :** Story 18.7, 18.8

---

## Migrations SQL résumées

| Migration | Contenu | Story |
|---|---|---|
| `048_reading_sessions.sql` | Tables `reading_sessions` + `royalty_fraud_flags` | 18.1, 18.2 |
| `049_normalized_pages.sql` | Colonne `total_normalized_pages` dans `contents` | 18.3 |
| `050_royalty_settings.sql` | Colonnes royalty dans `app_settings` | 18.5 |
| `051_royalty_tables.sql` | Tables `royalty_periods` + `publisher_royalties` + trigger immuabilité | 18.6, 18.7 |

---

## Annexe Financière (référence pour l'implémentation)

### Pool de Redevances
```
CA net = CA brut × (1 - 0.03) [frais bancaires] × (1 / 1.20) [TVA France]
Pool = CA net × 0.50
Pool Audio = Pool × 0.60
Pool Ebook = Pool × 0.40
```

### Taux unitaires
```
Taux minute = Pool Audio / Total minutes qualifiées plateforme
Taux page    = Pool Ebook / Total pages qualifiées plateforme
```

### Planchers garantis (configurable dans app_settings)
```
Plancher audio : 0.002 € / minute  (= 0.12 € / heure)
Plancher ebook : 0.004 € / page normalisée (= 1.00 € / 250 pages)
```

### Exemple simulé (1 000 abonnés à 10 €/mois)
```
CA brut          = 10 000 €
CA net           = 10 000 × 0.97 / 1.20 = 8 083 €
Pool total       = 8 083 × 0.50 = 4 042 €
Pool Audio       = 4 042 × 0.60 = 2 425 €
Pool Ebook       = 4 042 × 0.40 = 1 617 €

Si total minutes plateforme = 500 000 min/mois
→ Taux minute = 2 425 / 500 000 = 0.00485 €/min (> plancher 0.002 €/min ✓)

Éditeur A : 50 000 min qualifiées
→ Redevance = 50 000 × 0.00485 = 242 €
```

---

## Ordre d'implémentation recommandé

```
18.1 → 18.2 → 18.3 (parallèle avec 18.2) → 18.4 → 18.5
→ 18.6 → 18.7 → 18.8 (parallèle avec 18.7) → 18.9 → 18.10
```

Les Stories 18.1 à 18.5 sont les **fondations** — elles doivent être complètes avant de pouvoir calculer quoi que ce soit.

---

## Risques identifiés

| Risque | Impact | Mitigation |
|---|---|---|
| Volume de sessions trop élevé (table très large) | Performance requêtes | Index sur `(publisher_id, is_qualified, session_start)` + partitionnement mensuel |
| Faux positifs fraude (utilisateur bloqué injustement) | Relation éditeur | Story 18.10 permet réhabilitation manuelle |
| Écart entre estimation plancher et montant final | Relation éditeur | Libellé clair "estimation plancher" dans le dashboard |
| Hors-ligne > 7 jours (usage légitime vacances) | UX utilisateur | Message explicatif + bouton "Synchroniser maintenant" |
| Refus éditeur des conditions de mesure | Commercial | Clause audit externe (Story 18.7) rassure les partenaires |
