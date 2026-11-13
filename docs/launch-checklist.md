# Launch checklist

What the code cannot do for itself. The site builds, passes its gates (placeholders, dev URLs,
links, CSP hashes) and the accessibility audit; these are the remaining steps in the Cloudflare
dashboard and with the client.

## Before go-live

- [ ] **Connect the appointment form to Resend.** In Resend, verify `pomibbrowstudio.com`
      (Domains → Add; add the DNS records it lists in Cloudflare) and create an API key. Then on
      the `pomi-brow` Worker (Settings → Variables and secrets) add:
      - `RESEND_API_KEY`, type Secret.
      - `APPOINTMENT_TO`, the inbox that should get requests (comma-separate several).
      - `APPOINTMENT_FROM` only to change the sender from
        `Pomi B. Brow Studio website <website@pomibbrowstudio.com>`.
      Until the key and recipient are set, the form tells visitors to call instead, and the
      Worker log shows `[contact] RESEND_API_KEY and APPOINTMENT_TO must both be set`. Send one
      test request; a failed send logs `[contact] Resend failed:` with Resend's reason.
- [ ] **Confirm the rate limiter deployed.** `npx wrangler deploy` output should list the
      `CONTACT_LIMITER` binding. If the account cannot use it, the Worker logs
      `CONTACT_LIMITER binding missing` once per isolate.
- [ ] **Confirm the domain.** `astro.config.mjs` `site` is `https://pomibbrowstudio.com`;
      canonicals, the sitemap and robots.txt all use it.
- [ ] **Cloudflare zone settings:** leave Rocket Loader, Email Address Obfuscation and any
      "JavaScript detections" off. They inject inline scripts the Content-Security-Policy
      (public/_headers) does not list, which would be blocked.
- [ ] **Client review of the policy pages** (`/privacy`, `/terms`, `/accessibility`). They are
      written to match what the site actually does, in plain language, but are not legal advice.
      If the studio adds a booking widget, newsletter, ad pixel or chat, `/privacy` must change.
- [ ] **Visit counts (optional):** set `PUBLIC_CF_ANALYTICS_TOKEN` in the build environment to turn
      on Cloudflare Web Analytics (cookieless; `/privacy` already describes it as "may").
- [ ] **Pomi's bio** (Site settings in Sanity). The About section hides itself until it is real.

## Recommended soon after

- [ ] **Cloudflare Turnstile** on the appointment form, if spam gets through the honeypot,
      fill-time check and rate limit. Needs a site key from the Cloudflare dashboard; the CSP then
      needs `https://challenges.cloudflare.com` in `script-src` and `frame-src`.
- [ ] **Online booking link**, if the studio adopts one: set `bookingUrl` in Site settings and
      the header and mobile bar switch to "Book" automatically. Add the booking provider to
      `/privacy` and, if it is embedded rather than linked, to the CSP.
- [ ] **Instagram token** for the live feed (docs/instagram-feed-setup.md). Without it the grid
      shows the curated photos, which is fine.

## After any change

```sh
npm run build            # gates: placeholders, dev URLs, links, CSP hashes
npm test
npx wrangler dev --port 8788
node scripts/a11y-audit.mjs http://127.0.0.1:8788
```

Re-date `/accessibility` ("Last reviewed") when the audit is re-run after a substantial change.
