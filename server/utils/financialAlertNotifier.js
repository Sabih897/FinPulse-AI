import nodemailer from 'nodemailer';

export async function sendFinancialAlert({ user, title, message }) {
  const results = { email: 'not_configured', sms: 'not_configured' };

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && user?.email) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: process.env.ALERT_FROM_EMAIL || process.env.SMTP_USER,
        to: user.email,
        subject: `FinPulse AI alert: ${title}`,
        text: message
      });
      results.email = 'sent';
    } catch (error) {
      results.email = 'failed';
      console.error('Financial alert email failed:', error.message);
    }
  }

  const phone = user?.phoneNumber?.replace(/[ ()-]/g, '');
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER && phone) {
    try {
      const form = new URLSearchParams({
        To: phone,
        From: process.env.TWILIO_FROM_NUMBER,
        Body: `FinPulse AI warning: ${title}. ${message}`.slice(0, 1500)
      });
      const credentials = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      });
      if (!response.ok) throw new Error(`Twilio returned HTTP ${response.status}`);
      results.sms = 'sent';
    } catch (error) {
      results.sms = 'failed';
      console.error('Financial alert SMS failed:', error.message);
    }
  }

  return results;
}
