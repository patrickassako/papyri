import React from 'react';
import { Typography } from '@mui/material';
import LegalLayout, { LegalSection, LegalList, LegalSubSection } from './legal/LegalLayout';

const PLATFORM = 'Papyri';
const COMPANY = 'Papyri Inc.';
const EMAIL = 'privacy@papyri.app';
const DATE = 'Mars 2026';

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Politique de Confidentialité"
      subtitle={`${PLATFORM} – Protection de vos données personnelles`}
      lastUpdated={DATE}
    >
      <LegalSection title="1. Responsable du traitement">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Le responsable du traitement des données à caractère personnel collectées sur la plateforme <strong>{PLATFORM}</strong> est <strong>{COMPANY}</strong>.<br />
          Courriel : <strong>{EMAIL}</strong>
        </Typography>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Dans le cadre de la fourniture de nos services, nous collectons les catégories de données suivantes :
        </Typography>
        <LegalSubSection title="2.1 Données d'identification et de compte">
          <LegalList items={[
            'nom et prénom',
            'adresse email',
            'mot de passe (chiffré, non accessible)',
            'photo de profil (optionnelle)',
          ]} />
        </LegalSubSection>
        <LegalSubSection title="2.2 Données de navigation et techniques">
          <LegalList items={[
            'adresse IP',
            'type d\'appareil et système d\'exploitation',
            'navigateur utilisé',
            'dates et heures de connexion',
          ]} />
        </LegalSubSection>
        <LegalSubSection title="2.3 Données d'utilisation du service">
          <LegalList items={[
            'historique de lecture (livres consultés, progression, temps de lecture)',
            'listes de lecture et favoris',
            'avis et notes laissés sur les œuvres',
          ]} />
        </LegalSubSection>
        <LegalSubSection title="2.4 Données de paiement et d'abonnement">
          <LegalList items={[
            'informations de facturation (nom, adresse)',
            'historique des transactions (montant, date, devise)',
            'fournisseur de paiement utilisé (Stripe ou Flutterwave)',
            'les données de carte bancaire sont traitées directement par nos prestataires — nous ne les stockons pas',
          ]} />
        </LegalSubSection>
        <LegalSubSection title="2.5 Données de notification">
          <LegalList items={[
            'jetons de notification push (Firebase FCM)',
            'préférences de notification',
          ]} />
        </LegalSubSection>
      </LegalSection>

      <LegalSection title="3. Finalités du traitement">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Vos données sont traitées pour les finalités suivantes :
        </Typography>
        <LegalList items={[
          'création et gestion de votre compte utilisateur',
          'fourniture du service (accès aux contenus numériques)',
          'gestion des abonnements, paiements et facturation',
          'envoi de notifications liées au service (nouvelles parutions, rappels)',
          'amélioration de la plateforme via des statistiques anonymisées',
          'prévention de la fraude et sécurité des systèmes',
          'respect des obligations légales et comptables',
        ]} />
      </LegalSection>

      <LegalSection title="4. Base légale du traitement">
        <LegalList items={[
          'Exécution du contrat : pour les données nécessaires à la fourniture du service (compte, abonnement, accès aux contenus)',
          'Consentement : pour les cookies analytiques et les notifications push',
          'Intérêt légitime : pour la sécurité, la prévention des fraudes et l\'amélioration des services',
          'Obligation légale : pour la conservation des données comptables et fiscales',
        ]} />
      </LegalSection>

      <LegalSection title="5. Durée de conservation">
        <LegalList items={[
          'Données de compte actif : durée de l\'abonnement + 3 ans après résiliation',
          'Données de paiement et factures : 10 ans (obligation légale comptable)',
          'Données de navigation : 13 mois maximum',
          'Compte supprimé : vos données personnelles sont anonymisées immédiatement',
        ]} />
      </LegalSection>

      <LegalSection title="6. Partage des données">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Vos données ne sont jamais vendues à des tiers. Elles peuvent être partagées uniquement avec nos sous-traitants, dans le strict cadre de la fourniture du service :
        </Typography>
        <LegalList items={[
          'Supabase Inc. — hébergement des données et authentification',
          'Cloudflare Inc. — stockage des fichiers numériques (R2)',
          'Stripe Inc. — traitement des paiements par carte bancaire',
          'Flutterwave — traitement des paiements Mobile Money',
          'Google Firebase — envoi de notifications push (FCM)',
          'Brevo / Mailchimp — envoi d\'emails transactionnels',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1.5 }}>
          Ces prestataires sont soumis à des obligations contractuelles de confidentialité et de sécurité.
        </Typography>
      </LegalSection>

      <LegalSection title="7. Vos droits">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Conformément aux lois applicables en matière de protection des données (notamment le RGPD pour les utilisateurs européens), vous disposez des droits suivants :
        </Typography>
        <LegalList items={[
          'Droit d\'accès : consulter et télécharger l\'ensemble de vos données depuis votre profil',
          'Droit de rectification : modifier vos informations personnelles depuis votre profil',
          'Droit à l\'effacement : supprimer définitivement votre compte et vos données',
          'Droit à la portabilité : exporter vos données en format JSON depuis votre profil',
          'Droit d\'opposition : désactiver les cookies analytiques à tout moment via la bannière',
          'Droit à la limitation : demander la limitation du traitement dans certains cas',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1.5 }}>
          Pour exercer ces droits, contactez-nous à <strong>{EMAIL}</strong>. Nous répondrons dans un délai de 30 jours.
        </Typography>
      </LegalSection>

      <LegalSection title="8. Cookies">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Nous utilisons des cookies essentiels (session, authentification — nécessaires au fonctionnement du service) et des cookies analytiques anonymisés (amélioration du service, utilisés avec votre consentement). Aucun cookie publicitaire ou de pistage tiers n'est utilisé. Vous pouvez gérer vos préférences via la bannière de consentement. Pour plus de détails, consultez notre <strong>Politique de Cookies</strong>.
        </Typography>
      </LegalSection>

      <LegalSection title="9. Sécurité">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Vos données sont protégées par chiffrement en transit (HTTPS/TLS) et au repos. L'accès est limité aux personnes habilitées. Les paiements sont traités directement par Stripe et Flutterwave, certifiés PCI-DSS. En cas de violation de données susceptible d'affecter vos droits, nous vous en informerons conformément aux délais légaux.
        </Typography>
      </LegalSection>

      <LegalSection title="10. Transferts internationaux">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Certains de nos sous-traitants sont établis hors de l'Union Européenne (États-Unis, Singapour). Ces transferts sont encadrés par des garanties appropriées (clauses contractuelles types, certifications adéquates) conformément aux réglementations applicables.
        </Typography>
      </LegalSection>

      <LegalSection title="11. Mineurs">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          La plateforme est destinée aux personnes âgées d'au moins 18 ans. Nous ne collectons pas sciemment de données personnelles concernant des mineurs. Si vous êtes parent ou tuteur et constatez qu'un mineur nous a fourni des données sans autorisation, contactez-nous pour les supprimer.
        </Typography>
      </LegalSection>

      <LegalSection title="12. Modifications de la politique">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Nous pouvons mettre à jour cette politique à tout moment. En cas de modification substantielle, les utilisateurs seront notifiés par email ou via la plateforme. La version en vigueur est disponible en permanence sur le site.
        </Typography>
      </LegalSection>

      <LegalSection title="13. Contact et réclamations">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Pour toute question relative à la protection de vos données personnelles :<br />
          <strong>{EMAIL}</strong><br /><br />
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez également adresser une réclamation à l'autorité de contrôle compétente dans votre pays de résidence.
        </Typography>
      </LegalSection>
    </LegalLayout>
  );
}
