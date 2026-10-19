// Черновики для заказчиков: письмо, короткое сообщение (DM/форма), идея бесплатного демо-ролика.
// Пишет Workers AI (бесплатный лимит аккаунта), при ошибке — шаблон. Отправляет всегда владелец.
// Правила владельца: не упоминать страну и уровень английского, без созвонов, без выдуманных клиентов и цифр.
import { PORTFOLIO } from '../proposal.js';

export const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const RULES = `You write short cold outreach for Maksym, a freelance AI video creator and video editor
(AI UGC-style ads, product videos, explainers, motion design, short-form editing in Premiere Pro / DaVinci Resolve / CapCut).
Portfolio: ${PORTFOLIO}
Strict rules:
- Plain text, no markdown, no emojis, no placeholders like [Name].
- Never mention where Maksym lives or any country, and never mention language skills.
- Communication is async by text/email only: never suggest calls, meetings or Calendly.
- Never invent past clients, results, numbers or testimonials.
- Make exactly one specific observation about THEIR product, based only on the facts given.
- Propose one concrete video idea for them.
- Sound like a person, not a marketer. Short sentences. Proofread: correct grammar and articles.
- Start with "Hi <first name>," if a founder/maker name is given, otherwise "Hi there,".
- Pick the video format that fits the product: consumer products → UGC-style ad; apps, SaaS, tools → short product demo or explainer.
- Never offer free work. Offer ONE small paid pilot with a clear scope: e.g. one new hook or cutdown from their existing footage
  for $25–45, one 15–30 s AI-presenter ad starting at $79, or one 10–20 s app promo from their screenshots for $59–99.
- If you mention an AI presenter, say plainly that the presenter is AI-generated (synthetic) and that product claims come only
  from their approved material. Never imply a real customer or testimonial.
- Name ONE closest portfolio example by its title (given below) instead of describing everything.`;

// Агентство / студия / медиабайер → предлагаем white-label субподряд (исследование, раздел 13).
export const isAgency = (lead) => /\b(agency|studio|studios|media|creative|marketing|ads|ugc|content|production|growth|performance)\b/i
  .test(`${lead.company} ${lead.signal_text || ''} ${lead.descr || ''}`.slice(0, 600));

const sampleFor = (lead) => (lead.kind === 'b2b' || /app|saas|software|platform/i.test(`${lead.descr} ${lead.site_desc}`)
  ? 'The Viral App (app ad with presenter + phone UI) or Talkseek (11 s AI-presenter app clip)'
  : 'ZENFY (presenter-led ad with product inserts) or Talkseek (11 s AI-presenter clip)');

const leadFacts = (lead) => [
  `Company/product: ${lead.company}`,
  lead.desc && `What they do: ${lead.desc}`,
  lead.site_desc && `Website says: ${lead.site_desc}`,
  `Why now: ${lead.signal_text}`,
  lead.has_video === 0 && 'Their website has no video.',
  lead.kind === 'b2c' && 'Consumer product (UGC-style ads fit).',
  lead.kind === 'b2b' && 'B2B / SaaS (explainer or product demo video fits).',
  lead.maker && `Founder/maker name (from launch page): ${lead.maker}`,
  isAgency(lead) && 'This looks like an agency/studio: offer white-label overflow capacity for their clients, written approvals only.',
  `Closest portfolio examples to name: ${sampleFor(lead)}. Direct links: ${PORTFOLIO}/#talkseek-ugc, ${PORTFOLIO}/#viral-app-ugc, ${PORTFOLIO}/#zenfy-ugc`,
].filter(Boolean).join('\n');

async function ai(env, system, user, maxTokens = 350) {
  if (!env.AI) return null;
  try {
    const r = await env.AI.run(AI_MODEL, { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.6 });
    const text = String(r?.response || '').trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\*\*/g, '');
    return text.length > 40 ? text : null;
  } catch (err) {
    console.log('ai failed', err.message);
    return null;
  }
}

