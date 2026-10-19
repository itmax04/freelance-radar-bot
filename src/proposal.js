// Черновик отклика — по исследованию «The first three paid freelance projects» (19.10.2026), раздел 19–21:
// одна ближайшая работа (по названию, с меткой «заказ/концепт» и прямой ссылкой), одно производственное решение,
// небольшой ОПЛАЧЕННЫЙ пилот с точным объёмом, один вопрос по объёму, ясное закрытие. Без списка инструментов,
// без «работаю за любую цену», без гарантий результата, без бесплатного тестового ролика.
// Правила владельца: не упоминать страну проживания и уровень английского; только переписка, без созвонов.

export const PORTFOLIO = 'https://maksym-lashkevych.lashkevych2004.workers.dev';

// Работы портфолио. commissioned — по словам владельца (19.10.2026): ZENFY, Talkseek, The Viral App, Cortisol Signal.
export const WORKS = {
  talkseek: { slug: 'talkseek-ugc', name: 'Talkseek', commissioned: true,
    en: 'a compact AI-presenter clip with an App Store end card', ru: 'короткий ролик с ИИ-ведущим и заставкой App Store', uk: 'короткий ролик з ШІ-ведучим і заставкою App Store' },
  zenfy: { slug: 'zenfy-ugc', name: 'ZENFY', commissioned: true,
    en: 'a presenter-led ad with product inserts and a CTA', ru: 'реклама с ведущим, вставками продукта и призывом', uk: 'реклама з ведучим, вставками продукту і закликом' },
  viral: { slug: 'viral-app-ugc', name: 'The Viral App', commissioned: true,
    en: 'a presenter + phone-interface app ad', ru: 'реклама приложения: ведущий + интерфейс на телефоне', uk: 'реклама застосунку: ведучий + інтерфейс на телефоні' },
  cortisol: { slug: 'cortisol-signal', name: 'Cortisol Signal', commissioned: true,
    en: 'a cinematic 28-second brand teaser', ru: 'кинематографичный 28-секундный бренд-тизер', uk: 'кінематографічний 28-секундний бренд-тизер' },
  world: { slug: 'world-in-your-pocket', name: 'The World in Your Pocket', commissioned: false,
    en: 'an app visual concept with a download ending', ru: 'визуальный концепт приложения с концовкой «скачать»', uk: 'візуальний концепт застосунку з кінцівкою «завантажити»' },
  explainer: { slug: 'who-polices-countries', name: 'Who Polices Countries?', commissioned: false,
    en: 'a short explainer with one consistent character', ru: 'короткий эксплейнер с постоянным персонажем', uk: 'короткий експлейнер з постійним персонажем' },
  home: { slug: 'home-renovation', name: 'Home renovation', commissioned: false,
    en: 'a room-transformation concept ad', ru: 'концепт-реклама с преображением комнаты', uk: 'концепт-реклама з перетворенням кімнати' },
};

const workLink = (w) => `${PORTFOLIO}/#${w.slug}`;
const label = (w, lang) => (w.commissioned
  ? { en: 'commissioned project', ru: 'заказ клиента', uk: 'замовлення клієнта' }
  : { en: 'independent concept', ru: 'собственный концепт', uk: 'власний концепт' })[lang];

