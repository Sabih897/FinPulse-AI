import { Agent, setGlobalDispatcher } from 'undici';

// Prefer IPv4 when available and automatically fall back between address families.
// This prevents stalled HTTPS calls on networks with broken IPv6 routing while
// keeping fetch-based providers (Resend and Google GenAI) on the same fix.
setGlobalDispatcher(new Agent({
  connect: {
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 250
  }
}));
