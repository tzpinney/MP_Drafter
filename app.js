// Set this to your Cloudflare Turnstile *site* key to turn on the built-in AI writer
// (path 1). Left empty, the built-in writer stays hidden and the page works with just the
// ChatGPT/Claude hand-off and the phrase-bank letter. The matching Turnstile *secret* and
// the Workers AI binding live in the Cloudflare dashboard, never in this file.
const TURNSTILE_SITE_KEY = "";

// MP contact data and the suburb+postcode -> electorate map are loaded at runtime from
// /data. If the fetch fails (e.g. the file is opened directly off disk), these small
// fallbacks keep the page working and the acceptance example resolving.
const FALLBACK_MPS = {
  McEwen: { name: "Rob Mitchell", salutation: "Mr Mitchell", email: "rob.mitchell.mp@aph.gov.au", state: "VIC", party: "Australian Labor Party" }
};
const FALLBACK_LOCALITIES = { "3756": { WALLAN: ["McEwen"] }, "3757": { WHITTLESEA: ["McEwen"] } };
let MPS = FALLBACK_MPS, LOCALITIES = FALLBACK_LOCALITIES;

async function loadData() {
  try {
    const [m, l] = await Promise.all([
      fetch("data/mps.json").then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch("data/localities.json").then(r => r.ok ? r.json() : Promise.reject(r.status))
    ]);
    if (m && Object.keys(m).length) MPS = m;
    if (l && Object.keys(l).length) LOCALITIES = l;
  } catch (e) { /* keep fallbacks; the manual-entry path always works */ }
}

// Fixed cc recipients. One object so a reshuffle or change of Commissioner is a one-line edit.
// Verified Oct 2026 — re-check before launch.
const CC = {
  ccMinister: "minister.wells@mo.communications.gov.au",
  ccEsafety: "enquiries@esafety.gov.au"
};

