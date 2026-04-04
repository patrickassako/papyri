import React from 'react';
import { Typography } from '@mui/material';
import LegalLayout, { LegalSection, LegalList, LegalSubSection } from './LegalLayout';

const PLATFORM = 'Papyri';
const COMPANY = 'Papyri Inc.';
const EMAIL = 'support@papyri.app';
const DATE = 'Mars 2026';

export default function CGVPage() {
  return (
    <LegalLayout
      title="Conditions Générales de Vente"
      subtitle={`${PLATFORM} – Abonnements et achats de contenus numériques`}
      lastUpdated={DATE}
    >
      <LegalSection title="1. Présentation de la société">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Les présentes Conditions Générales de Vente (« CGV ») régissent les transactions effectuées sur la plateforme <strong>{PLATFORM}</strong>.
          La Plateforme est exploitée par <strong>{COMPANY}</strong>.<br />
          Courriel : <strong>{EMAIL}</strong>
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1.5 }}>
          Les présentes CGV complètent les Conditions Générales d'Utilisation (CGU) de la Plateforme.
        </Typography>
      </LegalSection>

      <LegalSection title="2. Objet">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Les CGV définissent les conditions applicables :
        </Typography>
        <LegalList items={[
          'aux abonnements donnant accès au catalogue numérique',
          'aux achats à l\'unité de contenus numériques',
          'à tout paiement effectué via la Plateforme',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1 }}>
          Toute commande implique l'acceptation des présentes CGV.
        </Typography>
      </LegalSection>

      <LegalSection title="3. Produits et services">
        <LegalSubSection title="3.1 Abonnements">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            Différentes formules sont proposées. Les détails de chaque offre (prix, crédits, durée) sont présentés sur la page Tarifs de la Plateforme.
          </Typography>
        </LegalSubSection>
        <LegalSubSection title="3.2 Achat à l'unité">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            Certaines œuvres peuvent être accessibles par achat individuel. L'achat donne droit à une licence d'accès personnelle à l'œuvre, généralement en streaming ou via l'application mobile. L'utilisateur n'acquiert pas la propriété du contenu.
          </Typography>
        </LegalSubSection>
        <LegalSubSection title="3.3 Contenus gratuits">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            La Plateforme peut proposer des œuvres gratuites, des essais gratuits ou des promotions temporaires. Ces offres peuvent être modifiées ou retirées à tout moment.
          </Typography>
        </LegalSubSection>
      </LegalSection>

      <LegalSection title="4. Prix">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Les prix des services sont affichés sur la Plateforme avant toute commande. Selon la localisation de l'utilisateur, les prix peuvent être affichés dans différentes devises. Pour les utilisateurs situés au Canada, les taxes applicables peuvent inclure :
        </Typography>
        <LegalList items={[
          'TPS (taxe fédérale)',
          'TVH',
          'TVQ (Québec)',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1 }}>
          La Plateforme se réserve le droit de modifier ses prix à tout moment. Toute modification tarifaire concernant un abonnement sera communiquée au moins <strong>30 jours</strong> avant son entrée en vigueur.
        </Typography>
      </LegalSection>

      <LegalSection title="5. Modalités de paiement">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Les paiements sont effectués en ligne via des prestataires sécurisés. La Plateforme utilise notamment les services de <strong>Stripe</strong> et <strong>Flutterwave</strong>. Les moyens de paiement acceptés incluent :
        </Typography>
        <LegalList items={[
          'cartes bancaires (Visa, Mastercard, American Express)',
          'Apple Pay',
          'Google Pay',
          'Mobile Money',
          'moyens de paiement régionaux',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1 }}>
          Les données bancaires sont traitées directement par ces prestataires et ne sont pas conservées par la Plateforme.
        </Typography>
      </LegalSection>

      <LegalSection title="6. Validation de la commande">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Toute commande devient définitive après validation du paiement et confirmation de la transaction par la Plateforme. La Plateforme se réserve le droit de refuser une transaction en cas de suspicion de fraude ou de paiement non autorisé.
        </Typography>
      </LegalSection>

      <LegalSection title="7. Abonnements">
        <LegalSubSection title="7.1 Renouvellement">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            Sauf indication contraire, les abonnements sont renouvelés automatiquement à la fin de chaque période de facturation.
          </Typography>
        </LegalSubSection>
        <LegalSubSection title="7.2 Résiliation">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            L'utilisateur peut résilier son abonnement à tout moment depuis son compte. La résiliation prend effet à la fin de la période de facturation en cours.
          </Typography>
        </LegalSubSection>
        <LegalSubSection title="7.3 Suspension">
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
            La Plateforme peut suspendre l'accès en cas de non-paiement, d'activité frauduleuse ou de violation des CGU.
          </Typography>
        </LegalSubSection>
      </LegalSection>

      <LegalSection title="8. Droit d'annulation et remboursement">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mb: 1 }}>
          Dans la mesure permise par les lois applicables, les contenus numériques accessibles immédiatement après achat peuvent ne pas être remboursables. Toutefois, un remboursement peut être accordé notamment dans les cas suivants :
        </Typography>
        <LegalList items={[
          'erreur de facturation',
          'transaction frauduleuse',
          'impossibilité technique d\'accès au service',
          'obligations légales applicables',
        ]} />
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151', mt: 1 }}>
          Les demandes de remboursement doivent être adressées au service client dans un délai raisonnable.
        </Typography>
      </LegalSection>

      <LegalSection title="9. Facturation">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Les utilisateurs peuvent accéder à leurs factures depuis leur compte. Les factures sont émises par <strong>{COMPANY}</strong>. Pour les utilisateurs professionnels, une facture incluant les taxes applicables peut être fournie.
        </Typography>
      </LegalSection>

      <LegalSection title="10. Fraude et sécurité">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          La Plateforme se réserve le droit de suspendre ou annuler toute transaction en cas de suspicion de fraude. Toute utilisation frauduleuse des moyens de paiement peut entraîner la fermeture du compte.
        </Typography>
      </LegalSection>

      <LegalSection title="11. Responsabilité">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          La Plateforme s'engage à fournir ses services avec diligence. Toutefois, elle ne peut être tenue responsable des dommages résultant d'une interruption temporaire du service, d'un problème technique indépendant de sa volonté ou d'une mauvaise utilisation du service. Rien dans les présentes CGV ne limite les droits des consommateurs prévus par les lois applicables.
        </Typography>
      </LegalSection>

      <LegalSection title="12. Loi applicable et règlement des litiges">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Les présentes CGV sont régies par les lois de la province de Québec (Canada) ainsi que les lois fédérales canadiennes applicables. En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut d'accord, le litige sera soumis aux tribunaux compétents de la province de Québec.
        </Typography>
      </LegalSection>

      <LegalSection title="13. Service client">
        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.85, color: '#374151' }}>
          Pour toute question relative aux paiements ou aux commandes :<br />
          Email : <strong>{EMAIL}</strong>
        </Typography>
      </LegalSection>
    </LegalLayout>
  );
}
