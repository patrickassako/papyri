/**
 * Email Service
 * Supports two providers: Brevo (default) and Amazon SES.
 * Switch with EMAIL_PROVIDER env var: 'brevo' | 'ses'
 */

const config = require('../config/env');

// ──── Internal transport ──────────────────────────────────────

/**
 * Send an email via the configured provider.
 * @param {object} opts
 * @param {string} opts.to - Recipient email
 * @param {string} opts.toName - Recipient name
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} opts.text
 * @param {{ content: Buffer, filename: string }|null} [opts.attachment]
 */
async function _sendEmail({ to, toName, subject, html, text, attachment = null }) {
  const provider = config.email.provider;
  if (provider === 'ses') {
    return _sendViaSES({ to, toName, subject, html, text, attachment });
  }
  return _sendViaBrevo({ to, toName, subject, html, text, attachment });
}

async function _sendViaBrevo({ to, toName, subject, html, text, attachment }) {
  if (!config.brevo?.apiKey) {
    console.warn('[email-skip] Brevo API key not configured');
    return;
  }

  const body = {
    sender: {
      name: config.email.senderName,
      email: config.email.senderEmail,
    },
    to: [{ email: to, name: toName }],
    subject,
    htmlContent: html,
    textContent: text,
  };

  if (attachment) {
    body.attachment = [{
      content: attachment.content.toString('base64'),
      name: attachment.filename,
    }];
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': config.brevo.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(`[brevo] Failed to send "${subject}" to ${to}:`, error);
  }
}

async function _sendViaSES({ to, toName, subject, html, text, attachment }) {
  if (!config.ses?.accessKeyId || !config.ses?.secretAccessKey) {
    console.warn('[email-skip] AWS SES credentials not configured');
    return;
  }

  const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
  const nodemailer = require('nodemailer');

  const ses = new SESClient({
    region: config.ses.region,
    credentials: {
      accessKeyId: config.ses.accessKeyId,
      secretAccessKey: config.ses.secretAccessKey,
    },
  });

  const transporter = nodemailer.createTransport({
    SES: { ses, aws: require('@aws-sdk/client-ses') },
  });

  const mailOptions = {
    from: `"${config.email.senderName}" <${config.email.senderEmail}>`,
    to: `"${toName}" <${to}>`,
    subject,
    html,
    text,
  };

  if (attachment) {
    mailOptions.attachments = [{
      filename: attachment.filename,
      content: attachment.content,
      contentType: 'application/pdf',
    }];
  }

  await transporter.sendMail(mailOptions);
}

// ──── Public API ──────────────────────────────────────────────