// Australia Post postcode ranges -> state, so the signature's "Suburb STATE Postcode"
// line is correct everywhere without needing state stored per locality.
function stateForPostcode(pc) {
  if (!/^\d{4}$/.test(pc)) return "";
  const n = parseInt(pc, 10);
  if ((n >= 200 && n <= 299) || (n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return "ACT";
  if ((n >= 800 && n <= 999)) return "NT";
  if ((n >= 1000 && n <= 2599) || (n >= 2619 && n <= 2898) || (n >= 2921 && n <= 2999)) return "NSW";
  if ((n >= 3000 && n <= 3999) || (n >= 8000 && n <= 8999)) return "VIC";
  if ((n >= 4000 && n <= 4999) || (n >= 9000 && n <= 9999)) return "QLD";
  if (n >= 5000 && n <= 5999) return "SA";
  if (n >= 6000 && n <= 6999) return "WA";
  if (n >= 7000 && n <= 7999) return "TAS";
  return "";
}

const CONCERNS = [
  { id: "adult", title: "I'm already a verified adult", sub: "My phone plan, payments and device accounts already require me to be 18+.",
    point: "My phone plan, payment methods and the accounts that run my devices are held in my name under contracts that require me to be 18 or older. I have already proved my age to these same companies.",
    text: [
      "I am already a verified adult. My phone plan, my payment methods and the accounts that operate my devices are all held in my name under contracts that require me to be 18 or older. It is unreasonable to make me prove my age again, repeatedly, to the same companies whose products I have already been accepted as an adult to buy and use.",
      "The companies now being told to check my age already know I am an adult. I could not have signed my phone contract, added a credit card or opened the accounts that run my devices otherwise. Asking me to prove it again achieves nothing except more collection of my personal information.",
      "Every device and account I use was set up under contracts available only to people aged 18 or over. My age has been established many times. A rule that ignores this and demands fresh proof treats every adult as a suspect."
    ],
    ask: "Make it a legal requirement, across both the social media rules and the Age-Restricted Material Codes, that services accept existing evidence of adulthood (contracts, payment details, long-standing accounts) before asking anyone for a face scan or ID. Today this is optional regulator guidance, not a right." },
  { id: "longstanding", title: "My accounts are decades old", sub: "An account that has existed this long proves its holder is an adult.",
    point: "Many of my accounts are about {years} years old. An account that old is itself proof its holder is an adult. Making me scan my face or upload ID for it is excessive, unsafe and ineffective: it re-proves something already proven, and creates a second key to the same gate that adds no security but does add a new store of sensitive data that can be breached. A net negative.",
    text: [
      "Many of my accounts are about {years} years old. An account that has existed for that long is itself proof that its holder is an adult, and no further verification should be needed.",
      "Some of the accounts I am now being asked to verify have been open for around {years} years. No child holds a {years}-year-old account. Demanding proof of age for them makes no sense.",
      "I have held many of my online accounts for roughly {years} years. Asking me to scan my face or upload ID for them is excessive, unsafe and ineffective. It re-proves something that has already been proven, and the access it grants is worth no more than the proof that already existed. It is a second key to the same gate. Once that gate is open, it stays open to whoever is using the device, whatever their age. The extra key adds no security, but it does create one more store of sensitive information that can be stolen. That makes it a net negative."
    ],
    ask: "Make it a legal requirement, across both the social media rules and the Age-Restricted Material Codes, that services accept existing evidence of adulthood (contracts, payment details, long-standing accounts) before asking anyone for a face scan or ID. Today this is optional regulator guidance, not a right." },
  { id: "breaches", title: "My data won't be kept safe", sub: "Governments and companies keep losing Australians' personal information.",
    point: "Government agencies have a record of failing to protect personal data and botching technology rollouts (2014 immigration detention data release, 2016 Census outage, Robodebt). Optus and Medibank breaches show the same on the industry side. In 2025, ID documents submitted to Discord for age checks were exposed through a third-party provider.",
    text: [
      "I have no confidence my personal information will be kept safe. Australian governments have a record of failing to protect private information and of botching major technology rollouts, from the 2014 accidental release of the details of thousands of people in immigration detention, to the 2016 online Census outage, to the unlawful Robodebt scheme. Breaches at Optus and Medibank show the private sector is no better. In 2025, identity documents submitted to Discord for age checks were exposed through a third-party provider. Every new requirement to hand over a face scan or ID creates another store of data waiting to be breached.",
      "Australians have watched their personal data leak again and again, from Optus and Medibank to government failures such as the 2016 Census outage and the 2014 release of immigration detainees' personal details. Age verification creates exactly the kind of identity data criminals want. That risk is already real: in 2025, ID images that Discord users submitted for age checks were exposed through a contractor.",
      "Collecting identity documents and face scans from millions of adults creates a target. Governments and companies in Australia have repeatedly failed to protect far less sensitive information, and the Robodebt scheme showed how badly a large automated system can go wrong. I am not willing to add my identity to another database on trust."
    ],
    ask: "Extend the data-use and destruction limits that already apply to social media age checks to the Age-Restricted Material Codes, which rely only on general privacy law, and make sure the statutory review of the social media age rules also covers the codes and takes public submissions." },
  { id: "offshore", title: "My data goes to foreign companies", sub: "Age checks hand my identity to overseas tech firms and their vendors.",
    point: "The rules effectively require Australians to share sensitive personal and biometric information with foreign corporations and the overseas age assurance vendors they contract, with little control or recourse.",
    text: [
      "These rules effectively require Australians to share sensitive personal and biometric information with foreign corporations, including overseas technology companies and the age assurance vendors they contract. Once that information leaves the country, Australians have little control over how it is stored or used, and little recourse when something goes wrong.",
      "In practice, the age checks are run by large overseas technology companies and the verification firms they hire. I should not be compelled to hand my identity to a foreign company as a condition of using the internet in my own home.",
      "The Government is not checking my age itself. It is requiring me to give my identity to overseas corporations and their contractors, under privacy rules Australia does not control. That is a poor trade for Australians' sovereignty over their own data."
    ],
    ask: "Require that any age assurance data be processed and held in Australia under Australian law, or not collected at all." },
  { id: "biometrics", title: "Face scans are too much", sub: "I can change a password. I can't change my face.",
    point: "Facial age estimation means handing biometric data to companies. A leaked password can be changed; a leaked face scan cannot.",
    text: [
      "Many of these systems rely on scanning my face. Biometric data is uniquely sensitive: if a password leaks I can change it, but I cannot change my face. Normalising face scans for ordinary internet use is a serious step that Australians were never properly asked about.",
      "I object to being asked to scan my face to use services I have used for years. Biometric information cannot be reissued after a breach, and routine face scanning for everyday apps is out of proportion to the problem being addressed.",
      "Face scanning turns an everyday activity into a biometric checkpoint. Once my facial data has been collected and leaked, there is nothing I can do to protect myself. That risk should not be imposed on every adult."
    ],
    ask: "Give face scans the same protection the law already gives government ID: no one should be required to use one, and a non-biometric alternative must always be offered." },
  { id: "home", title: "Government in my home", sub: "What adults do on their own devices is their business.",
    point: "What an adult does on their own devices is their own business. It should not be gated behind onerous identity verification, invasive facial scans, or guidelines so loose that people are effectively pushed to apply for a credit card they never previously had — just to prove their age — let alone a system that lets authorities examine everything a person does online. Parents already have tools to supervise children; responsibility should rest with families, supported by education and enforcement against genuinely harmful operators.",
    text: [
      "It is not the role of government to reach into my home and control what I, as an adult, can access on my own devices — least of all through onerous identity checks, invasive facial scans, or guidelines so loosely drawn that, just to prove my age, I am effectively expected to go out and apply for a credit card I never previously had or wanted. Parents already have tools to supervise their children's devices. Responsibility for children's online use should rest with families, supported by education and by enforcement against genuinely harmful operators, not with surveillance-style checks on the entire adult population.",
      "I am an adult using my own devices in my own home, and that should not mean submitting to identity verification, face scans, or being driven to apply for a credit card I never previously had just to go about my day online — still less a system that, in effect, lets the government look over my shoulder at everything I do. The answer to children's online safety is better tools and support for parents, not making every adult in Australia prove themselves before using the internet.",
      "Parents are best placed to decide what their children do online, and the tools to do that already exist on every phone and console. Instead, these rules push every adult towards onerous ID verification, invasive facial scans, and — under guidelines loose enough to permit it — being made to go out and apply for a credit card simply to prove their age, even if they never previously had or wanted one, while normalising the idea that someone can examine everything they do online. Imposing this on every adult to solve a problem that sits with families is government overreach."
    ],
    ask: "Oppose any further expansion of age verification, and rely on the parental controls device makers are already required to provide, rather than checks on every adult." },
  { id: "accountability", title: "An unelected regulator", sub: "Citizens have no say in eSafety's mandate and no way to challenge it.",
    point: "The eSafety Commissioner is unelected yet shapes how every adult uses the internet. Citizens have no say in the Commission's mandate and no practical way to challenge decisions short of costly litigation. Courts have found against the Commissioner more than once.",
    text: [
      "I am concerned about the lack of democratic accountability in how these rules are imposed. The eSafety Commissioner is an unelected official, yet now has sweeping influence over how every Australian adult uses the internet. Ordinary citizens have no say in the Commission's mandate and no practical way to challenge its decisions short of litigation only large corporations can afford. The courts have found against the Commissioner more than once.",
      "Rules this far-reaching should be made by elected representatives, not an unelected regulator and the industry codes it registers. Australians had no vote on any of this and have no realistic way to challenge it. Several court decisions against the Commissioner suggest the office has gone beyond what Parliament intended.",
      "Decisions that affect how every adult uses the internet are being made by an unelected Commissioner and written into codes drafted with industry. Voters have no voice in that process and no affordable avenue of appeal. That is not how a democracy should make rules of this size."
    ],
    ask: "Make the industry codes subject to disallowance by Parliament, as industry standards already are; establish a standing parliamentary committee to oversee eSafety with formal public input; and broaden the grounds for removing a Commissioner, which are currently limited to misbehaviour or incapacity." },
  { id: "anonymity", title: "Privacy and anonymity", sub: "Linking my identity to what I read online has a chilling effect.",
    point: "Tying identity to online activity has a chilling effect on lawful speech and harms people who depend on privacy, such as people escaping violence, whistleblowers and people seeking sensitive health information.",
    text: [
      "Tying people's real identities to what they read and do online has a chilling effect on lawful activity. It hurts the people who most depend on privacy: people escaping violence, whistleblowers, and anyone looking for sensitive health or legal information.",
      "The ability to read and speak online without showing ID is part of a free society. Age verification erodes it for every adult, and the people hurt most are those with the strongest reasons to stay private.",
      "Once proof of identity is needed to use mainstream services, anonymous lawful use of the internet starts to disappear. That is a significant loss of freedom, and it has not been justified."
    ],
    ask: "Protect adults' ability to use the internet anonymously and lawfully, and say so in law." },
  { id: "effectiveness", title: "It won't work", sub: "It obstructs you when you're doing nothing wrong, yet is trivial to evade.",
    point: "These rules get in the way of adults doing nothing wrong, yet anyone who actually wants to evade them can do so trivially — a VPN, a borrowed account, or simply going around the official services. In practice the current implementation pushes people towards VPNs, piracy and other evasive behaviour. It does not fix the harms the scheme was meant to address; it creates new ones, by making the right way too hard and the wrong way easy and attractive. The burden falls on the compliant, while the determined are barely slowed.",
    text: [
      "These measures get in the way of adults who are doing nothing wrong, while barely slowing anyone who actually wants to get around them — a VPN, a borrowed account or an unofficial service does the job. The burden falls on law-abiding adults, who are the people least in need of checking.",
      "The perverse result of these rules is that doing things the right way becomes difficult while doing things the wrong way becomes easy and attractive. They push ordinary people towards VPNs, piracy and other workarounds, and a determined teenager gets around an age check in minutes. The scheme inconveniences and exposes adults while doing little for children.",
      "A policy that is hard for law-abiding adults to live with but easy for the determined to evade has its burden exactly the wrong way round. It does not fix the problems it was designed to fix — it creates new ones, normalising VPNs and evasion. Before it goes any further, the Government should show independent evidence that it actually works.",
      "Checking an adult whose age is already established is like adding a second key to a gate that is already locked. Once that gate is open it stays open to whoever holds the device, of age or not, so the check adds no real security — only another store of sensitive data that can be lost or stolen. Meanwhile anyone set on evading it simply turns to a VPN or a borrowed login. On balance it leaves Australians less safe, not more, while encouraging the very workarounds it claims to prevent."
    ],
    ask: "Require independent, published evidence that age verification actually reduces harm to children before it is expanded any further." }
];

const INTRO = "I am writing as a constituent of {electorate} about mandatory online age verification, including the social media minimum age rules and the Age-Restricted Material Codes now applying to app stores, search engines and other online services. I support protecting children from genuinely harmful content online. My objection is to how the Government has gone about it. The methods chosen are poorly designed and badly implemented, and the rollout of the social media minimum age rules in particular has been inept. In pursuit of a reasonable goal, these measures overreach, placing unjustified burdens on law-abiding adults and restricting their online freedom.";
// Every opening keeps the same order: acknowledge the goal, object to the METHODS and
// implementation (not the goal), then the overreach onto law-abiding adults.
const OPEN = {
  firm: [
    INTRO,
    "As a constituent of {electorate}, I am writing about mandatory online age verification — the social media minimum age rules and the Age-Restricted Material Codes now applying to app stores, search engines and other online services. Protecting children from genuinely harmful content online is a goal I share. My objection is not to that goal but to the Government's execution of it: the methods are poorly designed and badly implemented, and the social media minimum age rules in particular have been rolled out ineptly. The result is overreach that loads unjustified burdens onto law-abiding adults and curtails their freedom online.",
    "I am writing to you as a constituent of {electorate} about mandatory online age verification, including the social media minimum age rules and the Age-Restricted Material Codes now covering app stores, search engines and other online services. Keeping children away from genuinely harmful content is a worthy aim, and I support it. What I object to is how it has been pursued — through poorly designed, badly implemented measures, with the social media minimum age rules handled worst of all — in a way that overreaches and places unjustified burdens on law-abiding adults and their online freedom."
  ],
  polite: [
    INTRO,
    "As a constituent of {electorate}, I would like to share my concerns about mandatory online age verification — the social media minimum age rules and the Age-Restricted Material Codes now applying to app stores, search engines and other online services. I genuinely support protecting children from harmful content online. My concern is with how the Government has approached it: the methods are poorly designed and have been badly implemented, and the rollout of the social media minimum age rules in particular has been inept. However well intended, these measures overreach, placing unjustified burdens on law-abiding adults and limiting their freedom online.",
    "I am writing to you as a constituent of {electorate} about the online age verification rules now being introduced, including the social media minimum age rules and the Age-Restricted Material Codes covering app stores, search engines and other services. Protecting children from genuinely harmful content matters to me too. My concern is not the goal but the execution — poorly designed and badly implemented measures, with the social media minimum age rules rolled out especially poorly — which in practice overreach and place unfair burdens on law-abiding adults and their freedom online."
  ]
};
const ASK_INTRO = { firm: ["I ask that you:", "I am asking you to:"], polite: ["I would be grateful if you would:", "I respectfully ask that you:"] };
const CLOSE = {
  firm: ["I would appreciate a written response setting out your position on this issue.", "Please reply in writing with your position and what you intend to do."],
  polite: ["I would welcome a reply setting out your view on this issue.", "Thank you for considering my concerns. I look forward to your reply."]
};
const SIGN = { firm: ["Yours sincerely,"], polite: ["Kind regards,", "Yours sincerely,"] };

const $ = id => document.getElementById(id);
const state = { selected: new Set(["adult", "breaches", "offshore"]), tone: "firm", seed: 7, dirty: false, source: "built", aiBody: "", chosen: null };

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

// Resolve suburb + postcode to an electorate. Returns one of:
//   { mode: "found",  electorate }   one electorate (shows the MP)
//   { mode: "choice", list }         locality split across electorates (shows a picker)
//   { mode: "manual" }               postcode unknown (manual entry)
function resolve() {
  const pc = $("postcode").value.trim();
  const sub = $("suburb").value.trim().toUpperCase();
  if (!pc) return { mode: "empty" };          // nothing entered yet — don't show an error
  const byPc = LOCALITIES[pc];
  if (byPc) {
    let list = (sub && byPc[sub]) ? byPc[sub]
      : [...new Set(Object.values(byPc).flat())]; // suburb not matched: union across the postcode
    list = list.filter(e => MPS[e]);               // only electorates we hold an MP for
    if (list.length === 1) return { mode: "found", electorate: list[0] };
    if (list.length > 1) {
      if (state.chosen && list.includes(state.chosen)) return { mode: "found", electorate: state.chosen };
      return { mode: "choice", list };
    }
  }
  return { mode: "manual" };
}

function mp() {
  const r = resolve();
  if (r.mode === "found") return { ...MPS[r.electorate], electorate: r.electorate, known: true };
  const name = $("mpName").value.trim(), title = $("mpTitle").value;
  const surname = name.split(/\s+/).pop() || "";
  return { name, electorate: $("mpElectorate").value.trim(), email: $("mpEmail").value.trim(),
    salutation: name ? (title ? title + " " + surname : name) : "", state: "", known: false };
}
function years() { const v = parseInt($("years").value, 10); return v > 0 ? v : 20; }
function fill(s, m) { return s.replace(/\{years\}/g, years()).replace(/\{electorate\}/g, m.electorate || "your electorate"); }
function chosen() { return CONCERNS.filter(c => state.selected.has(c.id)); }

function signature() {
  const lines = [$("name").value.trim() || "[Your name]", $("street").value.trim() || "[Street address]"];
  const sub = $("suburb").value.trim(), pc = $("postcode").value.trim();
  const st = stateForPostcode(pc) || "[State]";
  lines.push(((sub || "[Suburb]") + " " + st + " " + (pc || "[Postcode]")).trim());
  if ($("email").value.trim()) lines.push($("email").value.trim());
  return lines.join("\n");
}
function greeting(m) { return "Dear " + (m.salutation || "[MP's name]") + ","; }

function asksFor(list) { const seen = new Set(); return list.map(c => c.ask).filter(a => !seen.has(a) && seen.add(a)); }

function buildBody(m) {
  const r = rng(state.seed), t = state.tone, list = chosen();
  const parts = [fill(pick(OPEN[t], r), m)];
  list.forEach(c => parts.push(fill(pick(c.text, r), m)));
  const own = $("personal").value.trim();
  if (own) parts.splice(Math.min(1, parts.length), 0, own);
  const asks = asksFor(list);
  if (asks.length) parts.push(pick(ASK_INTRO[t], r) + "\n" + asks.map((a, i) => (i + 1) + ". " + a).join("\n"));
  parts.push(pick(CLOSE[t], r));
  return { body: parts.join("\n\n"), sign: pick(SIGN[t], r) };
}

function compose() {
  const m = mp();
  if (state.source === "ai" && state.aiBody) return greeting(m) + "\n\n" + state.aiBody + "\n\nYours sincerely,\n\n" + signature();
  const b = buildBody(m);
  return greeting(m) + "\n\n" + b.body + "\n\n" + b.sign + "\n\n" + signature();
}

function recipients() {
  const m = mp();
  const to = m.email || "";
  const cc = Object.keys(CC).filter(k => $(k).checked).map(k => CC[k]);
  return { to, cc };
}

function renderMp() {
  const r = resolve();
  $("mpPrompt").hidden = r.mode !== "empty";
  $("mpFound").hidden = r.mode !== "found";
  $("mpChoice").hidden = r.mode !== "choice";
  $("mpManual").hidden = r.mode !== "manual";
  if (r.mode === "found") {
    const m = MPS[r.electorate];
    const box = $("mpFound"); box.textContent = "";
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    box.append(el("span", "hint", "Member for " + r.electorate), el("strong", null, m.name + " MP"));
    if (m.email) {
      box.append(el("span", "addr", m.email));
    } else {
      const note = el("span", "notice"); note.style.marginTop = "6px";
      note.append("Parliament doesn't publish a direct email for this member. You can still build and copy your letter, or reach them via their page on ");
      const link = el("a", null, "aph.gov.au");
      link.href = "https://www.aph.gov.au/Senators_and_Members/Members"; link.target = "_blank"; link.rel = "noopener noreferrer";
      note.append(link, "."); box.append(note);
    }
  } else if (r.mode === "choice") {
    $("mpChoiceNote").innerHTML = "Your suburb is split between more than one electorate. Pick yours — if you're not sure, check the <a href=\"https://electorate.aec.gov.au/\" target=\"_blank\" rel=\"noopener noreferrer\">AEC electorate finder</a>.";
    const box = $("mpChoiceBtns"); box.innerHTML = "";
    r.list.forEach(e => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn small";
      b.textContent = MPS[e] ? e + " — " + MPS[e].name : e;
      b.onclick = () => { state.chosen = e; update(); };
      box.appendChild(b);
    });
  }
}

function renderConcerns() {
  const box = $("concerns"); box.innerHTML = "";
  CONCERNS.forEach(c => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "concern"; b.id = "c-" + c.id;
    b.setAttribute("aria-pressed", state.selected.has(c.id));
    const t = document.createElement("b"); t.textContent = c.title;
    const s = document.createElement("span"); s.textContent = c.sub;
    b.append(t, s);
    b.onclick = () => { state.selected.has(c.id) ? state.selected.delete(c.id) : state.selected.add(c.id); b.setAttribute("aria-pressed", state.selected.has(c.id)); update(); };
    box.appendChild(b);
  });
}

