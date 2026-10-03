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

## Status

Front-end complete and wired to live data. `data/mps.json` holds all 150 House members (built automatically from official Parliament of Australia sources — see [`scripts`](scripts)). Remaining work: the suburb→electorate map (`data/localities.json`), the AI draft Pages Function, Cloudflare deployment, and the pre-launch checks (AEC authorisation line, cc-address re-check, AEC/ABS data attributions).

## Licence / attribution

To be confirmed before launch. The site must carry data-licence attribution for the AEC and ABS boundary data, and an AEC electoral authorisation statement (`Authorised by [Name], [Town]`).
