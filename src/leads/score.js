// Оценка потенциального заказчика 0–100: насколько вероятно, что ему нужно видео и что до него можно достучаться.
// Страны не исключаются (решение владельца 19.10.2026). Германия и ЕС помечаются: другой канал связи (см. bestChannel).

export const LEADS_PER_DAY = 10;
export const MIN_LEAD_SCORE = 35;

const RECRUITER = /\b(recruit\w*|staffing|talent|career|headhunt\w*|outsourc\w*|hiring partner|pavago|growthpair|virtual assistant)\b/i;
const CHEAP_ONLY = ['philippines', 'pakistan', 'india', 'indonesia', 'bangladesh', 'nigeria', 'kenya', 'south africa', 'mexico', 'colombia', 'argentina', 'brazil', 'vietnam', 'egypt', 'latam', 'latin america'];
const GOOD_GEO = /\b(united states|usa|us|united kingdom|uk|canada|australia|new zealand|worldwide|anywhere|global)\b/i;
const VIDEO_ROLE = /\b(ugc|video|motion|animat\w*|creative strategist|content creator|tiktok|youtube)\b/i;

export function scoreLead(lead, info) {
  const reasons = [];
  let score = 0;
  const germany = Boolean(info.germany || lead.germany);
  const eu = Boolean(info.eu || lead.eu) && !germany;
  if (lead.signal === 'hiring' && RECRUITER.test(lead.company || '')) return { score: 0, reasons: ['кадровое агентство'], excluded: true };

  if (lead.signal === 'hiring') {
    score += 35; reasons.push('уже платят за видео (вакансия)');
    if (VIDEO_ROLE.test(lead.signalText)) { score += 10; reasons.push('роль про видео/UGC'); }
    const geo = String(lead.country || '').toLowerCase();
    if (!geo || GOOD_GEO.test(geo)) { score += 10; if (geo) reasons.push('США/UK/CA/AU или любая страна'); }
    else if (CHEAP_ONLY.some((c) => geo.includes(c)) && !GOOD_GEO.test(geo)) { score -= 20; reasons.push('ищут местного дешёвого сотрудника'); }
  } else if (lead.signal === 'launch') {
    score += lead.source === 'producthunt' ? 25 : 5; // Show HN — чаще хобби-проекты: наверх только с сильными признаками
    reasons.push(lead.source === 'producthunt' ? 'запуск на Product Hunt' : 'запуск в Show HN');
    if (info.hasVideo === false) { score += 15; reasons.push('на сайте нет видео'); }
    if (info.kind === 'b2c') { score += 15; reasons.push('потребительский продукт → UGC/реклама'); }
    else if (info.kind === 'b2b') { score += 8; reasons.push('B2B/SaaS → эксплейнер/демо'); }
    if (!info.website) { score -= 25; reasons.push('нет сайта'); }
  }

  // До кого можно достучаться.
  if (info.emails?.length) { score += 12; reasons.push('есть почта'); }
  else if (info.contactUrl) { score += 6; reasons.push('есть форма'); }
  else if (info.socials?.x || info.socials?.linkedin) { score += 4; reasons.push('есть X/LinkedIn'); }
  else if (lead.applyUrl) { score += 4; }
  else { score -= 10; reasons.push('нет контактов'); }

  if (['US', 'UK', 'CA', 'AU', 'NZ'].includes(info.country)) { score += 8; reasons.push(info.country); }
  if (germany) reasons.push('Германия');
  else if (eu) reasons.push('ЕС');
  if (lead.postedAt && Date.now() - lead.postedAt > 14 * 86400e3) { score -= 15; reasons.push('старое'); }

  return { score: Math.max(0, Math.min(100, score)), reasons, excluded: false };
}

/** Какой канал предложить. США + почта: по CAN-SPAM в коммерческом письме нужен почтовый адрес отправителя. */
export function bestChannel(lead, info, { hasPostalAddress = false } = {}) {
  if (lead.signal === 'hiring' && lead.applyUrl) return { kind: 'apply', url: lead.applyUrl, label: 'отклик на вакансию' };
  // США: CAN-SPAM требует почтовый адрес отправителя; ЕС: правила рекламных писем зависят от страны →
  // в обоих случаях сначала форма/DM, почта — запасной вариант с пометкой.
  const usEmailBlocked = info.country === 'US' && !hasPostalAddress;
  const germany = Boolean(info.germany || lead.germany);
  const euCaution = Boolean(info.eu || lead.eu) || germany;
  // Германия (UWG §7, владелец живёт в DE — закон применяется напрямую): реклама по почте/через формы без согласия
  // запрещена, риск Abmahnung → только вакансия (обработано выше) или LinkedIn/X.
  if (germany) {
    if (info.socials?.linkedin) return { kind: 'dm', url: info.socials.linkedin, label: 'LinkedIn (Германия: без писем и форм — UWG §7)' };
    if (info.socials?.x) return { kind: 'dm', url: info.socials.x, label: 'сообщение в X (Германия: без писем и форм — UWG §7)' };
    return { kind: 'none', label: 'Германия: писать на почту/в форму без согласия нельзя (UWG §7) — только если сами ищут подрядчика' };
  }
  if (info.emails?.length && !usEmailBlocked && !euCaution) return { kind: 'email', to: info.emails[0], label: `почта ${info.emails[0]}` };
  if (info.contactUrl) return { kind: 'form', url: info.contactUrl, label: 'форма на сайте' };
  if (info.socials?.x) return { kind: 'dm', url: info.socials.x, label: 'сообщение в X' };
  if (info.socials?.linkedin) return { kind: 'dm', url: info.socials.linkedin, label: 'LinkedIn' };
  if (info.emails?.length) return { kind: 'email', to: info.emails[0], label: `почта ${info.emails[0]} (${euCaution ? 'ЕС: проверь правила рекламных писем в стране' : 'США: нужен почтовый адрес в письме'})` };
  return { kind: 'none', label: 'контактов нет' };
}