function aiPrompt() {
  const m = mp(), list = chosen(), own = $("personal").value.trim();
  const tone = state.tone === "firm" ? "firm and direct, but respectful" : "courteous and constructive";
  return [
    "Write the body of a letter from an Australian voter to their federal MP" + (m.electorate ? " (Member for " + m.electorate + ")" : "") + ", objecting to mandatory online age verification (the social media minimum age rules and the eSafety Age-Restricted Material Codes covering app stores, search engines and other online services).",
    "Open by acknowledging that protecting children from genuinely harmful content is a worthy goal the writer supports. Make the writer's primary objection the poor and inept implementation of these measures — the social media minimum age rules especially — with government overreach that restricts the online freedom of law-abiding adults as a secondary concern.",
    "",
    "Tone: " + tone + ". Australian English. Plain language, first person, 300 to 450 words. Use your own wording and structure rather than a template.",
    "Do not include a greeting, sign-off, name or address. Start straight after \"Dear ...,\" and stop before \"Yours sincerely\".",
    "Only use the facts given below. Do not add statistics, quotes or events that are not listed.",
    "",
    "The writer's concerns:",
    ...list.map(c => "- " + c.title + ": " + fill(c.point, m)),
    own ? "\nIn the writer's own words (keep the substance and keep it personal):\n" + own : "",
    "",
    "End with a short numbered list of requests to the MP, drawn from these:",
    ...asksFor(list).map(a => "- " + a),
    "Finish by asking for a written reply."
  ].filter(x => x !== null).join("\n");
}

