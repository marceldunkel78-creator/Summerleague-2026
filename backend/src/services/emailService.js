const transporter = require('../config/email');
const { db } = require('../config/database');

const FROM = process.env.SMTP_FROM || 'webmaster@tennis-summerleague.de';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.tennis-summerleague.de';

function logEmail(recipient, subject, type) {
  try {
    db.prepare('INSERT INTO email_log (recipient, subject, type) VALUES (?, ?, ?)').run(recipient, subject, type);
  } catch (e) {
    console.error('E-Mail-Log Fehler:', e.message);
  }
}

// Verifizierungs-Code senden
async function sendVerificationEmail(email, name, code) {
  const mailOptions = {
    from: `"Summerleague Tennis" <${FROM}>`,
    to: email,
    subject: 'E-Mail Verifizierung - Summerleague Tennis',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5530;">🎾 Summerleague Tennis</h2>
        <p>Hallo ${name},</p>
        <p>Vielen Dank für deine Registrierung! Bitte bestätige deine E-Mail-Adresse mit folgendem Code:</p>
        <div style="background: #f0f7f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2c5530;">${code}</span>
        </div>
        <p>Der Code ist <strong>15 Minuten</strong> gültig.</p>
        <p>Falls du dich nicht registriert hast, ignoriere diese E-Mail bitte.</p>
        <hr style="margin-top: 30px;">
        <p style="color: #888; font-size: 12px;">Summerleague Tennis Verwaltung</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  logEmail(email, mailOptions.subject, 'verification');
}

// Passwort-Reset-Link senden
async function sendPasswordResetEmail(email, name, resetToken) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  const mailOptions = {
    from: `"Summerleague Tennis" <${FROM}>`,
    to: email,
    subject: 'Passwort zurücksetzen - Summerleague Tennis',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5530;">🎾 Summerleague Tennis</h2>
        <p>Hallo ${name},</p>
        <p>Du hast ein neues Passwort angefordert. Klicke auf den folgenden Link:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${resetUrl}" style="background: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-size: 16px;">Passwort zurücksetzen</a>
        </div>
        <p>Der Link ist <strong>1 Stunde</strong> gültig.</p>
        <p>Falls du kein neues Passwort angefordert hast, ignoriere diese E-Mail.</p>
        <hr style="margin-top: 30px;">
        <p style="color: #888; font-size: 12px;">Summerleague Tennis Verwaltung</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  logEmail(email, mailOptions.subject, 'password_reset');
}

// Ergebnis-Bestätigung senden
async function sendResultConfirmationEmail(email, name, matchInfo, confirmToken) {
  const confirmUrl = `${FRONTEND_URL}/confirm-result?token=${confirmToken}`;
  const disputeUrl = `${FRONTEND_URL}/dispute-result?token=${confirmToken}`;
  
  const mailOptions = {
    from: `"Summerleague Tennis" <${FROM}>`,
    to: email,
    subject: `Ergebnis bestätigen - ${matchInfo.tournamentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5530;">🎾 Ergebnis bestätigen</h2>
        <p>Hallo ${name},</p>
        <p>Dein Gegner <strong>${matchInfo.reporterName}</strong> hat ein Ergebnis für euer Spiel eingetragen:</p>
        <div style="background: #f0f7f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Turnier:</strong> ${matchInfo.tournamentName}</p>
          <p><strong>Runde:</strong> ${matchInfo.round}</p>
          <p><strong>Ergebnis:</strong> ${matchInfo.score}</p>
          <p><strong>Gewinner:</strong> ${matchInfo.winnerName}</p>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${confirmUrl}" style="background: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 0 10px;">✅ Bestätigen</a>
          <a href="${disputeUrl}" style="background: #c0392b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 0 10px;">❌ Reklamieren</a>
        </div>
        <hr style="margin-top: 30px;">
        <p style="color: #888; font-size: 12px;">Summerleague Tennis Verwaltung</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  logEmail(email, mailOptions.subject, 'result_confirmation');
}

// Admin über Reklamation benachrichtigen
async function sendDisputeNotificationToAdmin(matchInfo, disputeReason) {
  const adminEmail = process.env.ADMIN_EMAIL || FROM;
  const mailOptions = {
    from: `"Summerleague Tennis" <${FROM}>`,
    to: adminEmail,
    subject: `⚠️ Ergebnis-Reklamation - ${matchInfo.tournamentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #c0392b;">⚠️ Ergebnis-Reklamation</h2>
        <div style="background: #fef0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Turnier:</strong> ${matchInfo.tournamentName}</p>
          <p><strong>Match:</strong> ${matchInfo.player1Name} vs ${matchInfo.player2Name}</p>
          <p><strong>Runde:</strong> ${matchInfo.round}</p>
          <p><strong>Eingetragenes Ergebnis:</strong> ${matchInfo.score}</p>
          <p><strong>Gemeldet von:</strong> ${matchInfo.reporterName}</p>
          <p><strong>Reklamiert von:</strong> ${matchInfo.disputerName}</p>
          <p><strong>Grund:</strong> ${disputeReason || 'Kein Grund angegeben'}</p>
        </div>
        <p>Bitte kläre den Sachverhalt im Admin-Bereich.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${FRONTEND_URL}/admin/matches/${matchInfo.matchId}" style="background: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">Zum Match</a>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  logEmail(adminEmail, mailOptions.subject, 'dispute_notification');
}

// Turnier-Anmeldung bestätigt
async function sendRegistrationApprovedEmail(email, name, tournamentName) {
  const mailOptions = {
    from: `"Summerleague Tennis" <${FROM}>`,
    to: email,
    subject: `Anmeldung bestätigt - ${tournamentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5530;">🎾 Anmeldung bestätigt!</h2>
        <p>Hallo ${name},</p>
        <p>Deine Anmeldung für <strong>${tournamentName}</strong> wurde bestätigt!</p>
        <p>Weitere Informationen findest du auf der Turnierseite.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${FRONTEND_URL}/tournaments" style="background: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">Zu den Turnieren</a>
        </div>
        <hr style="margin-top: 30px;">
        <p style="color: #888; font-size: 12px;">Summerleague Tennis Verwaltung</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  logEmail(email, mailOptions.subject, 'registration_approved');
}

// Admin über neue Turnieranmeldung benachrichtigen
async function sendRegistrationNotificationToAdmin(playerName, playerEmail, tournamentName, tournamentId) {
  const adminEmail = process.env.ADMIN_EMAIL || FROM;
  const approveUrl = `${FRONTEND_URL}/admin/tournaments/${tournamentId}`;
  const mailOptions = {
    from: `"Summerleague Tennis" <${FROM}>`,
    to: adminEmail,
    subject: `Neue Anmeldung - ${tournamentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5530;">📋 Neue Turnieranmeldung</h2>
        <div style="background: #f0f7f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Turnier:</strong> ${tournamentName}</p>
          <p><strong>Spieler:</strong> ${playerName}</p>
          <p><strong>E-Mail:</strong> ${playerEmail}</p>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${approveUrl}" style="background: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">Anmeldung prüfen & genehmigen</a>
        </div>
        <hr style="margin-top: 30px;">
        <p style="color: #888; font-size: 12px;">Summerleague Tennis Verwaltung</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  logEmail(adminEmail, mailOptions.subject, 'registration_notification');
}

// Herausforderung senden
async function sendChallengeEmail(email, name, challengeInfo) {
  const tournamentUrl = `${FRONTEND_URL}/tournaments/${challengeInfo.tournamentId}`;
  const mailOptions = {
    from: `"Summerleague Tennis" <${FROM}>`,
    to: email,
    subject: `Herausforderung - ${challengeInfo.tournamentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5530;">🎾 Herausforderung!</h2>
        <p>Hallo ${name},</p>
        <p><strong>${challengeInfo.challengerName}</strong> fordert dich zu einem Ligaspiel heraus!</p>
        <div style="background: #f0f7f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Turnier:</strong> ${challengeInfo.tournamentName}</p>
          <p><strong>Vorgeschlagener Ort:</strong> ${challengeInfo.location}</p>
          <p><strong>Vorgeschlagene Zeit:</strong> ${challengeInfo.proposedDate} um ${challengeInfo.proposedTime} Uhr</p>
          ${challengeInfo.message ? `<p><strong>Nachricht:</strong> ${challengeInfo.message}</p>` : ''}
        </div>
        <p><strong>Kontaktmöglichkeiten von ${challengeInfo.challengerName}:</strong></p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 10px 0;">
          ${challengeInfo.challengerPhone ? `<p>📞 Telefon: <a href="tel:${challengeInfo.challengerPhone}">${challengeInfo.challengerPhone}</a></p>` : ''}
          <p>✉️ E-Mail: <a href="mailto:${challengeInfo.challengerEmail}">${challengeInfo.challengerEmail}</a></p>
        </div>
        <p>Bitte nimm Kontakt auf, um einen Termin zu vereinbaren.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${tournamentUrl}" style="background: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">Zum Turnier</a>
        </div>
        <hr style="margin-top: 30px;">
        <p style="color: #888; font-size: 12px;">Summerleague Tennis Verwaltung</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  logEmail(email, mailOptions.subject, 'challenge');
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendResultConfirmationEmail,
  sendDisputeNotificationToAdmin,
  sendRegistrationApprovedEmail,
  sendRegistrationNotificationToAdmin,
  sendChallengeEmail
};
