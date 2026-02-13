# Personas MVP — Bibliotheque Numerique Privee

Version: 1.0
Reference contractuelle: Cahier de charge signe (Dimitri Talla / Afrik NoCode — 31/01/2026)
Reference produit: PRD v1.1
Audience: Product, Engineering, UX, QA

---

## Preambule

Ces personas sont des **hypotheses operationnelles assumees**, pas des profils marketing valides. Ils servent a guider les decisions produit, UX et techniques pour le MVP. Chaque persona sera affine par les donnees d'usage reelles apres lancement.

Les 3 personas ci-dessous couvrent les segments prioritaires identifies dans le cahier de charge : marche africain urbain, diaspora, et lectorat engage (culturel / religieux).

---

## Persona 1 : Awa — Etudiante / Jeune active (Afrique urbaine)

### Profil

| Attribut | Detail |
|----------|--------|
| Age | 19 – 28 ans |
| Localisation | Douala, Cameroun (Afrique urbaine) |
| Situation | Etudiante en licence / jeune salariee premier emploi |
| Revenu | Faible a modere (budget mensuel serre) |
| Langue | Francais |
| Device principal | **Smartphone Android** (entree/milieu de gamme) |
| Device secondaire | Ordinateur partage (cybercafe, campus, famille) |
| Connectivite | **3G/4G instable**, Wi-Fi ponctuel (campus, lieux publics) |

### Motivation principale

Acceder a des livres numeriques pour ses etudes et sa culture personnelle, sans dependre de librairies physiques rares ou de fichiers pirates de mauvaise qualite.

> *"Je veux lire des livres que je ne trouve nulle part dans ma ville, sans avoir peur des virus dans les PDF telecharges n'importe ou."*

### Friction majeure

- **Connexion instable** : la lecture doit fonctionner meme avec une connexion faible ou intermittente
- **Budget limite** : 5 EUR/mois est un engagement significatif — la valeur percue doit etre immediate
- **Stockage device limite** : le smartphone a peu d'espace, le mode hors-ligne doit etre econome
- **Habitude de gratuite** : habituee aux contenus pirates/gratuits, le passage au payant demande une UX convaincante

### Usage type

| Dimension | Comportement |
|-----------|-------------|
| Contenu principal | **Ebooks** (EPUB) — manuels, litterature, developpement personnel |
| Contenu secondaire | Livres audio (pendant les trajets) |
| Mode de lecture | Principalement **mobile** |
| Offline / Online | **Offline critique** — telecharge le contenu sur Wi-Fi campus, lit hors connexion dans le transport |
| Sessions | Courtes a moyennes (15-40 min), frequentes |
| Fonctionnalites cles | Surlignage, marque-pages, reprise automatique, mode nuit (lecture nocturne) |

### Hypotheses a valider

| Hypothese | Signal |
|-----------|--------|
| Awa accepte de payer 5 EUR/mois | Conversion apres inscription |
| Le mode hors-ligne est determinant pour elle | % d'utilisation du hors-ligne sur mobile |
| L'ebook est son format principal | Ratio ebook / audio dans ses sessions |
| La reprise automatique augmente sa retention | Retention J30 des utilisateurs qui utilisent la reprise |

---

## Persona 2 : Franck — Professionnel diaspora

### Profil

