# Security controls — MealBlend landing pages + admin

Scope: public landing pages (`/:slug`) and the admin area (`/admin`). Status: runs locally (files) or on **Vercel**
(Upstash Redis + Vercel Blob, see README "Deploy"); one dummy admin account.
This maps what is implemented to OWASP Top 10 (2021), UU No. 27/2022 Pelindungan Data Pribadi (PDP) and SOC 2-style
controls. "Open" items must be closed before going live.

## OWASP Top 10

| Risk | Control | Where |
| --- | --- | --- |
| A01 Broken Access Control | Every `/admin` route except login requires a server-side session (`requireAdmin`); preview is admin-only; API returns 401 without a session. Slugs/section ids are validated against strict patterns, reserved slugs (`admin`, `uploads`, …) are refused, uploads are written only under `public/uploads/sections/<id>/` with random names (no path traversal). | `src/admin/security.js`, `src/store.js`, `src/admin/media.js` |
| A02 Cryptographic Failures | Passwords hashed with scrypt (N=2^15, 16-byte salt), compared in constant time. Session ids are 256-bit random. In production (`NODE_ENV=production`) the cookie is `Secure` with the `__Host-` prefix; HSTS header is sent. Secrets live only in `.env` (gitignored). | `security.js`, `server.js` |
| A03 Injection / XSS | Uploaded or edited HTML is sanitized (allow-list via sanitize-html): `<script>`, `<iframe>` (YouTube → click-to-load player), `<form>`, `<object>`, `on*` handlers, `javascript:` URLs, SVG `url()` references are removed. CSS is scoped to its section, `@import`, `expression()`, `-moz-binding`, `position:fixed` are neutralised. Admin UI inserts data as text only (no `innerHTML`). CSP: `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`. | `src/admin/sanitize.js`, `public/admin/admin.js`, `server.js` |
| A04 Insecure Design | Uploaded HTML is wrapped in `.lp-html` (`contain: paint`, max-width 100%) so it cannot overflow or overlay the page. Optimistic version check (409) prevents two admins silently overwriting each other. | `render.js`, `lp.css`, `routes.js` |
| A05 Security Misconfiguration | helmet headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy), `Permissions-Policy` blocks camera/mic/geo/payment, `x-powered-by` off, admin sends `X-Robots-Tag: noindex`, generic 500 messages (no stack traces to clients), static dirs deny dotfiles. | `server.js`, `routes.js` |
| A06 Vulnerable Components | `npm audit --omit=dev` = 0 (2026-10-14); sharp upgraded to 0.35.5 for libvips CVEs. The dev-only design tool `puppeteer-core` has advisories in its transitive deps (not shipped, not used by the server). Re-run the audit before each release. | `package.json` |
| A07 Identification & Auth Failures | Generic "Email atau password salah" (no user enumeration) + dummy-hash timing equalisation; lockout 5 failures → 15 min per email+IP; login rate limit 20 / 15 min per IP; session idle timeout 30 min, absolute 8 h; session id rotated at login; logout destroys the session server-side. Sessions and lockout counters live in a shared key-value store (Redis on Vercel, `data/kv.json` locally) keyed by SHA-256 hashes of session ids (a leaked store cannot be replayed as a cookie) and expire on their own. | `security.js`, `routes.js` |
| A08 Software & Data Integrity | Image uploads are decoded and re-encoded by sharp (proves it is a real image; SVG/HTML disguised as images are refused; `limitInputPixels` blocks decompression bombs). Every page save is atomic (temp file + rename) and snapshots the previous version. Page export codes are HMAC-SHA256 signed with a server-only key (`EXPORT_SECRET`); edited or foreign codes are rejected on import. | `media.js`, `store.js`, `transfer.js` |
| A09 Logging & Monitoring | Append-only JSONL audit log of logins (success/fail/lockout), logout and every content change (who, when, IP, page, section). Passwords are never logged. Viewable at **Admin → Log Aktivitas**. | `security.js` `audit()` |
| A10 SSRF | The server never fetches user-supplied URLs (uploads are files, not URLs). | — |

CSRF: synchronizer token per session, required on every state-changing request (`x-csrf-token` header), plus Origin
check and `SameSite=Strict` cookies. Login form also checks Origin.

## PDP (UU 27/2022)

- **Data minimisation**: the only personal data processed by the admin is the admin's email, IP address and user agent
  (audit log). Landing pages set no cookies; YouTube loads only after a tap (`youtube-nocookie.com`).
- **Analytics (Laporan)**: first-party and cookieless. Visitors are counted with a hash of (daily random salt + IP +
  user agent); the salt is replaced daily and not kept, so people cannot be re-identified or followed across days.
  Raw IPs and full user agents are not stored. Engagement beacons (`/t/e`) carry only section ids, seconds visible,
  click type and click position in page units — no text, form input, keystrokes or session recordings. Global Privacy
  Control is respected. Raw events are deleted after 400 days.
- **GA4** is optional (off until a Measurement ID is set in Global). GA4 sets cookies: add a consent notice before
  enabling it on live traffic.
- "Coba di HP" draft links use random 192-bit tokens (stored hashed), expire after 1 hour, are noindex and not tracked.
  The login `next` redirect is restricted to `/admin` paths (no open redirect).
- **Image metadata**: EXIF/GPS/camera data is stripped from every uploaded image (re-encode without metadata).
- **Retention**: audit files older than 90 days are deleted automatically (startup + daily). Page history keeps the last 50 versions.
- **Purpose & access**: audit log is visible only to logged-in admins.
- Open: privacy notice for admins, data-processing records (RoPA), breach-notification procedure (3×24 h to data
  subjects/authority) once the system is live.

## SOC 2-style controls

| Control | Implementation |
| --- | --- |
| Logical access (CC6.1) | Named admin accounts in `ADMIN_USERS`; removing an entry revokes active sessions on the next request. |
| Authentication (CC6.1) | Email + password (min. 12 chars via `scripts/create-admin.mjs`). **Open: MFA (TOTP) — deferred by product decision.** |
| Change management (CC8.1) | Edits go to a draft first (undo/redo); the live page changes only on **Simpan**. Every publish versions the previous live page (Riwayat → Muat ke draft). URL changes keep the old link working (301). All draft edits and publishes are in the audit log and in each page's Riwayat tab. |
| Monitoring (CC7.2) | Audit log of auth events and changes with actor, time, IP. |
| Availability / backup (A1.2) | Local: plain files in `data/` + `public/uploads/`. Vercel: Upstash Redis + Vercel Blob (managed, replicated). **Open: scheduled export/backup of Redis.** |
| Secure config | `.env` not committed; `.env.example` documents settings without secrets. On Vercel, secrets are project Environment Variables only. |

## Known limitations (local setup)

- Request rate limits (login 20 / 15 min, beacons) are per server instance; the per-account lockout is shared (Redis).
- HTTPS is required in production; Vercel serves HTTPS and sets `NODE_ENV=production`, so cookies get `Secure` + `__Host-`.
- On Vercel the admin is reachable from the internet. **Open: MFA (TOTP)** is strongly recommended before more admins are added;
  optionally restrict `/admin` with Vercel Firewall rules.
- Uploaded files are never deleted when a section is removed (history versions may still reference them).

## Operations

```bash
node scripts/create-admin.mjs admin@example.com          # random password → data/secrets/admin-credentials.txt
node scripts/create-admin.mjs admin@example.com 'S3cret-passphrase'
npm audit --omit=dev
node design-src/test-sanitize.mjs                          # sanitizer regression + attack samples
```