// Пилоты по исследованию (раздел 05): цена «от» и точный объём.
const PILOTS = {
  hook: { usd: [25, 45], en: 'one new hook or cutdown from your approved footage (or two simple opening variants), one minor revision', ru: 'один новый хук или перемонтаж из ваших утверждённых материалов (или два варианта начала), одна мелкая правка', uk: 'один новий хук або перемонтаж з ваших затверджених матеріалів (або два варіанти початку), одна дрібна правка' },
  presenter: { usd: [79], en: 'one 15–30 second vertical ad: one AI presenter, approved script, up to three simple scenes, captions and CTA, two minor revision rounds', ru: 'один вертикальный ролик 15–30 с: один ИИ-ведущий, утверждённый сценарий, до трёх простых сцен, субтитры и призыв, два круга мелких правок', uk: 'один вертикальний ролик 15–30 с: один ШІ-ведучий, затверджений сценарій, до трьох простих сцен, субтитри й заклик, два кола дрібних правок' },
  app: { usd: [59, 99], en: 'one 10–20 second app promo from your screenshots or screen recording, real interface kept intact, captions and end card', ru: 'одно промо приложения на 10–20 с из ваших скриншотов или записи экрана, настоящий интерфейс без изменений, субтитры и заставка', uk: 'одне промо застосунку на 10–20 с з ваших скриншотів або запису екрана, справжній інтерфейс без змін, субтитри й заставка' },
  ai: { usd: [79], en: 'one 15–30 second AI video from an approved script, limited scenes, two minor revision rounds', ru: 'один ИИ-ролик 15–30 с по утверждённому сценарию, ограниченное число сцен, два круга мелких правок', uk: 'один ШІ-ролик 15–30 с за затвердженим сценарієм, обмежена кількість сцен, два кола дрібних правок' },
  explainer: { usd: [60, 120], en: 'one 15–30 second explainer sequence from an approved script, one style, limited characters', ru: 'один фрагмент-эксплейнер на 15–30 с по утверждённому сценарию, один стиль, ограниченное число персонажей', uk: 'один фрагмент-експлейнер на 15–30 с за затвердженим сценарієм, один стиль, обмежена кількість персонажів' },
  product: { usd: [59], en: 'one 10–15 second product visual from your photos, logo and packaging kept exact', ru: 'один ролик о продукте на 10–15 с из ваших фото, логотип и упаковка без искажений', uk: 'один ролик про продукт на 10–15 с з ваших фото, логотип і упаковка без спотворень' },
  edit: { usd: [35], en: 'one short edit from your footage (pacing, captions, sound), one minor revision', ru: 'один короткий монтаж из ваших исходников (ритм, субтитры, звук), одна мелкая правка', uk: 'один короткий монтаж з ваших вихідників (ритм, субтитри, звук), одна дрібна правка' },
};

// Одно производственное решение — показывает подход, а не энтузиазм (исследование, раздел 08).
const DECISION = {
  hook: { en: 'I would keep your approved footage and claims, and change only the first 2–3 seconds and the on-screen hook.', ru: 'Я оставлю ваши утверждённые кадры и формулировки и поменяю только первые 2–3 секунды и текст-хук.', uk: 'Я залишу ваші затверджені кадри й формулювання і зміню лише перші 2–3 секунди та текст-хук.' },
  presenter: { en: 'I would keep your real product and claims from your materials, and generate only the presenter and background.', ru: 'Продукт и утверждения возьму из ваших материалов как есть, а сгенерирую только ведущего и фон.', uk: 'Продукт і твердження візьму з ваших матеріалів як є, а згенерую лише ведучого і фон.' },
  app: { en: 'I would keep the real app interface intact and generate only the surrounding scene, so nothing in the product is invented.', ru: 'Интерфейс приложения оставлю настоящим, а сгенерирую только окружение — ничего в продукте не будет выдуманным.', uk: 'Інтерфейс застосунку залишу справжнім, а згенерую лише оточення — нічого в продукті не буде вигаданим.' },
  ai: { en: 'I would lock the look on a short storyboard first, so generation matches what you approved.', ru: 'Сначала зафиксирую стиль в короткой раскадровке, чтобы генерация совпала с утверждённым.', uk: 'Спершу зафіксую стиль у короткій розкадровці, щоб генерація збіглася з затвердженим.' },
  explainer: { en: 'I would agree the script and one visual style before animating, so revisions stay small.', ru: 'Согласуем сценарий и один визуальный стиль до анимации — тогда правки останутся небольшими.', uk: 'Погодимо сценарій і один візуальний стиль до анімації — тоді правки будуть невеликими.' },
  product: { en: 'I would keep your logo and packaging as exact overlays, and animate only the scene around the product.', ru: 'Логотип и упаковку оставлю точными наложениями, анимирую только сцену вокруг продукта.', uk: 'Логотип і упаковку залишу точними накладаннями, анімую лише сцену навколо продукту.' },
  edit: { en: 'I would cut for a strong first second and readable captions, keeping your brand look.', ru: 'Смонтирую с сильной первой секундой и читаемыми субтитрами, сохранив ваш фирменный вид.', uk: 'Змонтую з сильною першою секундою і читабельними субтитрами, зберігши ваш фірмовий вигляд.' },
};

