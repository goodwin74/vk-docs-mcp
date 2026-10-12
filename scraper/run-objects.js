/**
 * Парсер объектов VK API Reference (dev.vk.com/ru/reference/objects/...) — автономный, без OpenCode.
 *
 * Использование:
 *   node scraper/run-objects.js index                — собрать список объектов
 *   node scraper/run-objects.js extract --all        — извлечь все объекты
 *   node scraper/run-objects.js extract --limit 10 --offset 0
 *
 * Результат:  vk-docs-mcp/data/vk-objects/<object-id>.json
 * Индекс:     vk-docs-mcp/data/objects-index.json
 *
 * Использует playwright-core + системный браузер (Edge/Chrome), headless.
 * networkidle НЕ используется (счётчики держат соединение) — ждём domcontentloaded + пауза.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT_DIR = path.join(DATA, 'vk-objects');
const INDEX_FILE = path.join(DATA, 'objects-index.json');
const BASE = 'https://dev.vk.com';
const LIST_URL = BASE + '/ru/reference/objects';

async function launch() {
  const channels = ['msedge', 'chrome', 'chrome-beta'];
  let lastErr;
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (e) { lastErr = e; }
  }
  throw new Error('Не найден системный браузер (Edge/Chrome): ' + lastErr.message);
}

function loadIndex() {
  const idx = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) : {};
  if (!idx.objects) idx.objects = [];
  return idx;
}
function saveIndex(index) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function open(page, url) {
  // domcontentloaded на этой SPA может не сработать — ждём первый коммит ответа,
  // затем реальный рендеринг контента (h1).
  await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
  try {
    await page.waitForSelector('main h1, h1', { timeout: 20000 });
    await sleep(800);
  } catch (e) { await sleep(2000); }
}

// ---------- индекс: список объектов ----------
async function indexObjects(page, index) {
  console.log('[index] страница списка объектов...');
  await open(page, LIST_URL);
  const objects = await page.evaluate(() => {
    const T = el => el ? (el.textContent || '').trim().replace(/\s+/g, ' ') : '';
    const out = [];
    const seen = {};
    // контентная часть (не сайдбар): ссылки внутри основного потока статьи
    const links = document.querySelectorAll('a[href^="/ru/reference/objects/"]');
    for (const a of links) {
      const href = a.getAttribute('href');
      const m = href.match(/^\/ru\/reference\/objects\/([a-z0-9-]+)$/i);
      if (!m) continue;
      const id = m[1].toLowerCase();
      if (seen[id]) continue;
      const title = T(a);
      // сайдбарные ссылки короткие и без смысла — интересуют осмысленные названия
      if (!title) continue;
      seen[id] = 1;
      out.push({ id, title, url: 'https://dev.vk.com' + href });
    }
    return out;
  });
  index.objects = objects;
  saveIndex(index);
  console.log(`[index] объектов: ${objects.length}`);
  return objects;
}

// ---------- извлечение страницы объекта ----------
// NOTE: строка должна самовызовываться — page.evaluate ожидает выражение со значением.
const EXTRACT_FN = `(() => {
  const T = el => el ? (el.textContent || '').trim().replace(/\\s+/g, ' ') : '';
  const main = document.querySelector('main') || document.querySelector('article') || document.body;
  const id = (location.pathname.split('/').pop() || '').toLowerCase();
  const url = location.href;
  const title = document.title;
  const h1 = T(main.querySelector('h1') || document.querySelector('h1'));

  // описание: абзацы после h1 до первого h2
  const descParts = [];
  {
    let n = (main.querySelector('h1') || document.querySelector('h1'));
    n = n ? n.nextElementSibling : null;
    while (n && n.tagName && n.tagName !== 'H2' && n.tagName !== 'H3') {
      const t = T(n);
      if (t) descParts.push(t);
      n = n.nextElementSibling;
    }
  }
  const description = descParts.join(' ');

  // Поля объекта: h3 либо h2 (на части страниц поля вложены в h2 вместо h3).
  // Критерий h2-поля: следующий сосед — <p> с <code>-типом в начале.
  // Внутри: <p> с типом (первый <code>) и описание, плюс возможные <ul>/<p> с подполями.
  const fields = [];
  const sectionTitles = [];
  let currentSection = '';
  const heads = [...main.querySelectorAll('h2,h3')];
  for (const h of heads) {
    const codeEl = h.querySelector('code');
    const name = T(codeEl || h).replace(/\\*/g, '');
    if (!name) continue;
    if (h.tagName === 'H2') {
      const nxt = h.nextElementSibling;
      const isField = !!(nxt && nxt.tagName === 'P' && nxt.querySelector('code'));
      if (!isField) { currentSection = name; sectionTitles.push(name); continue; }
    }
    let type = '';
    const descTexts = [];
    let n = h.nextElementSibling;
    while (n && n.tagName && n.tagName !== 'H2' && n.tagName !== 'H3') {
      const t = T(n);
      if (t) {
        if (!type) {
          const c = n.querySelector('code');
          if (c && n.tagName === 'P') {
            type = T(c);
            const rest = t.startsWith(type) ? t.slice(type.length).trim() : t;
            if (rest) descTexts.push(rest);
            n = n.nextElementSibling;
            continue;
          }
        }
        descTexts.push(t);
      }
      n = n.nextElementSibling;
    }
    fields.push({ name, type, section: currentSection, description: descTexts.join(' ') });
  }

  // секции по заголовкам (для contentText)
  const sections = [];
  for (const h of main.querySelectorAll('h2')) {
    const parts = [];
    let n = h.nextElementSibling;
    while (n && n.tagName && n.tagName !== 'H2' && n.tagName !== 'H3') {
      const t = T(n);
      if (t) parts.push(t);
      n = n.nextElementSibling;
    }
    sections.push({ level: 2, title: T(h), text: parts.join(' ').slice(0, 1500) });
  }

  // примеры кода (обычно нет, но на всякий случай)
  const examples = [];
  for (const pre of main.querySelectorAll('pre')) {
    const code = (pre.textContent || '').trim();
    if (code) examples.push({ lang: 'js', code });
  }

  // категория из заголовка вкладки: "Cправочник API | Объекты | <категория> | <название> | VK..."
  const tparts = title.split('|').map(s => s.trim());
  const group = (tparts.length >= 4 && tparts[1] === 'Объекты') ? tparts[2] : '';

  const parts = [];
  if (description) parts.push(description);
  for (const f of fields) parts.push(f.name + (f.type ? ' (' + f.type + ')' : '') + ': ' + f.description);

  return {
    id, url, title, h1, group,
    description,
    fields,
    examples: examples.slice(0, 6),
    sections,
    contentText: parts.join(' ').replace(/\\s+/g, ' ').slice(0, 5000),
  };
})()`;

async function extractPages(browser, items) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let done = 0, skip = 0, fail = 0;

  for (const item of items) {
    const outFile = path.join(OUT_DIR, item.id.toLowerCase() + '.json');
    if (fs.existsSync(outFile)) { skip++; continue; }
    try {
      await open(page, item.url);
      // SPA может рендериться лениво — до 3 попыток
      let data = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        data = await page.evaluate(EXTRACT_FN);
        if (data && data.id && (data.description || data.fields.length)) break;
        await sleep(2000);
      }
      if (data && data.id && (data.description || data.fields.length)) {
        fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
        done++;
        if (done % 10 === 0) console.log(`[extract] +${done} (пропущено ${skip}, ошибок ${fail})`);
      } else {
        fail++;
        console.log(`[extract] ${item.id}: пустой результат`);
      }
    } catch (e) {
      fail++;
      console.log(`[extract] ${item.id}: ОШИБКА ${e.message}`);
    }
    await sleep(300);
  }
  await ctx.close();
  return { done, skip, fail };
}

// ---------- CLI ----------
(async () => {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'help';
  const opt = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) { opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true; }
  }

  if (cmd === 'help') {
    console.log('Команды:');
    console.log('  index                 — собрать индекс объектов со страницы списка');
    console.log('  extract --all         — извлечь все объекты');
    console.log('  extract --limit 10 [--offset 0]');
    return;
  }

  const browser = await launch();
  try {
    const index = loadIndex();

    if (cmd === 'index') {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await indexObjects(page, index);
      await ctx.close().catch(() => {});
      console.log('[index] всего объектов:', index.objects.length);
    } else if (cmd === 'extract') {
      if (!index.objects || !index.objects.length) {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await indexObjects(page, index);
        await ctx.close().catch(() => {});
      }
      let items = index.objects;
      const offset = parseInt(opt.offset || '0', 10);
      const limit = opt.limit ? parseInt(opt.limit, 10) : items.length;
      const slice = items.slice(offset, offset + limit);
      console.log(`[extract] к обработке: ${slice.length} из ${items.length}`);
      const r = await extractPages(browser, slice);
      console.log(`[extract] ГОТОВО: новых ${r.done}, уже было ${r.skip}, ошибок ${r.fail}`);
    } else {
      console.log('Неизвестная команда. Справка: node scraper/run-objects.js help');
    }
  } finally {
    await browser.close();
  }
})();
