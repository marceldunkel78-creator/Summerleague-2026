const nodemailer = require('nodemailer');

const port = parseInt(process.env.SMTP_PORT) || 465;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.strato.de',
  port: port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verbindung testen
transporter.verify()
  .then(() => console.log('E-Mail-Server verbunden.'))
  .catch(err => console.error('E-Mail-Fehler:', err.message));

module.exports = transporter;