const firstName = (maker) => {
  const n = String(maker || '').trim().split(/\s+/)[0];
  return /^[A-Za-z][a-z'-]{1,20}$/.test(n) ? n : null;
};

// ---------- Письмо ----------
export async function draftEmail(env, lead) {
  const hiring = lead.signal === 'hiring';
  const agency = isAgency(lead);
  const user = `${leadFacts(lead)}

Write a cold email (70–110 words) plus a subject line (max 7 words).
${agency ? 'They are an agency/studio: offer one white-label paid pilot as overflow capacity; they keep the client relationship.'
    : hiring ? 'They are hiring for this role; offer Maksym as a flexible freelance alternative or extra capacity, without criticising hiring.'
      : 'They just launched; tie the video idea to launch / ads / onboarding.'}
Offer one small paid pilot with a clear scope and price (see rules). Include one direct portfolio link. End with one easy question about whether they are commissioning this format now.
Last line exactly: "If it's not relevant, just reply "no" and I won't follow up."
Sign as "Maksym".
Format:
Subject: ...

<email body>`;
  const text = await ai(env, RULES, user, 380);
  if (text && /subject:/i.test(text)) return { text, ai: true };
  return { text: templateEmail(lead), ai: false };
}

function templateEmail(lead) {
  const hi = firstName(lead.maker) ? `Hi ${firstName(lead.maker)},` : 'Hi there,';
  const hiring = lead.signal === 'hiring';
  const agency = isAgency(lead);
  const subject = agency ? `Paid app-ad pilot for ${lead.company}` : hiring ? `Freelance video help for ${lead.company}` : `A short video for ${lead.company}`;
  const why = agency
    ? `I create short AI-presenter ads and app promos, and could take one approved brief as white-label overflow capacity — you keep the client relationship and approvals stay in writing.`
    : hiring
      ? `I saw you're looking for ${lead.signal_text.replace(/^ищут /, '').replace(/ \(.+\)$/, '')}. If a freelancer who can take a defined piece of work helps in the meantime (or as extra capacity), I'd be glad to.`
      : `I came across ${lead.company}${lead.desc ? ` — ${lead.desc.replace(/\.$/, '')}` : ''}. A short ${lead.kind === 'b2c' ? 'UGC-style ad' : 'product demo'} could show it in seconds.`;
  return [
    `Subject: ${subject}`, '',
    hi, '',
    why, '',
    `The closest example is Talkseek — an 11-second AI-presenter app clip: ${PORTFOLIO}/#talkseek-ugc (the presenter is AI-generated; product claims come only from your approved material).`,
    'As a first step I can do one paid pilot: a 15–30 second vertical ad starting at $79, or one new hook/cutdown from your existing footage for $25–45. First cut in 3–5 working days after approval.', '',
    'Are you commissioning this format at the moment?', '',
    'Maksym', '',
    'If it\'s not relevant, just reply "no" and I won\'t follow up.',
  ].join('\n');
}

// ---------- Короткое сообщение (DM в X/LinkedIn, форма на сайте, отклик на вакансию) ----------
export async function draftShort(env, lead) {
  const user = `${leadFacts(lead)}

Write a short message (max 55 words) for a website contact form or a direct message to the founder.
One specific observation, one concrete video idea, one direct portfolio link, mention a small paid pilot (no free work), end with a light question. Sign "Maksym".`;
  const text = await ai(env, RULES, user, 160);
  if (text) return { text, ai: true };
  return {
    ai: false,
    text: `Hi! I saw ${lead.company}${lead.signal === 'launch' ? ' launch' : ''} — a short ${lead.kind === 'b2c' ? 'UGC-style ad' : 'product demo'} could show what it does in seconds. Closest example: ${PORTFOLIO}/#talkseek-ugc. I can start with one small paid pilot (one 15–30 s ad from $79, or a new hook from existing footage from $25). Commissioning anything like this now? — Maksym`,
  };
}

// ---------- Идея бесплатного демо ----------
export async function draftDemo(env, lead) {
  const user = `${leadFacts(lead)}

Propose ONE concrete video variation idea Maksym can DESCRIBE in his email (he will NOT produce it for free).
Answer in this exact format:
CONCEPT (in Russian, 2–3 sentences, for Maksym): ...
PROMPT (in English, for Kling / Veo / Sora, one paragraph: subject, action, camera, lighting, style, 9:16): ...
HOOK TEXT (in English, on-screen, max 8 words): ...`;
  const text = await ai(env, 'You are a creative director for short AI video ads. Be concrete and visual. No markdown.', user, 320);
  if (text) return { text, ai: true };
  return {
    ai: false,
    text: `CONCEPT: идея для письма (не делать бесплатно): ${lead.company} в действии — крупный план продукта или экрана, одно действие пользователя и результат.\nPROMPT: Close-up of a person using ${lead.company} on a phone, natural daylight, handheld UGC style, quick reveal of the result, 9:16, realistic.\nHOOK TEXT: Meet ${lead.company} in 5 seconds`,
  };
}

// ---------- Напоминание через 4 дня ----------
export function followUpText(lead) {
  return `Hi again — just bumping this in case it got buried. If a small paid pilot (one short ad or a new hook from existing footage) would be useful for ${lead.company}, I can send a fixed quote. If not relevant, no worries at all.\n\nMaksym`;
}