async function sendWelcomeEmail(email, full_name) {
  try {
    await _sendEmail({
      to: email,
      toName: full_name,
      subject: 'Bienvenue sur la Bibliothèque Numérique !',
      html: getWelcomeEmailTemplate(full_name),
      text: getWelcomeEmailTextContent(full_name),
    });
    console.log(`[email] Welcome sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

async function sendPasswordResetEmail(email, full_name, resetToken) {
  try {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
    await _sendEmail({
      to: email,
      toName: full_name,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <p>Bonjour ${full_name},</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :</p>
        <p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p>
        <p>Ce lien est valide pendant 1 heure.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      `,
      text: `Bonjour ${full_name},\n\nVous avez demandé à réinitialiser votre mot de passe.\n\nCliquez sur le lien ci-dessous :\n${resetUrl}\n\nCe lien est valide pendant 1 heure.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
    });
    console.log(`[email] Password reset sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
}

async function sendEmailVerificationCodeEmail(email, fullName, code) {
  try {
    await _sendEmail({
      to: email,
      toName: fullName || email,
      subject: 'Votre code de verification Papyri',
      html: getEmailLayout('Verification de connexion', `
        <h2 style="margin: 0 0 24px 0; color: #2E4057; font-size: 24px; font-weight: 600;">
          Verification de connexion
        </h2>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Bonjour ${fullName || email},
        </p>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Voici votre code de verification a 6 chiffres pour finaliser votre connexion a Papyri :
        </p>
        <div style="margin: 24px 0; padding: 20px; border-radius: 12px; background: #f9f6f2; text-align: center; border: 1px solid #eadfce;">
          <div style="font-size: 32px; letter-spacing: 8px; font-weight: 800; color: #B5651D;">
            ${code}
          </div>
        </div>
        <p style="margin: 0 0 12px 0; color: #4A4A4A; font-size: 14px; line-height: 1.6;">
          Ce code expire dans 10 minutes.
        </p>
        <p style="margin: 0; color: #9E9E9E; font-size: 13px; line-height: 1.5;">
          Si vous n'etes pas a l'origine de cette tentative, ignorez cet email.
        </p>
      `),
      text: `Bonjour ${fullName || email},\n\nVoici votre code de verification Papyri : ${code}\n\nCe code expire dans 10 minutes.\nSi vous n'etes pas a l'origine de cette tentative, ignorez cet email.`,
    });
    console.log(`[email] Verification code sent to ${email}`);
  } catch (error) {
    console.error('Error sending email verification code:', error);
    throw error;
  }
}

async function sendExpirationReminderEmail(email, fullName, daysLeft, renewUrl) {
  try {
    await _sendEmail({
      to: email,
      toName: fullName,
      subject: `Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
      html: getExpirationReminderTemplate(fullName, daysLeft, renewUrl),
      text: `Bonjour ${fullName},\n\nVotre abonnement à la Bibliothèque Numérique expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.\n\nRenouvelez maintenant : ${renewUrl}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Expiration reminder sent to ${email} (${daysLeft}j)`);
  } catch (error) {
    console.error('Error sending expiration reminder email:', error);
  }
}

async function sendSubscriptionExpiredEmail(email, fullName, renewUrl) {
  try {
    await _sendEmail({
      to: email,
      toName: fullName,
      subject: 'Votre abonnement a expiré',
      html: getSubscriptionExpiredTemplate(fullName, renewUrl),
      text: `Bonjour ${fullName},\n\nVotre abonnement à la Bibliothèque Numérique a expiré.\n\nRenouvelez dès maintenant : ${renewUrl}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Subscription expired sent to ${email}`);
  } catch (error) {
    console.error('Error sending subscription expired email:', error);
  }
}

async function sendPaymentConfirmationEmail(email, fullName, planName, amount, currency) {
  try {
    await _sendEmail({
      to: email,
      toName: fullName,
      subject: 'Confirmation de paiement - Bibliothèque Numérique',
      html: getPaymentConfirmationTemplate(fullName, planName, amount, currency),
      text: `Bonjour ${fullName},\n\nVotre paiement de ${amount} ${currency} pour l'abonnement ${planName} a bien été reçu.\n\nMerci de votre confiance !\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Payment confirmation sent to ${email}`);
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
}

async function sendSubscriptionConfirmationEmail(email, fullName, { planName, amount, currency, endDate }) {
  try {
    const formattedEnd = endDate
      ? new Date(endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

    await _sendEmail({
      to: email,
      toName: fullName,
      subject: `Abonnement ${planName} activé — Bienvenue chez Papyri !`,
      html: getSubscriptionConfirmationTemplate(fullName, { planName, amount, currency, formattedEnd }),
      text: `Bonjour ${fullName},\n\nVotre abonnement ${planName} est maintenant actif.\nMontant : ${amount} ${currency}${formattedEnd ? `\nValide jusqu'au : ${formattedEnd}` : ''}\n\nBonne lecture !\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Subscription confirmation sent to ${email}`);
  } catch (error) {
    console.error('Error sending subscription confirmation email:', error);
  }
}

async function sendInvoiceEmail(email, fullName, { invoiceNumber, pdfBuffer }) {
  try {
    await _sendEmail({
      to: email,
      toName: fullName,
      subject: `Votre facture Papyri — ${invoiceNumber}`,
      html: getInvoiceEmailTemplate(fullName, invoiceNumber),
      text: `Bonjour ${fullName},\n\nVeuillez trouver ci-joint votre facture ${invoiceNumber}.\n\nMerci de votre confiance !\n\n© ${new Date().getFullYear()} Papyri.`,
      attachment: { content: pdfBuffer, filename: `facture-${invoiceNumber}.pdf` },
    });
    console.log(`[email] Invoice sent to ${email} (${invoiceNumber})`);
  } catch (error) {
    console.error('Error sending invoice email:', error);
  }
}

async function sendPublisherContentApprovedEmail(email, fullName, { bookTitle, catalogUrl }) {
  try {
    await _sendEmail({
      to: email,
      toName: fullName,
      subject: `Votre livre "${bookTitle}" est maintenant publié !`,
      html: getEmailLayout('Contenu approuvé', `
        <h2 style="margin: 0 0 16px 0; color: #2E7D32; font-size: 22px; font-weight: 700;">
          Contenu approuvé et publié !
        </h2>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Bonjour ${fullName},
        </p>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Bonne nouvelle ! Votre livre <strong>"${bookTitle}"</strong> a été validé par notre équipe et est maintenant accessible à tous les abonnés de Papyri.
        </p>
        <div style="background: #E8F5E9; border-left: 4px solid #2E7D32; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0; color: #1B5E20; font-size: 14px; font-weight: 600;">
            Votre œuvre rejoint notre bibliothèque numérique.
          </p>
        </div>
        ${getCtaButton('Voir dans le catalogue', catalogUrl)}
        <p style="margin: 16px 0 0 0; color: #9E9E9E; font-size: 13px;">
          Suivez les statistiques de lecture depuis votre espace éditeur.
        </p>
      `),
      text: `Bonjour ${fullName},\n\nVotre livre "${bookTitle}" a été approuvé et publié sur Papyri.\n\nVoir dans le catalogue : ${catalogUrl}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Content approved sent to ${email} for "${bookTitle}"`);
  } catch (error) {
    console.error('Error sending content approved email:', error);
  }
}

async function sendPublisherContentRejectedEmail(email, fullName, { bookTitle, reason, dashboardUrl }) {
  try {
    await _sendEmail({
      to: email,
      toName: fullName,
      subject: `Retour sur votre soumission — "${bookTitle}"`,
      html: getEmailLayout('Retour sur votre soumission', `
        <h2 style="margin: 0 0 16px 0; color: #B5651D; font-size: 22px; font-weight: 700;">
          Retour sur votre soumission
        </h2>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Bonjour ${fullName},
        </p>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Après examen, notre équipe éditoriale ne peut pas publier <strong>"${bookTitle}"</strong> en l'état.
        </p>
        ${reason ? `
        <div style="background: #FFF3E0; border-left: 4px solid #B5651D; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0 0 6px 0; color: #E65100; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Motif</p>
          <p style="margin: 0; color: #4A4A4A; font-size: 14px; line-height: 1.6;">${reason}</p>
        </div>` : ''}
        <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
          Vous pouvez modifier votre soumission et la soumettre à nouveau depuis votre tableau de bord.
        </p>
        ${getCtaButton('Accéder à mon tableau de bord', dashboardUrl)}
        <p style="margin: 16px 0 0 0; color: #9E9E9E; font-size: 13px;">
          Pour toute question : <a href="mailto:${config.email.senderEmail}" style="color: #B5651D; text-decoration: none;">${config.email.senderEmail}</a>
        </p>
      `),
      text: `Bonjour ${fullName},\n\nVotre livre "${bookTitle}" n'a pas pu être publié.${reason ? `\n\nMotif : ${reason}` : ''}\n\nModifiez votre soumission : ${dashboardUrl}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Content rejected sent to ${email} for "${bookTitle}"`);
  } catch (error) {
    console.error('Error sending content rejected email:', error);
  }
}

async function sendPaymentFailedEmail(email, fullName, { planName, retryUrl }) {
  try {
    await _sendEmail({
      to: email,
      toName: fullName,
      subject: 'Échec du renouvellement de votre abonnement',
      html: getEmailLayout('Échec de paiement', `
        <h2 style="margin: 0 0 16px 0; color: #C62828; font-size: 22px; font-weight: 700;">
          Renouvellement non effectué
        </h2>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Bonjour ${fullName},
        </p>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Nous n'avons pas pu renouveler votre abonnement <strong>${planName}</strong>. Votre accès à la bibliothèque pourrait être interrompu.
        </p>
        <div style="background: #FFEBEE; border-left: 4px solid #C62828; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0; color: #B71C1C; font-size: 14px; line-height: 1.5;">
            Vérifiez vos informations de paiement et réessayez pour ne pas perdre l'accès à votre bibliothèque.
          </p>
        </div>
        ${getCtaButton('Mettre à jour mon paiement', retryUrl)}
        <p style="margin: 16px 0 0 0; color: #9E9E9E; font-size: 13px;">
          Besoin d'aide ? <a href="mailto:${config.email.senderEmail}" style="color: #B5651D; text-decoration: none;">${config.email.senderEmail}</a>
        </p>
      `),
      text: `Bonjour ${fullName},\n\nLe renouvellement de votre abonnement ${planName} a échoué.\n\nMettez à jour votre paiement : ${retryUrl}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Payment failed sent to ${email}`);
  } catch (error) {
    console.error('Error sending payment failed email:', error);
  }
}

async function sendClaimReplyEmail(email, fullName, { subject, reply, status, dashboardUrl }) {
  try {
    const statusLabel = status === 'resolved' ? 'Résolue' : status === 'in_progress' ? 'En cours' : 'En attente';
    const statusColor = status === 'resolved' ? '#2E7D32' : status === 'in_progress' ? '#B5651D' : '#757575';
    await _sendEmail({
      to: email,
      toName: fullName,
      subject: `Réponse à votre réclamation — "${subject}"`,
      html: getEmailLayout('Réponse à votre réclamation', `
        <h2 style="margin: 0 0 16px 0; color: #2E4057; font-size: 22px; font-weight: 700;">
          Réponse à votre réclamation
        </h2>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Bonjour ${fullName},
        </p>
        <p style="margin: 0 0 8px 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
          L'équipe Papyri a répondu à votre réclamation : <strong>"${subject}"</strong>
        </p>
        <div style="display: inline-block; background: ${statusColor}22; border: 1px solid ${statusColor}; border-radius: 12px; padding: 3px 12px; margin-bottom: 20px;">
          <span style="color: ${statusColor}; font-size: 12px; font-weight: 700;">${statusLabel}</span>
        </div>
        <div style="background: #f9f6f2; border-left: 4px solid #B5651D; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0 0 6px 0; color: #B5651D; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Réponse de l'équipe</p>
          <p style="margin: 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">${reply}</p>
        </div>
        ${getCtaButton('Voir dans mon tableau de bord', dashboardUrl)}
        <p style="margin: 16px 0 0 0; color: #9E9E9E; font-size: 13px;">
          Pour toute question complémentaire, créez une nouvelle réclamation depuis votre espace éditeur.
        </p>
      `),
      text: `Bonjour ${fullName},\n\nRéponse à votre réclamation "${subject}" :\n\n${reply}\n\nStatut : ${statusLabel}\n\nTableau de bord : ${dashboardUrl}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Claim reply sent to ${email} for "${subject}"`);
  } catch (error) {
    console.error('Error sending claim reply email:', error);
  }
}

async function sendPublisherWelcomeEmail(email, fullName, { companyName, dashboardUrl }) {
  try {
    await _sendEmail({
      to: email,
      toName: fullName,
      subject: `Bienvenue chez Papyri — Votre espace éditeur est prêt !`,
      html: getEmailLayout('Bienvenue éditeur', `
        <h2 style="margin: 0 0 16px 0; color: #2E4057; font-size: 22px; font-weight: 700;">
          Votre espace éditeur est activé !
        </h2>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Bonjour ${fullName},
        </p>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Bienvenue sur Papyri ! Votre espace éditeur pour <strong>${companyName}</strong> est maintenant actif. Vous pouvez dès à présent publier vos livres et livres audio.
        </p>
        <div style="background: #E8F5E9; border-left: 4px solid #2E7D32; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0; color: #1B5E20; font-size: 14px; line-height: 1.5;">
            Depuis votre tableau de bord vous pouvez soumettre des œuvres, suivre vos statistiques de lecture et consulter vos revenus.
          </p>
        </div>
        ${getCtaButton('Accéder à mon espace éditeur', dashboardUrl)}
        <p style="margin: 16px 0 0 0; color: #9E9E9E; font-size: 13px;">
          Une question ? Contactez-nous : <a href="mailto:${config.email.senderEmail}" style="color: #B5651D; text-decoration: none;">${config.email.senderEmail}</a>
        </p>
      `),
      text: `Bonjour ${fullName},\n\nVotre espace éditeur Papyri pour ${companyName} est maintenant actif.\n\nAccédez à votre tableau de bord : ${dashboardUrl}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Publisher welcome sent to ${email} (${companyName})`);
  } catch (error) {
    console.error('Error sending publisher welcome email:', error);
  }
}

async function sendPayoutNotificationEmail(email, fullName, { amountCad, scheduledFor, payoutMethod }) {
  try {
    const formattedDate = new Date(scheduledFor).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const methodLabel = payoutMethod === 'bank_transfer' ? 'Virement bancaire'
      : payoutMethod === 'mobile_money' ? 'Mobile Money'
      : payoutMethod || 'Virement';

    await _sendEmail({
      to: email,
      toName: fullName,
      subject: `Versement de ${Number(amountCad).toFixed(2)} CAD en cours de traitement`,
      html: getEmailLayout('Versement éditeur', `
        <h2 style="margin: 0 0 16px 0; color: #2E4057; font-size: 22px; font-weight: 700;">
          Votre versement est en cours
        </h2>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Bonjour ${fullName},
        </p>
        <p style="margin: 0 0 20px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Votre versement est en cours de traitement. Voici le récapitulatif :
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">
          <tr style="background-color: #B5651D;">
            <td colspan="2" style="padding: 14px 18px;">
              <span style="color: #fff; font-size: 15px; font-weight: 700;">Détail du versement</span>
            </td>
          </tr>
          <tr style="background-color: #F9F9F9;">
            <td style="padding: 12px 18px; color: #757575; font-size: 14px;">Montant</td>
            <td style="padding: 12px 18px; color: #2E4057; font-size: 14px; font-weight: 700; text-align: right;">${Number(amountCad).toFixed(2)} CAD</td>
          </tr>
          <tr>
            <td style="padding: 12px 18px; color: #757575; font-size: 14px;">Date prévue</td>
            <td style="padding: 12px 18px; color: #2E4057; font-size: 14px; font-weight: 700; text-align: right;">${formattedDate}</td>
          </tr>
          <tr style="background-color: #F9F9F9;">
            <td style="padding: 12px 18px; color: #757575; font-size: 14px;">Méthode</td>
            <td style="padding: 12px 18px; color: #2E4057; font-size: 14px; font-weight: 700; text-align: right;">${methodLabel}</td>
          </tr>
        </table>
        <div style="background: #f9f6f2; border-left: 4px solid #D4A017; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0; color: #4A4A4A; font-size: 13px; line-height: 1.5;">
            Les délais de réception dépendent de votre méthode de paiement. En cas de question, contactez notre équipe.
          </p>
        </div>
        <p style="margin: 0; color: #9E9E9E; font-size: 13px;">
          <a href="mailto:${config.email.senderEmail}" style="color: #B5651D; text-decoration: none;">${config.email.senderEmail}</a>
        </p>
      `),
      text: `Bonjour ${fullName},\n\nVotre versement de ${Number(amountCad).toFixed(2)} CAD est en cours de traitement.\n\nDate prévue : ${formattedDate}\nMéthode : ${methodLabel}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Payout notification sent to ${email} (${amountCad} CAD)`);
  } catch (error) {
    console.error('Error sending payout notification email:', error);
  }
}

async function sendRenewalReminderEmail(email, fullName, { planName, renewUrl, expiryDate }) {
  try {
    const formattedExpiry = new Date(expiryDate).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    await _sendEmail({
      to: email,
      toName: fullName,
      subject: `Renouvelez votre abonnement ${planName} avant le ${formattedExpiry}`,
      html: getRenewalReminderTemplate(fullName, planName, formattedExpiry, renewUrl),
      text: `Bonjour ${fullName},\n\nVotre abonnement ${planName} expire le ${formattedExpiry}.\n\nRenouvelez ici : ${renewUrl}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
    console.log(`[email] Renewal reminder sent to ${email} (expiry: ${formattedExpiry})`);
  } catch (error) {
    console.error('Error sending renewal reminder email:', error);
  }
}

// ──── HTML Templates ──────────────────────────────────────────

function getEmailLayout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F5F5F5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F5F5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #B5651D; padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-family: 'Playfair Display', Georgia, serif; font-size: 32px; font-weight: 600;">
                Papyri
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color: #F5F5F5; padding: 24px 30px; text-align: center;">
              <p style="margin: 0; color: #9E9E9E; font-size: 12px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} Papyri. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function getCtaButton(text, url) {
  return `<table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 24px 0;">
        <a href="${url}" style="display: inline-block; background-color: #B5651D; color: #FFFFFF; text-decoration: none; padding: 16px 32px; border-radius: 24px; font-size: 16px; font-weight: 600;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

function getWelcomeEmailTemplate(full_name) {
  const subscriptionUrl = `${config.frontendUrl}/subscription`;
  const hasPublicUrl = config.frontendUrl && !config.frontendUrl.includes('localhost') && !config.frontendUrl.includes('127.0.0.1');
  return getEmailLayout('Bienvenue', `
    <h2 style="margin: 0 0 24px 0; color: #2E4057; font-size: 24px; font-weight: 600;">
      Bienvenue ${full_name} !
    </h2>
    <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Nous sommes ravis de vous accueillir sur Papyri, votre bibliothèque numérique. Vous avez désormais accès à des milliers de livres et livres audio en français.
    </p>
    <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Pour profiter pleinement de notre catalogue, pensez à souscrire un abonnement.
    </p>
    ${hasPublicUrl ? getCtaButton('Choisir mon abonnement', subscriptionUrl) : ''}
    <p style="margin: 24px 0 0 0; color: #757575; font-size: 14px; line-height: 1.6;">
      Vous avez des questions ? Contactez-nous à <a href="mailto:${config.email.senderEmail}" style="color: #B5651D; text-decoration: none;">${config.email.senderEmail}</a>
    </p>
  `);
}

function getWelcomeEmailTextContent(full_name) {
  return `Bienvenue ${full_name} !\n\nNous sommes ravis de vous accueillir dans notre bibliothèque numérique.\n\nAbonnez-vous sur : ${config.frontendUrl}/subscription\n\nQuestions ? ${config.email.senderEmail}\n\n© ${new Date().getFullYear()} Papyri.`;
}

function getExpirationReminderTemplate(fullName, daysLeft, renewUrl) {
  return getEmailLayout('Rappel d\'expiration', `
    <h2 style="margin: 0 0 24px 0; color: #2E4057; font-size: 24px; font-weight: 600;">
      Votre abonnement expire bientôt
    </h2>
    <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Bonjour ${fullName},
    </p>
    <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Votre abonnement à la Bibliothèque Numérique expire dans <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>.
    </p>
    <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Renouvelez maintenant pour continuer à accéder à tous vos livres et livres audio sans interruption.
    </p>
    ${getCtaButton('Renouveler mon abonnement', renewUrl)}
    <p style="margin: 24px 0 0 0; color: #757575; font-size: 14px; line-height: 1.6;">
      Si vous ne renouvelez pas, vous perdrez l'accès à votre bibliothèque à l'expiration.
    </p>
  `);
}

function getSubscriptionExpiredTemplate(fullName, renewUrl) {
  return getEmailLayout('Abonnement expiré', `
    <h2 style="margin: 0 0 24px 0; color: #2E4057; font-size: 24px; font-weight: 600;">
      Votre abonnement a expiré
    </h2>
    <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Bonjour ${fullName},
    </p>
    <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Votre abonnement à la Bibliothèque Numérique a expiré. Vous n'avez plus accès aux contenus réservés aux abonnés.
    </p>
    <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Renouvelez dès maintenant pour retrouver l'accès à tous vos livres et livres audio.
    </p>
    ${getCtaButton('Renouveler mon abonnement', renewUrl)}
    <p style="margin: 24px 0 0 0; color: #757575; font-size: 14px; line-height: 1.6;">
      Vos favoris et votre historique de lecture sont conservés et vous attendent.
    </p>
  `);
}

function getPaymentConfirmationTemplate(fullName, planName, amount, currency) {
  return getEmailLayout('Confirmation de paiement', `
    <h2 style="margin: 0 0 24px 0; color: #2E4057; font-size: 24px; font-weight: 600;">
      Paiement confirmé !
    </h2>
    <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Bonjour ${fullName},
    </p>
    <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Votre paiement a bien été reçu. Voici le récapitulatif :
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">
      <tr style="background-color: #F9F9F9;">
        <td style="padding: 12px 16px; color: #757575; font-size: 14px;">Abonnement</td>
        <td style="padding: 12px 16px; color: #2E4057; font-size: 14px; font-weight: 600; text-align: right;">${planName}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #757575; font-size: 14px;">Montant</td>
        <td style="padding: 12px 16px; color: #2E4057; font-size: 14px; font-weight: 600; text-align: right;">${amount} ${currency}</td>
      </tr>
      <tr style="background-color: #F9F9F9;">
        <td style="padding: 12px 16px; color: #757575; font-size: 14px;">Date</td>
        <td style="padding: 12px 16px; color: #2E4057; font-size: 14px; font-weight: 600; text-align: right;">${new Date().toLocaleDateString('fr-FR')}</td>
      </tr>
    </table>
    <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Merci de votre confiance ! Profitez pleinement de votre bibliothèque.
    </p>
    ${getCtaButton('Accéder à ma bibliothèque', `${config.frontendUrl}/catalogue`)}
  `);
}

function getSubscriptionConfirmationTemplate(fullName, { planName, amount, currency, formattedEnd }) {
  return getEmailLayout('Abonnement activé', `
    <h2 style="margin: 0 0 8px 0; color: #2E4057; font-size: 24px; font-weight: 700;">
      Votre abonnement est actif !
    </h2>
    <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Bonjour ${fullName}, votre accès à la bibliothèque Papyri est maintenant ouvert.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px 0; border: 1px solid #E0E0E0; border-radius: 10px; overflow: hidden;">
      <tr style="background-color: #B5651D;">
        <td colspan="2" style="padding: 14px 18px;">
          <span style="color: #fff; font-size: 15px; font-weight: 700;">${planName}</span>
        </td>
      </tr>
      <tr style="background-color: #F9F9F9;">
        <td style="padding: 12px 18px; color: #757575; font-size: 14px;">Montant</td>
        <td style="padding: 12px 18px; color: #2E4057; font-size: 14px; font-weight: 700; text-align: right;">${amount} ${currency}</td>
      </tr>
      <tr>
        <td style="padding: 12px 18px; color: #757575; font-size: 14px;">Date d'activation</td>
        <td style="padding: 12px 18px; color: #2E4057; font-size: 14px; font-weight: 700; text-align: right;">${new Date().toLocaleDateString('fr-FR')}</td>
      </tr>
      ${formattedEnd ? `
      <tr style="background-color: #F9F9F9;">
        <td style="padding: 12px 18px; color: #757575; font-size: 14px;">Valide jusqu'au</td>
        <td style="padding: 12px 18px; color: #2E4057; font-size: 14px; font-weight: 700; text-align: right;">${formattedEnd}</td>
      </tr>` : ''}
    </table>
    <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
      Vous avez maintenant accès à toute la bibliothèque — ebooks, livres audio, et bien plus.
    </p>
    ${getCtaButton('Accéder à ma bibliothèque', `${config.frontendUrl}/catalogue`)}
    <p style="margin: 16px 0 0 0; color: #9E9E9E; font-size: 13px; line-height: 1.5;">
      Une facture vous sera envoyée séparément. Pour toute question :
      <a href="mailto:${config.email.senderEmail}" style="color: #B5651D; text-decoration: none;">
        ${config.email.senderEmail}
      </a>
    </p>
  `);
}

function getInvoiceEmailTemplate(fullName, invoiceNumber) {
  return getEmailLayout(`Facture ${invoiceNumber}`, `
    <h2 style="margin: 0 0 16px 0; color: #2E4057; font-size: 22px; font-weight: 700;">
      Votre facture est disponible
    </h2>
    <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
      Bonjour ${fullName},
    </p>
    <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 15px; line-height: 1.6;">
      Vous trouverez ci-joint la facture <strong>${invoiceNumber}</strong> correspondant à votre abonnement Papyri.
    </p>
    <div style="background: #f9f6f2; border-left: 4px solid #B5651D; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #4A4A4A; font-size: 14px; line-height: 1.5;">
        Pièce jointe : <strong>facture-${invoiceNumber}.pdf</strong>
      </p>
    </div>
    <p style="margin: 0; color: #9E9E9E; font-size: 13px; line-height: 1.5;">
      Conservez cette facture pour vos archives. Pour toute question :
      <a href="mailto:${config.email.senderEmail}" style="color: #B5651D; text-decoration: none;">
        ${config.email.senderEmail}
      </a>
    </p>
  `);
}

function getRenewalReminderTemplate(fullName, planName, formattedExpiry, renewUrl) {
  return getEmailLayout('Renouvellement de votre abonnement', `
    <h2 style="margin: 0 0 24px 0; color: #2E4057; font-size: 24px; font-weight: 600;">
      Renouvelez votre abonnement
    </h2>
    <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Bonjour ${fullName},
    </p>
    <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Votre abonnement <strong>${planName}</strong> arrive à expiration le <strong>${formattedExpiry}</strong> (dans 7 jours).
    </p>
    <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
      Pour continuer à accéder à tous vos livres et livres audio sans interruption, renouvelez dès maintenant en un clic.
    </p>
    ${getCtaButton('Renouveler mon abonnement', renewUrl)}
    <div style="background: #f9f6f2; border-left: 4px solid #D4A017; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-top: 24px;">
      <p style="margin: 0; color: #4A4A4A; font-size: 14px; line-height: 1.5;">
        Vos favoris, annotations et historique de lecture sont conservés.
      </p>
    </div>
  `);
}

async function sendAdminBroadcastEmail(email, fullName, { title, body, ctaLabel, ctaUrl }) {
  try {
    await _sendEmail({
      to: email,
      toName: fullName,
      subject: title,
      html: getEmailLayout(title, `
        <h2 style="margin: 0 0 16px 0; color: #2E4057; font-size: 22px; font-weight: 700;">
          ${title}
        </h2>
        <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          Bonjour ${fullName},
        </p>
        <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
          ${body.replace(/\n/g, '<br>')}
        </p>
        ${ctaUrl && ctaLabel ? getCtaButton(ctaLabel, ctaUrl) : ''}
        <p style="margin: 16px 0 0 0; color: #9E9E9E; font-size: 13px;">
          Vous recevez cet email car vous êtes membre de Papyri.
        </p>
      `),
      text: `Bonjour ${fullName},\n\n${body}${ctaUrl ? `\n\n${ctaLabel || 'En savoir plus'} : ${ctaUrl}` : ''}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
  } catch (error) {
    console.error('Error sending admin broadcast email:', error);
  }
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmailVerificationCodeEmail,
  sendExpirationReminderEmail,
  sendSubscriptionExpiredEmail,
  sendPaymentConfirmationEmail,
  sendSubscriptionConfirmationEmail,
  sendInvoiceEmail,
  sendRenewalReminderEmail,
  sendPublisherContentApprovedEmail,
  sendPublisherContentRejectedEmail,
  sendPaymentFailedEmail,
  sendClaimReplyEmail,
  sendPublisherWelcomeEmail,
  sendPayoutNotificationEmail,
  sendAdminBroadcastEmail,
};
