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

## `build-localities.mjs` — builds `data/localities.json`

Maps `postcode → suburb → [electorates]` from official boundaries. For each ABS locality
(suburb) polygon it samples a grid of interior points and looks each point up against the
official **AEC electoral-division** polygons and the ABS **postcode (POA)** polygons.
Tallying the (postcode, electorate) pairs gives, for the part of a suburb within a
postcode, which electorate(s) it falls in — ordered by share of sample points (a close
proxy for area share). Suburbs genuinely split across electorates fall out naturally.

AEC spells divisions like `Mcewen`; the builder canonicalises them to the `data/mps.json`
spelling (`McEwen`) so the front-end lookup matches, and warns if any division can't be
reconciled.

### Inputs (free downloads, unzipped under `scripts/.cache/`)

| Layer | File | Source |
|-------|------|--------|
| Electorates | `aec/AUS_ELB_region.shp` | [AEC boundaries, as at the 2025 election](https://www.aec.gov.au/electorates/gis/gis_datadownload.htm) (`AUS-March-2025-esri.zip`) |
| Suburbs | `sal/SAL_2021_AUST_GDA2020.shp` | [ABS ASGS Ed3 2021 Suburbs and Localities (SAL)](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files) |
| Postcodes | `poa/POA_2021_AUST_GDA2020.shp` | ABS ASGS Ed3 2021 Postal Areas (POA), same page |

These are large (~180 MB total) and are **not** committed — `.cache/` is git-ignored.

```bash
node scripts/build-localities.mjs                  # full national build
node scripts/build-localities.mjs --state Victoria # one state, for testing
node scripts/build-localities.mjs --limit 500      # first N suburbs, for testing
```

Requires Node 18+ and the npm deps in the repo `package.json` (`npm install`). The build
takes a few minutes and needs no network once the shapefiles are cached.

**Licence / attribution:** the AEC and ABS data are free to use with attribution — the
required credit lines must appear in the site footer before launch.
