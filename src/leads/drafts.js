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
- Pick the video format that fits the product: consumer products → UGC-style ad; apps, SaaS, tools → short product demo or explainer.`;

const leadFacts = (lead) => [
  `Company/product: ${lead.company}`,
  lead.desc && `What they do: ${lead.desc}`,
  lead.site_desc && `Website says: ${lead.site_desc}`,
  `Why now: ${lead.signal_text}`,
  lead.has_video === 0 && 'Their website has no video.',
  lead.kind === 'b2c' && 'Consumer product (UGC-style ads fit).',
  lead.kind === 'b2b' && 'B2B / SaaS (explainer or product demo video fits).',
  lead.maker && `Founder/maker name (from launch page): ${lead.maker}`,
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
export async function draftEmail(env, lead, { offerDemo = false } = {}) {
  const hiring = lead.signal === 'hiring';
  const user = `${leadFacts(lead)}

Write a cold email (70–110 words) plus a subject line (max 7 words).
${hiring ? 'They are hiring for this role; offer Maksym as a flexible freelance alternative or extra capacity, without criticising hiring.' : 'They just launched; tie the video idea to launch / ads / onboarding.'}
${offerDemo ? 'Offer to make a free 5–10 second concept clip for their product, no strings attached.' : 'Offer to send 2–3 relevant examples or a quick concept.'}
Include the portfolio link once. End with one easy yes/no question.
Last line exactly: "If it's not relevant, just reply "no" and I won't follow up."
Sign as "Maksym".
Format:
Subject: ...

<email body>`;
  const text = await ai(env, RULES, user, 380);
  if (text && /subject:/i.test(text)) return { text, ai: true };
  return { text: templateEmail(lead, { offerDemo }), ai: false };
}

function templateEmail(lead, { offerDemo }) {
  const hi = firstName(lead.maker) ? `Hi ${firstName(lead.maker)},` : 'Hi there,';
  const hiring = lead.signal === 'hiring';
  const subject = hiring ? `Freelance video help for ${lead.company}` : `A short video for ${lead.company}`;
  const why = hiring
    ? `I saw you're looking for ${lead.signal_text.replace(/^ищут /, '').replace(/ \(.+\)$/, '')}. If a freelancer who can start right away helps in the meantime (or as extra capacity), I'd be glad to.`
    : `I came across ${lead.company}${lead.desc ? ` — ${lead.desc.replace(/\.$/, '')}` : ''}. ${lead.has_video === 0 ? 'I noticed there is no video on the site yet, and' : ''} a 20–30 second ${lead.kind === 'b2c' ? 'UGC-style ad' : 'product explainer'} could show it in seconds.`;
  const offer = offerDemo
    ? 'I can make a free 5–10 second concept clip for your product first, so you can judge the style before anything else.'
    : 'Happy to send 2–3 examples that fit what you do.';
  return [
    `Subject: ${subject}`, '',
    hi, '',
    `${why}`, '',
    `I make AI video ads, product videos and explainers, and edit short-form content. ${offer}`,
    `Portfolio: ${PORTFOLIO}`, '',
    'Would that be useful?', '',
    'Maksym', '',
    'If it\'s not relevant, just reply "no" and I won\'t follow up.',
  ].join('\n');
}

// ---------- Короткое сообщение (DM в X/LinkedIn, форма на сайте, отклик на вакансию) ----------
export async function draftShort(env, lead) {
  const user = `${leadFacts(lead)}

Write a short message (max 55 words) for a website contact form or a direct message to the founder.
One specific observation, one concrete video idea, portfolio link once, end with a light question. Sign "Maksym".`;
  const text = await ai(env, RULES, user, 160);
  if (text) return { text, ai: true };
  return {
    ai: false,
    text: `Hi! I saw ${lead.company}${lead.signal === 'launch' ? ' launch' : ''} — a short ${lead.kind === 'b2c' ? 'UGC-style ad' : 'explainer video'} could show what it does in seconds. I make AI video ads and edit short-form content: ${PORTFOLIO}. Want me to sketch a 5-second concept for you? — Maksym`,
  };
}

// ---------- Идея бесплатного демо ----------
export async function draftDemo(env, lead) {
  const user = `${leadFacts(lead)}

Propose ONE free 5–10 second concept clip Maksym can make to win this client.
Answer in this exact format:
CONCEPT (in Russian, 2–3 sentences, for Maksym): ...
PROMPT (in English, for Kling / Veo / Sora, one paragraph: subject, action, camera, lighting, style, 9:16): ...
HOOK TEXT (in English, on-screen, max 8 words): ...`;
  const text = await ai(env, 'You are a creative director for short AI video ads. Be concrete and visual. No markdown.', user, 320);
  if (text) return { text, ai: true };
  return {
    ai: false,
    text: `CONCEPT: 5-секундный ролик: ${lead.company} в действии — крупный план продукта или экрана, одно действие пользователя и результат.\nPROMPT: Close-up of a person using ${lead.company} on a phone, natural daylight, handheld UGC style, quick reveal of the result, 9:16, realistic.\nHOOK TEXT: Meet ${lead.company} in 5 seconds`,
  };
}

// ---------- Напоминание через 4 дня ----------
export function followUpText(lead) {
  return `Hi again — just bumping this in case it got buried. Still happy to make a free short concept clip for ${lead.company}, or send a couple of examples. If not relevant, no worries at all.\n\nMaksym`;
}
