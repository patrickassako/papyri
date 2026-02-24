/**
 * Email Service
 * Handles email sending via Brevo (formerly Sendinblue)
 */

const config = require('../config/env');

/**
 * Send welcome email to new user
 * @param {string} email - User email
 * @param {string} full_name - User full name
 * @returns {Promise<void>}
 */
async function sendWelcomeEmail(email, full_name) {
  try {
    // Check if Brevo API key is configured
    if (!config.brevo || !config.brevo.apiKey) {
      console.warn('Brevo API key not configured, skipping welcome email');
      return;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': config.brevo.apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: config.brevo.senderName || 'Bibliothèque Numérique',
          email: config.brevo.senderEmail || 'noreply@bibliotheque.com',
        },
        to: [
          {
            email: email,
            name: full_name,
          },
        ],
        subject: 'Bienvenue sur la Bibliothèque Numérique !',
        htmlContent: getWelcomeEmailTemplate(full_name),
        textContent: getWelcomeEmailTextContent(full_name),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send welcome email:', error);
      // Don't throw - email failure shouldn't block registration
      return;
    }

    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw - email failure shouldn't block registration
  }
}

/**
 * Get HTML template for welcome email
 * @param {string} full_name - User full name
 * @returns {string} HTML content
 */
function getWelcomeEmailTemplate(full_name) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F5F5F5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F5F5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #B5651D; padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-family: 'Playfair Display', Georgia, serif; font-size: 32px; font-weight: 600;">
                Bibliothèque Numérique
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 24px 0; color: #2E4057; font-size: 24px; font-weight: 600;">
                Bienvenue ${full_name} !
              </h2>

              <p style="margin: 0 0 16px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Nous sommes ravis de vous accueillir dans notre bibliothèque numérique. Vous avez désormais accès à des milliers de livres et livres audio en français.
              </p>

              <p style="margin: 0 0 24px 0; color: #4A4A4A; font-size: 16px; line-height: 1.6;">
                Pour profiter pleinement de notre catalogue, pensez à souscrire un abonnement.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 24px 0;">
                    <a href="https://bibliotheque.com/subscription" style="display: inline-block; background-color: #B5651D; color: #FFFFFF; text-decoration: none; padding: 16px 32px; border-radius: 24px; font-size: 16px; font-weight: 600;">
                      Choisir mon abonnement
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; color: #757575; font-size: 14px; line-height: 1.6;">
                Vous avez des questions ? N'hésitez pas à nous contacter à <a href="mailto:support@bibliotheque.com" style="color: #B5651D; text-decoration: none;">support@bibliotheque.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F5F5F5; padding: 24px 30px; text-align: center;">
              <p style="margin: 0; color: #9E9E9E; font-size: 12px; line-height: 1.5;">
                © ${new Date().getFullYear()} Bibliothèque Numérique. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Get plain text content for welcome email (fallback)
 * @param {string} full_name - User full name
 * @returns {string} Text content
 */
function getWelcomeEmailTextContent(full_name) {
  return `
Bienvenue ${full_name} !

Nous sommes ravis de vous accueillir dans notre bibliothèque numérique. Vous avez désormais accès à des milliers de livres et livres audio en français.

Pour profiter pleinement de notre catalogue, pensez à souscrire un abonnement sur : https://bibliotheque.com/subscription

Vous avez des questions ? N'hésitez pas à nous contacter à support@bibliotheque.com

© ${new Date().getFullYear()} Bibliothèque Numérique. Tous droits réservés.
  `.trim();
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} full_name - User full name
 * @param {string} resetToken - Password reset token
 * @returns {Promise<void>}
 */
