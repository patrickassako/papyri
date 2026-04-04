# Plan De Test Pré‑Déploiement (Web + Mobile + Backend)

Date: 3 avril 2026  
Version: v1.0  
Produit: Papyri (bibliothèque numérique)

## 1. Objectif

Valider que l’application est stable, sécurisée, performante et monétisable avant mise en production, avec focus sur:
- lecture EPUB/PDF et audio,
- paiements Stripe + Flutterwave,
- abonnement/quotas/déblocage,
- rôles (user, admin, éditeur),
- conformité (RGPD, sécurité, traçabilité).

## 2. Périmètre

Inclus:
- Front web (`web/src/pages`, parcours public + authentifié + admin + éditeur).
- App mobile (`mobile/src/screens`).
- API backend (`backend/src/routes`).
- Intégrations: Supabase Auth/DB, Cloudflare R2, Stripe, Flutterwave, notifications, webhooks.

Hors périmètre:
- Refonte UI/UX.
- Refactor technique non bloquant release.

## 3. Stratégie de test

Approche par risque:
- P0 (bloquant release): auth, paiement, accès contenu, lecture, corruption données.
- P1 (important): admin/éditeur, historique, préférences, recherche.
- P2 (confort): micro-UI, textes, animations.

Ordre d’exécution:
1. Smoke environnement.
2. Parcours critiques business (P0).
3. Régressions fonctionnelles (P1).
4. Non-fonctionnel (perf, sécurité, résilience).
5. Go/No-Go.

## 4. Environnements et prérequis

## 4.1 Environnements
- `local`: validation technique rapide.
- `staging`: validation pré‑prod obligatoire (mêmes variables clés que prod).

## 4.2 Services externes à vérifier avant tests
- Supabase: accessible + migrations appliquées.
- R2: URLs signées valides + CORS configuré.
- Stripe: clé + webhook actif.
- Flutterwave: clé + webhook/hash actif.
- Meilisearch: disponible ou fallback DB explicitement validé.

## 4.3 Jeux de données
- 1 compte visiteur.
- 1 compte user sans abonnement.
- 1 compte user avec abonnement actif.
- 1 compte user avec abonnement expiré.
- 1 compte admin.
- 1 compte éditeur.
- Contenus: ebook gratuit, ebook payant, ebook subscription, audio gratuit, audio payant.

## 5. Critères d’entrée / sortie

Entrée:
- Build web OK, backend démarre sans erreur bloquante, mobile démarre.
- Variables d’environnement renseignées.
- Webhooks configurés en staging.

Sortie:
- 100% des P0 passés.
- 0 bug critique/majeur ouvert (paiement, auth, accès contenu, sécurité).
- P1 passés >= 95%.
- Plan de rollback documenté.

## 6. Suites de test détaillées

## 6.1 Smoke (obligatoire)
- `SMK-01` Web charge (`/`, `/catalogue`, `/login`) sans erreur console bloquante.
- `SMK-02` API health `GET /health` OK.
- `SMK-03` Login/logout OK.
- `SMK-04` Ouverture contenu depuis détail vers lecteur OK.

## 6.2 Authentification / comptes
- `AUTH-01` Register + vérification profil créé.
- `AUTH-02` Login valide.
- `AUTH-03` Login invalide.
- `AUTH-04` Forgot/Reset password complet.
- `AUTH-05` Token expiré -> refresh ou redirection propre.
- `AUTH-06` Déconnexion multi-onglets.

## 6.3 Catalogue et fiche contenu
- `CAT-01` Liste contenus + filtres + tri.
- `CAT-02` Détail contenu chargé (cover, prix, type, langue, metadata).
- `CAT-03` Recommandations affichées.
- `CAT-04` Cas contenu indisponible/404.

## 6.4 Accès contenu / déblocage
- `ACC-01` Utilisateur non connecté -> CTA vers login.
- `ACC-02` Abonné actif -> déblocage quota.
- `ACC-03` Bonus credit consommé si quota épuisé.
- `ACC-04` Livre payant sans abonnement -> paiement requis.
- `ACC-05` Abonné actif + livre payant -> prix réduit correct.
- `ACC-06` Idempotence: contenu déjà débloqué ne redébite pas.

## 6.5 Paiement (critique)
- `PAY-01` Achat contenu via Stripe depuis `ContentDetailPage`.
- `PAY-02` Achat contenu via Flutterwave depuis `ContentDetailPage`.
- `PAY-03` Callback Stripe (`provider=stripe&session_id=...`) débloque le contenu.
- `PAY-04` Callback Flutterwave (`tx_ref`, `transaction_id`) débloque le contenu.
- `PAY-05` Paiement annulé -> état cohérent, pas de déblocage.
- `PAY-06` Timeout provider -> message utilisateur + retry possible.
- `PAY-07` Webhooks Stripe/Flutterwave mettent à jour `payments`.
- `PAY-08` Changement provider UI: Stripe ne doit jamais rediriger Flutterwave.

