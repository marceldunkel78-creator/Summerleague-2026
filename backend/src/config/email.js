const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
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
