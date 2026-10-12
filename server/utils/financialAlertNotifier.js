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
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_FROM_EMAIL || !user?.email) {
    console.warn('Financial alert email skipped: set RESEND_API_KEY and ALERT_FROM_EMAIL, and ensure the user has an email address.');
    return { email: 'not_configured' };
  }

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
    console.info('Financial alert email accepted by Resend:', response.payload.id || 'message id unavailable');
    return { email: 'sent' };
  } catch (error) {
    console.error('Financial alert email failed:', error.message);
    return { email: 'failed' };
  }
}
