import rateLimit from 'express-rate-limit';

export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 20, // Max 20 requests per IP per 15 mins
  message: { error: 'AI limit reached. Please wait 15 minutes before scanning or chatting again.' },
  standardHeaders: true,
  legacyHeaders: false,
});