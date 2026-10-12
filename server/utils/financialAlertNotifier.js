export async function sendFinancialAlert({ user, title, message }) {
  const results = { email: 'not_configured', sms: 'not_configured' };

  // Email delivery uses Resend's HTTPS API, avoiding a separate SMTP dependency.
  if (process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL && user?.email) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.ALERT_FROM_EMAIL,
          to: [user.email],
          subject: `FinPulse AI alert: ${title}`,
          text: message
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Resend HTTP ${response.status}: ${payload.message || payload.name || JSON.stringify(payload)}`);
      results.email = 'sent';
      console.info('Financial alert email accepted by Resend:', payload.id || 'message id unavailable');
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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Twilio HTTP ${response.status}: ${payload.message || payload.code || JSON.stringify(payload)}`);
      results.sms = 'sent';
      console.info('Financial alert SMS accepted by Twilio:', payload.sid || 'message id unavailable', payload.status || '');
    } catch (error) {
      results.sms = 'failed';
      console.error('Financial alert SMS failed:', error.message);
    }
  }

  if (results.email === 'not_configured') console.warn('Financial alert email skipped: set RESEND_API_KEY and ALERT_FROM_EMAIL, and ensure the user has an email address.');
  if (results.sms === 'not_configured') console.warn('Financial alert SMS skipped: set all TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER and save a user phone number.');
  return results;
}
