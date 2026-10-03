# Data-build scripts

Scripts that generate the committed files in [`/data`](../data). They run on your
machine or in GitHub Actions — never at runtime, so the live site stays free and
dependency-free.

## `build-mps.mjs` — builds `data/mps.json`

Downloads two official Parliament of Australia sources and joins them:

- **All Members by name** CSV — names, salutations, electorate, state, party.
- **List of Members** PDF — the *published* contact email for each member.

Emails are taken from the published PDF and matched back to each member by name. Nothing
is constructed from a name pattern, and any member whose published email can't be matched
is reported (currently only Grayndler, whose office publishes no email).

```bash
node scripts/build-mps.mjs          # download and write data/mps.json
node scripts/build-mps.mjs --check  # build in memory and report, don't write
```

Requirements: Node 18+ and `pdftotext` (from poppler-utils). On Windows, `pdftotext`
ships with Git for Windows at `/mingw64/bin`. The GitHub Action installs poppler-utils on
the runner.

A scheduled workflow ([`.github/workflows/update-mps.yml`](../.github/workflows/update-mps.yml))
reruns this monthly and opens a PR when the data changes.

## `build-localities.*` — builds `data/localities.json`

**Not yet written.** Will intersect ABS "Suburbs and Localities" boundaries with the
current AEC federal electoral boundaries to map suburb + postcode to electorate(s).
