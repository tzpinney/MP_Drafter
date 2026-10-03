// Cloudflare Pages Function: POST /api/draft
//
// Writes the BODY of a constituent letter with Workers AI. This is "path 1" of three —
// it is progressive enhancement over the phrase-bank letter the page already builds, so
// it fails soft: on any problem it returns { ok:false, reason } and the page shows the
// phrase-bank draft plus the ChatGPT/Claude hand-off buttons. It never returns a raw error.
//
// Privacy (the site's whole argument):
//   - The client sends ONLY: concern IDs, account-age number, tone, electorate name, and
//     the voter's own paragraph. No name, address, suburb, postcode or email is accepted
//     or used. The browser adds the greeting, signature and address afterwards.
//   - This function must not log request bodies.
//
// Config (set at deploy time in the Cloudflare dashboard — never commit secrets):
//   - Binding  AI               Workers AI (Free plan)
//   - Variable TURNSTILE_SECRET Cloudflare Turnstile secret key (server-side verify)
// The matching Turnstile *site* key goes in index.html (TURNSTILE_SITE_KEY).

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

// Concern facts, mirrored from index.html's CONCERNS (the `point` and `ask` fields).
// Keep in sync with index.html. The wording is checked against current law — do not
// edit without checking with Tom. The model is told to use ONLY these facts.
const CONCERNS = {
  adult: {
    title: "I'm already a verified adult",
    point: "My phone plan, payment methods and the accounts that run my devices are held in my name under contracts that require me to be 18 or older. I have already proved my age to these same companies.",
    ask: "Make it a legal requirement, across both the social media rules and the Age-Restricted Material Codes, that services accept existing evidence of adulthood (contracts, payment details, long-standing accounts) before asking anyone for a face scan or ID. Today this is optional regulator guidance, not a right.",
  },
  longstanding: {
    title: "My accounts are decades old",
    point: "Many of my accounts are about {years} years old. An account that old is itself proof its holder is an adult. Making me scan my face or upload ID for it is excessive, unsafe and ineffective: it re-proves something already proven, and creates a second key to the same gate that adds no security but does add a new store of sensitive data that can be breached. A net negative.",
    ask: "Make it a legal requirement, across both the social media rules and the Age-Restricted Material Codes, that services accept existing evidence of adulthood (contracts, payment details, long-standing accounts) before asking anyone for a face scan or ID. Today this is optional regulator guidance, not a right.",
  },
  breaches: {
    title: "My data won't be kept safe",
    point: "Government agencies have a record of failing to protect personal data and botching technology rollouts (2014 immigration detention data release, 2016 Census outage, Robodebt). Optus and Medibank breaches show the same on the industry side. In 2025, ID documents submitted to Discord for age checks were exposed through a third-party provider.",
    ask: "Extend the data-use and destruction limits that already apply to social media age checks to the Age-Restricted Material Codes, which rely only on general privacy law, and make sure the statutory review of the social media age rules also covers the codes and takes public submissions.",
  },
  offshore: {
    title: "My data goes to foreign companies",
    point: "The rules effectively require Australians to share sensitive personal and biometric information with foreign corporations and the overseas age assurance vendors they contract, with little control or recourse.",
    ask: "Require that any age assurance data be processed and held in Australia under Australian law, or not collected at all.",
  },
  biometrics: {
    title: "Face scans are too much",
    point: "Facial age estimation means handing biometric data to companies. A leaked password can be changed; a leaked face scan cannot.",
    ask: "Give face scans the same protection the law already gives government ID: no one should be required to use one, and a non-biometric alternative must always be offered.",
  },
  home: {
    title: "Government in my home",
    point: "What an adult does on their own devices is their own business. It should not be gated behind onerous identity verification, invasive facial scans, or guidelines so loose that people are effectively pushed to apply for a credit card they never previously had — just to prove their age — let alone a system that lets authorities examine everything a person does online. Parents already have tools to supervise children; responsibility should rest with families, supported by education and enforcement against genuinely harmful operators.",
    ask: "Oppose any further expansion of age verification, and rely on the parental controls device makers are already required to provide, rather than checks on every adult.",
  },
  accountability: {
    title: "An unelected regulator",
    point: "The eSafety Commissioner is unelected yet shapes how every adult uses the internet. Citizens have no say in the Commission's mandate and no practical way to challenge decisions short of costly litigation. Courts have found against the Commissioner more than once.",
    ask: "Make the industry codes subject to disallowance by Parliament, as industry standards already are; establish a standing parliamentary committee to oversee eSafety with formal public input; and broaden the grounds for removing a Commissioner, which are currently limited to misbehaviour or incapacity.",
  },
  anonymity: {
    title: "Privacy and anonymity",
    point: "Tying identity to online activity has a chilling effect on lawful speech and harms people who depend on privacy, such as people escaping violence, whistleblowers and people seeking sensitive health information.",
    ask: "Protect adults' ability to use the internet anonymously and lawfully, and say so in law.",
  },
  effectiveness: {
    title: "It won't work",
    point: "These rules get in the way of adults doing nothing wrong, yet anyone who actually wants to evade them can do so trivially — a VPN, a borrowed account, or simply going around the official services. In practice the current implementation pushes people towards VPNs, piracy and other evasive behaviour. It does not fix the harms the scheme was meant to address; it creates new ones, by making the right way too hard and the wrong way easy and attractive. The burden falls on the compliant, while the determined are barely slowed.",
    ask: "Require independent, published evidence that age verification actually reduces harm to children before it is expanded any further.",
  },
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const sanitizeElectorate = s => String(s || "").replace(/[^A-Za-z .'()-]/g, "").slice(0, 40).trim();
const uniq = a => [...new Set(a)];

async function verifyTurnstile(token, secret, ip) {
  if (!secret) return false;                 // no secret configured -> treat as not verified
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const out = await r.json();
    return out.success === true;
  } catch {
    return false;
  }
}

function buildPrompt({ ids, tone, years, electorate, personal }) {
  const fill = s => s.replace(/\{years\}/g, String(years));
  const list = ids.map(id => CONCERNS[id]);
  const toneLine = tone === "polite" ? "courteous and constructive" : "firm and direct, but respectful";
  const asks = uniq(list.map(c => c.ask));
  const lines = [
    `Write the body of a letter from an Australian voter to their federal MP${electorate ? ` (Member for ${electorate})` : ""}, objecting to mandatory online age verification (the social media minimum age rules and the eSafety Age-Restricted Material Codes covering app stores, search engines and other online services).`,
    "Open by acknowledging that protecting children from genuinely harmful content is a worthy goal the writer supports. Make the writer's primary objection the poor and inept implementation of these measures — the social media minimum age rules especially — with government overreach that restricts the online freedom of law-abiding adults as a secondary concern.",
    "",
    `Tone: ${toneLine}. Australian English. Plain language, first person, 300 to 450 words. Use your own wording and structure rather than a template.`,
    `Do not include a greeting, sign-off, name or address. Start straight after "Dear ...," and stop before "Yours sincerely".`,
    "Only use the facts given below. Do not add statistics, quotes or events that are not listed.",
    "",
    "The writer's concerns:",
    ...list.map(c => `- ${c.title}: ${fill(c.point)}`),
  ];
  if (personal) lines.push("", "In the writer's own words (keep the substance and keep it personal):", personal);
  lines.push("", "End with a short numbered list of requests to the MP, drawn from these:", ...asks.map(a => `- ${a}`), "Finish by asking for a written reply.");
  return lines.join("\n");
}

// Mirror of index.html's useAi() cleanup: strip any greeting or sign-off the model adds.
function stripGreetingSignoff(text) {
  return text
    .replace(/^\s*dear[^\n]*\n+/i, "")
    .replace(/\n+(yours sincerely|yours faithfully|kind regards|regards|sincerely)[\s\S]*$/i, "")
    .trim();
}

export async function onRequestPost({ request, env }) {
  let data;
  try { data = await request.json(); } catch { return json({ ok: false, reason: "bad-request" }, 400); }

  const verified = await verifyTurnstile(data.turnstileToken, env.TURNSTILE_SECRET, request.headers.get("CF-Connecting-IP"));
  if (!verified) return json({ ok: false, reason: "turnstile" });

  const ids = Array.isArray(data.concerns) ? uniq(data.concerns.filter(id => CONCERNS[id])) : [];
  if (!ids.length) return json({ ok: false, reason: "no-concerns" });

  const prompt = buildPrompt({
    ids,
    tone: data.tone === "polite" ? "polite" : "firm",
    years: Math.max(1, Math.min(100, parseInt(data.years, 10) || 20)),
    electorate: sanitizeElectorate(data.electorate),
    personal: String(data.personal || "").slice(0, 1000).trim(),
  });

  if (!env.AI) return json({ ok: false, reason: "ai-unavailable" });
  try {
    const out = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: "You are helping an Australian voter write to their federal MP. Write only the letter body in Australian English. Use only the facts the user provides; invent no statistics, cases or events. Output the body text with no greeting and no sign-off." },
        { role: "user", content: prompt },
      ],
    });
    const body = stripGreetingSignoff(String((out && (out.response ?? out.result)) || "").trim());
    if (!body) return json({ ok: false, reason: "empty" });
    return json({ ok: true, body });
  } catch {
    return json({ ok: false, reason: "ai-unavailable" });
  }
}
