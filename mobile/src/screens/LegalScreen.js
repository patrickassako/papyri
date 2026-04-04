import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const tokens = require('../config/tokens');

const LEGAL_CONTENT = {
  cgu: {
    title: "Conditions Générales d'Utilisation",
    sections: [
      { heading: '1. Présentation du service', body: "Papyri est une plateforme numérique permettant l'accès à des livres numériques et des livres audio via un abonnement. La plateforme est éditée par Papyri Inc. (support@papyri.app)." },
      { heading: '2. Accès à la plateforme', body: "L'accès à certains services nécessite la création d'un compte. L'utilisateur doit avoir au moins 18 ans et fournir des informations exactes. L'utilisateur est responsable de la confidentialité de ses identifiants." },
      { heading: '3. Services proposés', body: "La plateforme permet l'accès à un catalogue de livres numériques et d'audiobooks, la lecture en streaming, l'écoute audio, et le téléchargement temporaire sur mobile." },
      { heading: '4. Téléchargement hors ligne', body: "Le téléchargement est réservé aux abonnés actifs, limité à 2 appareils par compte. Les fichiers sont protégés et deviennent inaccessibles après résiliation." },
      { heading: '5. Propriété intellectuelle', body: "Toutes les œuvres sont protégées par les lois sur le droit d'auteur. L'utilisateur bénéficie d'une licence d'utilisation personnelle, non exclusive et non transférable. Toute copie, distribution ou revente est interdite." },
      { heading: '6. Comportements interdits', body: "Il est interdit de contourner les protections techniques, d'utiliser des robots, de partager ses identifiants ou d'exploiter commercialement les contenus." },
      { heading: '7. Loi applicable', body: "Les CGU sont régies par les lois de la province de Québec (Canada). En cas de litige, les tribunaux compétents de Québec seront saisis." },
      { heading: '8. Contact', body: 'support@papyri.app' },
    ],
  },
  cgv: {
    title: 'Conditions Générales de Vente',
    sections: [
      { heading: '1. Objet', body: "Les CGV définissent les conditions applicables aux abonnements, aux achats à l'unité et à tout paiement effectué via la plateforme Papyri." },
      { heading: '2. Prix', body: "Les prix sont affichés avant toute commande. Toute modification tarifaire sur un abonnement sera communiquée au moins 30 jours à l'avance." },
      { heading: '3. Moyens de paiement', body: "Les paiements sont sécurisés via Stripe et Flutterwave. Les moyens acceptés incluent : cartes bancaires (Visa, Mastercard, Amex), Apple Pay, Google Pay, Mobile Money." },
      { heading: '4. Abonnements', body: "Les abonnements se renouvellent automatiquement. L'utilisateur peut résilier à tout moment depuis son compte, avec effet à la fin de la période en cours." },
      { heading: '5. Remboursement', body: "Un remboursement peut être accordé en cas d'erreur de facturation, de transaction frauduleuse ou d'impossibilité technique d'accès au service." },
      { heading: '6. Loi applicable', body: "Les CGV sont régies par les lois de la province de Québec (Canada)." },
      { heading: '7. Contact', body: 'support@papyri.app' },
    ],
  },
  privacy: {
    title: 'Politique de Confidentialité',
    sections: [
      { heading: '1. Responsable du traitement', body: 'Papyri Inc. — privacy@papyri.app' },
      { heading: '2. Données collectées', body: "Données d'identification (nom, email), données de navigation (IP, appareil), historique de lecture, données d'abonnement et de paiement, jetons de notification push." },
      { heading: '3. Finalités', body: "Gestion du compte, fourniture du service, gestion des paiements, envoi de notifications, amélioration de la plateforme via statistiques anonymisées, prévention des fraudes." },
      { heading: '4. Partage des données', body: "Vos données ne sont jamais vendues. Elles sont partagées uniquement avec nos sous-traitants : Supabase, Cloudflare, Stripe, Flutterwave, Firebase, Brevo." },
      { heading: '5. Vos droits', body: "Vous disposez des droits d'accès, de rectification, d'effacement, de portabilité et d'opposition. Exercez-les depuis votre profil ou en contactant privacy@papyri.app." },
      { heading: '6. Conservation', body: "Données actives : durée de l'abonnement + 3 ans. Données de paiement : 10 ans (obligation légale). Compte supprimé : anonymisation immédiate." },
      { heading: '7. Sécurité', body: "Chiffrement en transit (HTTPS/TLS) et au repos. Paiements traités par Stripe et Flutterwave (certifiés PCI-DSS)." },
      { heading: '8. Contact', body: 'privacy@papyri.app' },
    ],
  },
  cookies: {
    title: 'Politique de Cookies',
    sections: [
      { heading: 'Cookies essentiels', body: "Nécessaires au fonctionnement du service (connexion, sécurité, session). Ne peuvent pas être désactivés." },
      { heading: 'Cookies analytiques', body: "Permettent de comprendre comment les utilisateurs utilisent la plateforme. Utilisés uniquement avec votre consentement." },
      { heading: 'Cookies fonctionnels', body: "Mémorisent vos préférences (langue, thème, paramètres de lecture)." },
      { heading: 'Durée', body: "Les cookies peuvent être stockés pendant la session ou pour une durée maximale de 13 mois." },
      { heading: 'Gestion', body: "Vous pouvez accepter ou refuser les cookies non essentiels via la bannière de consentement sur le site web." },
      { heading: 'Contact', body: 'support@papyri.app' },
    ],
  },
  mentions: {
    title: 'Mentions Légales',
    sections: [
      { heading: 'Éditeur', body: "Papyri Inc.\nCourriel : support@papyri.app\nSite web : https://papyri.app" },
      { heading: 'Directeur de la publication', body: 'Dimitri Talla' },
      { heading: 'Hébergement', body: "Supabase Inc. — 970 Toa Payoh North, Singapour\nCloudflare Inc. (fichiers) — 101 Townsend St, San Francisco, CA" },
      { heading: 'Propriété intellectuelle', body: "Les contenus (textes, livres, fichiers audio, images, logos) sont protégés par les lois sur le droit d'auteur. Toute reproduction sans autorisation est interdite." },
      { heading: 'Contact', body: 'support@papyri.app' },
    ],
  },
  copyright: {
    title: 'Politique Copyright & Signalement',
    sections: [
      { heading: "Respect du droit d'auteur", body: "Papyri respecte les lois applicables en matière de propriété intellectuelle. Les œuvres disponibles sont publiées avec l'autorisation de leurs auteurs ou éditeurs." },
      { heading: 'Signaler une violation', body: "Envoyez une notification à copyright@papyri.app avec : vos coordonnées, l'identification de l'œuvre protégée, l'URL du contenu concerné, et une déclaration de bonne foi." },
      { heading: 'Traitement des demandes', body: "Après réception d'une notification valide : le contenu peut être temporairement retiré, une analyse juridique est effectuée, la décision est communiquée aux parties." },
      { heading: 'Contact', body: 'copyright@papyri.app' },
    ],
  },
};

export default function LegalScreen({ route, navigation }) {
  const { type } = route.params || {};
  const doc = LEGAL_CONTENT[type] || LEGAL_CONTENT.cgu;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{doc.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {doc.sections.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
            {i < doc.sections.length - 1 && <Divider style={styles.divider} />}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Papyri Inc. — support@papyri.app</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f4f1',
  },
  header: {
    backgroundColor: '#1A1A2E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 6,
    marginTop: 16,
  },
  sectionBody: {
    fontSize: 13.5,
    color: '#374151',
    lineHeight: 22,
  },
  divider: {
    marginTop: 16,
    backgroundColor: '#e5e0d8',
  },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e0d8',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9c7e49',
  },
});
