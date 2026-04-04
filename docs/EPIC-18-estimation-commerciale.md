# Epic 18 — Estimation Commerciale
# Système de Rémunération des Éditeurs (Publisher Royalty System)

**Date :** 2026-04-02
**Préparé par :** Patrick Essomba — Afrik NoCode
**Client :** Dimitri Talla — Papyri Inc.
**Référence projet :** Bibliothèque Numérique Privée Papyri

---

## Complexité par Story

| Story | Description | Complexité | Jours estimés |
|---|---|---|---|
| 18.1 | Sessions tracking (start / end / heartbeat) | Moyenne | 2.5 j |
| 18.2 | Qualified Listen — seuils anti-fraude (60s audio / 5 pages ebook) | Moyenne | 1.5 j |
| 18.3 | Pages Normalisées ebooks (extraction EPUB, 1 800 chars = 1 page) | Élevée | 2.5 j |
| 18.4 | Heartbeat Offline — sync au retour en ligne, blocage 7 jours | Élevée | 3 j |
| 18.5 | Fair Use Cap (12h/jour) + Preuve d'attention (3h sans interaction) | Moyenne | 2 j |
| 18.6 | Calcul mensuel automatique Pool + redevances par éditeur (cron) | **Très élevée** | 4 j |
| 18.7 | Audit Trail immuable + export CSV sessions anonymisé | Élevée | 2.5 j |
| 18.8 | Rapport PDF mensuel envoyé par email à chaque éditeur | Élevée | 2.5 j |
| 18.9 | Dashboard éditeur : stats temps réel + estimation revenus | Moyenne | 2 j |
| 18.10 | Panel admin : périodes, paiements, fraudes, sessions | Élevée | 3 j |
| **TOTAL** | | | **~26 jours** |

**Avec marge imprévus (+15%) → ~30 jours ouvrés = 6 semaines**

---

## Fourchette de Prix

> **Référence interne :** Publisher Feature (Epics 13-17) = **3 500 EUR / 7 semaines**
>
> Epic 18 = 6 semaines mais techniquement plus complexe (moteur financier, fraude,
> audit légal, sync offline) → légère prime de complexité justifiée.

| Scénario | Prix | Argument |
|---|---|---|
| Minimum acceptable | **2 800 EUR** | Plancher en cas de négociation — ne pas descendre en dessous |
| **Prix recommandé** | **3 500 EUR** | Aligné sur le précédent Publisher Feature, cohérent et défendable |
| Prix premium | **4 200 EUR** | Justifié par la complexité réelle du moteur financier + clause légale |

---

## Recommandation : 3 500 EUR

### Pourquoi ce chiffre tient la route face au client

1. **Référence connue** — c'est exactement ce qu'il a payé pour le Publisher Feature
   (7 semaines) : il a un repère, pas de surprise.
2. **Équilibre durée / complexité** — Epic 18 est 1 semaine plus court (6 semaines)
   mais plus complexe sur le plan technique. Ça s'équilibre.
3. **Valeur commerciale élevée** — le moteur financier (Story 18.6) et l'audit légal
   (Story 18.7) ne sont pas du simple CRUD : ce sont des livrables qui ont une valeur
   directe pour ses relations avec les éditeurs partenaires.
4. **Remplacement d'un coût externe** — le rapport PDF mensuel automatique (Story 18.8)
   remplace un travail comptable manuel qu'il devrait sinon confier à un prestataire.

---

## Option : Phasage pour faciliter la vente

Si le client hésite à engager le budget en une fois :

| Phase | Stories incluses | Prix | Ce que le client obtient |
|---|---|---|---|
| **Phase 1** — Fondations + Calcul | 18.1 → 18.6 | **2 200 EUR** | Système fonctionnel de bout en bout : tracking, qualification, calcul mensuel automatique |
| **Phase 2** — Rapports + Admin | 18.7 → 18.10 | **1 300 EUR** | Interface complète : PDF éditeur, audit trail, dashboard, panel admin |
| **Total** | 18.1 → 18.10 | **3 500 EUR** | — |

> Cette approche permet de livrer la Phase 1 rapidement (valeur immédiate visible)
> et de facturer la Phase 2 une fois que le client voit le système tourner en production.

---

## Récapitulatif Budget Total Projet

| Jalon | Description | Montant |
|---|---|---|
| Contrat initial | Application complète (Epics 1-12) | 3 300 EUR |
| Avenant 1 | Publisher Feature (Epics 13-17) | 3 500 EUR |
| **Avenant 2** | **Rémunération Éditeurs (Epic 18)** | **3 500 EUR** |
| **TOTAL PROJET** | | **10 300 EUR** |

---

*Document préparé par Afrik NoCode — Patrick Essomba*
*Estimation valable 30 jours à compter de la date d'émission.*