// Один вопрос, который меняет цену/объём.
const QUESTION = {
  hook: { en: 'Can you share the current ad and the footage I can reuse?', ru: 'Пришлёте текущий ролик и исходники, которые можно использовать?', uk: 'Надішлете поточний ролик і вихідники, які можна використати?' },
  presenter: { en: 'Is the script supplied, and how long should the first video be?', ru: 'Сценарий уже есть, и какой длины должен быть первый ролик?', uk: 'Сценарій уже є, і якої довжини має бути перший ролик?' },
  app: { en: 'Should the video show one feature or introduce the app as a whole?', ru: 'Ролик должен показать одну функцию или приложение целиком?', uk: 'Ролик має показати одну функцію чи застосунок загалом?' },
  ai: { en: 'How many scenes and what duration do you need for the first video?', ru: 'Сколько сцен и какой длительности нужен первый ролик?', uk: 'Скільки сцен і якої тривалості потрібен перший ролик?' },
  explainer: { en: 'Do you already have the script or voice-over?', ru: 'Сценарий или озвучка уже есть?', uk: 'Сценарій або озвучка вже є?' },
  product: { en: 'How many product photos do you have, and which placement is it for?', ru: 'Сколько есть фото продукта и для какой площадки ролик?', uk: 'Скільки є фото продукту і для якого майданчика ролик?' },
  edit: { en: 'How much raw footage is there, and do you have a reference you like?', ru: 'Сколько исходного материала и есть ли пример, который нравится?', uk: 'Скільки вихідного матеріалу і чи є приклад, який подобається?' },
};

/** Ближайшая работа под заказ (раздел 03–04 исследования). */
export function pickWork(category, job) {
  const t = `${job.title} ${job.desc || ''}`.toLowerCase();
  if (category === 'presenter') {
    const sec = t.match(/(\d{1,2})\s?(?:s\b|sec|second|сек|с\b)/);
    return sec && Number(sec[1]) <= 15 ? WORKS.talkseek : WORKS.zenfy;
  }
  if (category === 'hook') return WORKS.zenfy;
  if (category === 'app') return /presenter|ugc|creator|talking/.test(t) ? WORKS.viral : WORKS.world;
  if (category === 'explainer') return WORKS.explainer;
  if (category === 'product') return /home|interior|renovat|real estate|ремонт|інтер'?єр|интерьер/.test(t) ? WORKS.home : WORKS.world;
  if (/brand|teaser|cinematic|film|бренд|тизер/.test(t)) return WORKS.cortisol;
  return category === 'ai' ? WORKS.zenfy : WORKS.viral;
}

export function proposalLang(job) {
  if (job.source === 'kwork') return 'ru';
  if (['freelancehunt', 'telegram'].includes(job.source)) {
    const t = `${job.title} ${job.desc || ''}`;
    if (/[іїєґ]/i.test(t)) return 'uk';
    if (/[а-яё]/i.test(t)) return 'ru';
  }
  return 'en';
}

/** «— for $25–45» / «— starting at $79» / «— за 2450–4100 грн (≈ $59–99)» / «— від 3300 грн (≈ $79)». */
function priceText(usd, lang, rates) {
  const range = usd.length > 1 ? `$${usd[0]}–${usd[1]}` : `$${usd[0]}`;
  const single = usd.length === 1;
  if (lang !== 'en' && rates?.USD) {
    const uah = usd.map((x) => Math.round((x * rates.USD) / 50) * 50).join('–');
    const pre = single ? { ru: 'от', uk: 'від' }[lang] : 'за';
    return `${pre} ${uah} грн (≈ ${range})`;
  }
  if (lang === 'en') return single ? `starting at ${range}` : `for ${range}`;
  return `${single ? { ru: 'от', uk: 'від' }[lang] : 'за'} ${range}`;
}

