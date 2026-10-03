// Build data/mps.json from official Parliament of Australia sources.
//
//   - Structured fields (name, salutation, electorate, state, party) come from the
//     "All Members by name" CSV.
//   - The contact email is the PUBLISHED value taken from the official "List of Members"
//     PDF. Emails are never constructed from a name pattern; each is matched back to a
//     member by name and anything ambiguous is reported, not guessed.
//
// Usage:
//   node scripts/build-mps.mjs            download fresh from aph.gov.au, write data/mps.json
//   node scripts/build-mps.mjs --check    build in memory and report, but do not write
//
// Requires: Node 18+ (global fetch) and `pdftotext` (poppler-utils) on PATH.

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const CSV_PAGE = "https://www.aph.gov.au/Senators_and_Members/Contacting_Senators_and_Members/Address_labels_and_CSV_files";
const PDF_URL = "https://www.aph.gov.au/-/media/03_Senators_and_Members/32_Members/Lists/Members_List.pdf";

const outPath = fileURLToPath(new URL("../data/mps.json", import.meta.url));
const check = process.argv.includes("--check");

async function get(url, asBuffer = false) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
}

// --- tiny CSV parser (handles quoted fields with embedded commas) -------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
  console.error("Fetching CSV index page…");
  const page = await get(CSV_PAGE);
  const m = page.match(/href="([^"]*All_members_by_name\.csv[^"]*)"/i);
  if (!m) throw new Error("Could not find All_members_by_name.csv link on the APH page");
  const csvUrl = m[1].replace(/&amp;/g, "&");
  console.error("CSV:", csvUrl);
  const csvText = await get(csvUrl);

  console.error("Fetching Members List PDF…");
  const pdfBuf = await get(PDF_URL, true);
  const tmp = mkdtempSync(join(tmpdir(), "mps-"));
  const pdfPath = join(tmp, "members.pdf");
  writeFileSync(pdfPath, pdfBuf);
  let pdfText;
  try {
    pdfText = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  } catch (e) {
    throw new Error("pdftotext failed — install poppler-utils. " + e.message);
  }

  // Published emails -> lookup key by normalised local-part (without the .MP suffix)
  const emailByKey = new Map();
  for (const mm of pdfText.matchAll(/([A-Za-z0-9.'-]+)\.MP@aph\.gov\.au/gi)) {
    const local = mm[1];                       // e.g. "Basem.Abdo"
    emailByKey.set(norm(local), `${local}.MP@aph.gov.au`.toLowerCase());
  }
  console.error(`Published emails in PDF: ${emailByKey.size}`);

  const rows = parseCsv(csvText);
  const header = rows[0].map(h => h.trim());
  const col = name => header.indexOf(name);
  const idx = {
    salutation: col("Salutation"), surname: col("Surname"),
    first: col("First Name"), other: col("Other Name"), preferred: col("Preferred Name"),
    electorate: col("Electorate"), state: col("State"), party: col("Political Party"),
  };

  const mps = {};
  const unmatched = [];
  for (const r of rows.slice(1)) {
    if (!r[idx.electorate]) continue;
    const surname = r[idx.surname].trim();
    const first = r[idx.first].trim();
    const preferred = (r[idx.preferred] || "").trim();
    const other = (r[idx.other] || "").trim();
    const electorate = r[idx.electorate].trim();
    const salutation = r[idx.salutation].trim();

    // candidate email keys: published emails use <preferred-or-first>.<surname>
    const candidates = new Set([
      norm(preferred + surname), norm(first + surname),
      norm(other + surname), norm(first + other + surname),
    ].filter(Boolean));
    let email = null;
    for (const k of candidates) if (emailByKey.has(k)) { email = emailByKey.get(k); break; }
    if (!email) unmatched.push(`${surname}, ${first} (${electorate})`);

    mps[electorate] = {
      name: `${preferred || first} ${surname}`.trim(),
      salutation: `${salutation} ${surname}`.trim(),
      email,
      state: r[idx.state].trim(),
      party: r[idx.party].trim(),
    };
  }

  const n = Object.keys(mps).length;
  const withEmail = Object.values(mps).filter(x => x.email).length;
  console.error(`Members: ${n}   with email: ${withEmail}   missing: ${n - withEmail}`);
  if (unmatched.length) console.error("No published email matched for:\n  - " + unmatched.join("\n  - "));
  if (n !== 150) console.error(`WARNING: expected 150 members, got ${n}`);

  const sorted = Object.fromEntries(Object.keys(mps).sort().map(k => [k, mps[k]]));
  const json = JSON.stringify(sorted, null, 2) + "\n";
  if (check) { console.error("--check: not writing."); }
  else { writeFileSync(outPath, json); console.error("Wrote " + outPath); }
}

main().catch(e => { console.error(e); process.exit(1); });