## 6.6 Lecteur ebook (EPUB/PDF)
- `READ-01` Chargement rapide après refresh (< 10s cible staging).
- `READ-02` EPUB affiche pages + navigation suivante/précédente.
- `READ-03` Sommaire/chapitres fonctionnels.
- `READ-04` Sauvegarde progression (CFI + pourcentage).
- `READ-05` Reprise au bon emplacement après refresh.
- `READ-06` Gestion erreur URL signée expirée (refresh/retry propre).
- `READ-07` CORS R2: aucun blocage navigateur.

## 6.7 Lecteur audio
- `AUD-01` Démarrage lecture.
- `AUD-02` Pause/reprise/seek.
- `AUD-03` Chapitres audio.
- `AUD-04` Sauvegarde progression + reprise.
- `AUD-05` Mini-player global.

## 6.8 Historique / Ma liste / avis
- `USR-01` Historique se met à jour après lecture.
- `USR-02` Bouton Reprendre renvoie au bon point.
- `USR-03` Ajout/retrait Ma liste ebook/audio.
- `USR-04` Créer/modifier/supprimer avis.

## 6.9 Abonnements
- `SUB-01` Souscription Stripe plan mensuel/annuel.
- `SUB-02` Souscription Flutterwave plan mensuel/annuel.
- `SUB-03` Callback abonnement active bien le plan.
- `SUB-04` Upgrade/downgrade/annulation/réactivation.
- `SUB-05` Achat siège supplémentaire (Stripe + Flutterwave).
- `SUB-06` Quotas texte/audio recalculés correctement.

## 6.10 Admin
- `ADM-01` Login admin et accès pages admin.
- `ADM-02` CRUD contenus/catégories.
- `ADM-03` Validation contenus éditeurs.
- `ADM-04` Gestion promos.
- `ADM-05` Dashboard revenus par provider.
- `ADM-06` Traitement demandes RGPD.
- `ADM-07` RBAC: interdictions effectives selon rôle.

## 6.11 Éditeur
- `PUB-01` Activation compte éditeur.
- `PUB-02` Ajout livre + métadonnées + upload.
- `PUB-03` Suivi statut validation.
- `PUB-04` Stats et revenus éditeur.
- `PUB-05` Promo éditeur.

## 6.12 Mobile
- `MOB-01` Onboarding premier lancement.
- `MOB-02` Auth complète.
- `MOB-03` Catalogue + détail + lecture ebook/audio.
- `MOB-04` Téléchargement offline et lecture offline.
- `MOB-05` Sync progression web <-> mobile.
- `MOB-06` Déconnexion appareil/session.

## 6.13 Sécurité (minimum avant go-live)
- `SEC-01` Accès API protégé sans JWT -> 401.
- `SEC-02` IDOR: utilisateur A ne voit pas données B.
- `SEC-03` Validation input (payloads invalides, tailles extrêmes).
- `SEC-04` Headers sécurité (Helmet/CORS) conformes.
- `SEC-05` Secret leakage: aucune clé sensible dans front build.
- `SEC-06` Webhook signature obligatoire Stripe/Flutterwave.

## 6.14 Performance / résilience
- `PERF-01` Temps de réponse API critique P95 < 800ms (staging cible).
- `PERF-02` Temps ouverture lecteur EPUB acceptable (< 10s fichier standard).
- `PERF-03` Recharge page détail et lecteur sans freeze.
- `PERF-04` Dégradation service externe (Meilisearch down) -> fallback OK.

## 7. Matrice navigateurs / devices

Web:
- Chrome (dernière version), Safari (dernière version), Firefox (dernière version).
- Desktop + mobile responsive (iOS Safari / Android Chrome).

Mobile:
- Android 12+.
- iOS 16+.

## 8. Check-list Go/No-Go

Go si:
- Tous P0 pass.
- Pas d’erreur paiement non maîtrisée.
- Aucune régression critique lecteur (EPUB/audio).
- Rollback testé.

No-Go si:
- Paiement/abonnement incohérent.
- Déblocage contenu faux positif/faux négatif.
- Corruption progression lecture.
- Fail sécurité majeur.

## 9. Plan rollback

- Web: rollback vers build N-1.
- Backend: rollback container/version N-1.
- DB: migrations non destructives uniquement; script rollback prêt pour migration release.
- Paiement: couper route d’init checkout si incident (feature flag ou garde serveur).

## 10. Rapport de test (template)

Pour chaque campagne:
- Date, environnement, build SHA.
- Nombre tests exécutés / pass / fail / bloqués.
- Liste anomalies (criticité, owner, ETA fix).
- Décision finale: Go / No-Go.

## 11. Exécution recommandée (48h avant mise en ligne)

J-2:
- Smoke + P0 web/backend.
- Paiement complet Stripe/Flutterwave en staging.

J-1:
- P1 admin/éditeur/mobile.
- Non-fonctionnel (perf/sécu/fallbacks).

Jour J:
- Smoke final.
- Go/No-Go meeting.