| Attribut | Detail |
|----------|--------|
| Age | 30 – 45 ans |
| Localisation | Paris, France (diaspora africaine en Europe) |
| Situation | Cadre / professionnel salarie |
| Revenu | Modere a bon (pouvoir d'achat europeen) |
| Langue | Francais |
| Device principal | **iPhone** (milieu/haut de gamme) |
| Device secondaire | Laptop personnel, tablette |
| Connectivite | **4G/5G stable + Wi-Fi fibre** — aucune contrainte reseau |

### Motivation principale

Retrouver et consommer des contenus culturels africains de qualite (litterature, essais, recits) dans un environnement curate et professionnel, loin des plateformes generiques occidentales.

> *"Je cherche des auteurs africains, des penseurs de chez moi. Amazon ne me propose que des best-sellers americains. Je veux une plateforme qui comprend ma culture."*

### Friction majeure

- **Exigence UX elevee** : habitude aux standards Audible/Kindle/Spotify — tolerance zero pour une UX mediocre
- **Temps limite** : professionnel occupe, la decouverte de contenu doit etre rapide et pertinente
- **Multi-device** : commence sur iPhone dans le metro, continue sur laptop a la maison — la synchronisation est essentielle
- **Confiance** : doit percevoir la plateforme comme serieuse et legale, pas une copie pirate

### Usage type

| Dimension | Comportement |
|-----------|-------------|
| Contenu principal | **Livres audio** — pendant les trajets, la cuisine, le sport |
| Contenu secondaire | Ebooks (essais, non-fiction, week-end) |
| Mode de lecture | **Multi-device** (iPhone + laptop + tablette) |
| Offline / Online | **Online principalement**, utilise le hors-ligne pour les vols / trajets longs |
| Sessions | Audio : longues (30-90 min). Ebook : moyennes (20-45 min) |
| Fonctionnalites cles | Playlist audio, vitesse de lecture (1.25x-1.5x), synchronisation cross-device, recommandations d'accueil |

### Hypotheses a valider

| Hypothese | Signal |
|-----------|--------|
| Franck prefere l'abonnement annuel (50 EUR) | Ratio mensuel / annuel |
| L'audio est son format principal | Ratio audio / ebook dans ses sessions |
| La synchronisation cross-device est critique | % utilisateurs multi-device |
| Les recommandations d'accueil augmentent l'engagement | Taux de clic sur recommandations accueil |

---

## Persona 3 : Mariame — Lectrice engagee (culturel / religieux)

### Profil

| Attribut | Detail |
|----------|--------|
| Age | 35 – 55 ans |
| Localisation | Abidjan, Cote d'Ivoire (Afrique urbaine) |
| Situation | Mere de famille, active dans une communaute culturelle / religieuse |
| Revenu | Modere |
| Langue | Francais |
| Device principal | **Smartphone Android** (milieu de gamme) |
| Device secondaire | Aucun ou tablette familiale partagee |
| Connectivite | **3G/4G variable**, Wi-Fi domicile (debit modere) |

### Motivation principale

Acceder a des contenus de reflexion spirituelle, culturelle et educative pour elle-meme et sa famille, dans un environnement de confiance sans publicite ni contenu inapproprie.

> *"Je veux des livres propres, des contenus qui nourrissent l'esprit. Je ne veux pas tomber sur n'importe quoi. Et je veux pouvoir ecouter quand je fais mes taches a la maison."*

### Friction majeure

- **Confiance et curation** : la qualite et la "proprete" du catalogue sont essentielles — un contenu inapproprie = perte de confiance definitive
- **Autonomie technique limitee** : l'application doit etre intuitive sans tutoriel complexe
- **Partage familial potentiel** : le device est parfois utilise par les enfants — l'experience doit etre safe
- **Debit reseau modere** : l'audio doit streamer sans coupure meme en 3G

### Usage type

| Dimension | Comportement |
|-----------|-------------|
| Contenu principal | **Ebooks** (reflexion, spiritualite, education) + **livres audio** (ecoute pendant les taches menageres) |
| Contenu secondaire | Contenus editoriaux exclusifs (narrations, textes courts) |
| Mode de lecture | **Mobile uniquement** |
| Offline / Online | **Offline important** — telecharge le soir en Wi-Fi, ecoute/lit dans la journee |
| Sessions | Audio : longues (45-120 min, en fond). Ebook : courtes a moyennes (15-30 min) |
| Fonctionnalites cles | Reprise automatique, mode nuit, taille de police (confort visuel), playlist audio, notifications de nouveaux contenus |

### Hypotheses a valider

| Hypothese | Signal |
|-----------|--------|
| Mariame utilise massivement le mode hors-ligne | % sessions hors-ligne |
| L'audio en arriere-plan est un usage dominant | Duree moyenne session audio |
| Les notifications de nouveaux contenus generent du re-engagement | Taux d'ouverture apres notification |
| L'onboarding MVP est suffisant pour son niveau technique | Taux de completion de l'onboarding |

---

## Matrice comparative des personas

| Dimension | Awa (Etudiante) | Franck (Diaspora) | Mariame (Engagee) |
|-----------|----------------|-------------------|-------------------|
| **Age** | 19-28 | 30-45 | 35-55 |
| **Zone** | Afrique urbaine | Europe (diaspora) | Afrique urbaine |
| **Device** | Android entree de gamme | iPhone haut de gamme | Android milieu de gamme |
| **Reseau** | 3G/4G instable | 4G/5G + fibre | 3G/4G variable |
| **Contenu favori** | Ebooks | Audio | Mixte (ebook + audio) |
| **Mode hors-ligne** | Critique | Occasionnel | Important |
| **Sensibilite prix** | Tres elevee | Faible | Moderee |
| **Exigence UX** | Moderee | Tres elevee | Simplicite avant tout |
| **Multi-device** | Non (smartphone only) | Oui (3 devices) | Non (smartphone only) |
| **Plan probable** | Mensuel | Annuel | Mensuel |

---

## Implications produit cles

### Performance reseau
2 personas sur 3 (Awa, Mariame) operent sur reseau instable. La strategie reseau faible (compression, lazy loading, cache, fallback) n'est pas un nice-to-have — c'est une **condition de viabilite produit**.

### Mode hors-ligne
Le mode hors-ligne controle est **critique** pour Awa et **important** pour Mariame. Ces deux segments representent le coeur du marche africain. Sans hors-ligne fonctionnel, le produit perd sa proposition de valeur principale pour 2/3 des personas.

### Audio
L'audio est le format principal de Franck et un usage majeur de Mariame. Le lecteur audio doit etre aussi solide que le lecteur ebook — pas un ajout secondaire.

### Onboarding
Mariame a une autonomie technique limitee. L'onboarding MVP en 3 ecrans doit etre teste specifiquement pour ce profil : clarifier sans complexifier.

### Pricing
Le plan mensuel (5 EUR) sera probablement dominant au lancement (Awa et Mariame). Le plan annuel (50 EUR) ciblera Franck et les utilisateurs fideles apres 3-6 mois.

---

## Prochaine etape

Ces personas doivent etre confrontes aux donnees reelles des 90 premiers jours post-lancement. Les hypotheses listees pour chaque persona doivent etre suivies via Google Analytics et les statistiques back-office.
