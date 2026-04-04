import React from 'react';
import { Typography } from '@mui/material';
import LegalLayout, { LegalSection, LegalList, LegalSubSection } from './LegalLayout';

const PLATFORM = 'Papyri';
const COMPANY = 'Papyri Inc.';
const EMAIL = 'support@papyri.app';
const URL = 'https://papyri.app';
const DATE = 'Mars 2026';
const MAX_DEVICES = '2';

export default function CGUPage() {
  return (
    <LegalLayout
      title="Conditions Générales d'Utilisation"
      subtitle={`Plateforme ${PLATFORM} – Livres numériques et livres audio`}
      lastUpdated={DATE}
    >
      <LegalSection title="1. Présentation du service">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation de la plateforme numérique <strong>{PLATFORM}</strong> (ci-après « la Plateforme »).
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1.5 }}>
          La Plateforme est éditée par <strong>{COMPANY}</strong>.<br />
          Courriel : <strong>{EMAIL}</strong><br />
          Site web : <strong>{URL}</strong>
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1.5 }}>
          La Plateforme permet aux utilisateurs d'accéder à un catalogue de livres numériques et de livres audio disponibles en streaming ou en téléchargement hors ligne via une application mobile.
          L'utilisation de la Plateforme implique l'acceptation pleine et entière des présentes CGU.
        </Typography>
      </LegalSection>

      <LegalSection title="2. Définitions">
        {[
          ['Plateforme', 'Désigne le site web et les applications mobiles permettant l\'accès aux services.'],
          ['Utilisateur / Usager', 'Toute personne physique qui accède à la Plateforme ou qui crée un compte.'],
          ['Œuvre', 'Livre numérique (texte) ou livre audio mis à disposition sur la Plateforme.'],
          ['Streaming', 'Consultation d\'une œuvre en ligne sans téléchargement permanent.'],
          ['Téléchargement hors ligne', 'Fonction permettant de consulter une œuvre sans connexion Internet depuis l\'application mobile.'],
          ['Compte', 'Espace personnel permettant à l\'utilisateur d\'accéder aux services.'],
        ].map(([term, def]) => (
          <Typography key={term} sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 0.5 }}>
            <strong>{term} :</strong> {def}
          </Typography>
        ))}
      </LegalSection>

      <LegalSection title="3. Accès à la Plateforme">
        <LegalSubSection title="3.1 Inscription">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            L'accès à certains services nécessite la création d'un compte utilisateur. L'utilisateur s'engage à fournir des informations exactes, complètes et à jour. La Plateforme se réserve le droit de suspendre ou supprimer un compte contenant des informations inexactes.
          </Typography>
        </LegalSubSection>
        <LegalSubSection title="3.2 Âge minimum">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            L'utilisation de la Plateforme est réservée aux personnes âgées d'au moins <strong>18 ans</strong>. Les mineurs peuvent utiliser la Plateforme uniquement avec l'autorisation et sous la responsabilité d'un parent ou tuteur légal.
          </Typography>
        </LegalSubSection>
        <LegalSubSection title="3.3 Sécurité du compte">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            L'utilisateur est responsable de la confidentialité de ses identifiants de connexion. Toute activité effectuée depuis son compte est réputée effectuée par l'utilisateur. L'utilisateur doit informer la Plateforme immédiatement en cas d'accès non autorisé à son compte.
          </Typography>
        </LegalSubSection>
      </LegalSection>

      <LegalSection title="4. Services proposés">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          La Plateforme permet notamment :
        </Typography>
        <LegalList items={[
          'l\'accès à un catalogue de livres numériques et audiobooks',
          'la lecture en streaming',
          'l\'écoute audio en streaming',
          'le téléchargement temporaire sur mobile',
          'l\'accès via navigateur ou application mobile',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1 }}>
          La Plateforme peut modifier, suspendre ou améliorer ses services à tout moment.
        </Typography>
      </LegalSection>

      <LegalSection title="5. Téléchargement hors ligne">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Certaines œuvres peuvent être téléchargées temporairement sur un appareil mobile afin d'être consultées sans connexion Internet. Conditions :
        </Typography>
        <LegalList items={[
          'l\'utilisateur doit disposer d\'un abonnement actif',
          `le téléchargement est limité à ${MAX_DEVICES} appareils par compte`,
          'les fichiers sont protégés par des mesures techniques',
          'les fichiers deviennent inaccessibles après résiliation de l\'abonnement ou expiration du délai de téléchargement',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1 }}>
          Toute tentative de copie, extraction ou redistribution est interdite.
        </Typography>
      </LegalSection>

      <LegalSection title="6. Modèles d'accès au service">
        <LegalSubSection title="6.1 Abonnement">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            L'utilisateur peut souscrire un abonnement donnant accès à tout ou partie du catalogue. Les abonnements sont généralement mensuels, renouvelés automatiquement et résiliables depuis le compte utilisateur.
          </Typography>
        </LegalSubSection>
        <LegalSubSection title="6.2 Achat à l'unité">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            Certaines œuvres peuvent être accessibles par achat individuel. Dans ce cas, l'utilisateur obtient un droit personnel d'accès à l'œuvre.
          </Typography>
        </LegalSubSection>
        <LegalSubSection title="6.3 Contenus gratuits">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            Certaines œuvres peuvent être accessibles gratuitement. La Plateforme peut modifier ou retirer ces contenus à tout moment.
          </Typography>
        </LegalSubSection>
      </LegalSection>

      <LegalSection title="7. Propriété intellectuelle">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Toutes les œuvres disponibles sur la Plateforme sont protégées par les lois relatives au droit d'auteur et à la propriété intellectuelle. L'utilisateur bénéficie uniquement d'une licence d'utilisation personnelle, non exclusive et non transférable. Il est strictement interdit de :
        </Typography>
        <LegalList items={[
          'copier les œuvres',
          'distribuer les contenus',
          'revendre les fichiers',
          'reproduire tout ou partie du catalogue',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1 }}>
          Toute violation peut entraîner des poursuites.
        </Typography>
      </LegalSection>

      <LegalSection title="8. Comportements interdits">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          L'utilisateur s'engage à ne pas :
        </Typography>
        <LegalList items={[
          'contourner les mesures de protection techniques',
          'utiliser des robots ou scripts automatisés',
          'partager ses identifiants avec des tiers',
          'exploiter commercialement les contenus',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1 }}>
          La Plateforme peut suspendre ou supprimer un compte en cas de violation.
        </Typography>
      </LegalSection>

      <LegalSection title="9. Données personnelles">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          La Plateforme collecte et traite certaines données personnelles nécessaires au fonctionnement du service. Ces données peuvent inclure des informations de compte, l'historique de lecture et des données techniques. Le traitement est décrit dans la <strong>Politique de confidentialité</strong>. Selon la juridiction applicable, les utilisateurs disposent de droits d'accès, de rectification, de suppression et d'opposition.
        </Typography>
      </LegalSection>

      <LegalSection title="10. Disponibilité du service">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          La Plateforme s'efforce d'assurer l'accessibilité du service 24h/24. Toutefois, elle ne peut garantir une disponibilité permanente. Des interruptions peuvent survenir notamment pour maintenance, mise à jour, incidents techniques ou force majeure.
        </Typography>
      </LegalSection>

      <LegalSection title="11. Limitation de responsabilité">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          La Plateforme ne peut être tenue responsable des dommages résultant d'une utilisation non conforme du service, d'une interruption temporaire ou d'un problème technique indépendant de sa volonté. Aucune disposition ne limite les droits des consommateurs en vertu des lois applicables.
        </Typography>
      </LegalSection>

      <LegalSection title="12. Résiliation">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          L'utilisateur peut supprimer son compte à tout moment. La Plateforme peut suspendre ou résilier un compte en cas de violation des CGU, d'activité frauduleuse ou d'utilisation abusive du service.
        </Typography>
      </LegalSection>

      <LegalSection title="13. Modification des CGU">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          La Plateforme peut modifier les présentes CGU à tout moment. Les utilisateurs seront informés des modifications importantes. L'utilisation continue du service après modification vaut acceptation des nouvelles conditions.
        </Typography>
      </LegalSection>

      <LegalSection title="14. Loi applicable">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Les présentes CGU sont régies par les lois de la province de Québec (Canada) ainsi que les lois fédérales canadiennes applicables. Pour les utilisateurs résidant dans d'autres pays, certaines dispositions impératives de leur législation locale peuvent également s'appliquer.
        </Typography>
      </LegalSection>

      <LegalSection title="15. Règlement des litiges">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut d'accord, les tribunaux compétents de la province de Québec seront compétents, sauf dispositions légales contraires applicables au lieu de résidence du consommateur.
        </Typography>
      </LegalSection>

      <LegalSection title="16. Contact">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Pour toute question concernant les présentes CGU :<br />
          Courriel : <strong>{EMAIL}</strong>
        </Typography>
      </LegalSection>
    </LegalLayout>
  );
}
