import React from 'react';
import { Typography } from '@mui/material';
import LegalLayout, { LegalSection, LegalList } from './LegalLayout';
import { useTranslation } from 'react-i18next';

export default function CopyrightPage() {
  const { t } = useTranslation();
  return (
    <LegalLayout
      title={t('legal.copyrightTitle')}
      subtitle="Signalement de violation de droit d'auteur"
    >
      <LegalSection title="1. Respect du droit d'auteur">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Papyri respecte les lois applicables en matière de propriété intellectuelle. Les œuvres disponibles sur la plateforme sont publiées avec l'autorisation de leurs auteurs ou éditeurs.
        </Typography>
      </LegalSection>

      <LegalSection title="2. Signalement d'une violation de droit d'auteur">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Si vous estimez qu'un contenu présent sur la plateforme viole vos droits d'auteur, vous pouvez envoyer une notification comprenant :
        </Typography>
        <LegalList items={[
          'votre nom et coordonnées',
          'l\'identification de l\'œuvre protégée',
          'l\'URL du contenu concerné',
          'une déclaration attestant que la demande est faite de bonne foi',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1.5 }}>
          Les demandes doivent être envoyées à : <strong>copyright@papyri.app</strong>
        </Typography>
      </LegalSection>

      <LegalSection title="3. Traitement des demandes">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Après réception d'une notification valide :
        </Typography>
        <LegalList items={[
          'le contenu peut être temporairement retiré',
          'une analyse juridique est effectuée',
          'la décision finale est communiquée aux parties concernées',
        ]} />
      </LegalSection>

      <LegalSection title="4. Utilisation abusive">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Toute notification frauduleuse ou abusive peut entraîner des conséquences juridiques.
        </Typography>
      </LegalSection>

      <LegalSection title="5. Contact">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Pour toute question relative au droit d'auteur :<br />
          <strong>copyright@papyri.app</strong>
        </Typography>
      </LegalSection>
    </LegalLayout>
  );
}
