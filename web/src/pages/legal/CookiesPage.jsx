import React from 'react';
import { Typography } from '@mui/material';
import LegalLayout, { LegalSection, LegalSubSection, LegalList } from './LegalLayout';
import { useTranslation } from 'react-i18next';

const DATE = 'Mars 2026';

export default function CookiesPage() {
  const { t } = useTranslation();
  return (
    <LegalLayout
      title={t('legal.cookiesTitle')}
      lastUpdated={DATE}
    >
      <LegalSection title="1. Qu'est-ce qu'un cookie ?">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Un cookie est un petit fichier stocké sur votre appareil lors de la visite d'un site web. Les cookies permettent notamment :
        </Typography>
        <LegalList items={[
          'd\'améliorer l\'expérience utilisateur',
          'd\'analyser l\'utilisation du site',
          'de mémoriser les préférences',
        ]} />
      </LegalSection>

      <LegalSection title="2. Types de cookies utilisés">
        <LegalSubSection title="Cookies essentiels">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
            Ces cookies sont nécessaires au fonctionnement du site. Ils ne peuvent pas être désactivés. Exemples :
          </Typography>
          <LegalList items={['connexion au compte', 'sécurité', 'gestion de session']} />
        </LegalSubSection>
        <LegalSubSection title="Cookies analytiques">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            Ils permettent de comprendre comment les utilisateurs utilisent la plateforme afin d'améliorer les services. Ces cookies sont utilisés uniquement avec le <strong>consentement de l'utilisateur</strong> lorsque requis par la loi.
          </Typography>
        </LegalSubSection>
        <LegalSubSection title="Cookies fonctionnels">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            Ils permettent de mémoriser certaines préférences utilisateur (langue, thème, paramètres de lecture).
          </Typography>
        </LegalSubSection>
      </LegalSection>

      <LegalSection title="3. Gestion des cookies">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Les utilisateurs peuvent :
        </Typography>
        <LegalList items={[
          'accepter les cookies',
          'refuser les cookies non essentiels',
          'modifier leurs préférences à tout moment via la bannière de consentement',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1 }}>
          Les paramètres peuvent également être modifiés directement dans le navigateur.
        </Typography>
      </LegalSection>

      <LegalSection title="4. Durée de conservation">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Les cookies peuvent être stockés pendant la session (supprimés à la fermeture du navigateur) ou pour une durée maximale de <strong>13 mois</strong> selon les lois applicables.
        </Typography>
      </LegalSection>

      <LegalSection title="5. Contact">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Pour toute question concernant l'utilisation des cookies :<br />
          <strong>support@papyri.app</strong>
        </Typography>
      </LegalSection>
    </LegalLayout>
  );
}
