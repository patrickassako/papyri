# Prochaines Etapes - Avancement Epics 4, 5, 6
Date: 2026-02-14
Objectif: accelerer la livraison produit apres stabilisation Epic 2.

## Priorite 1 - Epic 4 (Lecteur Ebook) [Sprint court]
### Cible
Passer de UI lecteur a lecture fonctionnelle securisee + reprise progression.

### Stories ciblees
1. 4-1 Lecteur EPUB reprise automatique
2. 4-2 Lecteur PDF reprise automatique

### Livrables techniques
- Guard d'acces lecteur: auth + verification `can_read`.
- Consommation `GET /api/contents/:id/file-url` (URL signee) depuis `EReaderPage`.
- Persistance progression:
  - `PUT /reading-history/:content_id` toutes les X secondes / changement page.
- Restauration progression au chargement.

### Critere de validation
- Utilisateur non autorise bloque proprement.
- Reprise position fonctionnelle apres refresh/reconnexion.
- Aucune fuite URL privee longue duree.

## Priorite 2 - Epic 5 (Lecteur Audio) [Sprint court]
### Cible
Rendre le player audio reellement exploitable en streaming.

### Stories ciblees
1. 5-1 Lecteur audio plein ecran streaming
2. 5-2 Vitesse lecture + chapitres

### Livrables techniques
- Lecture stream via URL signee.
- Etat player stable: play/pause/seek/time.
- Vitesse 0.5x/1x/1.25x/1.5x/2x.
- Sauvegarde progression audio reguliere vers `reading_history`.

### Critere de validation
- Reprise audio apres fermeture page.
- Gestion erreurs reseau (message clair + retry).

## Priorite 3 - Epic 6 (Home personnalise) [Sprint court]
### Cible
Transformer `/home` en experience utile et personnalisee.

### Stories ciblees
1. 6-1 Reprendre en position #1
2. 6-2 Nouveautes / populaires

### Livrables techniques
- Refonte `Home` frontend pour consommer `/home`.
- Sections ordonnees: reprendre -> nouveautes -> populaires.
- Cards reutilisables avec progression.

### Critere de validation
- Home charge en <3s (dataset standard).
- Empty states soignes si pas d'historique.

## Ordre d'execution recommande
1. Epic 4 (acces + progression ebook)
2. Epic 5 (stream + progression audio)
3. Epic 6 (experience home unifiee)

## Risques
- Disponibilite fichiers reels (EPUB/PDF/MP3) et CORS R2.
- Granularite tracking progression (trop frequent = charge DB).
- Compatibilite navigateur sur rendu EPUB/PDF.

## KPI de sortie (phase suivante)
- Taux de reprise lecture/audio > 60%
- Temps moyen session lecteur +20%
- Erreurs lecture < 1%
