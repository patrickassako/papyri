import React from 'react';
import { Typography } from '@mui/material';
import LegalLayout, { LegalSection } from './LegalLayout';
import tokens from '../../config/tokens';
import { useTranslation } from 'react-i18next';

export default function MentionsLegalesPage() {
  const { t } = useTranslation();
  return (
    <LegalLayout title={t('legal.mentionsTitle')}>
      <LegalSection title="Éditeur de la plateforme">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 2, color: '#374151' }}>
          <strong>Nom de la plateforme :</strong> Papyri<br />
          <strong>Éditeur :</strong> Papyri Inc.<br />
          <strong>Courriel :</strong> support@papyri.app<br />
          <strong>Site web :</strong> https://papyri.app
        </Typography>
      </LegalSection>

      <LegalSection title="Directeur de la publication">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Dimitri Talla
        </Typography>
      </LegalSection>

      <LegalSection title="Hébergement">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 2, color: '#374151' }}>
          Le site et ses données sont hébergés par :<br /><br />
          <strong>Supabase Inc.</strong><br />
          970 Toa Payoh North, #07-04, Singapour 318992<br />
          <a href="https://supabase.com" style={{ color: tokens.colors.primary }}>supabase.com</a><br /><br />
          <strong>Cloudflare Inc.</strong> (stockage fichiers)<br />
          101 Townsend St, San Francisco, CA 94107, États-Unis<br />
          <a href="https://cloudflare.com" style={{ color: tokens.colors.primary }}>cloudflare.com</a>
        </Typography>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Les contenus présents sur la plateforme (textes, livres, fichiers audio, images, logos) sont protégés par les lois sur le droit d'auteur et la propriété intellectuelle. Toute reproduction ou distribution sans autorisation est interdite.
        </Typography>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          La plateforme met tout en œuvre pour fournir des informations exactes. Toutefois, elle ne peut être tenue responsable d'erreurs, d'interruptions ou de problèmes techniques.
        </Typography>
      </LegalSection>

      <LegalSection title="Liens externes">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          La plateforme peut contenir des liens vers des sites tiers. Elle n'est pas responsable du contenu de ces sites.
        </Typography>
      </LegalSection>

      <LegalSection title="Contact">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Pour toute question : <strong>support@papyri.app</strong>
        </Typography>
      </LegalSection>
    </LegalLayout>
  );
}