const PLATFORM_LINE = {
  freelancehunt: { en: 'We can set it up here through Safe.', ru: 'Можем оформить здесь через «Безопасную сделку».', uk: 'Можемо оформити тут через «Безпечну угоду».' },
  freelancer: { en: 'The first deliverable can be covered by a funded milestone here.', ru: 'Первую часть можно оформить как оплаченный этап здесь.', uk: 'Першу частину можна оформити як оплачений етап тут.' },
  peopleperhour: { en: 'We can keep the brief and feedback in this WorkStream.', ru: 'Бриф и правки можем вести здесь.', uk: 'Бриф і правки можемо вести тут.' },
  twine: { en: 'We can keep the agreement and payment here on Twine.', ru: 'Договорённость и оплату можем вести здесь.', uk: 'Домовленість і оплату можемо вести тут.' },
  telegram: { en: 'Is this a project-based assignment, and is the first task paid? Please share the brand, reference and payment terms.', ru: 'Это проектная работа и первое задание оплачивается? Пришлите, пожалуйста, бренд, референс и условия оплаты.', uk: 'Це проєктна робота і перше завдання оплачується? Надішліть, будь ласка, бренд, референс і умови оплати.' },
  reddit: { en: 'Would you consider one paid pilot before agreeing ongoing volume? Please send the reference, required scenes and budget for that first video.', ru: '', uk: '' },
};

const L = {
  en: { hi: 'Hi!', matches: (t) => `Your request for “${t}” matches my work.`, closest: 'Closest example', suggest: 'For a first project I suggest', at: 'for', time: 'First cut in 3–5 working days after the script and assets are approved.', written: 'I work through written briefs, approvals and timestamped feedback.', bye: 'Maksym' },
  ru: { hi: 'Здравствуйте!', matches: (t) => `Ваш запрос «${t}» совпадает с тем, что я делаю.`, closest: 'Ближайший пример', suggest: 'Для начала предлагаю', at: 'за', time: 'Первый вариант — через 3–5 рабочих дней после утверждения сценария и материалов.', written: 'Работаю через письменный бриф, согласования и правки с таймкодами.', bye: 'Максим' },
  uk: { hi: 'Вітаю!', matches: (t) => `Ваш запит «${t}» збігається з тим, що я роблю.`, closest: 'Найближчий приклад', suggest: 'Для початку пропоную', at: 'за', time: 'Перший варіант — через 3–5 робочих днів після затвердження сценарію та матеріалів.', written: 'Працюю через письмовий бриф, погодження і правки з таймкодами.', bye: 'Максим' },
};

export function buildProposal(job, { category = 'edit', rates = null } = {}) {
  const lang = proposalLang(job);
  const t = L[lang];
  const c = PILOTS[category] ? category : 'edit';
  const w = pickWork(c, job);
  const shortTitle = job.title.length > 70 ? `${job.title.slice(0, 67)}…` : job.title;
  const platform = PLATFORM_LINE[job.source]?.[lang] || '';
  const isTg = job.source === 'telegram' || job.source === 'reddit';
  return [
    t.hi,
    t.matches(shortTitle),
    `${t.closest}: ${w.name} (${label(w, lang)}) — ${w[lang]}: ${workLink(w)}`,
    '',
    DECISION[c][lang],
    `${t.suggest} ${PILOTS[c][lang]} — ${priceText(PILOTS[c].usd, lang, rates)}. ${t.time}`,
    '',
    isTg ? t.written : `${t.written} ${QUESTION[c][lang]}`,
    platform || null,
    '',
    t.bye,
  ].filter((x) => x !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
