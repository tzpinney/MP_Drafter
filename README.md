# Proof Enough

A free website where Australian voters write to their federal MP objecting to mandatory online age verification. The voter picks their concerns, adds a few words of their own, gets a varied draft letter, and sends it **from their own email account**.

The site is [`index.html`](index.html) — a single self-contained page that loads the data in [`/data`](data). [`proof-enough.html`](proof-enough.html) is the original standalone prototype it grew from.

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
  index.html             from the prototype
  data/mps.json          150 House MPs: electorate, name, salutation, email
  data/localities.json   suburb + postcode -> electorate(s)
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

Front-end complete and wired to live data; all 150 MPs and the full national
suburb→electorate map are built from official sources (see [`scripts`](scripts)). The
built-in AI function is written and unit-tested. Remaining work: **deployment** to
Cloudflare Pages (connect the repo, add the Workers AI binding + Turnstile keys, confirm
the Free plan), and the **pre-launch checks** — the AEC authorisation line, a cc-address
re-check, and confirming the exact AEC/ABS attribution wording.

## Licence / attribution

To be confirmed before launch. The site must carry data-licence attribution for the AEC and ABS boundary data, and an AEC electoral authorisation statement (`Authorised by [Name], [Town]`).
