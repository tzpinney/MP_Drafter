// Build data/localities.json: postcode -> suburb -> [electorates], from official data.
//
// Method (no paid geocoding, no runtime API): for each ABS locality (suburb) polygon we
// sample a grid of points that fall inside it, and look each point up against the
// official AEC electoral-division polygons and the ABS postcode (POA) polygons. Tallying
// the (postcode, electorate) pairs gives, for the part of each suburb within a postcode,
// which electorate(s) it belongs to — ordered by share of sample points (a close proxy
// for area share). Suburbs split across electorates fall out of this naturally.
//
// Sources (free; attribution required in the site footer):
//   - AEC Commonwealth electoral boundaries, as applied at the 2025 federal election.
//   - ABS ASGS Ed3 2021 Suburbs and Localities (SAL) and Postal Areas (POA).
//
// Usage:
//   node scripts/build-localities.mjs                 full national build
//   node scripts/build-localities.mjs --state Victoria   limit to one STE_NAME21 (testing)
//   node scripts/build-localities.mjs --limit 500         stop after N suburbs (testing)
//   node scripts/build-localities.mjs --out path.json     write somewhere else (testing)
//
// Requires the three shapefiles unzipped under scripts/.cache (see scripts/README.md).

import { openDbf, open } from "shapefile";
import whichPolygon from "which-polygon";
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bp = booleanPointInPolygon.default || booleanPointInPolygon;
const bboxOf = bbox.default || bbox;

const AEC = "scripts/.cache/aec/AUS_ELB_region.shp";
const SAL = "scripts/.cache/sal/SAL_2021_AUST_GDA2020.shp";
const POA = "scripts/.cache/poa/POA_2021_AUST_GDA2020.shp";

const arg = (flag, def) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : def; };
const onlyState = arg("--state", null);
const limit = parseInt(arg("--limit", "0"), 10) || 0;
const outPath = arg("--out", fileURLToPath(new URL("../data/localities.json", import.meta.url)));

const STEPS = 18;                 // grid resolution across each suburb's bounding box
const MIN_SHARE = 0.12;           // drop electorates below this share of a suburb-postcode part
const SKIP = /no usual address|migratory|offshore|outside|unclassified|no address/i;

// SAL names disambiguate duplicates with a trailing state, e.g. "Richmond (Vic.)".
// Voters type the bare name, and the postcode disambiguates, so strip the suffix.
const cleanName = s => s.replace(/\s*\([^)]*\)\s*$/, "").trim().toUpperCase();

async function loadFeatures(path, label) {
  const src = await open(path);
  const feats = [];
  for (let r = await src.read(); !r.done; r = await src.read()) feats.push(r.value);
  console.error(`${label}: ${feats.length} features`);
  return feats;
}

function main_sampleSuburb(feature, aecQ, poaQ) {
  const bb = bboxOf(feature);
  const w = bb[2] - bb[0], h = bb[3] - bb[1];
  const dx = w / STEPS, dy = h / STEPS;
  const pairs = {};                 // postcode -> { electorate: count }
  let inside = 0;
  const tally = pt => {
    const a = aecQ(pt); if (!a) return;
    const p = poaQ(pt); if (!p) return;
    const pc = p.POA_CODE21, div = a.Elect_div;
    (pairs[pc] ||= {});
    pairs[pc][div] = (pairs[pc][div] || 0) + 1;
    inside++;
  };
  if (w === 0 && h === 0) { tally([bb[0], bb[1]]); return { pairs, inside }; }
  for (let i = 0; i <= STEPS; i++)
    for (let j = 0; j <= STEPS; j++) {
      const pt = [bb[0] + dx * i, bb[1] + dy * j];
      if (bp(pt, feature)) tally(pt);
    }
  if (inside === 0) {               // tiny/thin suburb the grid missed: fall back to vertices
    const ring = (feature.geometry.type === "Polygon" ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates[0][0]) || [];
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    let best = null, bestD = Infinity;
    for (const [x, y] of ring) { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bestD) { bestD = d; best = [x, y]; } }
    if (best) tally(best);
  }
  return { pairs, inside };
}

async function main() {
  const aecFeats = await loadFeatures(AEC, "AEC");
  const poaFeats = await loadFeatures(POA, "POA");
  const aecQ = whichPolygon({ type: "FeatureCollection", features: aecFeats });
  const poaQ = whichPolygon({ type: "FeatureCollection", features: poaFeats });

  // AEC spells divisions like "Mcewen"; APH (mps.json) uses "McEwen". Canonicalise AEC
  // names to the mps.json spelling so the front-end's MPS[electorate] lookup matches.
  const mpsPath = fileURLToPath(new URL("../data/mps.json", import.meta.url));
  const mpsKeys = Object.keys(JSON.parse(readFileSync(mpsPath, "utf8")));
  const normDiv = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const canonMap = new Map(mpsKeys.map(k => [normDiv(k), k]));
  const divisions = new Set(mpsKeys);
  const canon = d => canonMap.get(normDiv(d)) || d;
  const unmatchedAec = aecFeats.map(f => f.properties.Elect_div).filter(d => !canonMap.has(normDiv(d)));
  if (unmatchedAec.length) console.error("WARNING: AEC divisions with no mps.json match:", [...new Set(unmatchedAec)]);

  const localities = {};            // postcode -> { SUBURB: [electorate, ...] }
  const src = await open(SAL);
  let n = 0, done = 0;
  for (let r = await src.read(); !r.done; r = await src.read()) {
    const f = r.value;
    const name = f.properties.SAL_NAME21;
    if (SKIP.test(name)) continue;
    if (onlyState && f.properties.STE_NAME21 !== onlyState) continue;
    done++;
    if (limit && done > limit) break;
    if (!f.geometry) continue;

    const key = cleanName(name);
    const { pairs } = main_sampleSuburb(f, aecQ, poaQ);
    for (const pc of Object.keys(pairs)) {
      const counts = pairs[pc];
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const divs = Object.entries(counts)
        .filter(([, c]) => c / total >= MIN_SHARE)
        .sort((a, b) => b[1] - a[1])
        .map(([d]) => canon(d));
      if (!divs.length) divs.push(canon(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]));
      (localities[pc] ||= {});
      // merge if the suburb already appeared under this postcode (multipart geometry)
      localities[pc][key] = [...new Set([...(localities[pc][key] || []), ...divs])];
    }
    if (++n % 1000 === 0) console.error(`  …${n} suburbs processed`);
  }
  console.error(`Processed ${n} suburbs; ${Object.keys(localities).length} postcodes.`);

  // sort postcodes and suburbs for a stable, reviewable diff
  const sorted = {};
  for (const pc of Object.keys(localities).sort()) {
    sorted[pc] = {};
    for (const s of Object.keys(localities[pc]).sort()) sorted[pc][s] = localities[pc][s];
  }
  writeFileSync(outPath, JSON.stringify(sorted) + "\n");
  console.error("Wrote " + outPath);

  // sanity: every electorate the data references should exist in the AEC set
  const used = new Set();
  for (const pc of Object.keys(sorted)) for (const s of Object.keys(sorted[pc])) sorted[pc][s].forEach(d => used.add(d));
  const unknown = [...used].filter(d => !divisions.has(d));
  if (unknown.length) console.error("WARNING: electorates not in AEC set:", unknown);
  console.error(`Electorates referenced: ${used.size} of ${divisions.size} AEC divisions.`);
}

main().catch(e => { console.error(e); process.exit(1); });