function setLinks() {
  const { to, cc } = recipients(), subj = $("subject").value, body = $("letter").value;
  $("toV").textContent = to || "Enter your MP's email in step 2";
  $("ccV").textContent = cc.join(", ") || "None";
  const e = encodeURIComponent;
  $("gmail").href = "https://mail.google.com/mail/?view=cm&fs=1&to=" + e(to) + "&cc=" + e(cc.join(",")) + "&su=" + e(subj) + "&body=" + e(body);
  $("outlook").href = "https://outlook.live.com/mail/0/deeplink/compose?to=" + e(to) + "&cc=" + e(cc.join(",")) + "&subject=" + e(subj) + "&body=" + e(body);
  $("mailto").href = "mailto:" + to + "?cc=" + e(cc.join(",")) + "&subject=" + e(subj) + "&body=" + e(body);
  const p = e(aiPrompt());
  $("toChatGPT").href = "https://chatgpt.com/?q=" + p;
  $("toClaude").href = "https://claude.ai/new?q=" + p;
}

function stats() {
  const t = $("letter").value, w = (t.match(/\S+/g) || []).length;
  $("wordCount").textContent = w + " words";
  const own = $("personal").value.trim().length > 30;
  $("uniq").textContent = state.source === "ai" ? "AI-rewritten" : own ? "Includes your own words" : "Add your own words in step 4";
}

