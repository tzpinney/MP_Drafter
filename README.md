# Proof Enough

A free website where Australian voters write to their federal MP objecting to mandatory online age verification. The voter picks their concerns, adds a few words of their own, gets a varied draft letter, and sends it **from their own email account**.

The site is [`index.html`](index.html) with its script in [`app.js`](app.js), loading its data from [`/data`](data). **Live at https://proof-enough.pages.dev**

## Core principles

**Zero cost — for the maintainer and for every visitor.** Hosting is Cloudflare Pages (Free plan, `*.pages.dev`). No paid APIs, no payment method on any account, no feature that could trigger billing on overuse. Letters are sent from the visitor's own email; the optional AI hand-off uses the visitor's own free ChatGPT or Claude account.

**Privacy by design.** Nothing the voter types leaves their browser except the optional AI generation request — and that request never includes the voter's name, address, suburb, postcode, or email. No database, no accounts, no stored letters, no cookies, no tracking.

## How it works

1. **MP lookup** — The voter enters suburb + postcode. A pre-built `localities.json` (official ABS locality boundaries intersected with current AEC federal electoral boundaries) maps that to one or more electorates, then to the MP's published contact details. No runtime geocoding. A manual-entry fallback is always available.
2. **Drafting** — three paths, in order:
   - **Built-in AI** via a Cloudflare Pages Function (`/api/draft`) using Workers AI, when the free allowance is available.
   - **ChatGPT / Claude hand-off** — opens the visitor's own free AI account with the prompt prefilled.
   - **Phrase-bank letter** — works offline, never fails, shown on first load.
3. **Sending** — Gmail / Outlook compose links, `mailto:`, and copy buttons for the letter and the To/Cc addresses.

## Architecture

```
/                        static site (Cloudflare Pages)
  index.html             the page (markup + styles)
  app.js                 the page script
  data/mps.json          150 House MPs: electorate, name, salutation, email
  data/localities.json   suburb + postcode -> electorate(s)
  fonts/                 self-hosted web fonts
  _headers               security response headers (CSP, HSTS, ...)
/functions/api/draft.js  Pages Function: Workers AI letter generation
/scripts/                local / GitHub Actions data-build scripts
```

## Built-in AI writer (optional, path 1)

`functions/api/draft.js` is a Cloudflare Pages Function that writes the letter body with
Workers AI. It is progressive enhancement over the phrase-bank letter and **fails soft**:
on any problem (Turnstile failure, free allowance exhausted, timeout) it returns a status
and the page shows the phrase-bank draft plus the ChatGPT/Claude hand-off. It never shows
a raw error.

Privacy: the browser sends only the selected concern IDs, the account-age number, the
tone, the electorate name and the voter's own paragraph. Name, address, suburb, postcode
and email never reach it. The prompt is built server-side from fixed concern text — the
only free-form input accepted is the personal paragraph (capped at 1,000 characters). The
function does not log request bodies.

It stays **off until configured**, so the site runs on just the hand-off + phrase-bank
until you deploy with keys:

| Where | Name | Value |
|-------|------|-------|
| `index.html` | `TURNSTILE_SITE_KEY` | your Cloudflare Turnstile **site** key |
| Cloudflare dashboard → Variables | `TURNSTILE_SECRET` | your Turnstile **secret** key |
| Cloudflare dashboard → Bindings | `AI` | Workers AI binding |

Model: `@cf/meta/llama-3.1-8b-instruct`. The Workers AI free allowance is 10,000 Neurons
per day — record the Neurons per letter from the Cloudflare dashboard after the first real
generations so we know the daily letter capacity (confirm at deploy).

## Status

Deployed and live on Cloudflare Pages (Free plan). All 150 MPs and the full national
suburb→electorate map are built from official sources (see [`scripts`](scripts)). The
ChatGPT/Claude hand-off and phrase-bank letter work today. The built-in Workers AI writer
is implemented but **off by default** — enable it by adding the `AI` binding and Turnstile
keys (see above). Outstanding operational checks: confirm the Cloudflare account is on the
Free plan with no payment method, and re-verify the cc addresses before promoting widely.

## Licence / attribution

The site footer credits the data sources: federal electoral boundaries © Australian
Electoral Commission, and ABS Suburbs/Localities and Postal Areas boundaries, both used
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); MP contact details are
from the Parliament of Australia.

No electoral authorisation statement is included: per the [AEC authorisation
test](https://www.aec.gov.au/About_AEC/Publications/backgrounders/authorisation-step1.htm)
this is issue advocacy (not electoral matter communicated to influence a vote at an
election) and is not a paid advertisement, printed material, or a communication by a
disclosure entity. Re-assess if any of those change.
