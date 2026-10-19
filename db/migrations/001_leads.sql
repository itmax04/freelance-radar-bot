-- Потенциальные заказчики (поиск клиентов). Применить:
--   npx wrangler d1 execute freelance-radar-bot --remote --file db/migrations/001_leads.sql
CREATE TABLE IF NOT EXISTS leads (
  n            INTEGER PRIMARY KEY AUTOINCREMENT, -- короткий id для кнопок Telegram (лимит 64 байта)
  id           TEXT NOT NULL UNIQUE,              -- '<источник>:<id>', напр. 'ph:tori-3'
  source       TEXT NOT NULL,                     -- producthunt | showhn | himalayas | remoteok
  company      TEXT NOT NULL,
  company_key  TEXT NOT NULL,                     -- для дублей: домен сайта или название в нижнем регистре
  website      TEXT,
  page_url     TEXT,
  apply_url    TEXT,
  signal       TEXT NOT NULL,                     -- launch | hiring | ads
  signal_text  TEXT,
  descr        TEXT,
  maker        TEXT,
  posted_at    INTEGER,
  emails       TEXT,                              -- публичные адреса с сайта, через запятую
  contact_url  TEXT,
  socials      TEXT,                              -- JSON {x, linkedin, instagram, tiktok, youtube}
  has_video    INTEGER,                           -- 1 / 0 / NULL (не знаем)
  site_desc    TEXT,
  country      TEXT,
  kind         TEXT,                              -- b2c | b2b | other
  score        INTEGER NOT NULL DEFAULT 0,
  reasons      TEXT,
  channel      TEXT,                              -- описание лучшего канала связи
  stage        TEXT NOT NULL DEFAULT 'raw',       -- raw → ready | excluded
  status       TEXT NOT NULL DEFAULT 'new',       -- new | contacted | replied | won | skip
  sent         INTEGER NOT NULL DEFAULT 0,        -- 1 — прислан владельцу
  msg_id       INTEGER,
  contacted_at INTEGER,
  followup_sent INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_stage ON leads (stage, sent, score);
CREATE INDEX IF NOT EXISTS leads_key ON leads (company_key);