function update() {
  renderMp();
  $("yearsWrap").hidden = !state.selected.has("longstanding");
  if (!state.dirty) $("letter").value = compose();
  $("sourceLabel").textContent = state.source === "ai" ? "Rewritten by AI, checked by you" : "Built from your choices";
  setLinks(); stats();
}

function toast(msg) { $("toast").textContent = msg; clearTimeout(toast.t); toast.t = setTimeout(() => $("toast").textContent = "", 2600); }
async function copy(text, label, fallbackEl) {
  try { await navigator.clipboard.writeText(text); toast(label + " copied."); }
  catch (e) {
    if (fallbackEl) { const s = window.getSelection(), r = document.createRange(); r.selectNodeContents(fallbackEl); s.removeAllRanges(); s.addRange(r); }
    toast("Couldn't copy automatically. The text is selected, so press Ctrl+C or ⌘C.");
  }
}

["name", "email", "street", "suburb", "postcode", "mpName", "mpTitle", "mpElectorate", "mpEmail", "personal", "years", "ccMinister", "ccEsafety"].forEach(id => $(id).addEventListener("input", update));
["ccMinister", "ccEsafety", "mpTitle"].forEach(id => $(id).addEventListener("change", update));
$("subject").addEventListener("input", setLinks);
$("letter").addEventListener("input", () => { state.dirty = true; $("dirtyNote").hidden = false; setLinks(); stats(); });
$("resetEdits").onclick = () => { state.dirty = false; $("dirtyNote").hidden = true; update(); };
$("shuffle").onclick = () => { state.seed = Math.floor(Math.random() * 1e9); state.source = "built"; state.dirty = false; $("dirtyNote").hidden = true; update(); toast("New wording."); };
function setTone(t) { state.tone = t; $("toneFirm").setAttribute("aria-pressed", t === "firm"); $("tonePolite").setAttribute("aria-pressed", t === "polite"); update(); }
$("toneFirm").onclick = () => setTone("firm"); $("tonePolite").onclick = () => setTone("polite");
$("copyPrompt").onclick = () => copy(aiPrompt(), "Prompt");
$("useAi").onclick = () => {
  let b = $("aiPaste").value.trim();
  if (!b) { toast("Paste the AI's draft into the box first."); return; }
  b = b.replace(/^dear[^\n]*\n+/i, "").replace(/\n+(yours sincerely|kind regards|regards|sincerely)[\s\S]*$/i, "").trim();
  state.aiBody = b; state.source = "ai"; state.dirty = false; $("dirtyNote").hidden = true; update(); toast("Using the AI draft.");
};
$("copyLetter").onclick = () => copy($("letter").value, "Letter", $("letter"));
document.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copy($(b.dataset.copy).textContent, b.closest(".addr-row").querySelector(".k").textContent + " addresses", $(b.dataset.copy)));

