# Checklist Pré‑Déploiement (À Cocher)

Date: 3 avril 2026  
Produit: Papyri  
Référence: `docs/PLAN-TEST-PREDEPLOIEMENT-2026-04-03.md`

## Mode d’emploi
- Coche `Done` quand le test est exécuté.
- `Résultat`: `PASS` | `FAIL` | `BLOQUÉ`.
- `Preuve`: lien capture/log/ticket.
- `Ticket`: ID bug si échec.

## Métadonnées campagne
| Champ | Valeur |
|---|---|
| Environnement | |
| Build / SHA | |
| Date début | |
| Date fin | |
| Test lead | |
| Décision Go/No-Go | |

## P0 - Critique Release
| Done | ID | Test | Résultat | Testeur | Preuve | Ticket |
|---|---|---|---|---|---|---|
| [ ] | SMK-01 | Web charge (`/`, `/catalogue`, `/login`) sans erreur bloquante | | | | |
| [ ] | SMK-02 | API health `GET /health` OK | | | | |
| [ ] | SMK-03 | Login/logout OK | | | | |
| [ ] | SMK-04 | Ouverture contenu -> lecteur OK | | | | |
| [ ] | AUTH-01 | Register + profil créé | | | | |
| [ ] | AUTH-02 | Login valide | | | | |
| [ ] | AUTH-04 | Forgot/Reset password complet | | | | |
| [ ] | AUTH-05 | Token expiré -> refresh ou redirection propre | | | | |
| [ ] | ACC-01 | Visiteur -> CTA login/pricing cohérent | | | | |
| [ ] | ACC-02 | Abonné actif -> déblocage quota OK | | | | |
| [ ] | ACC-03 | Bonus credit consommé si quota épuisé | | | | |
| [ ] | ACC-04 | Livre payant sans abonnement -> paiement requis | | | | |
| [ ] | ACC-05 | Abonné actif + livre payant -> prix réduit correct | | | | |
| [ ] | ACC-06 | Idempotence déblocage (pas de double débit) | | | | |
| [ ] | PAY-01 | Achat contenu via Stripe depuis détail livre | | | | |
| [ ] | PAY-02 | Achat contenu via Flutterwave depuis détail livre | | | | |
| [ ] | PAY-03 | Callback Stripe débloque contenu | | | | |
| [ ] | PAY-04 | Callback Flutterwave débloque contenu | | | | |
| [ ] | PAY-05 | Paiement annulé -> pas de déblocage | | | | |
| [ ] | PAY-06 | Timeout provider -> message + retry possible | | | | |
| [ ] | PAY-07 | Webhooks Stripe/Flutterwave -> `payments` à jour | | | | |
| [ ] | PAY-08 | Choix Stripe ne redirige jamais Flutterwave | | | | |
| [ ] | READ-01 | Chargement lecteur EPUB après refresh acceptable | | | | |
| [ ] | READ-02 | Navigation pages EPUB suivante/précédente | | | | |
| [ ] | READ-03 | TOC/chapitres EPUB | | | | |
| [ ] | READ-04 | Sauvegarde progression EPUB (CFI + %) | | | | |
| [ ] | READ-05 | Reprise position après refresh | | | | |
| [ ] | READ-06 | Gestion URL signée expirée (retry) | | | | |
| [ ] | READ-07 | Aucun blocage CORS R2 en lecture | | | | |
| [ ] | AUD-01 | Lecture audio démarre | | | | |
| [ ] | AUD-02 | Pause/reprise/seek audio | | | | |
| [ ] | AUD-04 | Sauvegarde + reprise progression audio | | | | |
| [ ] | SUB-01 | Souscription Stripe (mensuel/annuel) | | | | |
| [ ] | SUB-02 | Souscription Flutterwave (mensuel/annuel) | | | | |
| [ ] | SUB-03 | Callback abonnement active plan | | | | |
| [ ] | SUB-06 | Quotas texte/audio recalculés correctement | | | | |
| [ ] | SEC-01 | API protégée sans JWT -> 401 | | | | |
| [ ] | SEC-02 | Pas d’IDOR entre utilisateurs | | | | |
| [ ] | SEC-04 | Headers sécurité (Helmet/CORS) conformes | | | | |
| [ ] | SEC-06 | Signature webhook obligatoire | | | | |

## P1 - Important
| Done | ID | Test | Résultat | Testeur | Preuve | Ticket |
|---|---|---|---|---|---|---|
| [ ] | CAT-01 | Catalogue: filtres + tri | | | | |
| [ ] | CAT-02 | Fiche contenu: métadonnées + prix | | | | |
| [ ] | CAT-03 | Recommandations affichées | | | | |
| [ ] | USR-01 | Historique se met à jour | | | | |
| [ ] | USR-02 | Bouton Reprendre fonctionne | | | | |
| [ ] | USR-03 | Ma liste add/remove | | | | |
| [ ] | USR-04 | Avis créer/modifier/supprimer | | | | |
| [ ] | SUB-04 | Upgrade/downgrade/annulation/réactivation | | | | |
| [ ] | SUB-05 | Achat siège supplémentaire (2 providers) | | | | |
| [ ] | ADM-01 | Accès admin + routing | | | | |
| [ ] | ADM-02 | CRUD contenus/catégories | | | | |
| [ ] | ADM-03 | Validation contenus éditeurs | | | | |
| [ ] | ADM-04 | Gestion promos | | | | |
| [ ] | ADM-05 | Analytics revenus par provider | | | | |
| [ ] | ADM-06 | Traitement demandes RGPD | | | | |
| [ ] | ADM-07 | RBAC admin effectif | | | | |
| [ ] | PUB-01 | Activation compte éditeur | | | | |
| [ ] | PUB-02 | Ajout livre + upload | | | | |
| [ ] | PUB-03 | Workflow validation éditeur | | | | |
| [ ] | PUB-04 | Stats/revenus éditeur | | | | |
| [ ] | MOB-01 | Onboarding mobile | | | | |
| [ ] | MOB-02 | Auth mobile | | | | |
| [ ] | MOB-03 | Catalogue + détail + lecture mobile | | | | |
| [ ] | MOB-04 | Offline download + lecture | | | | |
| [ ] | MOB-05 | Sync progression web <-> mobile | | | | |
| [ ] | MOB-06 | Gestion appareils/sessions mobile | | | | |
| [ ] | PERF-01 | API P95 acceptable (staging) | | | | |
| [ ] | PERF-03 | Refresh pages critiques sans freeze | | | | |
| [ ] | PERF-04 | Fallback si Meilisearch indispo | | | | |

## P2 - Confort
| Done | ID | Test | Résultat | Testeur | Preuve | Ticket |
|---|---|---|---|---|---|---|
| [ ] | AUTH-03 | Message erreur login invalide clair | | | | |
| [ ] | CAT-04 | Gestion 404/empty states | | | | |
| [ ] | AUD-03 | Chapitres audio UI | | | | |
| [ ] | AUD-05 | Mini-player global UX | | | | |
| [ ] | SEC-03 | Validation payloads extrêmes | | | | |
| [ ] | SEC-05 | Pas de secret dans build front | | | | |
| [ ] | PERF-02 | Temps ouverture EPUB optimisé | | | | |

## Synthèse anomalies
| Sévérité | Nombre | Ticket(s) |
|---|---|---|
| Critique | | |
| Majeur | | |
| Mineur | | |

## Décision finale
- [ ] GO
- [ ] NO-GO

Commentaires:

