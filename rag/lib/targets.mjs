// The one target check for everything that sends traffic to an application: the Playwright config loader and
// the egress-guard fixture, the self-healer's --live mode and the verify-scope hook all call checkTarget().
//   required  the host is listed in qa.config.json environments[].hosts, or is a subdomain of a listed host.
//             There is no default: with no environments configured, every host is refused (fail closed).
//   refused   production-like names (prod, production, live as a label, or a leading www.), whatever the list says
//   refused   productionHosts and their subdomains (an optional, owner-maintained denylist on top of the allowlist)
//   refused   raw IP addresses unless that exact address is listed. Loopback is not special: list "localhost"
//             in an environment when a local dev server is a target.
const norm = (h) => String(h ?? '').trim().toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
const under = (host, base) => host === base || host.endsWith('.' + base);
const isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');
export const PRODUCTION_LIKE = /(^|[.-])(prod|production|live)([.-]|$)|^www\./i;

/** Every allowlisted host from a qa.config.json object (or an object that already carries allowedHosts). */
export function allowedHostsOf(qa = {}) {
  if (Array.isArray(qa.allowedHosts)) return qa.allowedHosts.map(norm).filter(Boolean);
  return (qa.environments ?? []).flatMap((e) => e?.hosts ?? []).map(norm).filter(Boolean);
}

/** Returns { ok, host, reason }. `qa` is the qa.config.json object. */
export function checkTarget(urlOrHost, qa = {}) {
  let host;
  try { host = norm(/^[a-z][a-z0-9+.-]*:\/\//i.test(urlOrHost) ? new URL(urlOrHost).hostname : urlOrHost); }
  catch { return { ok: false, host: String(urlOrHost), reason: 'not a valid URL' }; }
  if (!host) return { ok: false, host, reason: 'empty host' };
  if (PRODUCTION_LIKE.test(host)) return { ok: false, host, reason: `${host} looks like a production host` };
  const prod = (qa.productionHosts ?? []).map(norm).filter(Boolean).find((p) => under(host, p));
  if (prod) return { ok: false, host, reason: `${host} is ${host === prod ? '' : 'under '}a production host (${prod}) in productionHosts` };
  const allowed = allowedHostsOf(qa);
  if (!allowed.length) return { ok: false, host, reason: 'no environments are configured: every host is refused until config-proposal is merged' };
  if (isIp(host)) return allowed.includes(host) ? { ok: true, host, reason: 'listed address' } : { ok: false, host, reason: `${host} is a raw IP address that is not listed` };
  const hit = allowed.find((a) => !isIp(a) && under(host, a));
  return hit ? { ok: true, host, reason: `allowed by ${hit}` } : { ok: false, host, reason: `${host} is not in environments[].hosts` };
}