// Clear a previous split-electorate choice when the address changes.
["suburb", "postcode"].forEach(id => $(id).addEventListener("input", () => { state.chosen = null; }));

// --- Built-in AI writer (path 1) -------------------------------------------------------
// Only the selected concerns, account-age, tone, electorate name and the voter's own
// paragraph are sent. Name, address, suburb, postcode and email never leave the browser.
function failSoftAi() {
  state.source = "built"; state.dirty = false; $("dirtyNote").hidden = true; update();
  toast("The built-in writer isn't available right now — here's a draft from your choices, or use your own AI below.");
}
async function useBuiltinAi() {
  const token = window.turnstile ? window.turnstile.getResponse() : "";
  if (!token) { toast("Please complete the quick check first."); return; }
  const payload = {
    concerns: [...state.selected],
    years: years(),
    tone: state.tone,
    electorate: mp().electorate || "",
    personal: $("personal").value.trim().slice(0, 1000),
    turnstileToken: token,
  };
  toast("Writing your letter…");
  try {
    const r = await fetch("/api/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await r.json();
    if (data && data.ok && data.body) {
      state.aiBody = data.body; state.source = "ai"; state.dirty = false; $("dirtyNote").hidden = true; update();
      toast("Drafted by the built-in writer. Read it over and edit as you like.");
    } else { failSoftAi(); }
  } catch (e) { failSoftAi(); }
  if (window.turnstile) window.turnstile.reset();
}
function initBuiltinAi() {
  if (!TURNSTILE_SITE_KEY) return;                 // feature off until a site key is set
  $("builtinAi").hidden = false;
  $("useBuiltin").onclick = useBuiltinAi;
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  s.async = true; s.defer = true;
  s.onload = () => { try { window.turnstile.render("#turnstile", { sitekey: TURNSTILE_SITE_KEY }); } catch (e) {} };
  document.head.appendChild(s);
}

renderConcerns(); update();          // paint immediately with the built-in fallback data
loadData().then(update);             // then swap in the full data and re-render
initBuiltinAi();                     // reveal the built-in AI writer if a site key is set
