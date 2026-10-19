// Черновик отклика. Короткий, по делу, со ссылкой на портфолио и подходящую работу.
// Правила владельца: не упоминать уровень английского и страну проживания; только переписка (без созвонов);
// бесплатный тестовый ролик 5–10 с предлагаем только для сильных заказов.

export const PORTFOLIO = 'https://maksym-lashkevych.lashkevych2004.workers.dev';

// Какую работу показать под направление (названия как на сайте).
const SHOWCASE = {
  ugc: { en: 'ZENFY — an AI UGC ad (hook to camera, product demo, CTA) and Auto insurance — a lead-gen UGC ad', ru: 'ZENFY — ИИ-UGC реклама (хук в камеру, демо продукта, призыв) и Auto insurance — UGC-реклама для лидогенерации', uk: 'ZENFY — ШІ-UGC реклама (хук у камеру, демо продукту, заклик) і Auto insurance — UGC-реклама для лідогенерації' },
  motion: { en: 'Who Polices Countries? — an animated explainer with a consistent character, and Neon City — a character animation', ru: 'Who Polices Countries? — анимированный эксплейнер с постоянным персонажем, и Neon City — анимация персонажа', uk: 'Who Polices Countries? — анімований експлейнер з постійним персонажем, і Neon City — анімація персонажа' },
  edit: { en: 'Cortisol Signal — a 28-second brand film, and Dante’s Inferno — a 14-minute narrated long-form edit', ru: 'Cortisol Signal — 28-секундный бренд-фильм, и Dante’s Inferno — 14-минутный фильм с закадровым текстом', uk: 'Cortisol Signal — 28-секундний бренд-фільм, і Dante’s Inferno — 14-хвилинний фільм із закадровим текстом' },
};

const APPROACH = {
  ugc: { en: 'I’d write 2–3 hooks, generate a consistent AI actor and voice, then edit with captions and music for TikTok/Reels.', ru: 'Напишу 2–3 хука, сделаю постоянного ИИ-актёра и голос, смонтирую с субтитрами и музыкой под TikTok/Reels.', uk: 'Напишу 2–3 хуки, зроблю постійного ШІ-актора і голос, змонтую з субтитрами та музикою під TikTok/Reels.' },
  motion: { en: 'I’d start with a short storyboard so you approve the look before animation, then deliver in the formats you need.', ru: 'Начну с короткой раскадровки, чтобы вы утвердили стиль до анимации, затем сдам в нужных форматах.', uk: 'Почну з короткої розкадровки, щоб ви затвердили стиль до анімації, потім здам у потрібних форматах.' },
  edit: { en: 'I edit in Premiere Pro, DaVinci Resolve or CapCut — whichever matches your project files — with clean pacing, captions and sound.', ru: 'Монтирую в Premiere Pro, DaVinci Resolve или CapCut — под ваши исходники — с хорошим ритмом, субтитрами и звуком.', uk: 'Монтую в Premiere Pro, DaVinci Resolve або CapCut — під ваші вихідники — з гарним ритмом, субтитрами та звуком.' },
};

const QUESTION = {
  ugc: { en: 'Which platform will the ad run on, and do you have a product page or photos I can work from?', ru: 'На какой площадке будет реклама и есть ли страница продукта или фото, от которых отталкиваться?', uk: 'На якій платформі буде реклама і чи є сторінка продукту або фото, від яких відштовхуватися?' },
  motion: { en: 'Do you already have a script or voice-over, or should I prepare one?', ru: 'Есть ли уже сценарий или озвучка, или подготовить мне?', uk: 'Чи є вже сценарій або озвучка, чи підготувати мені?' },
  edit: { en: 'Could you share an example video whose style you like, and how much raw footage there is?', ru: 'Можете прислать пример видео, стиль которого нравится, и сколько исходного материала?', uk: 'Можете надіслати приклад відео, стиль якого подобається, і скільки вихідного матеріалу?' },
};

const L = {
  en: { hi: 'Hi!', read: (t) => `I read your brief “${t}” — this is exactly the kind of work I do.`, examples: 'Relevant examples', portfolio: 'Portfolio', how: 'How I’d approach it', test: 'I can make a free 5–10 second test clip for your project first, so you see the style before you decide.', days: 'First cut in 3–5 days, two revision rounds included.', q: 'Quick question', bye: 'Best,\nMaksym' },
  ru: { hi: 'Здравствуйте!', read: (t) => `Прочитал ваше задание «${t}» — это как раз мой профиль.`, examples: 'Похожие работы', portfolio: 'Портфолио', how: 'Как сделаю', test: 'Могу сначала бесплатно сделать тестовый фрагмент на 5–10 секунд, чтобы вы увидели стиль до решения.', days: 'Первый вариант через 3–5 дней, две правки включены.', q: 'Вопрос', bye: 'С уважением,\nМаксим' },
  uk: { hi: 'Вітаю!', read: (t) => `Прочитав ваше завдання «${t}» — це саме мій профіль.`, examples: 'Схожі роботи', portfolio: 'Портфоліо', how: 'Як зроблю', test: 'Можу спершу безкоштовно зробити тестовий фрагмент на 5–10 секунд, щоб ви побачили стиль до рішення.', days: 'Перший варіант через 3–5 днів, дві правки включені.', q: 'Питання', bye: 'З повагою,\nМаксим' },
};

export function proposalLang(job) {
  if (job.source === 'kwork') return 'ru';
  if (job.source === 'freelancehunt' && !job.foreign) return 'uk';
  return 'en';
}

export function buildProposal(job, { category = 'edit', score = 0 } = {}) {
  const lang = proposalLang(job);
  const t = L[lang];
  const c = SHOWCASE[category] ? category : 'edit';
  const shortTitle = job.title.length > 70 ? `${job.title.slice(0, 67)}…` : job.title;
  return [
    t.hi,
    t.read(shortTitle),
    '',
    `${t.examples}: ${SHOWCASE[c][lang]}.`,
    `${t.portfolio}: ${PORTFOLIO}`,
    '',
    `${t.how}: ${APPROACH[c][lang]}`,
    score >= 65 ? t.test : null,
    t.days,
    '',
    `${t.q}: ${QUESTION[c][lang]}`,
    '',
    t.bye,
  ].filter((x) => x !== null).join('\n');
}
