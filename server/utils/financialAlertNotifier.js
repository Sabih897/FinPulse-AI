import https from 'node:https';

function postJson({ hostname, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname,
      path,
      method: 'POST',
      family: 4,
      timeout: 15000,
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        let payload = {};
        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch {
          payload = { message: raw || 'Provider returned an empty response.' };
        }
        resolve({ status: response.statusCode || 0, ok: (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300, payload });
      });
    });

    request.on('timeout', () => request.destroy(new Error('Request timed out after 15 seconds.')));
    request.on('error', reject);
    request.end(body);
  });
}

export async function sendFinancialAlert({ user, title, message }) {
  const results = { email: 'not_configured', sms: 'not_configured' };

  // Use Node's native HTTPS client with family: 4. This avoids the IPv6
  // connect timeout seen on networks where IPv4 works but IPv6 routing does not.
  if (process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL && user?.email) {
    try {
      const body = JSON.stringify({
        from: process.env.ALERT_FROM_EMAIL,
        to: [user.email],
        subject: `FinPulse AI alert: ${title}`,
        text: message
      });
      const response = await postJson({
        hostname: 'api.resend.com',
        path: '/emails',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body
      });
      if (!response.ok) {
        const payload = response.payload;
        throw new Error(`Resend HTTP ${response.status}: ${payload.message || payload.name || JSON.stringify(payload)}`);
      }
      results.email = 'sent';
      console.info('Financial alert email accepted by Resend:', response.payload.id || 'message id unavailable');
    } catch (error) {
      results.email = 'failed';
      console.error('Financial alert email failed:', error.message);
    }
  }

  const phone = user?.phoneNumber?.replace(/[ ()-]/g, '');
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER && phone) {
    try {
      const body = new URLSearchParams({
        To: phone,
        From: process.env.TWILIO_FROM_NUMBER,
        Body: `FinPulse AI warning: ${title}. ${message}`.slice(0, 1500)
      }).toString();
      const credentials = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const response = await postJson({
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });
      if (!response.ok) {
        const payload = response.payload;
        throw new Error(`Twilio HTTP ${response.status}: ${payload.message || payload.code || JSON.stringify(payload)}`);
      }
      results.sms = 'sent';
      console.info('Financial alert SMS accepted by Twilio:', response.payload.sid || 'message id unavailable', response.payload.status || '');
    } catch (error) {
      results.sms = 'failed';
      console.error('Financial alert SMS failed:', error.message);
    }
  }

  if (results.email === 'not_configured') console.warn('Financial alert email skipped: set RESEND_API_KEY and ALERT_FROM_EMAIL, and ensure the user has an email address.');
  if (results.sms === 'not_configured') console.warn('Financial alert SMS skipped: set all TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER and save a user phone number.');
  return results;
}