async function sendPasswordResetEmail(email, full_name, resetToken) {
  try {
    if (!config.brevo || !config.brevo.apiKey) {
      console.warn('Brevo API key not configured, skipping password reset email');
      return;
    }

    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': config.brevo.apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: config.brevo.senderName || 'Bibliothèque Numérique',
          email: config.brevo.senderEmail || 'noreply@bibliotheque.com',
        },
        to: [
          {
            email: email,
            name: full_name,
          },
        ],
        subject: 'Réinitialisation de votre mot de passe',
        htmlContent: `
          <p>Bonjour ${full_name},</p>
          <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
          <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :</p>
          <p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p>
          <p>Ce lien est valide pendant 1 heure.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        `,
        textContent: `
Bonjour ${full_name},

Vous avez demandé à réinitialiser votre mot de passe.

Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :
${resetUrl}

Ce lien est valide pendant 1 heure.

Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send password reset email:', error);
      return;
    }

    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
}

/**
 * Send expiration reminder email
 * @param {string} email - User email
 * @param {string} fullName - User full name
 * @param {number} daysLeft - Days until expiration
 * @param {string} renewUrl - URL to renew subscription
 */
async function sendExpirationReminderEmail(email, fullName, daysLeft, renewUrl) {
  try {
    if (!config.brevo || !config.brevo.apiKey) {
      console.log(`[email-skip] Expiration reminder for ${email} (${daysLeft}j restants)`);
      return;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': config.brevo.apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: config.brevo.senderName || 'Bibliothèque Numérique',
          email: config.brevo.senderEmail || 'noreply@bibliotheque.com',
        },
        to: [{ email, name: fullName }],
        subject: `Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
        htmlContent: getExpirationReminderTemplate(fullName, daysLeft, renewUrl),
        textContent: `Bonjour ${fullName},\n\nVotre abonnement à la Bibliothèque Numérique expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.\n\nRenouvelez maintenant pour continuer à profiter de votre bibliothèque : ${renewUrl}\n\n© ${new Date().getFullYear()} Bibliothèque Numérique.`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send expiration reminder email:', error);
      return;
    }

    console.log(`📧 Expiration reminder sent to ${email} (${daysLeft}j)`);
  } catch (error) {
    console.error('Error sending expiration reminder email:', error);
  }
}

/**
 * Send subscription expired email
 * @param {string} email - User email
 * @param {string} fullName - User full name
 * @param {string} renewUrl - URL to renew subscription
 */
async function sendSubscriptionExpiredEmail(email, fullName, renewUrl) {
  try {
    if (!config.brevo || !config.brevo.apiKey) {
      console.log(`[email-skip] Subscription expired for ${email}`);
      return;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': config.brevo.apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: config.brevo.senderName || 'Bibliothèque Numérique',
          email: config.brevo.senderEmail || 'noreply@bibliotheque.com',
        },
        to: [{ email, name: fullName }],
        subject: 'Votre abonnement a expiré',
        htmlContent: getSubscriptionExpiredTemplate(fullName, renewUrl),
        textContent: `Bonjour ${fullName},\n\nVotre abonnement à la Bibliothèque Numérique a expiré.\n\nRenouvelez dès maintenant pour retrouver l'accès à votre bibliothèque : ${renewUrl}\n\n© ${new Date().getFullYear()} Bibliothèque Numérique.`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send subscription expired email:', error);
      return;
    }

    console.log(`📧 Subscription expired email sent to ${email}`);
  } catch (error) {
    console.error('Error sending subscription expired email:', error);
  }
}

/**
 * Send payment confirmation email
 * @param {string} email - User email
 * @param {string} fullName - User full name
 * @param {string} planName - Subscription plan name
 * @param {number} amount - Payment amount
 * @param {string} currency - Payment currency
 */
async function sendPaymentConfirmationEmail(email, fullName, planName, amount, currency) {
  try {
    if (!config.brevo || !config.brevo.apiKey) {
      console.log(`[email-skip] Payment confirmation for ${email} (${amount} ${currency})`);
      return;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': config.brevo.apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: config.brevo.senderName || 'Bibliothèque Numérique',
          email: config.brevo.senderEmail || 'noreply@bibliotheque.com',
        },
        to: [{ email, name: fullName }],
        subject: 'Confirmation de paiement - Bibliothèque Numérique',
        htmlContent: getPaymentConfirmationTemplate(fullName, planName, amount, currency),
        textContent: `Bonjour ${fullName},\n\nVotre paiement de ${amount} ${currency} pour l'abonnement ${planName} a bien été reçu.\n\nMerci de votre confiance !\n\n© ${new Date().getFullYear()} Bibliothèque Numérique.`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send payment confirmation email:', error);
      return;
    }

    console.log(`📧 Payment confirmation sent to ${email}`);
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
}

// ──── HTML Templates ────

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
                Bibliothèque Numérique
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
                &copy; ${new Date().getFullYear()} Bibliothèque Numérique. Tous droits réservés.
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
    ${getCtaButton('Accéder à ma bibliothèque', '${config.frontendUrl || "https://bibliotheque.com"}')}
  `);
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendExpirationReminderEmail,
  sendSubscriptionExpiredEmail,
  sendPaymentConfirmationEmail,
};
